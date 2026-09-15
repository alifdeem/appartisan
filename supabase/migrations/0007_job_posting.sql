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
