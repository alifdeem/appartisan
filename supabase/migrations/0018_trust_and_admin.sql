-- ArtisanGH — 0018 trust and admin (Phase 6)
--
-- Ratings, disputes, reliability scoring, and the admin knobs that let the
-- client tune the platform without a deploy.
--
-- Three things in here are corrections rather than additions, and they are the
-- reason this migration is larger than it looks:
--
--   1. `providers.jobs_completed` has never been incremented. It was defined in
--      0001, guarded as "derived, not editable" in 0006, and then nothing ever
--      derived it. Every artisan has shown 0 completed jobs since launch.
--
--   2. `ratings: client writes own` (0003) checks only `client_id = auth.uid()`.
--      RLS is row-level: that policy lets any client insert a rating for any
--      provider on any job, including one they were never party to. Reputation
--      is the product's whole promise, so this is the most valuable table in
--      the schema to be able to forge.
--
--   3. Reputation columns have no platform escape hatch. `rate_job` has to
--      write `rating_avg`, and the 0017 guard refuses it for anyone who is not
--      an admin or the service role — so a client rating their own finished job
--      would raise 42501. Same shape of fix as 0017: a transaction-local flag
--      only a SECURITY DEFINER function can open.

-- ---------------------------------------------------------------------------
-- 1. The reputation escape hatch
-- ---------------------------------------------------------------------------

create or replace function public.provider_reputation_change_permitted()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(current_setting('artisangh.provider_reputation_change', true), 'off') = 'on';
$$;

comment on function public.provider_reputation_change_permitted is
  'True only inside a platform function that has opened the flag for this '
  'transaction. Lets rate_job and the reliability sweep write derived '
  'reputation columns without letting an artisan touch their own.';

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

  if new.verification_status is distinct from old.verification_status
     and not public.provider_status_change_permitted() then
    raise exception 'Verification status is set by an administrator, not by you.'
      using errcode = '42501';
  end if;

  if new.availability is distinct from old.availability
     and not public.provider_status_change_permitted() then
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

  -- CHANGED in 0018. Suspension is still an administrator's call, but the
  -- reliability sweep is the platform acting on thresholds the client set, so
  -- it may suspend through the flag. PLAN.md §8 is explicit that the sweep only
  -- ever suspends *into* an admin's queue — it never bans anyone outright.
  if (new.suspended_at is distinct from old.suspended_at
      or new.suspension_reason is distinct from old.suspension_reason)
     and not public.provider_reputation_change_permitted() then
    raise exception 'Suspension is set by an administrator.' using errcode = '42501';
  end if;

  -- CHANGED in 0018. Still not editable by the artisan; now writable by the
  -- platform functions that actually derive them.
  if (new.rating_avg     is distinct from old.rating_avg
      or new.rating_count  is distinct from old.rating_count
      or new.jobs_completed is distinct from old.jobs_completed)
     and not public.provider_reputation_change_permitted() then
    raise exception 'Reputation figures are derived, not editable.' using errcode = '42501';
  end if;

  if new.payout_recipient_code is distinct from old.payout_recipient_code then
    raise exception 'Payout details are set by the platform.' using errcode = '42501';
  end if;

  if new.ghana_card_number is distinct from old.ghana_card_number
     and old.verification_status in ('pending', 'approved', 'suspended') then
    raise exception 'Your Ghana Card number cannot be changed while your account is under review.'
      using errcode = '42501';
  end if;

  if new.application_submitted_at is distinct from old.application_submitted_at
     and not public.provider_status_change_permitted() then
    raise exception 'Submission time is recorded by the platform.' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Ratings
-- ---------------------------------------------------------------------------
-- The forgeable insert policy from 0003, replaced. A rating now requires that
-- the row actually describes a job you paid for.

drop policy if exists "ratings: client writes own" on public.ratings;

create policy "ratings: client rates own finished job"
  on public.ratings for insert to authenticated
  with check (
    client_id = auth.uid()
    and exists (
      select 1 from public.jobs j
      where j.id = ratings.job_id
        and j.client_id = auth.uid()
        and j.provider_id = ratings.provider_id
        and j.status in ('paid', 'closed')
    )
  );

create or replace function public.recompute_provider_rating(p_provider_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_avg   numeric(3,2);
  v_count int;
begin
  select coalesce(round(avg(stars)::numeric, 2), 0), count(*)
    into v_avg, v_count
  from public.ratings
  where provider_id = p_provider_id;

  perform set_config('artisangh.provider_reputation_change', 'on', true);
  update public.providers
     set rating_avg = v_avg, rating_count = v_count, updated_at = now()
   where profile_id = p_provider_id;
  perform set_config('artisangh.provider_reputation_change', 'off', true);
end;
$$;

comment on function public.recompute_provider_rating is
  'Recomputes from the ratings table rather than incrementing a running total. '
  'An increment drifts the moment a rating is corrected or a job is deleted, '
  'and the number is small enough that recomputing costs nothing.';

create or replace function public.rate_job(
  p_job_id  uuid,
  p_stars   int,
  p_comment text default null,
  p_tags    text[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.jobs;
begin
  select * into v_job from public.jobs where id = p_job_id;

  if v_job.id is null then
    raise exception 'Job not found.' using errcode = 'P0002';
  end if;

  if v_job.client_id is distinct from auth.uid() and not public.is_trusted_backend() then
    raise exception 'Only the client who booked the job can rate it.' using errcode = '42501';
  end if;

  if v_job.status not in ('paid', 'closed') then
    raise exception 'You can rate the work once the job is paid for.' using errcode = '22023';
  end if;

  if v_job.provider_id is null then
    raise exception 'This job has no artisan to rate.' using errcode = '22023';
  end if;

  if p_stars < 1 or p_stars > 5 then
    raise exception 'A rating is between 1 and 5 stars.' using errcode = '22023';
  end if;

  -- One rating per job: `ratings.job_id` is the primary key. Re-rating updates
  -- rather than failing, because a client who changes their mind an hour later
  -- should not have to phone support to do it.
  insert into public.ratings (job_id, client_id, provider_id, stars, comment, tags)
  values (p_job_id, v_job.client_id, v_job.provider_id, p_stars, nullif(trim(p_comment), ''), coalesce(p_tags, '{}'))
  on conflict (job_id) do update
    set stars = excluded.stars, comment = excluded.comment, tags = excluded.tags;

  perform public.recompute_provider_rating(v_job.provider_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. jobs_completed — the counter that was never counted
-- ---------------------------------------------------------------------------

create or replace function public.recount_provider_jobs(p_provider_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  select count(*) into v_count
  from public.jobs
  where provider_id = p_provider_id and status in ('paid', 'closed');

  perform set_config('artisangh.provider_reputation_change', 'on', true);
  update public.providers
     set jobs_completed = v_count, updated_at = now()
   where profile_id = p_provider_id;
  perform set_config('artisangh.provider_reputation_change', 'off', true);
end;
$$;

create or replace function public.sync_provider_jobs_completed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.provider_id is not null
     and new.status in ('paid', 'closed')
     and old.status is distinct from new.status then
    perform public.recount_provider_jobs(new.provider_id);
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_sync_completed_count on public.jobs;
create trigger jobs_sync_completed_count
  after update on public.jobs
  for each row execute function public.sync_provider_jobs_completed();

-- Backfill: every job already paid or closed predates the trigger.
do $$
declare
  v_id uuid;
begin
  for v_id in select distinct provider_id from public.jobs
               where provider_id is not null and status in ('paid', 'closed')
  loop
    perform public.recount_provider_jobs(v_id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Disputes
-- ---------------------------------------------------------------------------

create or replace function public.raise_dispute(
  p_job_id         uuid,
  p_reason         text,
  p_detail         text default null,
  p_evidence_paths text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.jobs;
  v_id  uuid;
begin
  select * into v_job from public.jobs where id = p_job_id;

  if v_job.id is null then
    raise exception 'Job not found.' using errcode = 'P0002';
  end if;

  if v_job.client_id is distinct from auth.uid()
     and v_job.provider_id is distinct from auth.uid()
     and not public.is_admin() then
    raise exception 'That is not your job.' using errcode = '42501';
  end if;

  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Say what went wrong.' using errcode = '22023';
  end if;

  -- A job in dispute must not quietly keep moving. The status machine treats
  -- `disputed` as terminal until an admin resolves it (PLAN.md §6).
  if exists (select 1 from public.disputes where job_id = p_job_id and status in ('open', 'investigating')) then
    raise exception 'There is already an open dispute on this job.' using errcode = '23505';
  end if;

  insert into public.disputes (job_id, raised_by, reason, detail, evidence_paths)
  values (p_job_id, auth.uid(), trim(p_reason), nullif(trim(p_detail), ''), coalesce(p_evidence_paths, '{}'))
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.resolve_dispute(
  p_dispute_id uuid,
  p_status     public.dispute_status,
  p_resolution text
)
returns public.dispute_status
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_dispute public.disputes;
begin
  if not public.is_admin() then
    raise exception 'Disputes are resolved by an administrator.' using errcode = '42501';
  end if;

  select * into v_dispute from public.disputes where id = p_dispute_id;

  if v_dispute.id is null then
    raise exception 'Dispute not found.' using errcode = 'P0002';
  end if;

  if p_status not in ('investigating', 'resolved', 'rejected') then
    raise exception 'A dispute moves to investigating, resolved or rejected.' using errcode = '22023';
  end if;

  if p_status in ('resolved', 'rejected') and coalesce(trim(p_resolution), '') = '' then
    raise exception 'Record what was decided and why.' using errcode = '22023';
  end if;

  update public.disputes
     set status      = p_status,
         resolution  = nullif(trim(p_resolution), ''),
         admin_id    = auth.uid(),
         resolved_at = case when p_status in ('resolved', 'rejected') then now() else null end
   where id = p_dispute_id;

  return p_status;
end;
$$;

create policy "disputes: admin reads all"
  on public.disputes for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. Reliability scoring (PLAN.md §8)
-- ---------------------------------------------------------------------------
-- Every threshold is read from `settings`, so the client tunes them in the
-- admin console rather than through a deploy.

create or replace function public.provider_reliability(p_provider_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_cfg         jsonb;
  v_window      int;
  v_since       timestamptz;
  v_offered     int;
  v_accepted    int;
  v_accept_rate numeric;
  v_cancels     int;
  v_no_shows    int;
  v_provider    public.providers;
begin
  -- An artisan may read their own; an admin may read anyone's. Hiding the
  -- score and then punishing people for it is how you lose supply (PLAN.md §8).
  if p_provider_id is distinct from auth.uid()
     and not public.is_admin()
     and not public.is_trusted_backend() then
    raise exception 'That is not your account.' using errcode = '42501';
  end if;

  select value into v_cfg from public.settings where key = 'reliability';
  v_window := coalesce((v_cfg ->> 'window_days')::int, 30);
  v_since  := now() - make_interval(days => v_window);

  select * into v_provider from public.providers where profile_id = p_provider_id;

  select count(*) filter (where true),
         count(*) filter (where status = 'accepted')
    into v_offered, v_accepted
  from public.job_offers
  where provider_id = p_provider_id and sent_at >= v_since;

  v_accept_rate := case when v_offered = 0 then null
                        else round((v_accepted::numeric / v_offered) * 100, 1) end;

  select count(*) into v_cancels
  from public.jobs
  where provider_id = p_provider_id
    and status = 'cancelled_by_provider'
    and updated_at >= v_since;

  -- A no-show is an accepted offer where the job never reached `en_route`
  -- within the grace period. The audit log is the only place that records when
  -- a status actually changed, which is exactly what it is for.
  select count(*) into v_no_shows
  from public.job_offers o
  where o.provider_id = p_provider_id
    and o.status = 'accepted'
    and o.responded_at >= v_since
    and o.responded_at < now() - make_interval(hours => coalesce((v_cfg ->> 'no_show_hours')::int, 2))
    and not exists (
      select 1 from public.job_events e
      where e.job_id = o.job_id
        and e.to_status = 'en_route'
        and e.created_at <= o.responded_at
             + make_interval(hours => coalesce((v_cfg ->> 'no_show_hours')::int, 2))
    );

  return jsonb_build_object(
    'window_days',   v_window,
    'offers',        v_offered,
    'accepted',      v_accepted,
    'accept_rate',   v_accept_rate,
    'cancels',       v_cancels,
    'no_shows',      v_no_shows,
    'rating_avg',    coalesce(v_provider.rating_avg, 0),
    'rating_count',  coalesce(v_provider.rating_count, 0),
    'jobs_completed', coalesce(v_provider.jobs_completed, 0),
    -- Below the offer floor nothing is scored at all, so a new artisan cannot
    -- be suspended on their first bad day.
    'scored',        v_offered >= coalesce((v_cfg ->> 'min_offers_before_scoring')::int, 5)
  );
end;
$$;

/**
 * Returns the verdict for one artisan without applying it: 'ok', 'deprioritise',
 * 'review' or 'suspend'. Split from the sweep so the admin console can show why
 * somebody is flagged, and so the thresholds can be tested directly.
 */
create or replace function public.reliability_verdict(p_provider_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_cfg     jsonb;
  v_stats   jsonb;
  v_reasons text[] := '{}';
  v_action  text := 'ok';
begin
  select value into v_cfg from public.settings where key = 'reliability';
  v_stats := public.provider_reliability(p_provider_id);

  if not (v_stats ->> 'scored')::boolean then
    return jsonb_build_object('action', 'ok', 'reasons', '[]'::jsonb, 'stats', v_stats);
  end if;

  -- Suspensions first: the strongest verdict wins, and collecting every reason
  -- matters because the admin who makes the call needs all of them.
  if (v_stats ->> 'cancels')::int >= coalesce((v_cfg ->> 'cancel_after_accept_suspend')::int, 3) then
    v_action := 'suspend';
    v_reasons := v_reasons || format('%s cancellations after accepting', v_stats ->> 'cancels');
  end if;

  if (v_stats ->> 'no_shows')::int >= coalesce((v_cfg ->> 'no_show_suspend')::int, 2) then
    v_action := 'suspend';
    v_reasons := v_reasons || format('%s no-shows', v_stats ->> 'no_shows');
  end if;

  if (v_stats ->> 'rating_count')::int >= coalesce((v_cfg ->> 'rating_suspend_min_jobs')::int, 10)
     and (v_stats ->> 'rating_avg')::numeric < coalesce((v_cfg ->> 'rating_suspend_below')::numeric, 2.5) then
    v_action := 'suspend';
    v_reasons := v_reasons || format('rating %s across %s jobs', v_stats ->> 'rating_avg', v_stats ->> 'rating_count');
  end if;

  if v_action <> 'suspend' then
    if (v_stats ->> 'accept_rate')::numeric < coalesce((v_cfg ->> 'accept_rate_review')::numeric, 20) then
      v_action := 'review';
      v_reasons := v_reasons || format('accept rate %s%%', v_stats ->> 'accept_rate');
    elsif (v_stats ->> 'rating_count')::int >= coalesce((v_cfg ->> 'rating_review_min_jobs')::int, 5)
          and (v_stats ->> 'rating_avg')::numeric < coalesce((v_cfg ->> 'rating_review_below')::numeric, 3) then
      v_action := 'review';
      v_reasons := v_reasons || format('rating %s across %s jobs', v_stats ->> 'rating_avg', v_stats ->> 'rating_count');
    elsif (v_stats ->> 'accept_rate')::numeric < coalesce((v_cfg ->> 'accept_rate_deprioritise')::numeric, 40) then
      v_action := 'deprioritise';
      v_reasons := v_reasons || format('accept rate %s%%', v_stats ->> 'accept_rate');
    end if;
  end if;

  return jsonb_build_object('action', v_action, 'reasons', to_jsonb(v_reasons), 'stats', v_stats);
end;
$$;

create or replace function public.apply_reliability_scoring()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_provider record;
  v_verdict  jsonb;
  v_count    int := 0;
begin
  if not public.is_trusted_backend() then
    raise exception 'Reliability scoring is run by the platform.' using errcode = '42501';
  end if;

  for v_provider in
    select profile_id from public.providers
    where verification_status = 'approved' and suspended_at is null
  loop
    v_verdict := public.reliability_verdict(v_provider.profile_id);

    if v_verdict ->> 'action' = 'suspend' then
      -- Suspension removes the artisan from matching and puts them in front of
      -- an admin. It is never permanent and never automatic-final (PLAN.md §8).
      perform set_config('artisangh.provider_reputation_change', 'on', true);
      perform set_config('artisangh.provider_status_change', 'on', true);
      update public.providers
         set suspended_at      = now(),
             suspension_reason = 'Auto-suspended: '
               || array_to_string(array(select jsonb_array_elements_text(v_verdict -> 'reasons')), '; '),
             availability      = 'offline',
             updated_at        = now()
       where profile_id = v_provider.profile_id;
      perform set_config('artisangh.provider_status_change', 'off', true);
      perform set_config('artisangh.provider_reputation_change', 'off', true);

      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Admin configuration
-- ---------------------------------------------------------------------------

create or replace function public.update_setting(p_key text, p_value jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Settings are changed by an administrator.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.settings where key = p_key) then
    raise exception 'Unknown setting "%".', p_key using errcode = 'P0002';
  end if;

  -- Commission is the platform's only revenue line (PLAN.md §4). A fat finger
  -- here is not recoverable from the jobs already quoted against it.
  if p_key = 'platform_commission_pct'
     and ((p_value)::numeric < 0 or (p_value)::numeric > 50) then
    raise exception 'Commission must be between 0 and 50 percent.' using errcode = '22023';
  end if;

  if p_key = 'deposit_pct'
     and ((p_value)::numeric < 0 or (p_value)::numeric > 100) then
    raise exception 'The deposit must be between 0 and 100 percent.' using errcode = '22023';
  end if;

  update public.settings set value = p_value, updated_at = now() where key = p_key;
  return p_value;
end;
$$;

create or replace function public.save_category(
  p_id          uuid,
  p_name        text,
  p_slug        text,
  p_icon        text,
  p_description text default null,
  p_is_active   boolean default true,
  p_sort_order  int default 0
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Categories are managed by an administrator.' using errcode = '42501';
  end if;

  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_slug), '') = '' then
    raise exception 'A category needs a name and a slug.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.categories (name, slug, icon, description, is_active, sort_order)
    values (trim(p_name), trim(p_slug), p_icon, nullif(trim(p_description), ''), p_is_active, p_sort_order)
    returning id into v_id;
  else
    update public.categories
       set name = trim(p_name), slug = trim(p_slug), icon = p_icon,
           description = nullif(trim(p_description), ''),
           is_active = p_is_active, sort_order = p_sort_order
     where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Category not found.' using errcode = 'P0002';
    end if;
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Privileges
-- ---------------------------------------------------------------------------
-- Same posture as 0013: nothing is callable by anon, and the platform-only
-- sweeps are not callable by authenticated either.

revoke all on function public.rate_job(uuid, int, text, text[]) from public, anon;
grant execute on function public.rate_job(uuid, int, text, text[]) to authenticated;

revoke all on function public.raise_dispute(uuid, text, text, text[]) from public, anon;
grant execute on function public.raise_dispute(uuid, text, text, text[]) to authenticated;

revoke all on function public.resolve_dispute(uuid, public.dispute_status, text) from public, anon;
grant execute on function public.resolve_dispute(uuid, public.dispute_status, text) to authenticated;

revoke all on function public.provider_reliability(uuid) from public, anon;
grant execute on function public.provider_reliability(uuid) to authenticated;

revoke all on function public.reliability_verdict(uuid) from public, anon;
grant execute on function public.reliability_verdict(uuid) to authenticated;

revoke all on function public.update_setting(text, jsonb) from public, anon;
grant execute on function public.update_setting(text, jsonb) to authenticated;

revoke all on function public.save_category(uuid, text, text, text, text, boolean, int) from public, anon;
grant execute on function public.save_category(uuid, text, text, text, text, boolean, int) to authenticated;

-- Platform only. Not reachable with a user's JWT at all.
revoke all on function public.apply_reliability_scoring() from public, anon, authenticated;
revoke all on function public.recompute_provider_rating(uuid) from public, anon, authenticated;
revoke all on function public.recount_provider_jobs(uuid) from public, anon, authenticated;
