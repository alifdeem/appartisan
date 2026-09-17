-- ArtisanGH — 0015 execution and money out (Phase 5)
--
-- The back half of a job: travelling, working, signing off, settling, paying
-- the artisan.
--
--   deposit_paid → en_route → arrived → in_progress
--                → awaiting_signoff → awaiting_balance → paid → closed
--
-- Five decisions worth stating:
--
--  1. **`work_complete` is collapsed into `awaiting_signoff`.** The artisan
--     marking the job done IS what makes it await the client's signature; they
--     are one event, and a status nobody acts on exists only to be logged. Same
--     reasoning that collapsed `assigned` into `quote_pending` in 0011. The
--     enum keeps `work_complete` because removing an enum value is a rewrite,
--     and Phase 6 disputes may yet want it.
--
--  2. **The balance is collected while the artisan is still there.** PLAN.md §4
--     Finding 2: mobile money cannot be charged silently, so "we'll bill you
--     later" is not available. `sign_off_job` therefore lands on
--     `awaiting_balance`, not on `paid`.
--
--  3. **The payout is queued, not paid, by the database.** Moving money out is
--     the payment provider's job; this records the intent and the amount, and
--     the adapter's `transfer` fills in the reference. A payout row that exists
--     before the transfer is attempted is what makes a failed transfer
--     recoverable instead of invisible.
--
--  4. **The remaining cancellation tiers are enforced here** (PLAN.md §7).
--     After `en_route` the client owes the transport fee; after `in_progress`
--     the deposit is forfeited. Both were refused outright until now.
--
--  5. **Every transition is checked against a table, not an if-ladder.** The
--     execution half has eight states and the wrong edge is a job that cannot
--     move. One `case` that lists the legal pairs is auditable at a glance.

-- ---------------------------------------------------------------------------
-- 1. Travel and work
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

  -- The legal edges of the artisan's half of the machine. Anything not listed
  -- is refused, including skipping a step — an artisan who marks "arrived"
  -- without ever going en route has a client watching a map that never moved.
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

  -- Completing the work is the one transition with a precondition beyond the
  -- state: PLAN.md §12 asks for completion photos, and a dispute six weeks
  -- later turns on whether they exist.
  if p_to = 'awaiting_signoff' and not exists (
    select 1 from public.job_photos
    where job_id = p_job_id and stage = 'completion'
  ) then
    raise exception 'Add at least one photo of the finished work before marking it done.'
      using errcode = '22023';
  end if;

  perform set_config('artisangh.job_status_change', 'on', true);

  update public.jobs
     set status       = p_to,
         -- Going on a job takes the artisan out of the matching pool; finishing
         -- does not put them back, because the balance is still to collect.
         availability = availability
   where id = p_job_id;

  if p_to = 'en_route' then
    update public.providers set availability = 'on_job' where profile_id = v_job.provider_id;
  end if;

  perform set_config('artisangh.job_status_change', 'off', true);

  return p_to;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Sign-off
-- ---------------------------------------------------------------------------
-- The signature is stored as opaque text: either a data URL from the drawing
-- pad or a typed full name. WCAG 2.2 requires a single-pointer alternative to
-- any drag operation, and drawing is a drag — so typing a name is not a
-- fallback bolted on, it is the accessible path and is equally binding.

create or replace function public.sign_off_job(
  p_job_id       uuid,
  p_signature    text,
  p_client_notes text default null
)
returns public.job_status
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.jobs;
begin
  select * into v_job from public.jobs where id = p_job_id for update;

  if v_job.id is null then
    raise exception 'Job not found.' using errcode = 'P0002';
  end if;

  if v_job.client_id is distinct from auth.uid() then
    raise exception 'That is not your job.' using errcode = '42501';
  end if;

  if v_job.status <> 'awaiting_signoff' then
    raise exception 'This job is not waiting to be signed off.' using errcode = '22023';
  end if;

  if length(coalesce(trim(p_signature), '')) < 2 then
    raise exception 'Sign your name to approve the work.' using errcode = '22023';
  end if;

  insert into public.signoffs (job_id, signature_data, client_notes)
  values (p_job_id, p_signature, nullif(trim(coalesce(p_client_notes, '')), ''))
  on conflict (job_id) do update
    set signature_data = excluded.signature_data,
        client_notes   = excluded.client_notes,
        signed_at      = now();

  perform set_config('artisangh.job_status_change', 'on', true);
  update public.jobs set status = 'awaiting_balance' where id = p_job_id;
  perform set_config('artisangh.job_status_change', 'off', true);

  return 'awaiting_balance'::public.job_status;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. What is left to pay
-- ---------------------------------------------------------------------------

create or replace function public.balance_due_for_job(p_job_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_job    public.jobs;
  v_quote  public.quotes;
  v_amount numeric(12,2);
begin
  select * into v_job from public.jobs where id = p_job_id;

  if v_job.id is null then
    raise exception 'Job not found.' using errcode = 'P0002';
  end if;

  if v_job.client_id is distinct from auth.uid()
     and v_job.provider_id is distinct from auth.uid()
     and not public.is_admin()
     and auth.uid() is not null then
    raise exception 'That is not your job.' using errcode = '42501';
  end if;

  select * into v_quote
  from public.quotes
  where job_id = p_job_id and status = 'accepted'
  order by responded_at desc nulls last
  limit 1;

  if v_quote.id is null then
    raise exception 'No accepted price on this job.' using errcode = '22023';
  end if;

  -- Everything agreed, less everything already banked. Derived rather than
  -- stored so a partial refund or a reconciled duplicate cannot leave the
  -- balance quietly wrong.
  v_amount := (v_quote.total + v_quote.transport_fee) - coalesce((
    select sum(amount) from public.payments
    where job_id = p_job_id and status = 'succeeded'
  ), 0);

  return greatest(v_amount, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Settling the balance, and queuing the payout
-- ---------------------------------------------------------------------------
-- Replaces the 0013 definition. Same guard, same idempotency; the balance leg
-- now completes the job and records what the artisan is owed.

create or replace function public.settle_payment(
  p_reference text,
  p_succeeded boolean,
  p_reason    text default null,
  p_channel   text default null
)
returns public.job_status
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payments;
  v_job     public.jobs;
  v_quote   public.quotes;
  v_payout  numeric(12,2);
begin
  if not public.is_trusted_backend() then
    raise exception 'Payments are settled by the payment provider, not by callers.'
      using errcode = '42501';
  end if;

  select * into v_payment
  from public.payments
  where provider_reference = p_reference
  for update;

  if v_payment.id is null then
    return null;
  end if;

  select * into v_job from public.jobs where id = v_payment.job_id for update;

  if v_payment.status = 'succeeded' then
    return v_job.status;
  end if;

  if not p_succeeded then
    update public.payments
       set status         = 'failed',
           failure_reason = coalesce(p_reason, 'Payment failed')
     where id = v_payment.id;

    return v_job.status;
  end if;

  update public.payments
     set status         = 'succeeded',
         paid_at        = now(),
         channel        = coalesce(p_channel, channel),
         failure_reason = null
   where id = v_payment.id;

  perform set_config('artisangh.job_status_change', 'on', true);

  if v_payment.leg = 'deposit' and v_job.status = 'awaiting_deposit' then
    update public.jobs set status = 'deposit_paid' where id = v_job.id;
    perform set_config('artisangh.job_status_change', 'off', true);
    return 'deposit_paid'::public.job_status;
  end if;

  if v_payment.leg = 'balance' and v_job.status = 'awaiting_balance' then
    update public.jobs set status = 'paid' where id = v_job.id;

    -- The artisan is free to take work again the moment the money is in.
    update public.providers
       set availability = 'online'
     where profile_id = v_job.provider_id and availability = 'on_job';

    select * into v_quote
    from public.quotes
    where job_id = v_job.id and status = 'accepted'
    order by responded_at desc nulls last
    limit 1;

    -- Their quote plus the whole transport fee. The platform's 12% is the only
    -- thing it keeps, and transport passes through untouched (PLAN.md §4).
    v_payout := coalesce(v_quote.subtotal, 0) + coalesce(v_quote.transport_fee, 0);

    -- Queued, not paid. `transfer` is the adapter's job; this row is what makes
    -- a failed transfer recoverable rather than invisible.
    if v_payout > 0 and v_job.provider_id is not null then
      insert into public.payouts (job_id, provider_id, amount, status, is_simulated)
      values (v_job.id, v_job.provider_id, v_payout, 'pending', true)
      on conflict do nothing;
    end if;

    perform set_config('artisangh.job_status_change', 'off', true);
    return 'paid'::public.job_status;
  end if;

  perform set_config('artisangh.job_status_change', 'off', true);
  return v_job.status;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Closing
-- ---------------------------------------------------------------------------
-- A paid job closes when the client rates it, or automatically after seven days
-- (PLAN.md §6). Ratings are Phase 6; the auto-close half works now.

create or replace function public.close_job(p_job_id uuid)
returns public.job_status
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.jobs;
begin
  select * into v_job from public.jobs where id = p_job_id for update;

  if v_job.id is null then
    raise exception 'Job not found.' using errcode = 'P0002';
  end if;

  if v_job.client_id is distinct from auth.uid()
     and not public.is_admin()
     and not public.is_trusted_backend() then
    raise exception 'That is not your job.' using errcode = '42501';
  end if;

  if v_job.status <> 'paid' then
    raise exception 'Only a paid job can be closed.' using errcode = '22023';
  end if;

  perform set_config('artisangh.job_status_change', 'on', true);
  update public.jobs set status = 'closed', closed_at = now() where id = p_job_id;
  perform set_config('artisangh.job_status_change', 'off', true);

  return 'closed'::public.job_status;
end;
$$;

create or replace function public.auto_close_paid_jobs(p_after_days int default 7)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id    uuid;
  v_count int := 0;
begin
  if not public.is_trusted_backend() then
    raise exception 'Auto-close is run by the platform.' using errcode = '42501';
  end if;

  for v_id in
    select id from public.jobs
    where status = 'paid'
      and updated_at < now() - make_interval(days => p_after_days)
  loop
    perform public.close_job(v_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. The rest of the cancellation ladder
-- ---------------------------------------------------------------------------
-- PLAN.md §7 in full. Replaces the 0014 definition, which refused everything
-- past `deposit_paid`.
--
--   before deposit                 client pays nothing
--   after deposit, before travel   nothing — full refund
--   after en_route, before work    the transport fee only
--   after in_progress              the deposit is forfeited
--
-- A partial refund is expressed by refunding the deposit and recording what is
-- retained on the audit row, rather than by editing the payment's amount — the
-- amount is what the provider charged, and rewriting it would make our ledger
-- disagree with theirs.

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

  if v_job.status in ('draft', 'posted', 'matching', 'offer_sent', 'unmatched',
                      'assigned', 'quote_pending', 'quote_sent', 'awaiting_deposit') then
    v_tier := 'nothing_paid';

  elsif v_job.status = 'deposit_paid' then
    v_tier     := 'full_refund';
    v_refunded := public.refund_job_payments(p_job_id, coalesce(p_reason, 'Cancelled before travel'));

  elsif v_job.status in ('en_route', 'arrived') then
    -- The artisan is already travelling, so their journey is paid for. The rest
    -- of the deposit goes back.
    v_tier     := 'transport_retained';
    v_retained := coalesce(v_quote.transport_fee, 0);
    v_refunded := public.refund_job_payments(
      p_job_id,
      format('Cancelled after the artisan set out — GHS %s transport retained', v_retained)
    );

  else
    -- in_progress, awaiting_signoff, awaiting_balance: work has been done.
    v_tier     := 'deposit_forfeited';
    v_retained := coalesce(v_quote.deposit_amount, 0);
  end if;

  update public.jobs
     set status    = 'cancelled_by_client',
         closed_at = now()
   where id = p_job_id;

  -- Whatever happens to the money, the artisan goes back in the pool.
  if v_job.provider_id is not null then
    update public.providers
       set availability = 'online'
     where profile_id = v_job.provider_id and availability = 'on_job';
  end if;

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

-- ---------------------------------------------------------------------------
-- 7. Grants
-- ---------------------------------------------------------------------------
-- Revoked from anon and authenticated BY NAME. A revoke from PUBLIC alone does
-- nothing here — Supabase's default privileges grant these explicitly (0013).

do $$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    'public.settle_payment(text, boolean, text, text)',
    'public.auto_close_paid_jobs(int)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', v_signature);
  end loop;
end;
$$;

revoke all on function public.advance_job_execution(uuid, public.job_status) from public, anon;
revoke all on function public.sign_off_job(uuid, text, text) from public, anon;
revoke all on function public.balance_due_for_job(uuid) from public, anon;
revoke all on function public.close_job(uuid) from public, anon;

grant execute on function public.advance_job_execution(uuid, public.job_status) to authenticated;
grant execute on function public.sign_off_job(uuid, text, text) to authenticated;
grant execute on function public.balance_due_for_job(uuid) to authenticated;
grant execute on function public.close_job(uuid) to authenticated;
