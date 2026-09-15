-- ArtisanGH — all migrations concatenated, in order.
-- Generated from supabase/migrations/ — do not edit by hand.
-- Paste into the Supabase SQL editor if you cannot use `npm run db:push`.

-- ══════════════════════════════════════════════════════════════
-- 0001_init.sql
-- ══════════════════════════════════════════════════════════════
-- ArtisanGH — 0001 init
-- Extensions, enums, core tables, indexes, storage buckets.
--
-- Design notes:
--  * Every money/messaging table carries `is_simulated` so that once the platform
--    goes live we can always tell test rows from real ones. Retrofitting this
--    column later would be guesswork. See PLAN.md §3.
--  * There is deliberately NO user-facing wallet/balance table anywhere. Bank of
--    Ghana treats "creation and management of wallet" as E-Money Issuer activity
--    (GHS 25m capital). Money moves in and out per job. See PLAN.md §4.

create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- Supabase installs extensions into `extensions`, which is NOT on the default
-- search_path of the role the CLI migrates with. Without this, `geography`
-- resolves to nothing and every table below fails with "type does not exist".
--
-- The types are also schema-qualified explicitly, so re-running any single
-- migration in isolation still works. Belt and braces, because the failure mode
-- is a migration that applies cleanly on one machine and not on another.
set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('client', 'provider', 'admin');

create type public.verification_status as enum (
  'unsubmitted',   -- account exists, application not yet filled in
  'pending',       -- submitted, sitting in the admin queue
  'approved',
  'rejected',
  'suspended'      -- was approved, pulled by admin or by reliability thresholds
);

create type public.provider_availability as enum ('offline', 'online', 'on_job');

-- The job lifecycle. Mirrors the state machine in PLAN.md §6 exactly.
create type public.job_status as enum (
  'draft',
  'posted',
  'matching',
  'offer_sent',
  'unmatched',          -- nobody accepted; falls through to the admin queue
  'assigned',
  'quote_pending',
  'quote_sent',
  'awaiting_deposit',
  'deposit_paid',
  'en_route',
  'arrived',
  'in_progress',
  'work_complete',
  'awaiting_signoff',
  'awaiting_balance',
  'paid',
  'closed',
  'cancelled_by_client',
  'cancelled_by_provider',
  'expired_no_match',
  'disputed'
);

create type public.offer_status as enum ('pending', 'accepted', 'declined', 'expired', 'superseded');
create type public.quote_status as enum ('draft', 'sent', 'accepted', 'rejected', 'expired');
create type public.quote_item_kind as enum ('labour', 'material');
create type public.payment_leg as enum ('deposit', 'balance');
create type public.payment_status as enum ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'cancelled');
create type public.payout_status as enum ('pending', 'processing', 'paid', 'failed');
create type public.momo_network as enum ('mtn', 'telecel', 'airteltigo');
create type public.dispute_status as enum ('open', 'investigating', 'resolved', 'rejected');
create type public.notification_channel as enum ('sms', 'push', 'in_app', 'whatsapp');
create type public.provider_doc_type as enum (
  'ghana_card_front', 'ghana_card_back', 'selfie', 'work_photo', 'certificate'
);
create type public.job_photo_stage as enum ('request', 'progress', 'completion');

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  role              public.user_role not null default 'client',
  phone             text not null unique,          -- E.164, e.g. +233241234567
  full_name         text not null,
  avatar_url        text,
  spoken_languages  text[] not null default array['English'],
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint profiles_phone_e164 check (phone ~ '^\+233[0-9]{9}$')
);

comment on column public.profiles.phone is
  'E.164 Ghana format. Phone is the identity key across the platform, not email.';

create table public.clients (
  profile_id      uuid primary key references public.profiles (id) on delete cascade,
  default_address text,
  created_at      timestamptz not null default now()
);

create table public.providers (
  profile_id          uuid primary key references public.profiles (id) on delete cascade,
  bio                 text,
  years_experience    int check (years_experience >= 0 and years_experience <= 70),
  verification_status public.verification_status not null default 'unsubmitted',
  availability        public.provider_availability not null default 'offline',
  current_location    extensions.geography(Point, 4326),
  last_location_at    timestamptz,
  service_radius_km   numeric(5,2) not null default 10 check (service_radius_km > 0 and service_radius_km <= 100),
  base_city           text,
  momo_number         text,
  momo_network        public.momo_network,
  -- Set once the platform goes live and the artisan is registered as a Paystack
  -- transfer recipient. Null in simulation. See PLAN.md §3.
  payout_recipient_code text,
  rating_avg          numeric(3,2) not null default 0 check (rating_avg >= 0 and rating_avg <= 5),
  rating_count        int not null default 0,
  jobs_completed      int not null default 0,
  suspended_at        timestamptz,
  suspension_reason   text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint providers_momo_e164 check (momo_number is null or momo_number ~ '^\+233[0-9]{9}$')
);

-- The default GIST operator class for geography is resolved through the
-- search_path set at the top of this file. Naming it explicitly is tempting but
-- the name differs between PostGIS versions (gist_geography_ops vs the _2d/_nd
-- variants geometry uses), so the search_path is the more durable answer.
create index providers_location_idx on public.providers using gist (current_location);
create index providers_matchable_idx on public.providers (availability, verification_status)
  where verification_status = 'approved';

create table public.provider_documents (
  id            uuid primary key default gen_random_uuid(),
  provider_id   uuid not null references public.providers (profile_id) on delete cascade,
  doc_type      public.provider_doc_type not null,
  storage_path  text not null,
  uploaded_at   timestamptz not null default now()
);

create index provider_documents_provider_idx on public.provider_documents (provider_id);

create table public.verification_reviews (
  id           uuid primary key default gen_random_uuid(),
  provider_id  uuid not null references public.providers (profile_id) on delete cascade,
  admin_id     uuid not null references public.profiles (id),
  decision     public.verification_status not null,
  call_notes   text,           -- the offline vetting call lives here
  reviewed_at  timestamptz not null default now()
);

create index verification_reviews_provider_idx on public.verification_reviews (provider_id, reviewed_at desc);

-- ---------------------------------------------------------------------------
-- Catalogue and configuration
-- ---------------------------------------------------------------------------

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  icon        text not null default 'wrench',
  description text,
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table public.provider_categories (
  provider_id uuid not null references public.providers (profile_id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (provider_id, category_id)
);

create table public.transport_zones (
  id                 uuid primary key default gen_random_uuid(),
  city               text not null,
  min_km             numeric(6,2) not null check (min_km >= 0),
  max_km             numeric(6,2) not null,
  fee               numeric(10,2) not null check (fee >= 0),
  -- 100 = the artisan keeps the whole transport fee. This is the agreed default:
  -- transport is a cost reimbursement, not platform revenue. See PLAN.md §4.
  provider_share_pct numeric(5,2) not null default 100 check (provider_share_pct between 0 and 100),
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  constraint transport_zones_band check (max_km > min_km)
);

-- Operational knobs the client's admin can tune without a deploy.
create table public.settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id)
);

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------

create table public.jobs (
  id               uuid primary key default gen_random_uuid(),
  reference        text not null unique,
  client_id        uuid not null references public.clients (profile_id) on delete restrict,
  provider_id      uuid references public.providers (profile_id) on delete set null,
  category_id      uuid not null references public.categories (id) on delete restrict,
  status           public.job_status not null default 'draft',
  description      text,
  voice_note_path  text,
  location         extensions.geography(Point, 4326),
  address_text     text,
  ghanapost_code   text,   -- e.g. GA-543-0125
  landmark         text,
  matching_radius_km numeric(5,2) not null default 5,
  matching_pass    int not null default 0,
  quote_rejections int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  closed_at        timestamptz
);

create index jobs_location_idx on public.jobs using gist (location);
create index jobs_client_idx on public.jobs (client_id, created_at desc);
create index jobs_provider_idx on public.jobs (provider_id, created_at desc);
create index jobs_status_idx on public.jobs (status);

create table public.job_photos (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references public.jobs (id) on delete cascade,
  storage_path text not null,
  stage        public.job_photo_stage not null default 'request',
  uploaded_by  uuid not null references public.profiles (id),
  created_at   timestamptz not null default now()
);

create index job_photos_job_idx on public.job_photos (job_id);

create table public.job_offers (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references public.jobs (id) on delete cascade,
  provider_id  uuid not null references public.providers (profile_id) on delete cascade,
  sequence_no  int not null,
  distance_km  numeric(6,2),
  status       public.offer_status not null default 'pending',
  sent_at      timestamptz not null default now(),
  expires_at   timestamptz not null,
  responded_at timestamptz,
  unique (job_id, provider_id, sequence_no)
);

create index job_offers_pending_idx on public.job_offers (status, expires_at)
  where status = 'pending';
create index job_offers_provider_idx on public.job_offers (provider_id, status);

-- The audit log. When a dispute lands six weeks after the fact, this table is
-- the only record of what actually happened. Append-only by policy.
create table public.job_events (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs (id) on delete cascade,
  from_status public.job_status,
  to_status   public.job_status not null,
  actor_id    uuid references public.profiles (id),
  actor_role  public.user_role,
  reason      text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index job_events_job_idx on public.job_events (job_id, created_at);

create table public.location_pings (
  id          bigserial primary key,
  job_id      uuid not null references public.jobs (id) on delete cascade,
  provider_id uuid not null references public.providers (profile_id) on delete cascade,
  location    extensions.geography(Point, 4326) not null,
  accuracy_m  numeric(8,2),
  recorded_at timestamptz not null default now()
);

create index location_pings_job_idx on public.location_pings (job_id, recorded_at desc);

create table public.signoffs (
  job_id         uuid primary key references public.jobs (id) on delete cascade,
  signature_data text not null,
  client_notes   text,
  signed_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Money
-- ---------------------------------------------------------------------------

create table public.quotes (
  id                uuid primary key default gen_random_uuid(),
  job_id            uuid not null references public.jobs (id) on delete cascade,
  provider_id       uuid not null references public.providers (profile_id) on delete restrict,
  status            public.quote_status not null default 'draft',
  -- subtotal is what the ARTISAN asked for. service_fee is the platform's 12%
  -- markup. total is what the CLIENT sees. Both numbers are shown to both
  -- parties on purpose — see PLAN.md §4.
  subtotal          numeric(12,2) not null check (subtotal >= 0),
  service_fee_pct   numeric(5,2) not null default 12,
  service_fee_amount numeric(12,2) not null check (service_fee_amount >= 0),
  transport_fee     numeric(10,2) not null default 0 check (transport_fee >= 0),
  total             numeric(12,2) not null check (total >= 0),
  deposit_amount    numeric(12,2) not null check (deposit_amount >= 0),
  notes             text,
  created_at        timestamptz not null default now(),
  sent_at           timestamptz,
  responded_at      timestamptz
);

create index quotes_job_idx on public.quotes (job_id, created_at desc);

create table public.quote_items (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references public.quotes (id) on delete cascade,
  kind        public.quote_item_kind not null,
  description text not null,
  quantity    numeric(10,2) not null default 1 check (quantity > 0),
  unit_price  numeric(12,2) not null check (unit_price >= 0),
  amount      numeric(12,2) not null check (amount >= 0),
  sort_order  int not null default 0
);

create index quote_items_quote_idx on public.quote_items (quote_id, sort_order);

create table public.payments (
  id                 uuid primary key default gen_random_uuid(),
  job_id             uuid not null references public.jobs (id) on delete restrict,
  leg                public.payment_leg not null,
  amount             numeric(12,2) not null check (amount > 0),
  currency           char(3) not null default 'GHS',
  status             public.payment_status not null default 'pending',
  channel            text,                       -- momo | card | bank_transfer
  momo_network       public.momo_network,
  provider_reference text not null unique,       -- Paystack reference (or mock_*)
  is_simulated       boolean not null default true,
  failure_reason     text,
  raw_payload        jsonb,
  created_at         timestamptz not null default now(),
  paid_at            timestamptz,
  unique (job_id, leg)
);

create index payments_job_idx on public.payments (job_id);
create index payments_status_idx on public.payments (status);

create table public.payouts (
  id                 uuid primary key default gen_random_uuid(),
  job_id             uuid not null references public.jobs (id) on delete restrict,
  provider_id        uuid not null references public.providers (profile_id) on delete restrict,
  amount             numeric(12,2) not null check (amount > 0),
  currency           char(3) not null default 'GHS',
  status             public.payout_status not null default 'pending',
  transfer_reference text unique,
  is_simulated       boolean not null default true,
  failure_reason     text,
  raw_payload        jsonb,
  initiated_at       timestamptz not null default now(),
  settled_at         timestamptz
);

create index payouts_provider_idx on public.payouts (provider_id, initiated_at desc);

-- ---------------------------------------------------------------------------
-- Trust and support
-- ---------------------------------------------------------------------------

create table public.ratings (
  job_id      uuid primary key references public.jobs (id) on delete cascade,
  client_id   uuid not null references public.clients (profile_id) on delete cascade,
  provider_id uuid not null references public.providers (profile_id) on delete cascade,
  stars       int not null check (stars between 1 and 5),
  comment     text,
  tags        text[] not null default '{}',
  created_at  timestamptz not null default now()
);

create index ratings_provider_idx on public.ratings (provider_id, created_at desc);

create table public.disputes (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null references public.jobs (id) on delete cascade,
  raised_by      uuid not null references public.profiles (id),
  reason         text not null,
  detail         text,
  evidence_paths text[] not null default '{}',
  status         public.dispute_status not null default 'open',
  resolution     text,
  admin_id       uuid references public.profiles (id),
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz
);

create index disputes_status_idx on public.disputes (status, created_at desc);

-- Every message we send (or would have sent) lands here. In simulation the row
-- records the cost the SMS WOULD have incurred, so that by go-live the client
-- has a real monthly SMS budget figure instead of a guess. See PLAN.md §3.
create table public.notifications_log (
  id                  uuid primary key default gen_random_uuid(),
  recipient_phone     text,
  recipient_id        uuid references public.profiles (id) on delete set null,
  channel             public.notification_channel not null,
  template            text not null,
  body                text not null,
  cost                numeric(10,4) not null default 0,
  currency            char(3) not null default 'GHS',
  provider_message_id text,
  status              text not null default 'sent',
  is_simulated        boolean not null default true,
  created_at          timestamptz not null default now()
);

create index notifications_log_recipient_idx on public.notifications_log (recipient_phone, created_at desc);

-- ---------------------------------------------------------------------------
-- OTP challenges
-- ---------------------------------------------------------------------------
-- We manage OTP ourselves rather than using Supabase's built-in phone auth.
-- Supabase phone auth only supports Twilio/MessageBird/Vonage/Textlocal, none of
-- which are the Ghanaian providers we intend to use (Arkesel/Hubtel). Owning the
-- challenge means the simulated and live flows are identical apart from which
-- SmsProvider actually delivers the message. See PLAN.md §3.

create table public.otp_challenges (
  id           uuid primary key default gen_random_uuid(),
  phone        text not null,
  code_hash    text not null,
  purpose      text not null default 'login',
  attempts     int not null default 0,
  max_attempts int not null default 5,
  expires_at   timestamptz not null,
  consumed_at  timestamptz,
  created_ip   text,
  created_at   timestamptz not null default now()
);

create index otp_challenges_phone_idx on public.otp_challenges (phone, created_at desc);

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------
-- provider-docs holds Ghana Card images and selfies. That is sensitive personal
-- data under the Data Protection Act — private bucket, signed URLs to admins
-- only, never public.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',      'avatars',      true,  2  * 1024 * 1024, array['image/jpeg','image/png','image/webp']),
  ('job-photos',   'job-photos',   false, 10 * 1024 * 1024, array['image/jpeg','image/png','image/webp','image/heic']),
  ('voice-notes',  'voice-notes',  false, 5  * 1024 * 1024, array['audio/webm','audio/mpeg','audio/mp4','audio/ogg']),
  ('provider-docs','provider-docs',false, 10 * 1024 * 1024, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

-- ══════════════════════════════════════════════════════════════
-- 0002_functions.sql
-- ══════════════════════════════════════════════════════════════
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

-- ══════════════════════════════════════════════════════════════
-- 0003_rls.sql
-- ══════════════════════════════════════════════════════════════
-- ArtisanGH — 0003 row level security
--
-- Posture: deny by default, enable RLS on every table, then grant the narrowest
-- workable read/write. The service role bypasses RLS entirely and is used only
-- by trusted server code (OTP verification, payment webhooks, the seed script).
--
-- Three principals:
--   client   — sees only their own jobs and their own data
--   provider — sees jobs offered to them or assigned to them, nothing else
--   admin    — sees everything

alter table public.profiles             enable row level security;
alter table public.clients              enable row level security;
alter table public.providers            enable row level security;
alter table public.provider_documents   enable row level security;
alter table public.verification_reviews enable row level security;
alter table public.categories           enable row level security;
alter table public.provider_categories  enable row level security;
alter table public.transport_zones      enable row level security;
alter table public.settings             enable row level security;
alter table public.jobs                 enable row level security;
alter table public.job_photos           enable row level security;
alter table public.job_offers           enable row level security;
alter table public.job_events           enable row level security;
alter table public.location_pings       enable row level security;
alter table public.signoffs             enable row level security;
alter table public.quotes               enable row level security;
alter table public.quote_items          enable row level security;
alter table public.payments             enable row level security;
alter table public.payouts              enable row level security;
alter table public.ratings              enable row level security;
alter table public.disputes             enable row level security;
alter table public.notifications_log    enable row level security;
alter table public.otp_challenges       enable row level security;

-- otp_challenges is service-role only. No policies at all means no access for
-- anon or authenticated, which is exactly right — the OTP flow runs entirely in
-- trusted server code.

-- ---------------------------------------------------------------------------
-- Helper: can the current user see this job?
-- ---------------------------------------------------------------------------

create or replace function public.can_view_job(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.is_admin()
    or exists (select 1 from public.jobs j where j.id = p_job_id and j.client_id = auth.uid())
    or exists (select 1 from public.jobs j where j.id = p_job_id and j.provider_id = auth.uid())
    or exists (select 1 from public.job_offers o where o.job_id = p_job_id and o.provider_id = auth.uid());
$$;

grant execute on function public.can_view_job(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create policy "profiles: read own"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "profiles: admin reads all"
  on public.profiles for select to authenticated
  using (public.is_admin());

-- Counterparties on a shared job can see each other's name and phone. Without
-- this the client cannot call the artisan who is on the way to their house.
create policy "profiles: read job counterparty"
  on public.profiles for select to authenticated
  using (
    exists (
      select 1 from public.jobs j
      where (j.client_id = auth.uid() and j.provider_id = profiles.id)
         or (j.provider_id = auth.uid() and j.client_id = profiles.id)
    )
  );

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles: admin updates any"
  on public.profiles for update to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------

create policy "clients: read own"
  on public.clients for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());

create policy "clients: update own"
  on public.clients for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- providers
-- ---------------------------------------------------------------------------

create policy "providers: read own"
  on public.providers for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());

-- Approved providers are visible to any signed-in user so a client can see who
-- has been matched to them. Unapproved applications stay private.
create policy "providers: read approved"
  on public.providers for select to authenticated
  using (verification_status = 'approved');

create policy "providers: update own"
  on public.providers for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy "providers: admin updates any"
  on public.providers for update to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- provider_documents — Ghana Card images. Owner and admin only, ever.
-- ---------------------------------------------------------------------------

create policy "provider_documents: read own or admin"
  on public.provider_documents for select to authenticated
  using (provider_id = auth.uid() or public.is_admin());

create policy "provider_documents: insert own"
  on public.provider_documents for insert to authenticated
  with check (provider_id = auth.uid());

create policy "provider_documents: delete own"
  on public.provider_documents for delete to authenticated
  using (provider_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- verification_reviews
-- ---------------------------------------------------------------------------

create policy "verification_reviews: provider reads own"
  on public.verification_reviews for select to authenticated
  using (provider_id = auth.uid() or public.is_admin());

create policy "verification_reviews: admin writes"
  on public.verification_reviews for insert to authenticated
  with check (public.is_admin() and admin_id = auth.uid());

-- ---------------------------------------------------------------------------
-- categories, transport_zones — world readable, admin writable
-- ---------------------------------------------------------------------------

create policy "categories: public read"
  on public.categories for select to anon, authenticated
  using (is_active or public.is_admin());

create policy "categories: admin writes"
  on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "transport_zones: public read"
  on public.transport_zones for select to anon, authenticated
  using (is_active or public.is_admin());

create policy "transport_zones: admin writes"
  on public.transport_zones for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "provider_categories: read"
  on public.provider_categories for select to anon, authenticated
  using (true);

create policy "provider_categories: own writes"
  on public.provider_categories for all to authenticated
  using (provider_id = auth.uid() or public.is_admin())
  with check (provider_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- settings — admin only. Commission rates and thresholds are not public.
-- ---------------------------------------------------------------------------

create policy "settings: admin only"
  on public.settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- jobs
-- ---------------------------------------------------------------------------

create policy "jobs: participants read"
  on public.jobs for select to authenticated
  using (
    client_id = auth.uid()
    or provider_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.job_offers o
      where o.job_id = jobs.id and o.provider_id = auth.uid()
    )
  );

create policy "jobs: client creates own"
  on public.jobs for insert to authenticated
  with check (client_id = auth.uid());

create policy "jobs: client updates own"
  on public.jobs for update to authenticated
  using (client_id = auth.uid())
  with check (client_id = auth.uid());

create policy "jobs: assigned provider updates"
  on public.jobs for update to authenticated
  using (provider_id = auth.uid())
  with check (provider_id = auth.uid());

create policy "jobs: admin updates any"
  on public.jobs for update to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Job children — all gated through can_view_job()
-- ---------------------------------------------------------------------------

create policy "job_photos: participants read"
  on public.job_photos for select to authenticated
  using (public.can_view_job(job_id));

create policy "job_photos: participants write"
  on public.job_photos for insert to authenticated
  with check (public.can_view_job(job_id) and uploaded_by = auth.uid());

create policy "job_events: participants read"
  on public.job_events for select to authenticated
  using (public.can_view_job(job_id));
-- Deliberately no insert/update/delete policy. job_events is written only by
-- the SECURITY DEFINER trigger, which makes the audit log append-only and
-- untamperable from the client.

create policy "job_offers: provider reads own"
  on public.job_offers for select to authenticated
  using (provider_id = auth.uid() or public.can_view_job(job_id));

create policy "job_offers: provider responds"
  on public.job_offers for update to authenticated
  using (provider_id = auth.uid() and status = 'pending')
  with check (provider_id = auth.uid());

create policy "location_pings: participants read"
  on public.location_pings for select to authenticated
  using (public.can_view_job(job_id));

create policy "location_pings: provider writes own"
  on public.location_pings for insert to authenticated
  with check (provider_id = auth.uid());

create policy "signoffs: participants read"
  on public.signoffs for select to authenticated
  using (public.can_view_job(job_id));

create policy "signoffs: client writes"
  on public.signoffs for insert to authenticated
  with check (exists (select 1 from public.jobs j where j.id = job_id and j.client_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Money — readable by participants, writable only by trusted server code
-- ---------------------------------------------------------------------------

create policy "quotes: participants read"
  on public.quotes for select to authenticated
  using (public.can_view_job(job_id));

create policy "quotes: provider writes own"
  on public.quotes for insert to authenticated
  with check (provider_id = auth.uid());

create policy "quotes: provider updates own draft"
  on public.quotes for update to authenticated
  using (provider_id = auth.uid() and status in ('draft', 'sent'))
  with check (provider_id = auth.uid());

create policy "quote_items: participants read"
  on public.quote_items for select to authenticated
  using (exists (
    select 1 from public.quotes q where q.id = quote_id and public.can_view_job(q.job_id)
  ));

create policy "quote_items: provider writes own"
  on public.quote_items for all to authenticated
  using (exists (select 1 from public.quotes q where q.id = quote_id and q.provider_id = auth.uid()))
  with check (exists (select 1 from public.quotes q where q.id = quote_id and q.provider_id = auth.uid()));

-- Payments and payouts are READ ONLY to end users. Rows are created and
-- transitioned exclusively by server code holding the service role, driven by
-- the payment provider's webhook. A client being able to write its own payment
-- row would be the whole security model gone.
create policy "payments: participants read"
  on public.payments for select to authenticated
  using (public.can_view_job(job_id));

create policy "payouts: provider reads own"
  on public.payouts for select to authenticated
  using (provider_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Trust and support
-- ---------------------------------------------------------------------------

create policy "ratings: public read"
  on public.ratings for select to anon, authenticated
  using (true);

create policy "ratings: client writes own"
  on public.ratings for insert to authenticated
  with check (client_id = auth.uid());

create policy "disputes: participants read"
  on public.disputes for select to authenticated
  using (public.can_view_job(job_id) or public.is_admin());

create policy "disputes: participants raise"
  on public.disputes for insert to authenticated
  with check (raised_by = auth.uid() and public.can_view_job(job_id));

create policy "disputes: admin resolves"
  on public.disputes for update to authenticated
  using (public.is_admin());

create policy "notifications_log: read own"
  on public.notifications_log for select to authenticated
  using (recipient_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage policies
-- ---------------------------------------------------------------------------
-- Convention: files are stored under a folder named for the owning entity's
-- uuid, so `storage.foldername(name)[1]` is the owner id.

create policy "avatars: public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'avatars');

create policy "avatars: own write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: own update"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Ghana Card images and selfies. Owner and admin only. Never public, served
-- through short-lived signed URLs.
create policy "provider-docs: own or admin read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'provider-docs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

create policy "provider-docs: own write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'provider-docs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "job-photos: participants read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'job-photos'
    and public.can_view_job(((storage.foldername(name))[1])::uuid)
  );

create policy "job-photos: participants write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'job-photos'
    and public.can_view_job(((storage.foldername(name))[1])::uuid)
  );

create policy "voice-notes: participants read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'voice-notes'
    and public.can_view_job(((storage.foldername(name))[1])::uuid)
  );

create policy "voice-notes: participants write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'voice-notes'
    and public.can_view_job(((storage.foldername(name))[1])::uuid)
  );

-- ══════════════════════════════════════════════════════════════
-- 0004_reference_data.sql
-- ══════════════════════════════════════════════════════════════
-- ArtisanGH — 0004 reference data
--
-- Categories, transport zone bands and operational settings. Idempotent, so it
-- is safe to re-run. Transport fees here are PLACEHOLDERS — the client confirms
-- real Accra/Tema numbers before go-live (PLAN.md §16).

-- ---------------------------------------------------------------------------
-- Service categories
-- ---------------------------------------------------------------------------

insert into public.categories (name, slug, icon, description, sort_order) values
  ('Electrical',                  'electrical',           'zap',          'Wiring, sockets, lighting, fuse boards, faults', 10),
  ('Plumbing',                    'plumbing',             'droplets',     'Leaks, pipes, taps, toilets, water pressure', 20),
  ('AC & Refrigeration',          'ac-refrigeration',     'snowflake',    'Air conditioner install, servicing, gas refill, fridges', 30),
  ('Carpentry',                   'carpentry',            'hammer',       'Doors, wardrobes, furniture repair, fittings', 40),
  ('Painting',                    'painting',             'paint-roller', 'Interior and exterior painting, touch-ups', 50),
  ('Cleaning',                    'cleaning',             'sparkles',     'Deep cleaning, post-construction, move-in and move-out', 60),
  ('Masonry & Tiling',            'masonry-tiling',       'brick-wall',   'Block work, plastering, floor and wall tiles', 70),
  ('Welding & Metalwork',         'welding-metalwork',    'flame',        'Gates, burglar-proofing, railings, repairs', 80),
  ('Appliance Repair',            'appliance-repair',     'washing-machine', 'Washing machines, microwaves, cookers, TVs', 90),
  ('Generator Repair',            'generator-repair',     'fuel',         'Generator servicing, repair and installation', 100),
  ('Roofing',                     'roofing',              'home',         'Leaks, sheet replacement, gutters, ceilings', 110),
  ('Aluminium & Glass',           'aluminium-glass',      'square',       'Windows, sliding doors, shopfronts, glazing', 120),
  ('CCTV & Security',             'cctv-security',        'cctv',         'Cameras, alarms, intercoms, electric fencing', 130),
  ('Pest Control',                'pest-control',         'bug',          'Fumigation, termites, rodents, mosquitoes', 140),
  ('Landscaping & Gardening',     'landscaping',          'trees',        'Lawn care, hedging, garden design, clearing', 150),
  ('Borehole & Water Systems',    'borehole-water',       'waves',        'Pumps, polytanks, filtration, boreholes', 160),
  ('POP & Ceiling Works',         'pop-ceiling',          'layout-panel-top', 'POP designs, ceiling installation and repair', 170),
  ('Upholstery',                  'upholstery',           'sofa',         'Sofa recovering, cushions, foam replacement', 180),
  ('Curtains & Blinds',           'curtains-blinds',      'blinds',       'Measuring, sewing, rails and installation', 190),
  ('Locksmith',                   'locksmith',            'key-round',    'Lock fitting, lockouts, key cutting, padlocks', 200),
  ('Satellite & TV Installation', 'satellite-tv',         'satellite-dish', 'Dish alignment, decoders, wall mounting', 210),
  ('Solar Installation',          'solar',                'sun',          'Panels, inverters, batteries, maintenance', 220),
  ('Mobile Auto Mechanic',        'auto-mechanic',        'car',          'Roadside and at-home vehicle servicing and repair', 230),
  ('Interior Fit-out',            'interior-fitout',      'ruler',        'Partitioning, shelving, full room finishing', 240),
  ('Tailoring',                   'tailoring',            'scissors',     'Alterations, repairs, custom sewing at home', 250),
  ('Hair & Beauty (Home)',        'hair-beauty',          'scissors-line-dashed', 'Home-service braiding, barbering, nails, makeup', 260)
on conflict (slug) do update
  set name        = excluded.name,
      icon        = excluded.icon,
      description = excluded.description,
      sort_order  = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- Transport zones (PLACEHOLDER VALUES — confirm with client before go-live)
-- ---------------------------------------------------------------------------
-- provider_share_pct is 100 across the board: the transport fee passes to the
-- artisan in full. It is a cost reimbursement, not platform revenue.

insert into public.transport_zones (city, min_km, max_km, fee, provider_share_pct)
select * from (values
  ('*',      0.00,   5.00,   20.00, 100.00),
  ('*',      5.00,  15.00,   40.00, 100.00),
  ('*',     15.00,  30.00,   60.00, 100.00),
  ('*',     30.00, 100.00,  100.00, 100.00)
) as v(city, min_km, max_km, fee, provider_share_pct)
where not exists (select 1 from public.transport_zones);

-- ---------------------------------------------------------------------------
-- Operational settings
-- ---------------------------------------------------------------------------
-- All tunable by the client's admin without a deploy. Reliability thresholds
-- are the starting numbers from PLAN.md §8.

insert into public.settings (key, value, description) values
  ('platform_commission_pct', '12'::jsonb,
   'Percent added on top of the artisan quote. The platform''s only revenue line.'),

  ('deposit_pct', '50'::jsonb,
   'Percent of the marked-up total collected before the artisan travels.'),

  ('offer_timeout_seconds', '120'::jsonb,
   'How long a single artisan has to accept an offer before it passes on.'),

  ('matching_radius_passes', '[5, 10, 20]'::jsonb,
   'Radius in km for each successive matching pass before falling through to admin.'),

  ('max_quote_rejections', '3'::jsonb,
   'Quote rejections before a job stops rematching and offers an admin callback.'),

  ('min_job_value_ghs', '80'::jsonb,
   'Below this the payout transfer fee makes the economics unworkable.'),

  ('reliability', jsonb_build_object(
      'window_days',                 30,
      'min_offers_before_scoring',   5,
      'accept_rate_deprioritise',    40,
      'accept_rate_review',          20,
      'cancel_after_accept_suspend', 3,
      'no_show_suspend',             2,
      'no_show_hours',               2,
      'rating_review_below',         3.0,
      'rating_review_min_jobs',      5,
      'rating_suspend_below',        2.5,
      'rating_suspend_min_jobs',     10
   ),
   'Artisan reliability thresholds. Suspension always requires an admin to reinstate.'),

  ('support_phone', '"+233000000000"'::jsonb,
   'Shown to users when a job stalls or a dispute is raised. Replace before launch.')
on conflict (key) do nothing;

-- ══════════════════════════════════════════════════════════════
-- 0005_location.sql
-- ══════════════════════════════════════════════════════════════
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

-- ══════════════════════════════════════════════════════════════
-- 0006_column_guards.sql
-- ══════════════════════════════════════════════════════════════
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

-- ══════════════════════════════════════════════════════════════
-- 0007_job_posting.sql
-- ══════════════════════════════════════════════════════════════
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
