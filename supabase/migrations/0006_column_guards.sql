-- ArtisanGH — 0006 privileged column guards
--
-- RLS decides WHICH ROWS you may touch. It has no opinion on WHICH COLUMNS.
-- Every "update own" policy in 0003 therefore handed the row's owner write
-- access to every field on it, including the ones that decide what they are
-- allowed to do:
--
--   • profiles.role            — a client could make themselves an admin
--   • profiles.is_active       — a suspended user could reinstate themselves
--   • profiles.phone           — identity, and the key the synthetic auth email
--                                is derived from; changing it desyncs the two
--   • providers.verification_status
--                              — an artisan could self-approve and skip the
--                                Ghana Card review entirely, which is the one
--                                thing the whole product promises clients
--   • providers.rating_avg / rating_count / jobs_completed
--                              — reputation, self-assigned
--   • providers.payout_recipient_code
--                              — where the money is sent at go-live
--
-- Postgres can express this as column-level GRANTs, but grants apply per role,
-- and admins are also `authenticated` — revoking the column from the role would
-- disarm the admin console along with the attacker. So the rule goes in BEFORE
-- UPDATE triggers, which can tell the two apart.
--
-- Three callers, three outcomes:
--   service role (auth.uid() is null) — trusted server code, allowed
--   admin                             — allowed, except true identity fields
--   everyone else                     — rejected loudly with 42501
--
-- The triggers read committed state, so an attacker cannot set role='admin' and
-- have is_admin() believe it inside the same statement: a BEFORE trigger sees
-- the row as it was.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create or replace function public.guard_profiles_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return new;   -- service role: seeding, webhooks, admin server actions
  end if;

  if new.id is distinct from old.id or new.phone is distinct from old.phone then
    raise exception 'profiles.id and profiles.phone are immutable'
      using errcode = '42501';
  end if;

  if public.is_admin() then
    return new;   -- admins may change role and is_active
  end if;

  if new.role is distinct from old.role then
    raise exception 'You cannot change your own role.' using errcode = '42501';
  end if;

  if new.is_active is distinct from old.is_active then
    raise exception 'You cannot change your own account status.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_columns on public.profiles;
create trigger profiles_guard_columns
  before update on public.profiles
  for each row execute function public.guard_profiles_columns();

-- ---------------------------------------------------------------------------
-- providers
-- ---------------------------------------------------------------------------

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

  -- The one status change an artisan may make for themselves: submitting a
  -- completed application for review. Approval is always someone else's call.
  if new.verification_status is distinct from old.verification_status
     and not (old.verification_status = 'unsubmitted'
              and new.verification_status = 'pending') then
    raise exception 'Verification status is set by an administrator, not by you.'
      using errcode = '42501';
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

  return new;
end;
$$;

drop trigger if exists providers_guard_columns on public.providers;
create trigger providers_guard_columns
  before update on public.providers
  for each row execute function public.guard_providers_columns();

-- ---------------------------------------------------------------------------
-- jobs
-- ---------------------------------------------------------------------------
-- `jobs: client updates own` and `jobs: assigned provider updates` were written
-- with Phase 1's edit-your-own-request in mind, but as written they also let a
-- participant drive the status machine by hand — a client could mark a job
-- 'completed' without a payment ever settling.
--
-- Status is therefore closed to direct writes for everyone but trusted server
-- code. Phase 1 opens each transition deliberately, through a function that can
-- check the preconditions. Doing it the other way round — shipping it open and
-- tightening later — means the hole is live in the meantime.

create or replace function public.guard_jobs_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.client_id is distinct from old.client_id then
    raise exception 'jobs.client_id is immutable' using errcode = '42501';
  end if;

  if public.is_admin() then
    return new;
  end if;

  if new.provider_id is distinct from old.provider_id then
    raise exception 'Job assignment is made by the platform, not by participants.'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    raise exception 'Job status changes go through the platform, not direct writes.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists jobs_guard_columns on public.jobs;
create trigger jobs_guard_columns
  before update on public.jobs
  for each row execute function public.guard_jobs_columns();
