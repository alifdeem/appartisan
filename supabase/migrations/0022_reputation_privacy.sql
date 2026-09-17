-- ArtisanGH — 0022 stop publishing who hired whom
--
-- Two `using (true)` policies from 0003, found by probing every table in the
-- schema as an anonymous caller and as a plain client.
--
-- 1. `ratings: public read` — to anon AND authenticated, unconditionally.
--
--    Public reputation is correct and deliberate: a rating is the product's
--    whole promise and it should be readable. But the ratings table is keyed on
--    `job_id` and carries `client_id`, so the policy published a permanent,
--    queryable record of WHICH CLIENT HIRED WHICH ARTISAN, to anyone at all,
--    with no account. Join it against `profiles` from any signed-in session
--    and it becomes named people and their phone numbers.
--
--    Nobody needs that to see that an electrician has 4.8 stars.
--
-- 2. `provider_categories: read` — also `using (true)` to anon.
--
--    Publishes the artisan-to-trade map, and with it the full list of provider
--    UUIDs, to the open internet. PLAN.md §14 puts public artisan browsing out
--    of v1, so there is no surface this was serving. The only readers in the
--    application are an artisan reading their own trades and the admin
--    assignment screen; matching goes through SECURITY DEFINER functions that
--    never consulted RLS.
--
-- Same shape of fix as 0020: narrow the base table to the people who have
-- business with the row, and expose the genuinely public subset through a view
-- that simply does not contain the sensitive columns.

-- ---------------------------------------------------------------------------
-- 1. Ratings
-- ---------------------------------------------------------------------------

drop policy if exists "ratings: public read" on public.ratings;

-- The client who left it, the artisan it is about, and an admin. `getJobRating`
-- on the client's job screen reads through this.
create policy "ratings: participants read"
  on public.ratings for select to authenticated
  using (client_id = auth.uid() or provider_id = auth.uid() or public.is_admin());

/**
 * Reputation, without the reporter.
 *
 * `client_id` and `job_id` are both absent, and that is the entire point — a
 * row here says "this artisan was given 5 stars and these words", not "Ama
 * Boateng of 024 111 1111 hired this artisan on the 17th".
 *
 * security_invoker is off so this reads through the tightened policy above,
 * exactly as provider_public does.
 */
create or replace view public.rating_public
with (security_invoker = false)
as
  select
    r.provider_id,
    r.stars,
    r.comment,
    r.tags,
    r.created_at
  from public.ratings r
  join public.providers p on p.profile_id = r.provider_id
  where p.verification_status = 'approved'
    and p.suspended_at is null;

comment on view public.rating_public is
  'Ratings for display against an artisan. Deliberately omits client_id and '
  'job_id: publishing those turns a reputation system into a public record of '
  'who hired whom.';

grant select on public.rating_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Provider categories
-- ---------------------------------------------------------------------------

drop policy if exists "provider_categories: read" on public.provider_categories;

create policy "provider_categories: own or admin reads"
  on public.provider_categories for select to authenticated
  using (provider_id = auth.uid() or public.is_admin());

-- The trades an approved artisan offers, for the day there is a surface that
-- wants them. Carries no provider identity beyond the id already exposed by
-- provider_public, and only for artisans who are live.
create or replace view public.provider_trade_public
with (security_invoker = false)
as
  select
    pc.provider_id,
    c.id   as category_id,
    c.name as category_name,
    c.slug as category_slug,
    c.icon as category_icon
  from public.provider_categories pc
  join public.providers  p on p.profile_id = pc.provider_id
  join public.categories c on c.id = pc.category_id
  where p.verification_status = 'approved'
    and p.suspended_at is null
    and c.is_active;

grant select on public.provider_trade_public to anon, authenticated;
