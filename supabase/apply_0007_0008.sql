-- ArtisanGH — apply missing migrations 0007 + 0008
-- Your database already has 0001-0006. This file contains ONLY the two
-- migrations that have never been applied (Phase 1 job posting, Phase 2
-- provider verification). Paste the whole thing into the Supabase
-- dashboard SQL editor and run it.
-- Generated 2026-09-15 10:12

begin;

-- ===================== 0007_job_posting.sql =====================
-- ArtisanGH — 0007 job posting (Phase 1)
--
-- Everything the client-posting flow needs that RLS alone cannot express.
--
-- Four problems this file solves:
--
--  1. PostGIS geography cannot be written or read through PostREST in any form
--     the browser can use. Writes go through `set_job_location()`; reads come
--     back through two STORED GENERATED columns, so the coordinates the UI
--     draws can never drift from the point the matcher measures against.
--
--  2. `jobs: client creates own` in 0003 checks only the row's owner, so a
--     client could INSERT a job already in `paid`. 0006 closed that for UPDATE
--     and left INSERT open because nothing could post a job yet. Phase 1 can.
--
--  3. `guard_jobs_columns` (0006) blocks every participant status change, which
--     is correct and also blocks the one transition Phase 1 has to make —
--     draft → posted. SECURITY DEFINER does not help: `auth.uid()` reads a
--     request GUC, not the database role, so it is still the client's id inside
--     a definer function. The guard therefore gets an explicit escape that only
--     a transaction-local flag can open, and only the functions below set it.
--
--  4. A draft accumulates photos and a voice note before it is posted, so the
--     client needs to be able to take them off again — there was no DELETE
--     policy on `job_photos`, on `jobs`, or on the storage objects.

-- ---------------------------------------------------------------------------
-- 1. Coordinates the browser can actually read
-- ---------------------------------------------------------------------------
-- `location` is geography(Point,4326) and arrives over PostgREST as WKB hex
-- ("0101000020E6100000…"), which is useless to a map component. Decoding that
-- in TypeScript would mean a second definition of where the job is, and the two
-- would eventually disagree. Generated columns cannot: they are recomputed by
-- Postgres from the same value the matcher reads.
--
-- ST_X/ST_Y are IMMUTABLE, which is what `generated always as … stored`
-- requires. They must be schema-qualified — `extensions` is not on the search
-- path during a generated-column evaluation.

alter table public.jobs
  add column if not exists location_lng double precision
    generated always as (extensions.st_x(location::extensions.geometry)) stored,
  add column if not exists location_lat double precision
    generated always as (extensions.st_y(location::extensions.geometry)) stored;

comment on column public.jobs.location_lng is
  'Read-only mirror of location, for the client. Never write this — write location via set_job_location().';
comment on column public.jobs.location_lat is
  'Read-only mirror of location, for the client. Never write this — write location via set_job_location().';

-- ---------------------------------------------------------------------------
-- 2. A client may only ever INSERT a draft
-- ---------------------------------------------------------------------------

create or replace function public.guard_jobs_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Service role (seed script, future server-side job creation).
  if auth.uid() is null then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  if new.client_id is distinct from auth.uid() then
    raise exception 'You can only create jobs for yourself.' using errcode = '42501';
  end if;

  -- Status is not the client's to choose. Posting is a separate, validated
  -- call; anything else is the state machine's business.
  if new.status is distinct from 'draft' then
    raise exception 'A new job starts as a draft. Use post_job() to post it.'
      using errcode = '42501';
  end if;

  -- Likewise the fields that only the platform may set.
  if new.provider_id is not null then
    raise exception 'Job assignment is made by the platform.' using errcode = '42501';
  end if;

  new.matching_pass    := 0;
  new.quote_rejections := 0;

  return new;
end;
$$;

drop trigger if exists jobs_guard_insert on public.jobs;
create trigger jobs_guard_insert
  before insert on public.jobs
  for each row execute function public.guard_jobs_insert();

-- ---------------------------------------------------------------------------
-- 3. The one sanctioned door through the status guard
-- ---------------------------------------------------------------------------
-- A transaction-local GUC, set only inside the SECURITY DEFINER functions
-- below. `set_config(..., true)` scopes it to the current transaction, so it
-- cannot survive into another statement even on a pooled connection.
--
-- A client cannot set it themselves: PostgREST exposes only functions in the
-- `public` schema, and `set_config` lives in `pg_catalog`.

create or replace function public.job_status_change_permitted()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('artisangh.job_status_change', true), 'off') = 'on';
$$;

-- Replaces the 0006 definition. Identical except for the escape hatch.
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

  if new.status is distinct from old.status
     and not public.job_status_change_permitted() then
    raise exception 'Job status changes go through the platform, not direct writes.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Writing the pin
-- ---------------------------------------------------------------------------
-- PostGIS takes LONGITUDE FIRST. Ghana sits near 0°,0°, so a swapped pair lands
-- in the Gulf of Guinea rather than erroring — the bounds check below is what
-- turns that silent nonsense into a loud failure.

create or replace function public.set_job_location(
  p_job_id         uuid,
  p_lng            double precision,
  p_lat            double precision,
  p_address_text   text default null,
  p_ghanapost_code text default null,
  p_landmark       text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_client uuid;
  v_status public.job_status;
begin
  select client_id, status into v_client, v_status
  from public.jobs where id = p_job_id;

  if v_client is null then
    raise exception 'Job not found.' using errcode = 'P0002';
  end if;

  if v_client is distinct from auth.uid() and not public.is_admin() then
    raise exception 'That is not your job.' using errcode = '42501';
  end if;

  -- Once a job is posted the address is part of an offer an artisan may already
  -- be travelling to. Moving it is a cancel-and-repost, not an edit.
  if v_status is distinct from 'draft' and not public.is_admin() then
    raise exception 'The location can only be changed while the job is a draft.'
      using errcode = '42501';
  end if;

  if p_lat is null or p_lng is null then
    raise exception 'Both a latitude and a longitude are required.' using errcode = '22023';
  end if;

  -- Rough Ghana bounding box, mirroring GHANA_BOUNDS in lib/integrations/maps.
  if p_lat < 4.5 or p_lat > 11.2 or p_lng < -3.3 or p_lng > 1.2 then
    raise exception 'That pin is outside Ghana (%, %).', p_lat, p_lng using errcode = '22023';
  end if;

  update public.jobs
     set location       = st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
         address_text   = coalesce(nullif(trim(p_address_text), ''), address_text),
         ghanapost_code = nullif(upper(trim(coalesce(p_ghanapost_code, ''))), ''),
         landmark       = nullif(trim(coalesce(p_landmark, '')), '')
   where id = p_job_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Posting
-- ---------------------------------------------------------------------------
-- The completeness rules live here rather than in the form, because the form is
-- not a security boundary and a half-described job wastes an artisan's trip.

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
-- 6. Client cancellation
-- ---------------------------------------------------------------------------
-- Phase 1 only reaches `posted`, which is before any money or any artisan
-- commitment, so this is always the free tier of the cancellation table
-- (PLAN.md §7). The later tiers arrive with the payment phases; the guard below
-- refuses anything past the point where money is involved rather than
-- pretending to handle it.

create or replace function public.cancel_job(p_job_id uuid, p_reason text default null)
returns void
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

  if v_job.client_id is distinct from auth.uid() and not public.is_admin() then
    raise exception 'That is not your job.' using errcode = '42501';
  end if;

  if v_job.status not in ('draft', 'posted', 'matching', 'offer_sent', 'unmatched', 'assigned') then
    raise exception 'This job has gone too far to cancel here. Contact support.'
      using errcode = '22023';
  end if;

  perform set_config('artisangh.job_status_change', 'on', true);

  update public.jobs
     set status    = 'cancelled_by_client',
         closed_at = now()
   where id = p_job_id;

  perform set_config('artisangh.job_status_change', 'off', true);

  -- The automatic trigger records the transition; this adds the human reason.
  update public.job_events
     set reason = nullif(trim(coalesce(p_reason, '')), '')
   where id = (
     select id from public.job_events
     where job_id = p_job_id and to_status = 'cancelled_by_client'
     order by created_at desc limit 1
   );
end;
$$;

grant execute on function public.set_job_location(uuid, double precision, double precision, text, text, text) to authenticated;
grant execute on function public.post_job(uuid) to authenticated;
grant execute on function public.cancel_job(uuid, text) to authenticated;
grant execute on function public.job_status_change_permitted() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Taking things back off a draft
-- ---------------------------------------------------------------------------

create policy "jobs: client deletes own draft"
  on public.jobs for delete to authenticated
  using (client_id = auth.uid() and status = 'draft');

create policy "job_photos: uploader removes from draft"
  on public.job_photos for delete to authenticated
  using (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.jobs j
      where j.id = job_photos.job_id
        and j.client_id = auth.uid()
        and j.status = 'draft'
    )
  );

-- Storage had insert and select for job-photos but no delete, so removing a
-- photo from a draft would have orphaned the object in the bucket forever.
create policy "job-photos: uploader deletes own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'job-photos'
    and owner = auth.uid()
    and public.can_view_job(((storage.foldername(name))[1])::uuid)
  );

create policy "voice-notes: uploader deletes own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'voice-notes'
    and owner = auth.uid()
    and public.can_view_job(((storage.foldername(name))[1])::uuid)
  );

-- Re-recording a voice note overwrites the same key, which storage treats as an
-- update rather than an insert.
create policy "voice-notes: uploader replaces own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'voice-notes'
    and owner = auth.uid()
    and public.can_view_job(((storage.foldername(name))[1])::uuid)
  );

-- ---------------------------------------------------------------------------
-- 8. Settings this phase reads
-- ---------------------------------------------------------------------------

insert into public.settings (key, value, description) values
  ('job_photo_max_count', '6'::jsonb,
   'Photos a client may attach to one job request. Mirrored in lib/jobs/limits.ts.')
on conflict (key) do nothing;

-- =============== 0008_provider_verification.sql =================
-- ArtisanGH — 0008 provider verification (Phase 2)
--
-- Everything the artisan application and the admin review queue need that RLS
-- alone cannot express.
--
-- Five problems this file solves:
--
--  1. An application is not a column, it is a *state*: a dozen fields across
--     three tables plus three images in a private bucket. "Is this ready to
--     submit?" has to be answered in one place that the UI and the database
--     agree on, or a client with a stale page submits half an application.
--
--  2. `guard_providers_columns` (0006) allows exactly one status transition —
--     unsubmitted → pending. A rejected artisan who fixes their photo has no
--     way back into the queue. That is not a rule, it is an oversight.
--
--  3. Nothing stops an unapproved provider writing `availability = 'online'`.
--     The guard does not mention the column, so it is wide open, and an
--     unverified artisan sitting in the matching pool is the one failure this
--     entire phase exists to prevent.
--
--  4. `provider-docs` has SELECT and INSERT policies and no DELETE. An artisan
--     who photographs their Ghana Card badly cannot replace it.
--
--  5. Approving somebody is a two-table write — the decision row and the
--     provider's status — and the audit trail is the whole point of the
--     verification queue. It goes in one function or it eventually goes wrong.

-- ---------------------------------------------------------------------------
-- 1. What an application actually holds
-- ---------------------------------------------------------------------------
-- The Ghana Card PIN is the identity the offline vetting call confirms, so it
-- is stored as a field rather than left to be read off the photograph. Format
-- is GHA-#########-# — nine digits then a single check digit.

alter table public.providers
  add column if not exists ghana_card_number text,
  add column if not exists application_submitted_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'providers_ghana_card_format'
  ) then
    alter table public.providers
      add constraint providers_ghana_card_format
      check (ghana_card_number is null or ghana_card_number ~ '^GHA-[0-9]{9}-[0-9]$');
  end if;
end;
$$;

comment on column public.providers.ghana_card_number is
  'Ghana Card PIN, GHA-#########-#. Confirmed against the card photograph during the offline vetting call.';
comment on column public.providers.application_submitted_at is
  'When the artisan last submitted for review. Drives the queue ordering — oldest waiting first.';

-- One Ghana Card front, one back, one selfie. Work photos and certificates are
-- deliberately excluded: an artisan may show as many of those as they like.
create unique index if not exists provider_documents_singleton_idx
  on public.provider_documents (provider_id, doc_type)
  where doc_type in ('ghana_card_front', 'ghana_card_back', 'selfie');

-- The queue reads "everyone waiting, oldest first" on every admin page load.
create index if not exists providers_pending_review_idx
  on public.providers (application_submitted_at)
  where verification_status = 'pending';

-- ---------------------------------------------------------------------------
-- 2. The sanctioned door through the provider guard
-- ---------------------------------------------------------------------------
-- Same mechanism as `artisangh.job_status_change` in 0007, and for the same
-- reason: SECURITY DEFINER does not help here, because `auth.uid()` reads a
-- request GUC rather than the database role — inside a definer function the
-- caller is still the artisan, so the guard still fires. A transaction-local
-- setting is the only thing that can be opened from inside a function and
-- cannot be forged from outside one: PostgREST exposes `public`, and
-- `set_config` lives in `pg_catalog`.

create or replace function public.provider_status_change_permitted()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('artisangh.provider_status_change', true), 'off') = 'on';
$$;

-- Replaces the 0006 definition. Three changes, all noted inline.
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

  -- CHANGED (1): status moves only through submit_provider_application() and
  -- review_provider_application(), which open the flag above. The old version
  -- hardcoded unsubmitted → pending here, which locked a rejected artisan out
  -- of ever reapplying.
  if new.verification_status is distinct from old.verification_status
     and not public.provider_status_change_permitted() then
    raise exception 'Verification status is set by an administrator, not by you.'
      using errcode = '42501';
  end if;

  -- CHANGED (2): availability was unguarded. An artisan may put themselves
  -- online or offline; they may not put themselves *on a job*, and they may not
  -- go online at all until an admin has approved them. Enforced here rather
  -- than in the action because the matcher trusts this column absolutely.
  if new.availability is distinct from old.availability then
    if new.availability = 'on_job' then
      raise exception 'Job status is set by the platform, not by you.' using errcode = '42501';
    end if;

    if old.availability = 'on_job' then
      raise exception 'You cannot change your availability during a job.' using errcode = '42501';
    end if;

    if new.availability = 'online' and new.verification_status <> 'approved' then
      raise exception 'You can go online once your account has been approved.'
        using errcode = '42501';
    end if;
  end if;

  -- CHANGED (3): the Ghana Card PIN is what the vetting call confirmed. It is
  -- editable while the artisan is still drafting or fixing a rejection, and
  -- frozen the moment it is somebody else's job to check it.
  if new.ghana_card_number is distinct from old.ghana_card_number
     and old.verification_status in ('pending', 'approved', 'suspended') then
    raise exception 'Your Ghana Card number cannot be changed while your account is under review.'
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

  if new.application_submitted_at is distinct from old.application_submitted_at
     and not public.provider_status_change_permitted() then
    raise exception 'Submission time is recorded by the platform.' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Is this application ready?
-- ---------------------------------------------------------------------------
-- One function, called by the submit RPC *and* read by the UI to draw the
-- checklist. The alternative — the form deciding for itself — means the
-- checklist and the gate drift apart, and the artisan is told they are ready
-- and then refused.
--
-- Returns the list of what is still missing, so an empty array means ready.
-- Phrased as sentences an artisan can act on, not field names.

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
  -- exists to keep quiet about.
  if p_provider_id is distinct from auth.uid() and not public.is_admin() then
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

comment on function public.provider_application_gaps is
  'What is still missing from an artisan application, as sentences. Empty array means ready to submit. Read by the UI checklist and enforced by submit_provider_application().';

-- ---------------------------------------------------------------------------
-- 4. Submitting
-- ---------------------------------------------------------------------------

create or replace function public.submit_provider_application()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_provider public.providers;
  v_gaps     text[];
begin
  if auth.uid() is null then
    raise exception 'You need to be signed in.' using errcode = '42501';
  end if;

  select * into v_provider from public.providers where profile_id = auth.uid() for update;

  if v_provider.profile_id is null then
    raise exception 'This account is not set up as an artisan.' using errcode = 'P0002';
  end if;

  -- Approved and suspended are both somebody else's decision to revisit. Only
  -- an artisan who has not yet been judged, or who has been turned down and has
  -- since fixed something, may put themselves in the queue.
  if v_provider.verification_status not in ('unsubmitted', 'rejected') then
    raise exception 'Your application has already been submitted.' using errcode = '22023';
  end if;

  v_gaps := public.provider_application_gaps(auth.uid());

  if array_length(v_gaps, 1) > 0 then
    raise exception 'Your application is not finished: %', array_to_string(v_gaps, ' ')
      using errcode = '22023';
  end if;

  perform set_config('artisangh.provider_status_change', 'on', true);

  update public.providers
     set verification_status      = 'pending',
         application_submitted_at = now()
   where profile_id = auth.uid();

  perform set_config('artisangh.provider_status_change', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. The admin decision
-- ---------------------------------------------------------------------------
-- Writes the review row and moves the provider in one transaction. The review
-- row is the record of *why*, and PLAN.md §2 is explicit that the judgement
-- itself happens offline on a phone call — so the notes field is the actual
-- artefact here, not a nicety.

create or replace function public.review_provider_application(
  p_provider_id uuid,
  p_decision    public.verification_status,
  p_call_notes  text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_provider public.providers;
  v_notes    text := nullif(trim(coalesce(p_call_notes, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can review an application.' using errcode = '42501';
  end if;

  if p_decision not in ('approved', 'rejected', 'suspended') then
    raise exception 'A review decision must be approve, reject or suspend.' using errcode = '22023';
  end if;

  select * into v_provider from public.providers where profile_id = p_provider_id for update;

  if v_provider.profile_id is null then
    raise exception 'That artisan could not be found.' using errcode = 'P0002';
  end if;

  if v_provider.verification_status = p_decision then
    raise exception 'That artisan is already %.', p_decision using errcode = '22023';
  end if;

  -- Turning somebody down, or pulling their approval, is the half of this job
  -- that gets questioned later. Requiring the note costs the admin ten seconds
  -- and is the only thing that will answer "why was I rejected?" in six weeks.
  if p_decision in ('rejected', 'suspended') and v_notes is null then
    raise exception 'Record why before turning an artisan down.' using errcode = '22023';
  end if;

  insert into public.verification_reviews (provider_id, admin_id, decision, call_notes)
  values (p_provider_id, auth.uid(), p_decision, v_notes);

  perform set_config('artisangh.provider_status_change', 'on', true);

  update public.providers
     set verification_status = p_decision,
         suspended_at      = case when p_decision = 'suspended' then now() end,
         suspension_reason = case when p_decision = 'suspended' then v_notes end,
         -- Anyone not currently approved must leave the matching pool at once.
         -- Without this, suspending an artisan who is online leaves them
         -- receiving offers until the next time they happen to toggle.
         availability      = case when p_decision = 'approved' then availability
                                  else 'offline' end
   where profile_id = p_provider_id;

  perform set_config('artisangh.provider_status_change', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Going online
-- ---------------------------------------------------------------------------
-- A plain UPDATE would do, and the guard above would enforce the rules. This
-- exists so the failure comes back as one sentence rather than as a trigger
-- exception, and so the toggle has somewhere to grow when Phase 3 needs it to
-- also refuse an artisan with no pinned location.

create or replace function public.set_provider_availability(p_online boolean)
returns public.provider_availability
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_provider public.providers;
  v_next     public.provider_availability;
begin
  if auth.uid() is null then
    raise exception 'You need to be signed in.' using errcode = '42501';
  end if;

  select * into v_provider from public.providers where profile_id = auth.uid() for update;

  if v_provider.profile_id is null then
    raise exception 'This account is not set up as an artisan.' using errcode = 'P0002';
  end if;

  if v_provider.availability = 'on_job' then
    raise exception 'You are on a job. Finish it before changing your availability.'
      using errcode = '22023';
  end if;

  if p_online and v_provider.verification_status <> 'approved' then
    raise exception 'You can go online once your account has been approved.'
      using errcode = '42501';
  end if;

  v_next := case when p_online then 'online' else 'offline' end;

  update public.providers
     set availability = v_next
   where profile_id = auth.uid();

  return v_next;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Replacing a badly-shot document
-- ---------------------------------------------------------------------------
-- 0003 gave provider-docs a SELECT and an INSERT policy and no DELETE, so a
-- blurred Ghana Card was permanent. The table already allows the owner to
-- delete their row; this lets the object go with it rather than leaving
-- orphaned identity documents in a private bucket forever.

-- Dropped first so the whole file stays re-runnable. `supabase/apply_all.sql`
-- exists to be pasted into the SQL editor when the CLI is not an option, and a
-- second paste should be a no-op rather than an error halfway down.
drop policy if exists "provider-docs: own or admin delete" on storage.objects;

create policy "provider-docs: own or admin delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'provider-docs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- ---------------------------------------------------------------------------
-- 8. Grants
-- ---------------------------------------------------------------------------

grant execute on function public.provider_status_change_permitted() to authenticated;
grant execute on function public.provider_application_gaps(uuid) to authenticated;
grant execute on function public.submit_provider_application() to authenticated;
grant execute on function public.review_provider_application(uuid, public.verification_status, text)
  to authenticated;
grant execute on function public.set_provider_availability(boolean) to authenticated;

commit;
