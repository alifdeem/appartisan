-- ArtisanGH — 0019 make the reputation counters self-healing
--
-- 0018 recomputes `providers.rating_avg` / `rating_count` inside `rate_job`,
-- which covers the only path a client can take. It does not cover any other way
-- a rating row can change:
--
--   • an admin deleting an abusive review
--   • `on delete cascade` when a job is removed
--   • a correction applied directly in the SQL editor
--
-- After any of those the artisan keeps the rating they no longer have. The
-- e2e suite found this the honest way — it deleted its test ratings, the
-- counter stayed at 1, and the next run's "the rating lands on the profile"
-- assertion read 1 → 1 and failed.
--
-- A trigger on the ratings table is the right home for it: the counter is
-- derived from exactly one table, so it should be maintained by that table
-- rather than by every caller that remembers to.

create or replace function public.sync_provider_rating()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- On UPDATE the rating can move between artisans, so both sides are recomputed.
  if tg_op in ('DELETE', 'UPDATE') then
    perform public.recompute_provider_rating(old.provider_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    perform public.recompute_provider_rating(new.provider_id);
  end if;

  return null;   -- AFTER trigger; the return value is discarded
end;
$$;

drop trigger if exists ratings_sync_provider on public.ratings;
create trigger ratings_sync_provider
  after insert or update or delete on public.ratings
  for each row execute function public.sync_provider_rating();

-- Repair every counter that has already drifted.
do $$
declare
  v_id uuid;
begin
  for v_id in select profile_id from public.providers loop
    perform public.recompute_provider_rating(v_id);
  end loop;
end;
$$;
