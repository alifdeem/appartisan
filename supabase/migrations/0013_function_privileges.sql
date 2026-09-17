-- ArtisanGH — 0013 function privileges
--
-- **A `revoke ... from public` on a Supabase project does almost nothing, and
-- three migrations have now relied on it.**
--
-- Supabase ships the `public` schema with default privileges:
--
--   alter default privileges in schema public
--     grant execute on functions to anon, authenticated, service_role;
--
-- So every function created here is born with EXPLICIT grants to `anon` and
-- `authenticated`. `revoke ... from public` removes only the PUBLIC pseudo-role
-- grant and leaves those two untouched. 0010 introduced that pattern believing
-- it closed the door; 0011 and 0012 copied it.
--
-- What that actually meant, verified against the live database with an
-- anonymous key:
--
--   anon -> settle_payment       EXECUTED
--   anon -> refund_job_payments  EXECUTED
--   anon -> expire_stale_offers  EXECUTED
--   anon -> advance_matching     reached the body (failed only on a bad job id)
--
-- `settle_payment` had no internal authority check at all, because the grant
-- was believed to be the control. Anyone holding the publishable key and a
-- payment reference could mark a deposit paid. That is the whole security model
-- of the money path, gone.
--
-- Two fixes, because either alone is one mistake away from reopening it:
--
--   1. Revoke from `anon` and `authenticated` BY NAME, not from PUBLIC.
--   2. Give every privileged function an internal caller check, so a future
--      `create or replace` — which resets nothing but is easy to pair with a
--      forgotten revoke — cannot silently re-expose it.

-- ---------------------------------------------------------------------------
-- 1. Who is a trusted backend caller?
-- ---------------------------------------------------------------------------
-- `auth.uid() is null` is NOT the answer, and that is the trap 0009 fell into:
-- an anonymous PostgREST request also has a null uid. The role claim is what
-- separates them.
--
--   service_role   the webhook handler and the cron route
--   postgres       pg_cron, psql, migrations — no JWT at all
--   anon           an unauthenticated browser
--   authenticated  a signed-in user
--
-- Absent claims default to 'postgres' so a direct database connection (which is
-- how pg_cron runs `expire_stale_offers`) stays trusted.

create or replace function public.is_trusted_backend()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    'postgres'
  ) in ('service_role', 'postgres');
$$;

comment on function public.is_trusted_backend is
  'True for the service role and for direct database connections (pg_cron, psql). False for anon and authenticated — unlike auth.uid() is null, which is true for anon too.';

-- ---------------------------------------------------------------------------
-- 2. Internal guards on the functions that move money
-- ---------------------------------------------------------------------------

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
  -- NEW in 0013. This function is the only thing that may mark money received;
  -- it is called by the webhook handler under the service role and by nothing
  -- else. The grant below is the primary control and this is the backstop.
  if not public.is_trusted_backend() then
    raise exception 'Payments are settled by the payment provider, not by callers.'
      using errcode = '42501';
  end if;

  select * into v_payment
  from public.payments
  where provider_reference = p_reference
  for update;

  if v_payment.id is null then
    -- Not an error. A provider can deliver an event for a reference we never
    -- recorded (a test ping, a charge from another environment), and answering
    -- 500 makes them retry it on a schedule for days.
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
    -- try again, which is what the partial unique index in 0012 exists for.
    return v_job.status;
  end if;

  update public.payments
     set status         = 'succeeded',
         paid_at        = now(),
         channel        = coalesce(p_channel, channel),
         failure_reason = null
   where id = v_payment.id;

  if v_payment.leg = 'deposit' and v_job.status = 'awaiting_deposit' then
    perform set_config('artisangh.job_status_change', 'on', true);
    update public.jobs set status = 'deposit_paid' where id = v_job.id;
    perform set_config('artisangh.job_status_change', 'off', true);

    return 'deposit_paid'::public.job_status;
  end if;

  return v_job.status;
end;
$$;

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
  -- Callable from `cancel_job`, which is SECURITY DEFINER and runs with the
  -- cancelling client's JWT — so a plain trusted-backend check would break the
  -- legitimate path. An admin may also refund directly.
  if not (public.is_trusted_backend() or public.is_admin() or public.job_status_change_permitted()) then
    raise exception 'Refunds are issued by the platform.' using errcode = '42501';
  end if;

  -- Because the platform holds the gross and pays artisans separately
  -- (PLAN.md §4 Finding 1), a refund is a clean reversal of our own charge.
  update public.payments
     set status         = 'refunded',
         failure_reason = coalesce(p_reason, 'Refunded')
   where job_id = p_job_id
     and status = 'succeeded';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.expire_stale_offers()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job_id uuid;
  v_count  int := 0;
begin
  if not public.is_trusted_backend() then
    raise exception 'The offer sweep is run by the platform.' using errcode = '42501';
  end if;

  update public.job_offers
     set status = 'expired', responded_at = now()
   where status = 'pending' and expires_at <= now();

  get diagnostics v_count = row_count;

  for v_job_id in
    select j.id
    from public.jobs j
    where j.status in ('posted', 'matching', 'offer_sent')
      and not exists (
        select 1 from public.job_offers o
        where o.job_id = j.id and o.status = 'pending' and o.expires_at > now()
      )
  loop
    -- One job's failure must not strand the rest of the queue.
    begin
      perform public.advance_matching(v_job_id);
    exception when others then
      raise warning 'advance_matching failed for job %: %', v_job_id, sqlerrm;
    end;
  end loop;

  return v_count;
end;
$$;

create or replace function public.stale_pending_payments(p_older_than_minutes int default 15)
returns table (
  payment_id         uuid,
  job_id             uuid,
  provider_reference text,
  leg                public.payment_leg,
  amount             numeric,
  created_at         timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_trusted_backend() or public.is_admin()) then
    raise exception 'That is not yours to read.' using errcode = '42501';
  end if;

  return query
    select p.id, p.job_id, p.provider_reference, p.leg, p.amount, p.created_at
    from public.payments p
    where p.status in ('pending', 'processing')
      and p.created_at < now() - make_interval(mins => p_older_than_minutes)
    order by p.created_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Revoke by name
-- ---------------------------------------------------------------------------
-- The part 0010, 0011 and 0012 all got wrong. `anon` and `authenticated` hold
-- their grants explicitly, courtesy of Supabase's default privileges, so they
-- have to be named.

do $$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    -- Money. Nothing outside the backend may reach these.
    'public.settle_payment(text, boolean, text, text)',
    'public.refund_job_payments(uuid, text)',
    'public.stale_pending_payments(int)',
    -- Matching internals. A client who could call advance_matching directly
    -- could burn through their own job's candidate list.
    'public.advance_matching(uuid)',
    'public.expire_stale_offers()',
    -- Guard predicates and settings readers. Harmless to read, but there is no
    -- reason for a browser to hold EXECUTE on them.
    'public.job_status_change_permitted()',
    'public.provider_status_change_permitted()',
    'public.setting_int(text, int)',
    'public.matching_radius_for_pass(int)',
    'public.matching_pass_count()'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', v_signature);
  end loop;
end;
$$;

-- `is_trusted_backend` is a read-only predicate about the CALLER, so it tells a
-- browser nothing it does not already know about itself. Left readable rather
-- than revoked, because the guards above call it and clarity beats ceremony.

-- ---------------------------------------------------------------------------
-- 4. Stop the next one
-- ---------------------------------------------------------------------------
-- Future functions are still born granted to anon and authenticated. Changing
-- the schema-wide default would silently break every RPC the app relies on, so
-- the rule stays "revoke by name" — enforced by scripts/verify.ts, which now
-- asserts that an anonymous caller is refused by each function above.

comment on function public.is_trusted_backend is
  'True for service_role and direct database connections. See 0013: a revoke from PUBLIC does not remove Supabase''s default grants to anon and authenticated — revoke those by name.';
