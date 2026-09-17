-- ArtisanGH — 0017 let the platform move an artisan's availability
--
-- `guard_providers_columns` (0008) forbids anyone but an admin from writing
-- `availability = 'on_job'`, and forbids changing availability at all while it
-- is `on_job`. Both rules are right and both were written when nothing could
-- put an artisan on a job — Phase 2 had no jobs to be on.
--
-- Phase 5 does. Three platform paths now need to move that column while the
-- caller is an ordinary user:
--
--   advance_job_execution   artisan sets out      → on_job
--   settle_payment          balance lands         → online
--   cancel_job              job called off        → online
--
-- `settle_payment` runs as the service role, where `auth.uid()` is null and the
-- guard returns early, so it was never blocked. The other two are called by the
-- artisan and the client respectively, and both were.
--
-- The fix is the escape hatch the verification rules already use — the
-- transaction-local `artisangh.provider_status_change` flag, settable only
-- inside SECURITY DEFINER functions. The artisan still cannot type `on_job`
-- into their own row; only a platform transition can.

create or replace function public.guard_providers_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.profile_id is distinct from old.profile_id then
    raise exception 'providers.profile_id is immutable' using errcode = '42501';
  end if;

  if public.is_admin() then
    return new;
  end if;

  if new.verification_status is distinct from old.verification_status
     and not public.provider_status_change_permitted() then
    raise exception 'Verification status is set by an administrator, not by you.'
      using errcode = '42501';
  end if;

  -- CHANGED in 0017. An artisan may still only put themselves online or
  -- offline, and still cannot touch it mid-job — but a platform transition
  -- that has opened the flag may do both, because going on a job and coming
  -- off one are consequences of the job moving, not choices the artisan makes.
  if new.availability is distinct from old.availability
     and not public.provider_status_change_permitted() then
    if new.availability = 'on_job' then
      raise exception 'Job status is set by the platform, not by you.' using errcode = '42501';
    end if;

    if old.availability = 'on_job' then
      raise exception 'You cannot change your availability during a job.' using errcode = '42501';
    end if;

    if new.availability = 'online' and new.verification_status <> 'approved' then
      raise exception 'You can go online once your account has been approved.'
        using errcode = '42501';
    end if;
  end if;

  if new.suspended_at      is distinct from old.suspended_at
     or new.suspension_reason is distinct from old.suspension_reason then
    raise exception 'Suspension is set by an administrator.' using errcode = '42501';
  end if;

  if new.rating_avg     is distinct from old.rating_avg
     or new.rating_count  is distinct from old.rating_count
     or new.jobs_completed is distinct from old.jobs_completed then
    raise exception 'Reputation figures are derived, not editable.' using errcode = '42501';
  end if;

  if new.payout_recipient_code is distinct from old.payout_recipient_code then
    raise exception 'Payout details are set by the platform.' using errcode = '42501';
  end if;

  if new.ghana_card_number is distinct from old.ghana_card_number
     and old.verification_status in ('pending', 'approved', 'suspended') then
    raise exception 'Your Ghana Card number cannot be changed while your account is under review.'
      using errcode = '42501';
  end if;

  if new.application_submitted_at is distinct from old.application_submitted_at
     and not public.provider_status_change_permitted() then
    raise exception 'Submission time is recorded by the platform.' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- The two callers that now open the flag
-- ---------------------------------------------------------------------------

create or replace function public.advance_job_execution(
  p_job_id uuid,
  p_to     public.job_status
)
returns public.job_status
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job   public.jobs;
  v_legal boolean;
begin
  select * into v_job from public.jobs where id = p_job_id for update;

  if v_job.id is null then
    raise exception 'Job not found.' using errcode = 'P0002';
  end if;

  if v_job.provider_id is distinct from auth.uid() and not public.is_admin() then
    raise exception 'That is not your job.' using errcode = '42501';
  end if;

  v_legal := case
    when v_job.status = 'deposit_paid'  and p_to = 'en_route'         then true
    when v_job.status = 'en_route'      and p_to = 'arrived'          then true
    when v_job.status = 'arrived'       and p_to = 'in_progress'      then true
    when v_job.status = 'in_progress'   and p_to = 'awaiting_signoff' then true
    else false
  end;

  if not v_legal then
    raise exception 'A job cannot go from % to %.', v_job.status, p_to
      using errcode = '22023';
  end if;

  if p_to = 'awaiting_signoff' and not exists (
    select 1 from public.job_photos
    where job_id = p_job_id and stage = 'completion'
  ) then
    raise exception 'Add at least one photo of the finished work before marking it done.'
      using errcode = '22023';
  end if;

  perform set_config('artisangh.job_status_change', 'on', true);
  perform set_config('artisangh.provider_status_change', 'on', true);

  update public.jobs set status = p_to where id = p_job_id;

  if p_to = 'en_route' and v_job.provider_id is not null then
    update public.providers
       set availability = 'on_job'
     where profile_id = v_job.provider_id;
  end if;

  perform set_config('artisangh.provider_status_change', 'off', true);
  perform set_config('artisangh.job_status_change', 'off', true);

  return p_to;
end;
$$;

create or replace function public.cancel_job(p_job_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job       public.jobs;
  v_quote     public.quotes;
  v_refunded  int := 0;
  v_retained  numeric(12,2) := 0;
  v_tier      text;
begin
  select * into v_job from public.jobs where id = p_job_id for update;

  if v_job.id is null then
    raise exception 'Job not found.' using errcode = 'P0002';
  end if;

  if v_job.client_id is distinct from auth.uid() and not public.is_admin() then
    raise exception 'That is not your job.' using errcode = '42501';
  end if;

  if v_job.status in ('paid', 'closed', 'cancelled_by_client', 'cancelled_by_provider',
                      'expired_no_match', 'disputed') then
    raise exception 'This job is already finished.' using errcode = '22023';
  end if;

  select * into v_quote
  from public.quotes
  where job_id = p_job_id and status = 'accepted'
  order by responded_at desc nulls last
  limit 1;

  perform set_config('artisangh.job_status_change', 'on', true);
  perform set_config('artisangh.provider_status_change', 'on', true);

  -- PLAN.md §7, in full.
  if v_job.status in ('draft', 'posted', 'matching', 'offer_sent', 'unmatched',
                      'assigned', 'quote_pending', 'quote_sent', 'awaiting_deposit') then
    v_tier := 'nothing_paid';

  elsif v_job.status = 'deposit_paid' then
    v_tier     := 'full_refund';
    v_refunded := public.refund_job_payments(p_job_id, coalesce(p_reason, 'Cancelled before travel'));

  elsif v_job.status in ('en_route', 'arrived') then
    -- The artisan is already travelling, so their journey is paid for.
    v_tier     := 'transport_retained';
    v_retained := coalesce(v_quote.transport_fee, 0);
    v_refunded := public.refund_job_payments(
      p_job_id,
      format('Cancelled after the artisan set out — GHS %s transport retained', v_retained)
    );

  else
    -- in_progress and beyond: work has been done, the deposit is forfeited.
    v_tier     := 'deposit_forfeited';
    v_retained := coalesce(v_quote.deposit_amount, 0);
  end if;

  update public.jobs
     set status    = 'cancelled_by_client',
         closed_at = now()
   where id = p_job_id;

  if v_job.provider_id is not null then
    update public.providers
       set availability = 'online'
     where profile_id = v_job.provider_id and availability = 'on_job';
  end if;

  perform set_config('artisangh.provider_status_change', 'off', true);
  perform set_config('artisangh.job_status_change', 'off', true);

  update public.job_events
     set reason   = coalesce(p_reason, 'Cancelled'),
         metadata = metadata || jsonb_build_object(
           'tier', v_tier,
           'refunded_payments', v_refunded,
           'retained_ghs', v_retained
         )
   where job_id = p_job_id
     and to_status = 'cancelled_by_client'
     and created_at > now() - interval '1 minute';
end;
$$;

revoke all on function public.advance_job_execution(uuid, public.job_status) from public, anon;
grant execute on function public.advance_job_execution(uuid, public.job_status) to authenticated;
