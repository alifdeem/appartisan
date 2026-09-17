-- ArtisanGH — 0010 harden provider_application_gaps
--
-- Two defects, both in code added by 0008/0009, both found by exercising the
-- function against the live database rather than by reading it.
--
--  1. **Anonymous callers could read application gaps.** Postgres grants
--     EXECUTE on a new function to PUBLIC by default, so 0008's
--     `grant ... to authenticated` excluded nobody — it was additive to a grant
--     that was already there. 0009 then made it reachable: it relaxed the
--     authority check to `auth.uid() is not null and ...` so that trusted
--     server code could call it, not accounting for the fact that an anonymous
--     PostgREST caller *also* has a null `auth.uid()`. The two together meant
--     anyone could ask whether a given artisan had a Ghana Card on file.
--
--     0009 was wrong on its own terms as well. The `auth.uid() is null` escape
--     documented in 0006 belongs to the guard *triggers*, which are only
--     reachable once RLS has already allowed a write. A directly-callable RPC
--     has no such gate in front of it, so the same test does not mean the same
--     thing. The escape is removed rather than repaired: nothing in this
--     codebase calls this as the service role, and a code path that exists for
--     no caller is a code path nobody maintains.
--
--  2. **`v_gaps || 'some sentence'` raised "malformed array literal".** An
--     unquoted string literal is `unknown` to the parser, which resolves `||`
--     toward `anyarray || anyarray` and then tries to read the sentence as an
--     array. Every incomplete application would have hit this — the function
--     only fails once it has an actual gap to report, which is precisely the
--     case the review screen and the submit RPC exist to handle. Explicit
--     `::text` casts pin the operator to `anyarray || anyelement`.

-- ---------------------------------------------------------------------------
-- 1. Take back the default PUBLIC grant
-- ---------------------------------------------------------------------------
-- The other three Phase 2 functions refuse an anonymous caller on their own
-- (they raise on a null `auth.uid()`, or on `is_admin()`), so this is defence
-- in depth for them and the actual fix for the first one. Revoking from PUBLIC
-- does not touch the owner, which is what runs migrations.

revoke execute on function public.provider_application_gaps(uuid) from public;
revoke execute on function public.submit_provider_application() from public;
revoke execute on function public.review_provider_application(
  uuid, public.verification_status, text
) from public;
revoke execute on function public.set_provider_availability(boolean) from public;
revoke execute on function public.provider_status_change_permitted() from public;

grant execute on function public.provider_application_gaps(uuid) to authenticated;
grant execute on function public.submit_provider_application() to authenticated;
grant execute on function public.review_provider_application(
  uuid, public.verification_status, text
) to authenticated;
grant execute on function public.set_provider_availability(boolean) to authenticated;
grant execute on function public.provider_status_change_permitted() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. The function itself
-- ---------------------------------------------------------------------------

create or replace function public.provider_application_gaps(p_provider_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_provider public.providers;
  v_gaps     text[] := array[]::text[];
  v_trades   int;
  v_docs     int;
begin
  -- SECURITY DEFINER, so RLS is not doing the scoping here and this has to.
  -- A caller must be the artisan in question or an admin. A null `auth.uid()`
  -- is an anonymous caller and is refused with everybody else — see the header.
  if p_provider_id is distinct from auth.uid() and not public.is_admin() then
    raise exception 'That is not your application.' using errcode = '42501';
  end if;

  select * into v_provider from public.providers where profile_id = p_provider_id;

  if v_provider.profile_id is null then
    return array['This account is not set up as an artisan.'::text];
  end if;

  select count(*) into v_trades
  from public.provider_categories pc
  join public.categories c on c.id = pc.category_id and c.is_active
  where pc.provider_id = p_provider_id;

  if v_trades = 0 then
    v_gaps := v_gaps || 'Choose at least one trade you work in.'::text;
  end if;

  -- 40 characters is roughly one honest sentence. Shorter than that is a
  -- placeholder, and a placeholder bio is what the admin ends up phoning about.
  if length(coalesce(trim(v_provider.bio), '')) < 40 then
    v_gaps := v_gaps || 'Write at least a sentence about the work you do.'::text;
  end if;

  if v_provider.years_experience is null then
    v_gaps := v_gaps || 'Say how many years you have been doing this work.'::text;
  end if;

  if coalesce(trim(v_provider.base_city), '') = '' then
    v_gaps := v_gaps || 'Tell us which town or area you work from.'::text;
  end if;

  if v_provider.momo_number is null or v_provider.momo_network is null then
    v_gaps := v_gaps || 'Add the mobile money number you want to be paid on.'::text;
  end if;

  if v_provider.ghana_card_number is null then
    v_gaps := v_gaps || 'Enter your Ghana Card number.'::text;
  end if;

  select count(distinct doc_type) into v_docs
  from public.provider_documents
  where provider_id = p_provider_id
    and doc_type in ('ghana_card_front', 'ghana_card_back', 'selfie');

  if v_docs < 3 then
    v_gaps := v_gaps
      || 'Upload both sides of your Ghana Card and a photo of yourself holding it.'::text;
  end if;

  return v_gaps;
end;
$$;
