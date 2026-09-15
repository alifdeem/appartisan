-- ---------------------------------------------------------------------------
-- Location writes
-- ---------------------------------------------------------------------------
-- PostgREST cannot write a `geography` column from JSON, so every path that
-- sets a point has to go through a function. Keeping that in one place also
-- means the longitude/latitude argument order is stated once, in a signature,
-- rather than remembered correctly at four different call sites.
--
-- ST_MakePoint takes LONGITUDE FIRST. Getting this backwards puts every artisan
-- in Accra somewhere in the Indian Ocean, and because Ghana sits near 0,0 the
-- resulting coordinates still look plausible at a glance.

create or replace function public.set_provider_location(
  p_provider_id uuid,
  p_lng         double precision,
  p_lat         double precision
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  -- auth.uid() is null when called with the service role (the seed script, or a
  -- trusted server action). Otherwise an artisan may only move themselves.
  if auth.uid() is not null
     and auth.uid() <> p_provider_id
     and not public.is_admin() then
    raise exception 'set_provider_location: not permitted';
  end if;

  if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'set_provider_location: coordinates out of range (lng %, lat %)', p_lng, p_lat;
  end if;

  update public.providers
     set current_location  = st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
         last_location_at  = now()
   where profile_id = p_provider_id;
end;
$$;

comment on function public.set_provider_location is
  'Sets an artisan''s current position. Arguments are longitude then latitude.';

-- ---------------------------------------------------------------------------
-- Per-job breadcrumbs, used by the client's live tracking map in Phase 5.
-- ---------------------------------------------------------------------------

create or replace function public.record_location_ping(
  p_job_id     uuid,
  p_lng        double precision,
  p_lat        double precision,
  p_accuracy_m numeric default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_provider_id uuid;
begin
  select provider_id into v_provider_id from public.jobs where id = p_job_id;

  if v_provider_id is null then
    raise exception 'record_location_ping: job % has no assigned artisan', p_job_id;
  end if;

  if auth.uid() is not null and auth.uid() <> v_provider_id then
    raise exception 'record_location_ping: not permitted';
  end if;

  insert into public.location_pings (job_id, provider_id, location, accuracy_m)
  values (
    p_job_id,
    v_provider_id,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    p_accuracy_m
  );

  -- The artisan's own position is kept current as a side effect, so matching
  -- does not need a separate ping while they are working.
  update public.providers
     set current_location = st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
         last_location_at = now()
   where profile_id = v_provider_id;
end;
$$;

revoke all on function public.set_provider_location(uuid, double precision, double precision) from public;
revoke all on function public.record_location_ping(uuid, double precision, double precision, numeric) from public;

grant execute on function public.set_provider_location(uuid, double precision, double precision) to authenticated, service_role;
grant execute on function public.record_location_ping(uuid, double precision, double precision, numeric) to authenticated, service_role;
