-- ArtisanGH — 0002 functions, triggers and helpers

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger providers_touch_updated_at
  before update on public.providers
  for each row execute function public.touch_updated_at();

create trigger jobs_touch_updated_at
  before update on public.jobs
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Role helpers
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so that policies on `profiles` can call these without
-- recursing into the very policies being evaluated.

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;

create or replace function public.is_approved_provider()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.providers
    where profile_id = auth.uid() and verification_status = 'approved'
  );
$$;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_approved_provider() to authenticated;

-- ---------------------------------------------------------------------------
-- New user provisioning
-- ---------------------------------------------------------------------------
-- Auth users are created through the admin API with role/full_name/phone in
-- user metadata. This trigger turns that into the matching profile plus the
-- role-specific row, atomically, so there is never an auth user without a
-- profile.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role      public.user_role;
  v_phone     text;
  v_full_name text;
  v_languages text[];
begin
  v_role := coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'client');
  v_phone := new.raw_user_meta_data ->> 'phone';
  v_full_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'ArtisanGH user');

  -- Admins are never self-provisioned. Anyone signing up through the public
  -- flow lands as a client or provider regardless of what metadata claims.
  if v_role = 'admin' and coalesce((new.raw_user_meta_data ->> 'allow_admin')::boolean, false) is not true then
    v_role := 'client';
  end if;

  if v_phone is null then
    raise exception 'handle_new_auth_user: phone is required in user metadata';
  end if;

  select coalesce(
           array(select jsonb_array_elements_text(new.raw_user_meta_data -> 'spoken_languages')),
           array['English']
         )
    into v_languages;

  if array_length(v_languages, 1) is null then
    v_languages := array['English'];
  end if;

  insert into public.profiles (id, role, phone, full_name, spoken_languages)
  values (new.id, v_role, v_phone, v_full_name, v_languages);

  if v_role = 'client' then
    insert into public.clients (profile_id) values (new.id);
  elsif v_role = 'provider' then
    insert into public.providers (profile_id) values (new.id);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Job reference numbers
-- ---------------------------------------------------------------------------

create or replace function public.generate_job_reference()
returns text
language plpgsql
as $$
declare
  v_ref text;
begin
  loop
    v_ref := 'AGH-' || to_char(now(), 'YYMMDD') || '-' ||
             upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 5));
    exit when not exists (select 1 from public.jobs where reference = v_ref);
  end loop;
  return v_ref;
end;
$$;

create or replace function public.set_job_reference()
returns trigger
language plpgsql
as $$
begin
  if new.reference is null or new.reference = '' then
    new.reference := public.generate_job_reference();
  end if;
  return new;
end;
$$;

create trigger jobs_set_reference
  before insert on public.jobs
  for each row execute function public.set_job_reference();

-- ---------------------------------------------------------------------------
-- Job status audit log
-- ---------------------------------------------------------------------------
-- Every transition is recorded automatically. Nothing in application code has
-- to remember to log, which is the only way an audit trail stays trustworthy.

create or replace function public.log_job_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.job_events (job_id, from_status, to_status, actor_id, actor_role)
    values (
      new.id,
      case when tg_op = 'INSERT' then null else old.status end,
      new.status,
      auth.uid(),
      (select role from public.profiles where id = auth.uid())
    );
  end if;
  return new;
end;
$$;

create trigger jobs_log_status_change
  after insert or update of status on public.jobs
  for each row execute function public.log_job_status_change();

-- ---------------------------------------------------------------------------
-- Money helpers
-- ---------------------------------------------------------------------------
-- Quote arithmetic lives in the database as well as in TypeScript so that the
-- two can be checked against each other. Rounding to pesewas, half-up.

create or replace function public.compute_quote_totals(
  p_subtotal      numeric,
  p_service_fee_pct numeric,
  p_transport_fee numeric
)
returns table (service_fee_amount numeric, total numeric, deposit_amount numeric)
language sql
immutable
as $$
  select
    round(p_subtotal * p_service_fee_pct / 100, 2)                                   as service_fee_amount,
    round(p_subtotal + (p_subtotal * p_service_fee_pct / 100), 2)                    as total,
    -- Deposit is 50% of the marked-up total PLUS the whole transport fee, which
    -- is charged upfront so the artisan is never out of pocket for travel.
    round((p_subtotal + (p_subtotal * p_service_fee_pct / 100)) * 0.5, 2)
      + round(p_transport_fee, 2)                                                    as deposit_amount;
$$;

create or replace function public.transport_fee_for_distance(
  p_city    text,
  p_distance_km numeric
)
returns numeric
language sql
stable
as $$
  select fee
  from public.transport_zones
  where is_active
    and (city = p_city or city = '*')
    and p_distance_km >= min_km
    and p_distance_km < max_km
  order by (city = p_city) desc, min_km
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Matching
-- ---------------------------------------------------------------------------
-- Candidate selection for the sequential-offer matcher. Phase 3 drives this;
-- it lives here now because the schema and indexes it depends on are Phase 0.
--
-- Distance comes from PostGIS, NOT from the map provider — so matching quality
-- is identical whether the UI renders OpenStreetMap or Google Maps. See PLAN.md §3.

create or replace function public.find_candidate_providers(
  p_job_id     uuid,
  p_radius_km  numeric default 5,
  p_limit      int default 10
)
returns table (provider_id uuid, distance_km numeric, rating_avg numeric)
language sql
stable
security definer
-- `extensions` must be here, not just on the migration's search_path: a
-- SECURITY DEFINER function runs with the path pinned below, so st_distance and
-- st_dwithin would be unresolvable at call time otherwise. That failure would
-- only surface the first time an artisan went online, not at migration.
set search_path = public, extensions, pg_temp
as $$
  select
    p.profile_id,
    round((st_distance(p.current_location, j.location) / 1000)::numeric, 2) as distance_km,
    p.rating_avg
  from public.jobs j
  join public.providers p
    on p.verification_status = 'approved'
   and p.availability = 'online'
   and p.current_location is not null
   and p.suspended_at is null
  join public.provider_categories pc
    on pc.provider_id = p.profile_id
   and pc.category_id = j.category_id
  where j.id = p_job_id
    and j.location is not null
    and st_dwithin(p.current_location, j.location, least(p_radius_km, p.service_radius_km) * 1000)
    -- Never offer a job to someone already on one.
    and not exists (
      select 1 from public.jobs active
      where active.provider_id = p.profile_id
        and active.status in ('assigned','quote_pending','quote_sent','awaiting_deposit',
                              'deposit_paid','en_route','arrived','in_progress',
                              'work_complete','awaiting_signoff','awaiting_balance')
    )
    -- Never re-offer the same job to someone who already saw it.
    and not exists (
      select 1 from public.job_offers o
      where o.job_id = p_job_id and o.provider_id = p.profile_id
    )
  order by distance_km asc, p.rating_avg desc
  limit p_limit;
$$;

grant execute on function public.find_candidate_providers(uuid, numeric, int) to authenticated;
grant execute on function public.compute_quote_totals(numeric, numeric, numeric) to authenticated;
grant execute on function public.transport_fee_for_distance(text, numeric) to authenticated;
