-- ArtisanGH — 0011 matching and quoting (Phase 3)
--
-- The sequential-offer matcher and the itemised quote, and the state machine
-- between them (PLAN.md §6).
--
--   posted → matching → offer_sent ⇄ decline/expire → next candidate
--                           ↓ accept
--                      assigned → quote_pending → quote_sent
--                                      ↓ accept → awaiting_deposit
--                                      ↓ reject → matching (×3) → unmatched
--      candidates exhausted at 20km → unmatched → admin assigns → assigned
--
-- Five things this file has to get right, and why each is here rather than in
-- the application:
--
--  1. **The matcher must be idempotent and lock.** It is called from a user
--     action, from `post_job`, and from a cron sweep — potentially at the same
--     moment. Two concurrent calls that both find "the nearest free artisan"
--     would send two offers for one job. Every entry point takes `for update`
--     on the job row first.
--
--  2. **Quote arithmetic is computed here, never accepted from the client.**
--     The browser sends line items; the subtotal, the 12%, the transport band
--     and the deposit are all derived server-side through
--     `compute_quote_totals`. A quote is a number somebody pays — it does not
--     come off a form.
--
--  3. **`guard_jobs_columns` blocks `provider_id` outright**, which is correct
--     for a participant and wrong for the matcher. It also leaves
--     `matching_pass`, `matching_radius_km` and `quote_rejections` completely
--     unguarded, so today a client can widen their own search to 100km or reset
--     their own rejection count. Both fixed below.
--
--  4. **Declining is not rejecting the client.** A declined quote sends the job
--     back to matching, and PLAN.md §6 is explicit that this path will be
--     walked often because there is no price guidance in v1. It has to be a
--     first-class transition, not an error path.
--
--  5. **Nothing may sit still.** A job in `offer_sent` whose offer has expired
--     is a job nobody is looking at. `expire_stale_offers()` is the sweep, and
--     it is written to be safe to run every 30 seconds forever.

-- ---------------------------------------------------------------------------
-- 1. Widen the guard's sanctioned door, and close two holes beside it
-- ---------------------------------------------------------------------------

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

  -- CHANGED in 0011: assignment is still not a participant's to make, but the
  -- matcher has to make it. Same transaction-local flag the status change uses,
  -- opened only inside the functions below.
  if new.provider_id is distinct from old.provider_id
     and not public.job_status_change_permitted() then
    raise exception 'Job assignment is made by the platform, not by participants.'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status
     and not public.job_status_change_permitted() then
    raise exception 'Job status changes go through the platform, not direct writes.'
      using errcode = '42501';
  end if;

  -- NEW in 0011. These three were unguarded, which meant a client could widen
  -- their own search radius past every other client's, skip matching passes, or
  -- zero their own quote-rejection count to keep rematching forever.
  if (new.matching_pass      is distinct from old.matching_pass
      or new.matching_radius_km is distinct from old.matching_radius_km
      or new.quote_rejections   is distinct from old.quote_rejections)
     and not public.job_status_change_permitted() then
    raise exception 'Matching is run by the platform, not by participants.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Settings helpers
-- ---------------------------------------------------------------------------

create or replace function public.setting_int(p_key text, p_fallback int)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select value::text::int from public.settings where key = p_key), p_fallback);
$$;

/** Radius in km for a given 1-based matching pass, clamped to the last band. */
create or replace function public.matching_radius_for_pass(p_pass int)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_passes jsonb;
  v_len    int;
begin
  select value into v_passes from public.settings where key = 'matching_radius_passes';
  if v_passes is null then v_passes := '[5,10,20]'::jsonb; end if;

  v_len := jsonb_array_length(v_passes);
  if v_len = 0 then return 5; end if;

  -- Past the last pass the caller is done widening; returning the widest band
  -- keeps this total rather than making every caller handle a null.
  return (v_passes -> least(greatest(p_pass, 1), v_len) - 1)::text::numeric;
end;
$$;

/** How many passes exist before a job falls through to the admin queue. */
create or replace function public.matching_pass_count()
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    jsonb_array_length((select value from public.settings where key = 'matching_radius_passes')),
    3
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. The matcher
-- ---------------------------------------------------------------------------
-- Offers one artisan at a time, nearest first, widening the radius when a pass
-- is exhausted and falling through to `unmatched` when the widest pass is.
--
-- PLAN.md §6 asks that broadcasting to the nearest 3–5 simultaneously later be
-- a config change rather than a rewrite. The shape that makes that true is the
-- candidate query being separate from the offer loop: to broadcast, raise the
-- `limit` here and insert a row per candidate. Nothing else moves.

create or replace function public.advance_matching(p_job_id uuid)
returns public.job_status
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job       public.jobs;
  v_pass      int;
  v_max_pass  int;
  v_radius    numeric;
  v_candidate record;
  v_timeout   int;
  v_seq       int;
begin
  select * into v_job from public.jobs where id = p_job_id for update;

  if v_job.id is null then
    raise exception 'Job not found.' using errcode = 'P0002';
  end if;

  -- The only statuses from which looking for an artisan makes sense. Anything
  -- else is a job that has moved on, and re-entering the matcher would send an
  -- offer for work somebody is already doing.
  if v_job.status not in ('posted', 'matching', 'offer_sent') then
    return v_job.status;
  end if;

  -- A live offer is somebody's 120 seconds. Do not step on it.
  if exists (
    select 1 from public.job_offers
    where job_id = p_job_id and status = 'pending' and expires_at > now()
  ) then
    return v_job.status;
  end if;

  v_timeout  := public.setting_int('offer_timeout_seconds', 120);
  v_max_pass := public.matching_pass_count();
  v_pass     := greatest(coalesce(v_job.matching_pass, 0), 1);

  perform set_config('artisangh.job_status_change', 'on', true);

  -- Walk outwards. Each pass asks the same question at a wider radius; the
  -- candidate function already excludes anyone busy, unverified, offline, or
  -- previously offered this job, so a pass that finds nobody genuinely has
  -- nobody left to find.
  while v_pass <= v_max_pass loop
    v_radius := public.matching_radius_for_pass(v_pass);

    select * into v_candidate
    from public.find_candidate_providers(p_job_id, v_radius, 1);

    if found then
      select coalesce(max(sequence_no), 0) + 1 into v_seq
      from public.job_offers where job_id = p_job_id;

      insert into public.job_offers
        (job_id, provider_id, sequence_no, distance_km, status, expires_at)
      values
        (p_job_id, v_candidate.provider_id, v_seq, v_candidate.distance_km, 'pending',
         now() + make_interval(secs => v_timeout));

      update public.jobs
         set status             = 'offer_sent',
             matching_pass      = v_pass,
             matching_radius_km = v_radius
       where id = p_job_id;

      perform set_config('artisangh.job_status_change', 'off', true);
      return 'offer_sent'::public.job_status;
    end if;

    v_pass := v_pass + 1;
  end loop;

  -- Every pass exhausted. A human takes over from here — PLAN.md §6 is blunt
  -- that every real marketplace runs on this for its first six months.
  update public.jobs
     set status             = 'unmatched',
         matching_pass      = v_max_pass,
         matching_radius_km = public.matching_radius_for_pass(v_max_pass)
   where id = p_job_id;

  perform set_config('artisangh.job_status_change', 'off', true);
  return 'unmatched'::public.job_status;
end;
$$;

-- `post_job` now hands straight off to the matcher, so a posted job can never
-- sit in `posted` waiting for somebody to remember to look for an artisan.
-- Otherwise identical to the 0009 definition, landmark rule included.
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

  if length(coalesce(trim(v_job.landmark), '')) < 10 then
    raise exception 'Add a landmark so the artisan can find the place — “blue gate opposite Melcom”.'
      using errcode = '22023';
  end if;

  if coalesce(trim(v_job.description), '') = '' and v_job.voice_note_path is null then
    raise exception 'Describe the job, or record a voice note, before posting.'
      using errcode = '22023';
  end if;

  v_radius := public.matching_radius_for_pass(1);

  perform set_config('artisangh.job_status_change', 'on', true);

  update public.jobs
     set status             = 'posted',
         matching_radius_km = v_radius,
         matching_pass      = 1
   where id = p_job_id;

  perform set_config('artisangh.job_status_change', 'off', true);

  -- Fires the first offer in the same transaction as the post. If there is
  -- nobody to offer it to, this lands the job in `unmatched` immediately, which
  -- is a far better answer than a spinner that never resolves.
  perform public.advance_matching(p_job_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. The artisan's 120 seconds
-- ---------------------------------------------------------------------------

create or replace function public.respond_to_offer(p_offer_id uuid, p_accept boolean)
returns public.job_status
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_offer public.job_offers;
  v_job   public.jobs;
begin
  select * into v_offer from public.job_offers where id = p_offer_id for update;

  if v_offer.id is null then
    raise exception 'That offer could not be found.' using errcode = 'P0002';
  end if;

  if v_offer.provider_id is distinct from auth.uid() then
    raise exception 'That offer is not yours.' using errcode = '42501';
  end if;

  if v_offer.status <> 'pending' then
    raise exception 'You have already responded to this job.' using errcode = '22023';
  end if;

  -- Losing the race is normal and must read as normal. The sweep may not have
  -- run yet, so expiry is decided on the clock, not on the stored status.
  if v_offer.expires_at <= now() then
    update public.job_offers
       set status = 'expired', responded_at = now()
     where id = p_offer_id;

    raise exception 'This job has moved on to another artisan.' using errcode = '22023';
  end if;

  select * into v_job from public.jobs where id = v_offer.job_id for update;

  if not p_accept then
    update public.job_offers
       set status = 'declined', responded_at = now()
     where id = p_offer_id;

    return public.advance_matching(v_offer.job_id);
  end if;

  if v_job.status <> 'offer_sent' then
    raise exception 'This job has moved on to another artisan.' using errcode = '22023';
  end if;

  update public.job_offers
     set status = 'accepted', responded_at = now()
   where id = p_offer_id;

  -- Belt and braces: only one offer per job should ever be live, but a
  -- superseded row is cheaper than an ambiguous audit trail.
  update public.job_offers
     set status = 'superseded', responded_at = now()
   where job_id = v_offer.job_id and id <> p_offer_id and status = 'pending';

  perform set_config('artisangh.job_status_change', 'on', true);

  -- Straight to `quote_pending`. `assigned` would be a state the artisan sees
  -- for no reason: the very next thing they do is price the job, and a status
  -- nobody acts on is a status that only exists to be logged.
  update public.jobs
     set provider_id = v_offer.provider_id,
         status      = 'quote_pending'
   where id = v_offer.job_id;

  perform set_config('artisangh.job_status_change', 'off', true);

  return 'quote_pending'::public.job_status;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. The sweep
-- ---------------------------------------------------------------------------
-- Every 30 seconds: retire offers nobody answered, and push those jobs on.
--
-- Written to be safe at any frequency and safe to run twice at once. It takes
-- no locks of its own — `advance_matching` does that per job — and it reads the
-- job list into an array first so a long sweep cannot hold a cursor open across
-- dozens of row locks.

create or replace function public.expire_stale_offers()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job_id uuid;
  v_count  int := 0;
begin
  update public.job_offers
     set status = 'expired', responded_at = now()
   where status = 'pending' and expires_at <= now();

  get diagnostics v_count = row_count;

  for v_job_id in
    select j.id
    from public.jobs j
    where j.status in ('posted', 'matching', 'offer_sent')
      and not exists (
        select 1 from public.job_offers o
        where o.job_id = j.id and o.status = 'pending' and o.expires_at > now()
      )
  loop
    -- One job's failure must not strand the rest of the queue.
    begin
      perform public.advance_matching(v_job_id);
    exception when others then
      raise warning 'advance_matching failed for job %: %', v_job_id, sqlerrm;
    end;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. The admin fallback
-- ---------------------------------------------------------------------------

create or replace function public.admin_assign_job(p_job_id uuid, p_provider_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.jobs;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can assign a job.' using errcode = '42501';
  end if;

  select * into v_job from public.jobs where id = p_job_id for update;

  if v_job.id is null then
    raise exception 'Job not found.' using errcode = 'P0002';
  end if;

  if v_job.status not in ('posted', 'matching', 'offer_sent', 'unmatched') then
    raise exception 'This job is past the point where it can be assigned by hand.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.providers
    where profile_id = p_provider_id
      and verification_status = 'approved'
      and suspended_at is null
  ) then
    raise exception 'That artisan is not approved to take jobs.' using errcode = '22023';
  end if;

  update public.job_offers
     set status = 'superseded', responded_at = now()
   where job_id = p_job_id and status = 'pending';

  perform set_config('artisangh.job_status_change', 'on', true);

  update public.jobs
     set provider_id = p_provider_id,
         status      = 'quote_pending'
   where id = p_job_id;

  perform set_config('artisangh.job_status_change', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. The quote
-- ---------------------------------------------------------------------------
-- Items arrive as JSON; every number that matters is derived here.
--
-- `p_items` is `[{ "kind": "labour"|"material", "description": text,
--                  "quantity": numeric, "unit_price": numeric }, ...]`.
--
-- Transport is not a line the artisan types. It is looked up from the distance
-- recorded on the accepted offer, through the admin-managed band table, and it
-- passes to the artisan in full (PLAN.md §4). Letting an artisan set their own
-- travel fee would make the one number the platform controls negotiable.

create or replace function public.save_quote(
  p_job_id uuid,
  p_items  jsonb,
  p_notes  text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_job        public.jobs;
  v_quote_id   uuid;
  v_subtotal   numeric(12,2) := 0;
  v_commission numeric(5,2);
  v_transport  numeric(10,2);
  v_distance   numeric;
  v_city       text;
  v_totals     record;
  v_item       jsonb;
  v_count      int := 0;
  v_amount     numeric(12,2);
begin
  select * into v_job from public.jobs where id = p_job_id for update;

  if v_job.id is null then
    raise exception 'Job not found.' using errcode = 'P0002';
  end if;

  if v_job.provider_id is distinct from auth.uid() then
    raise exception 'That is not your job.' using errcode = '42501';
  end if;

  if v_job.status not in ('quote_pending', 'quote_sent') then
    raise exception 'This job is not waiting for a price.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one line to the quote.' using errcode = '22023';
  end if;

  if jsonb_array_length(p_items) > 30 then
    raise exception 'A quote can have up to 30 lines.' using errcode = '22023';
  end if;

  -- Distance from the offer the artisan accepted, so the band cannot shift
  -- under the client because the artisan drove somewhere between accepting and
  -- quoting. Falls back to live PostGIS for an admin-assigned job, which never
  -- had an offer.
  select o.distance_km into v_distance
  from public.job_offers o
  where o.job_id = p_job_id and o.provider_id = auth.uid() and o.status = 'accepted'
  order by o.responded_at desc
  limit 1;

  if v_distance is null then
    select round((st_distance(p.current_location, v_job.location) / 1000)::numeric, 2)
      into v_distance
    from public.providers p
    where p.profile_id = auth.uid() and p.current_location is not null;
  end if;

  select base_city into v_city from public.providers where profile_id = auth.uid();

  v_transport := coalesce(
    public.transport_fee_for_distance(coalesce(v_city, '*'), coalesce(v_distance, 0)),
    0
  );

  v_commission := public.setting_int('platform_commission_pct', 12);

  -- One draft per job. Replacing it wholesale is correct here for the same
  -- reason it is in the trades picker: a quote line carries nothing worth
  -- preserving across an edit, and a diff is a bug waiting to be written.
  delete from public.quotes
   where job_id = p_job_id and provider_id = auth.uid() and status = 'draft';

  insert into public.quotes
    (job_id, provider_id, status, subtotal, service_fee_pct, service_fee_amount,
     transport_fee, total, deposit_amount, notes)
  values
    (p_job_id, auth.uid(), 'draft', 0, v_commission, 0, v_transport, 0, 0,
     nullif(trim(coalesce(p_notes, '')), ''))
  returning id into v_quote_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_count := v_count + 1;

    if coalesce(trim(v_item ->> 'description'), '') = '' then
      raise exception 'Every line needs a description.' using errcode = '22023';
    end if;

    if (v_item ->> 'kind') not in ('labour', 'material') then
      raise exception 'Every line must be labour or materials.' using errcode = '22023';
    end if;

    if coalesce((v_item ->> 'quantity')::numeric, 0) <= 0 then
      raise exception 'Quantity must be more than zero.' using errcode = '22023';
    end if;

    if coalesce((v_item ->> 'unit_price')::numeric, -1) < 0 then
      raise exception 'A price cannot be negative.' using errcode = '22023';
    end if;

    v_amount := round((v_item ->> 'quantity')::numeric * (v_item ->> 'unit_price')::numeric, 2);
    v_subtotal := v_subtotal + v_amount;

    insert into public.quote_items
      (quote_id, kind, description, quantity, unit_price, amount, sort_order)
    values
      (v_quote_id,
       (v_item ->> 'kind')::public.quote_item_kind,
       left(trim(v_item ->> 'description'), 200),
       (v_item ->> 'quantity')::numeric,
       (v_item ->> 'unit_price')::numeric,
       v_amount,
       v_count);
  end loop;

  if v_subtotal <= 0 then
    raise exception 'A quote has to come to more than zero.' using errcode = '22023';
  end if;

  select * into v_totals
  from public.compute_quote_totals(v_subtotal, v_commission, v_transport);

  update public.quotes
     set subtotal           = v_subtotal,
         service_fee_amount = v_totals.service_fee_amount,
         total              = v_totals.total,
         deposit_amount     = v_totals.deposit_amount
   where id = v_quote_id;

  return v_quote_id;
end;
$$;

create or replace function public.send_quote(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote public.quotes;
  v_min   int;
begin
  select * into v_quote from public.quotes where id = p_quote_id for update;

  if v_quote.id is null then
    raise exception 'That quote could not be found.' using errcode = 'P0002';
  end if;

  if v_quote.provider_id is distinct from auth.uid() then
    raise exception 'That is not your quote.' using errcode = '42501';
  end if;

  if v_quote.status <> 'draft' then
    raise exception 'That quote has already been sent.' using errcode = '22023';
  end if;

  -- PLAN.md §16: below the minimum the payout transfer fee makes the job
  -- uneconomic for everyone. Warned about here, where it can still be changed.
  v_min := public.setting_int('min_job_value_ghs', 0);
  if v_min > 0 and v_quote.subtotal < v_min then
    raise exception 'Quotes start at GHS %. Anything less costs more to process than it earns.', v_min
      using errcode = '22023';
  end if;

  update public.quotes
     set status = 'sent', sent_at = now()
   where id = p_quote_id;

  perform set_config('artisangh.job_status_change', 'on', true);
  update public.jobs set status = 'quote_sent' where id = v_quote.job_id;
  perform set_config('artisangh.job_status_change', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. The client's answer
-- ---------------------------------------------------------------------------
-- Declining is a normal, expected outcome, not a failure. With no price
-- guidance in v1 (PLAN.md §2) artisans price freely and clients decline, so
-- this path goes straight back to matching — and because
-- `find_candidate_providers` already excludes anyone who has seen this job, the
-- declined artisan is never re-offered it.

create or replace function public.respond_to_quote(
  p_quote_id uuid,
  p_accept   boolean,
  p_reason   text default null
)
returns public.job_status
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote      public.quotes;
  v_job        public.jobs;
  v_rejections int;
  v_max        int;
begin
  select * into v_quote from public.quotes where id = p_quote_id for update;

  if v_quote.id is null then
    raise exception 'That quote could not be found.' using errcode = 'P0002';
  end if;

  select * into v_job from public.jobs where id = v_quote.job_id for update;

  if v_job.client_id is distinct from auth.uid() then
    raise exception 'That is not your job.' using errcode = '42501';
  end if;

  if v_quote.status <> 'sent' or v_job.status <> 'quote_sent' then
    raise exception 'This quote is no longer open.' using errcode = '22023';
  end if;

  if p_accept then
    update public.quotes
       set status = 'accepted', responded_at = now()
     where id = p_quote_id;

    perform set_config('artisangh.job_status_change', 'on', true);
    update public.jobs set status = 'awaiting_deposit' where id = v_job.id;
    perform set_config('artisangh.job_status_change', 'off', true);

    return 'awaiting_deposit'::public.job_status;
  end if;

  update public.quotes
     set status = 'rejected', responded_at = now()
   where id = p_quote_id;

  v_rejections := coalesce(v_job.quote_rejections, 0) + 1;
  v_max        := public.setting_int('max_quote_rejections', 3);

  perform set_config('artisangh.job_status_change', 'on', true);

  -- Endless rematching wastes artisan goodwill, which is the scarce resource
  -- here. After the cap a human calls the client (PLAN.md §16 q5).
  if v_rejections >= v_max then
    update public.jobs
       set status           = 'unmatched',
           provider_id      = null,
           quote_rejections = v_rejections
     where id = v_job.id;

    perform set_config('artisangh.job_status_change', 'off', true);
    return 'unmatched'::public.job_status;
  end if;

  -- Back to the start of the search, at the original radius. Widening is for
  -- artisans who did not answer, not for one who quoted too high.
  update public.jobs
     set status             = 'matching',
         provider_id        = null,
         quote_rejections   = v_rejections,
         matching_pass      = 1,
         matching_radius_km = public.matching_radius_for_pass(1)
   where id = v_job.id;

  perform set_config('artisangh.job_status_change', 'off', true);

  return public.advance_matching(v_job.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Reading the search, for the client's "we've contacted N so far"
-- ---------------------------------------------------------------------------
-- PLAN.md §6: "Tell the client what's happening — 'Finding your artisan — we've
-- contacted 3 so far' beats a silent spinner." The offer rows carry provider
-- ids, which the client must never see; this returns only the shape of the
-- search.

create or replace function public.job_matching_progress(p_job_id uuid)
returns table (
  contacted      int,
  current_pass   int,
  radius_km      numeric,
  offer_expires_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (select count(*)::int from public.job_offers o where o.job_id = j.id),
    coalesce(j.matching_pass, 1),
    coalesce(j.matching_radius_km, public.matching_radius_for_pass(1)),
    (select max(o.expires_at) from public.job_offers o
      where o.job_id = j.id and o.status = 'pending' and o.expires_at > now())
  from public.jobs j
  where j.id = p_job_id
    and (j.client_id = auth.uid() or public.is_admin());
$$;

-- ---------------------------------------------------------------------------
-- 10. Grants
-- ---------------------------------------------------------------------------
-- Revoked from PUBLIC first. Postgres grants EXECUTE to PUBLIC by default, so a
-- bare `grant ... to authenticated` excludes nobody — the lesson of 0010.

revoke execute on function public.advance_matching(uuid) from public;
revoke execute on function public.respond_to_offer(uuid, boolean) from public;
revoke execute on function public.expire_stale_offers() from public;
revoke execute on function public.admin_assign_job(uuid, uuid) from public;
revoke execute on function public.save_quote(uuid, jsonb, text) from public;
revoke execute on function public.send_quote(uuid) from public;
revoke execute on function public.respond_to_quote(uuid, boolean, text) from public;
revoke execute on function public.job_matching_progress(uuid) from public;
revoke execute on function public.setting_int(text, int) from public;
revoke execute on function public.matching_radius_for_pass(int) from public;
revoke execute on function public.matching_pass_count() from public;

grant execute on function public.respond_to_offer(uuid, boolean) to authenticated;
grant execute on function public.admin_assign_job(uuid, uuid) to authenticated;
grant execute on function public.save_quote(uuid, jsonb, text) to authenticated;
grant execute on function public.send_quote(uuid) to authenticated;
grant execute on function public.respond_to_quote(uuid, boolean, text) to authenticated;
grant execute on function public.job_matching_progress(uuid) to authenticated;

-- `advance_matching` is deliberately NOT granted to end users. It is reachable
-- only through the functions above and the sweep — a client who could call it
-- directly could burn through their own candidate list.

-- ---------------------------------------------------------------------------
-- 11. The sweep's schedule
-- ---------------------------------------------------------------------------
-- pg_cron is not enabled on every Supabase plan and cannot be created from a
-- migration on some of them, so this is best-effort: if the extension is there,
-- schedule it; if not, say so and leave `/api/cron/matching` (which calls the
-- same function) as the path. Either way the migration succeeds.

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;

      perform cron.unschedule('artisangh-expire-offers')
      where exists (select 1 from cron.job where jobname = 'artisangh-expire-offers');

      perform cron.schedule(
        'artisangh-expire-offers',
        '30 seconds',
        $cron$ select public.expire_stale_offers(); $cron$
      );

      raise notice 'pg_cron: offer sweep scheduled every 30 seconds.';
    exception when others then
      raise notice 'pg_cron present but not schedulable here (%). Use /api/cron/matching.', sqlerrm;
    end;
  else
    raise notice 'pg_cron unavailable. Drive the sweep from /api/cron/matching.';
  end if;
end;
$$;
