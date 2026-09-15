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
