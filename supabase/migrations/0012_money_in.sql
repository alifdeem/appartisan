-- ArtisanGH — 0012 money in (Phase 4)
--
-- The deposit leg: awaiting_deposit → deposit_paid, and every way that fails.
--
-- Five things this file has to get right:
--
--  1. **A retry must be possible.** `payments` carried `unique (job_id, leg)`,
--     which means the first failed deposit permanently blocks the second
--     attempt — and a declined MoMo prompt is the single most common real-world
--     path, not an edge case. That becomes a PARTIAL unique index on
--     `status = 'succeeded'`: as many attempts as the client needs, exactly one
--     success, and the failed attempts stay on the record where a dispute can
--     find them.
--
--  2. **The amount comes from the accepted quote.** Never from the browser,
--     never recomputed in TypeScript at the moment of charging. `save_quote`
--     already derived and stored `deposit_amount`; this reads that row back.
--
--  3. **The webhook is the only thing that moves money forward.** Not the
--     callback screen, not the client tapping "I paid". `settle_payment()` is
--     the one door, it is idempotent by reference, and it advances the job in
--     the same transaction as the payment row.
--
--  4. **Cancellation after a deposit must refund.** PLAN.md §7 makes this a
--     tiered, auto-enforced policy. `cancel_job` refused everything past
--     `assigned`, which was right when nothing could be paid and is wrong now.
--
--  5. **Out-of-order and duplicate delivery are normal.** Providers retry, and
--     a webhook can arrive twice or arrive for a charge we already reconciled
--     by polling. Every function here is written to be run again safely.

-- ---------------------------------------------------------------------------
-- 1. Let a client try again
-- ---------------------------------------------------------------------------

alter table public.payments drop constraint if exists payments_job_id_leg_key;

-- The invariant that actually matters: a job can never have two successful
-- deposits, or two successful balances. Attempts are free.
create unique index if not exists payments_one_success_per_leg_idx
  on public.payments (job_id, leg)
  where status = 'succeeded';

-- Finding a client's live attempt, and the reconciliation sweep, both read this.
create index if not exists payments_pending_idx
  on public.payments (status, created_at)
  where status in ('pending', 'processing');

comment on index public.payments_one_success_per_leg_idx is
  'Replaces unique(job_id, leg) from 0001, which blocked a retry after a declined MoMo prompt.';

-- ---------------------------------------------------------------------------
-- 2. What is owed
-- ---------------------------------------------------------------------------
-- Read from the accepted quote rather than recomputed. The quote is the
-- agreement; recomputing it at charge time means a settings change between
-- acceptance and payment silently alters what somebody agreed to pay.

create or replace function public.deposit_due_for_job(p_job_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_job    public.jobs;
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

  select q.deposit_amount into v_amount
  from public.quotes q
  where q.job_id = p_job_id and q.status = 'accepted'
  order by q.responded_at desc nulls last
  limit 1;

  if v_amount is null then
    raise exception 'No accepted price on this job yet.' using errcode = '22023';
  end if;

  return v_amount;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. The one door money comes through
-- ---------------------------------------------------------------------------
-- Called by the webhook handler holding the service role. Deliberately NOT
-- granted to end users: a client who could call this could mark their own
-- deposit paid, which is the entire security model gone.
--
-- Returns the job status afterwards so the caller can log what it did.

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
begin
  select * into v_payment
  from public.payments
  where provider_reference = p_reference
  for update;

  if v_payment.id is null then
    -- Not an error. A provider can deliver an event for a reference we never
    -- recorded (a test ping, a charge started against another environment), and
    -- answering 500 makes them retry it on a schedule for days.
    return null;
  end if;

  select * into v_job from public.jobs where id = v_payment.job_id for update;

  -- Idempotency. Providers retry, and a second delivery of a success we have
  -- already banked must not re-run the state change.
  if v_payment.status = 'succeeded' then
    return v_job.status;
  end if;

  if not p_succeeded then
    update public.payments
       set status         = 'failed',
           failure_reason = coalesce(p_reason, 'Payment failed')
     where id = v_payment.id;

    -- The job does NOT move. It stays in `awaiting_deposit` so the client can
    -- try again — which is the whole point of the partial index above.
    return v_job.status;
  end if;

  update public.payments
     set status         = 'succeeded',
         paid_at        = now(),
         channel        = coalesce(p_channel, channel),
         failure_reason = null
   where id = v_payment.id;

  -- Only the deposit leg moves the job in Phase 4. The balance leg lands in
  -- Phase 5, where it sits between `awaiting_balance` and `paid`.
  if v_payment.leg = 'deposit' and v_job.status = 'awaiting_deposit' then
    perform set_config('artisangh.job_status_change', 'on', true);
    update public.jobs set status = 'deposit_paid' where id = v_job.id;
    perform set_config('artisangh.job_status_change', 'off', true);

    return 'deposit_paid'::public.job_status;
  end if;

  return v_job.status;
end;
$$;

comment on function public.settle_payment is
  'The only function that may mark a payment succeeded. Idempotent by reference. Called by the webhook handler under the service role — never granted to end users.';

-- ---------------------------------------------------------------------------
-- 4. Refunds
-- ---------------------------------------------------------------------------

create or replace function public.refund_job_payments(
  p_job_id uuid,
  p_reason text default null
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  -- Because the platform holds the gross and pays artisans separately
  -- (PLAN.md §4 Finding 1), a refund is a clean reversal of our own charge.
  -- Nothing has been split away to claw back.
  update public.payments
     set status         = 'refunded',
         failure_reason = coalesce(p_reason, 'Refunded')
   where job_id = p_job_id
     and status = 'succeeded';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Cancelling once money is involved
-- ---------------------------------------------------------------------------
-- PLAN.md §7, auto-enforced. Phase 4 reaches `deposit_paid`; `en_route` and
-- everything past it arrives in Phase 5, and this refuses those rather than
-- pretending to handle them.
--
--   before deposit                    client pays nothing
--   after deposit, before en_route    nothing — full refund
--   after en_route                    Phase 5
--
-- Replaces the 0007 definition, which refused everything past `assigned`.

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

  -- Free tier: nothing succeeded, so there is nothing to give back.
  -- Refund tier: the deposit is returned in full, because nobody has travelled.
  if v_job.status = 'deposit_paid' then
    v_refunded := public.refund_job_payments(
      p_job_id,
      coalesce(p_reason, 'Cancelled before the artisan travelled')
    );
  end if;

  perform set_config('artisangh.job_status_change', 'on', true);

  update public.jobs
     set status    = 'cancelled_by_client',
         closed_at = now()
   where id = p_job_id;

  perform set_config('artisangh.job_status_change', 'off', true);

  -- The reason lands on the audit row the status trigger writes, so a dispute
  -- six weeks later can see both the cancellation and the refund that followed.
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

-- ---------------------------------------------------------------------------
-- 6. Reconciliation
-- ---------------------------------------------------------------------------
-- A charge that was initialised and never heard about again is the failure mode
-- PLAN.md §13 calls out: the webhook did not arrive, or arrived and was lost.
-- This finds them so a sweep can re-verify against the provider.
--
-- Nothing is *decided* here. Deciding from a timeout would mean guessing at
-- somebody's money; the sweep asks the provider and then calls settle_payment.

create or replace function public.stale_pending_payments(p_older_than_minutes int default 15)
returns table (
  payment_id         uuid,
  job_id             uuid,
  provider_reference text,
  leg                public.payment_leg,
  amount             numeric,
  created_at         timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.job_id, p.provider_reference, p.leg, p.amount, p.created_at
  from public.payments p
  where p.status in ('pending', 'processing')
    and p.created_at < now() - make_interval(mins => p_older_than_minutes)
  order by p.created_at;
$$;

-- ---------------------------------------------------------------------------
-- 7. Grants
-- ---------------------------------------------------------------------------
-- Revoked from PUBLIC first — Postgres grants EXECUTE to PUBLIC by default, so
-- a bare grant to `authenticated` excludes nobody (the lesson of 0010).

revoke execute on function public.deposit_due_for_job(uuid) from public;
revoke execute on function public.settle_payment(text, boolean, text, text) from public;
revoke execute on function public.refund_job_payments(uuid, text) from public;
revoke execute on function public.stale_pending_payments(int) from public;

-- The only one an end user may call: "what do I owe?", scoped to their own job.
grant execute on function public.deposit_due_for_job(uuid) to authenticated;

-- settle_payment, refund_job_payments and stale_pending_payments are
-- deliberately ungranted. They run under the service role, from the webhook
-- handler and the reconciliation sweep. A client who could reach settle_payment
-- could mark their own deposit paid.
