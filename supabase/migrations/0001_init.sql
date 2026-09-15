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
