-- ArtisanGH — 0014 cancel/refund ordering
--
-- 0013 gave `refund_job_payments` an internal caller check, and one of the
-- accepted callers is "we are already inside a platform state transition",
-- signalled by the transaction-local flag `artisangh.job_status_change`.
--
-- `cancel_job` (0012) refunds BEFORE it opens that flag, so the guard fired on
-- the one path it was written to allow: a client cancelling a paid job got
-- "Refunds are issued by the platform." and the deposit stayed banked.
--
-- The fix is the ordering, not the guard. The flag now opens at the top of the
-- cancellation, which is also more honest about what it means — everything
-- between the two `set_config` calls is the platform acting, and the refund is
-- part of that, not a preamble to it.

create or replace function public.cancel_job(p_job_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job      public.jobs;
  v_refunded int := 0;
begin
  select * into v_job from public.jobs where id = p_job_id for update;

  if v_job.id is null then
    raise exception 'Job not found.' using errcode = 'P0002';
  end if;

  if v_job.client_id is distinct from auth.uid() and not public.is_admin() then
    raise exception 'That is not your job.' using errcode = '42501';
  end if;

  if v_job.status not in (
    'draft', 'posted', 'matching', 'offer_sent', 'unmatched', 'assigned',
    'quote_pending', 'quote_sent', 'awaiting_deposit', 'deposit_paid'
  ) then
    raise exception 'Your artisan is already on the way. Call support to cancel this one.'
      using errcode = '22023';
  end if;

  -- Opened first, and held across both writes. Everything from here to the
  -- matching close is the platform acting on the client's instruction.
  perform set_config('artisangh.job_status_change', 'on', true);

  -- PLAN.md §7. Before a deposit nothing was taken, so nothing comes back;
  -- after one, the whole thing does, because nobody has travelled yet. Clean
  -- only because the platform holds the gross rather than splitting at charge
  -- time (§4 Finding 1).
  if v_job.status = 'deposit_paid' then
    v_refunded := public.refund_job_payments(
      p_job_id,
      coalesce(p_reason, 'Cancelled before the artisan travelled')
    );
  end if;

  update public.jobs
     set status    = 'cancelled_by_client',
         closed_at = now()
   where id = p_job_id;

  perform set_config('artisangh.job_status_change', 'off', true);

  -- The reason lands on the audit row the status trigger just wrote, so a
  -- dispute later sees both the cancellation and the refund that followed it.
  if p_reason is not null or v_refunded > 0 then
    update public.job_events
       set reason   = coalesce(p_reason, 'Cancelled'),
           metadata = metadata || jsonb_build_object('refunded_payments', v_refunded)
     where job_id = p_job_id
       and to_status = 'cancelled_by_client'
       and created_at > now() - interval '1 minute';
  end if;
end;
$$;
