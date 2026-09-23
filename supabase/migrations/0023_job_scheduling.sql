-- 0023 — when the client wants the artisan
--
-- The posting flow gains a step between "describe" and "where" (reference
-- `@4-shedule-time`). Two columns, both nullable, both optional to fill.
--
-- WHAT THIS IS, AND WHAT IT IS DELIBERATELY NOT
--
-- This is a *preference*, not a booking. ArtisanGH dispatches on posting: the
-- matcher offers the job to the nearest available artisan straight away and the
-- offer expires on a timer (0011). Nothing in this migration changes that, and
-- nothing here holds a job back until a chosen hour.
--
-- Storing it as a booking would be a lie in the schema. There is no calendar,
-- no availability table, no hold-and-release, and no artisan-side accept-for-
-- later. Building the column as though there were would invite the next change
-- to treat it as a commitment the product cannot keep.
--
-- So: the client says when suits them, the artisan sees it in the offer and on
-- the job, and the two of them agree the actual arrival on the call they
-- already have. That is how this trade works in Accra today, and it is what the
-- posting screen says on its face.
--
-- `preferred_date` is a date and not a timestamptz on purpose. A window is a
-- part of a day in Ghana (UTC+0, no DST) — "Thursday afternoon" — and storing
-- an instant would invent a precision nobody supplied and would shift under a
-- client whose phone is set to another timezone.

alter table public.jobs
  add column if not exists preferred_date   date,
  add column if not exists preferred_window text;

-- The windows, as words rather than hours. An artisan reading "afternoon"
-- knows what to do with it; an artisan reading "12:00:00+00" has to convert it
-- back into the same word. The hours each one means are presentation, and live
-- in `src/lib/jobs/schedule.ts` so one edit changes the label everywhere.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'jobs_preferred_window_check'
  ) then
    alter table public.jobs
      add constraint jobs_preferred_window_check
      check (preferred_window is null or preferred_window in ('morning', 'afternoon', 'evening'));
  end if;
end $$;

-- A window without a date is meaningless ("afternoon" of when?), and a date
-- without a window is a legitimate "that day, any time". Only the first is
-- forbidden.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'jobs_preferred_window_needs_date'
  ) then
    alter table public.jobs
      add constraint jobs_preferred_window_needs_date
      check (preferred_window is null or preferred_date is not null);
  end if;
end $$;

comment on column public.jobs.preferred_date is
  'The day the client would like the artisan. A preference shown to the artisan, not a booking — jobs are dispatched on posting. Null means as soon as possible.';

comment on column public.jobs.preferred_window is
  'morning | afternoon | evening, or null for any time on preferred_date. Hours are presentation only (src/lib/jobs/schedule.ts).';

-- No RLS change. These are ordinary columns on `jobs`, covered by the policies
-- that already scope the row to its client and its matched artisan. They are
-- readable by exactly the people who can already read the description.
