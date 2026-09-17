-- ArtisanGH — 0009 corrections
--
-- Two fixes, one to each of the last two phases.
--
--  1. **Phase 1 left the landmark half-required.** `location-picker.tsx` marks
--     the field with a required asterisk, and nothing anywhere enforced it —
--     not the action's schema, not `post_job`. A client could post a job whose
--     only human-readable direction was an OSM reverse-geocode label, which in
--     Accra is frequently a road name and nothing else. The pin is what the
--     matcher measures from, but the pin is not what the artisan reads when
--     they are standing at a junction holding a phone. PLAN.md §3 and the
--     picker's own header comment both call the landmark the thing Ghanaians
--     actually navigate by; this makes the database agree.
--
--  2. **0008's `provider_application_gaps` locked out the service role.** Every
--     other guard and definer function in this schema treats `auth.uid() is
--     null` as trusted server code and lets it through — 0006 says so in as
--     many words. That one refused it, so the seed script and any future
--     back-office tooling would meet "That is not your application." The app
--     never hit it (it always calls with a session), which is exactly the kind
--     of inconsistency that stays hidden until somebody writes a script at 2am.

-- ---------------------------------------------------------------------------
-- 1. A landmark is part of a complete job
-- ---------------------------------------------------------------------------
-- Enforced in `post_job` rather than as a NOT NULL column, deliberately: a
-- draft is allowed to be incomplete, and the pin is set on its own step before
-- the landmark is typed. The rule belongs at the point of no return, next to
-- the other two completeness checks, not on the column.
--
-- Existing rows are untouched — this only gates new posts. A draft started
-- before this migration is refused at the review step with a sentence telling
-- the client what to add, and the review screen already links back to the
-- location step to add it.

create or replace function public.post_job(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job    public.jobs;
  v_radius numeric;
begin
  select * into v_job from public.jobs where id = p_job_id for update;

  if v_job.id is null then
    raise exception 'Job not found.' using errcode = 'P0002';
  end if;

  if v_job.client_id is distinct from auth.uid() then
    raise exception 'That is not your job.' using errcode = '42501';
  end if;

  if v_job.status <> 'draft' then
    raise exception 'This job has already been posted.' using errcode = '22023';
  end if;

  if v_job.location is null then
    raise exception 'Pin the job location before posting.' using errcode = '22023';
  end if;

  -- NEW in 0009. A pin gets the artisan to the street; the landmark gets them
  -- to the gate. Ten characters is enough to refuse an empty field or a full
  -- stop without demanding prose.
  if length(coalesce(trim(v_job.landmark), '')) < 10 then
    raise exception 'Add a landmark so the artisan can find the place — “blue gate opposite Melcom”.'
      using errcode = '22023';
  end if;

  -- A description OR a voice note. Requiring prose would exclude the clients
  -- this product is partly built for; requiring neither wastes a callout.
  if coalesce(trim(v_job.description), '') = '' and v_job.voice_note_path is null then
    raise exception 'Describe the job, or record a voice note, before posting.'
      using errcode = '22023';
  end if;

  -- First matching pass radius comes from `matching_radius_passes` ([5,10,20]),
  -- the same array the Phase 3 widener walks, so the first offer and the first
  -- widening can never be configured against each other (PLAN.md §6).
  select coalesce((value -> 0)::numeric, 5) into v_radius
  from public.settings where key = 'matching_radius_passes';

  perform set_config('artisangh.job_status_change', 'on', true);

  update public.jobs
     set status             = 'posted',
         matching_radius_km = coalesce(v_radius, 5),
         matching_pass      = 1
   where id = p_job_id;

  perform set_config('artisangh.job_status_change', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Let trusted server code read application gaps
-- ---------------------------------------------------------------------------
-- Identical to the 0008 definition except for the `auth.uid() is null` escape,
-- which restores the convention 0006 documents.

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
  -- Without it, any signed-in user could ask whether a given artisan has a
  -- Ghana Card on file — which is exactly the kind of thing the private bucket
  -- exists to keep quiet about. The service role is exempt, as everywhere else.
  if auth.uid() is not null
     and p_provider_id is distinct from auth.uid()
     and not public.is_admin() then
    raise exception 'That is not your application.' using errcode = '42501';
  end if;

  select * into v_provider from public.providers where profile_id = p_provider_id;

  if v_provider.profile_id is null then
    return array['This account is not set up as an artisan.'];
  end if;

  select count(*) into v_trades
  from public.provider_categories pc
  join public.categories c on c.id = pc.category_id and c.is_active
  where pc.provider_id = p_provider_id;

  if v_trades = 0 then
    v_gaps := v_gaps || 'Choose at least one trade you work in.';
  end if;

  -- 40 characters is roughly one honest sentence. Shorter than that is a
  -- placeholder, and a placeholder bio is what the admin ends up phoning about.
  if length(coalesce(trim(v_provider.bio), '')) < 40 then
    v_gaps := v_gaps || 'Write at least a sentence about the work you do.';
  end if;

  if v_provider.years_experience is null then
    v_gaps := v_gaps || 'Say how many years you have been doing this work.';
  end if;

  if coalesce(trim(v_provider.base_city), '') = '' then
    v_gaps := v_gaps || 'Tell us which town or area you work from.';
  end if;

  if v_provider.momo_number is null or v_provider.momo_network is null then
    v_gaps := v_gaps || 'Add the mobile money number you want to be paid on.';
  end if;

  if v_provider.ghana_card_number is null then
    v_gaps := v_gaps || 'Enter your Ghana Card number.';
  end if;

  select count(distinct doc_type) into v_docs
  from public.provider_documents
  where provider_id = p_provider_id
    and doc_type in ('ghana_card_front', 'ghana_card_back', 'selfie');

  if v_docs < 3 then
    v_gaps := v_gaps
      || 'Upload both sides of your Ghana Card and a photo of yourself holding it.';
  end if;

  return v_gaps;
end;
$$;
