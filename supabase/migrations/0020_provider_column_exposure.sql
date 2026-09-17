-- ArtisanGH — 0020 close the provider column leak
--
-- `providers: read approved` (migration 0003) reads:
--
--   on public.providers for select to authenticated
--   using (verification_status = 'approved')
--
-- RLS is ROW level. It has no opinion on columns — the same lesson 0006 wrote
-- down for writes, not applied to reads. So that policy handed every signed-in
-- user every column of every approved artisan's row:
--
--   momo_number            their mobile money number
--   momo_network
--   ghana_card_number      national ID
--   payout_recipient_code  where their money is sent at go-live
--   current_location       a live GPS point, to ~1m
--   suspension_reason      an administrative note about them
--
-- Anyone can sign up at /signup. So the cost of a complete list of every
-- verified artisan's ID number, MoMo wallet and home-ish coordinates was one
-- phone number and one `select * from providers`. Confirmed against the live
-- database before writing this: a seeded client session read the artisan's
-- +233242222222 and their exact point.
--
-- The policy was written for "a client can see who has been matched to them",
-- which is a real need — but the artisan's NAME and PHONE come from `profiles`
-- via `profiles: read job counterparty`, and nothing in the application has
-- ever read the providers table from a client session. The policy had no
-- legitimate consumer at all. PLAN.md §14 also puts "public artisan profile
-- browsing" explicitly out of v1, so there is no browse surface to serve.
--
-- Why not column-level GRANTs: 0006 already explains it. Grants apply per role
-- and admins are also `authenticated`, so revoking a column from the role
-- disarms the admin console along with the attacker.
--
-- Why a view: a view runs with its owner's rights and does not consult the
-- underlying table's RLS, so it can expose a safe subset of columns to
-- everyone without the base table being readable by anyone. That is the
-- Postgres-native answer to "column-level RLS", which does not exist.

drop policy if exists "providers: read approved" on public.providers;

-- What is left on `providers` after the drop:
--   providers: read own          profile_id = auth.uid() or is_admin()
--   providers: update own
--   providers: admin updates any
-- Matching is unaffected: `find_candidate_providers` is SECURITY DEFINER and
-- never consulted RLS in the first place.

-- ---------------------------------------------------------------------------
-- The safe surface
-- ---------------------------------------------------------------------------
-- Everything a client could reasonably be shown about an artisan, and nothing
-- that costs the artisan anything to have published. Add columns here
-- deliberately; the whole point is that the list is short and reviewed.

create or replace view public.provider_public
with (security_invoker = false)
as
  select
    p.profile_id,
    pr.full_name,
    pr.avatar_url,
    pr.spoken_languages,
    p.bio,
    p.years_experience,
    p.base_city,
    p.availability,
    p.rating_avg,
    p.rating_count,
    p.jobs_completed
  from public.providers p
  join public.profiles pr on pr.id = p.profile_id
  where p.verification_status = 'approved'
    and p.suspended_at is null
    and pr.is_active;

comment on view public.provider_public is
  'Artisan detail safe to show a client. Deliberately omits momo_number, '
  'momo_network, ghana_card_number, payout_recipient_code, current_location, '
  'last_location_at and suspension_reason. security_invoker is off so the view '
  'bypasses the base table RLS — which is the point: the base table is now '
  'readable only by its owner and an admin.';

-- A location the client is entitled to is a location on THEIR job, and that is
-- already served by `location_pings` under `can_view_job`. There is no reason
-- for a live provider coordinate to be readable outside an active job, so it
-- is not in the view.

grant select on public.provider_public to anon, authenticated;
