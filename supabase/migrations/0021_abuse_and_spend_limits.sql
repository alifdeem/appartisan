-- ArtisanGH — 0021 OTP abuse limits and the SMS spend cap
--
-- PLAN.md §13 carries one risk marked High for after launch:
--
--   "SMS costs run away, or OTP endpoint gets pumped — Rate limit per number
--    AND PER IP, daily spend cap, alerts."
--
-- Half of that shipped in Phase 0. `issueOtp` enforces a 60-second resend
-- cooldown and six sends per hour, both keyed on the phone number. The other
-- half did not:
--
--   • Per IP, nothing. `otp_challenges.created_ip` has been written since
--     Phase 0 and read by nothing. Six per number is not a limit when an
--     attacker supplies the numbers — every valid Ghanaian mobile prefix is
--     public, so one host can walk 0241234567 upward and pay for an SMS on
--     every step. The per-number limit never fires because each number is
--     only asked for once.
--
--   • No spend cap at all. `notifications_log.cost` has been recorded
--     faithfully on every simulated message, which was the point (a real
--     budget figure before go-live) — but nothing ever reads the column, so
--     there is no number at which sending stops.
--
-- Both live in the database rather than in `otp.ts`. The TypeScript is the
-- only caller today; it will not be the only caller after the Phase 2 native
-- app, and a limit that exists in one client is not a limit.

-- ---------------------------------------------------------------------------
-- 1. Tunable, like everything else in §8
-- ---------------------------------------------------------------------------

insert into public.settings (key, value, description) values
  (
    'otp_max_per_ip_per_hour',
    '20'::jsonb,
    'OTP sends allowed from one IP address in an hour, across all numbers. Generous for a shared office or a phone on mobile data behind a carrier NAT; tight enough that walking a prefix costs real money.'
  ),
  (
    'sms_daily_cap_ghs',
    '50'::jsonb,
    'Stop sending once this much has been spent on SMS in a day. A circuit breaker, not a budget — it should never be reached in normal traffic.'
  )
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Per-IP throttle
-- ---------------------------------------------------------------------------

create or replace function public.otp_ip_throttled(p_ip text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_cap   int;
  v_count int;
begin
  -- A missing IP is not a free pass, but it is not something to refuse on
  -- either: behind some proxies x-forwarded-for genuinely does not arrive, and
  -- failing closed there locks every real user out of signing in. The
  -- per-number limits still apply.
  if p_ip is null or p_ip = '' then
    return false;
  end if;

  select coalesce((value)::int, 20) into v_cap
  from public.settings where key = 'otp_max_per_ip_per_hour';

  select count(*) into v_count
  from public.otp_challenges
  where created_ip = p_ip
    and created_at >= now() - interval '1 hour';

  return v_count >= coalesce(v_cap, 20);
end;
$$;

comment on function public.otp_ip_throttled is
  'True when this IP has asked for too many codes in the last hour, across '
  'every number. The per-number limit cannot see this attack: an attacker who '
  'supplies a fresh number each time never trips it.';

-- ---------------------------------------------------------------------------
-- 3. Daily spend cap
-- ---------------------------------------------------------------------------

create or replace function public.sms_spend_today()
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- Real messages only. Simulated sends record what they WOULD have cost so
  -- there is a budget figure before go-live (PLAN.md §3), and counting those
  -- against a live cap would mean the demo period silently consumed the
  -- launch budget.
  select coalesce(sum(cost), 0)
  from public.notifications_log
  where channel = 'sms'
    and not is_simulated
    and created_at >= date_trunc('day', now());
$$;

create or replace function public.sms_budget_exhausted()
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_cap numeric;
begin
  select coalesce((value)::numeric, 50) into v_cap
  from public.settings where key = 'sms_daily_cap_ghs';

  -- A cap of 0 means "no cap", not "send nothing". Reading it the other way
  -- turns a missing setting into a platform-wide outage.
  if coalesce(v_cap, 0) <= 0 then
    return false;
  end if;

  return public.sms_spend_today() >= v_cap;
end;
$$;

comment on function public.sms_budget_exhausted is
  'The circuit breaker. Counts only real spend, so the simulation phase never '
  'eats the live budget. A cap of 0 disables it rather than blocking every '
  'message, because a missing setting must not become an outage.';

-- ---------------------------------------------------------------------------
-- 4. Privileges
-- ---------------------------------------------------------------------------
-- Not callable by anyone holding a user JWT. These read across every account's
-- OTP history and the platform's spend; the OTP flow that consults them runs
-- as the service role before any session exists.

revoke all on function public.otp_ip_throttled(text) from public, anon, authenticated;
revoke all on function public.sms_spend_today() from public, anon, authenticated;
revoke all on function public.sms_budget_exhausted() from public, anon, authenticated;
