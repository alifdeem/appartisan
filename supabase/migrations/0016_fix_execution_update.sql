-- ArtisanGH — 0016 fix advance_job_execution
--
-- 0015 shipped this inside `advance_job_execution`:
--
--   update public.jobs
--      set status       = p_to,
--          availability = availability   -- <- jobs has no such column
--    where id = p_job_id;
--
-- `availability` lives on `providers`. It was a no-op self-assignment left over
-- from moving the provider update out into its own statement, and it made every
-- execution transition raise `column "availability" does not exist` — so a job
-- could reach `deposit_paid` and then never move again.
--
-- Caught by `scripts/e2e-execution.ts` on its first run. Worth noting that
-- nothing else could have caught it: the function compiles, because PL/pgSQL
-- resolves column references at execution time, not at creation.

create or replace function public.advance_job_execution(
  p_job_id uuid,
  p_to     public.job_status
)
returns public.job_status
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job   public.jobs;
  v_legal boolean;
begin
  select * into v_job from public.jobs where id = p_job_id for update;

  if v_job.id is null then
    raise exception 'Job not found.' using errcode = 'P0002';
  end if;

  if v_job.provider_id is distinct from auth.uid() and not public.is_admin() then
    raise exception 'That is not your job.' using errcode = '42501';
  end if;

  -- The legal edges of the artisan's half of the machine. Anything not listed
  -- is refused, including skipping a step — an artisan who marks "arrived"
  -- without ever going en route leaves a client watching a map that never moved.
  v_legal := case
    when v_job.status = 'deposit_paid'  and p_to = 'en_route'         then true
    when v_job.status = 'en_route'      and p_to = 'arrived'          then true
    when v_job.status = 'arrived'       and p_to = 'in_progress'      then true
    when v_job.status = 'in_progress'   and p_to = 'awaiting_signoff' then true
    else false
  end;

  if not v_legal then
    raise exception 'A job cannot go from % to %.', v_job.status, p_to
      using errcode = '22023';
  end if;

  -- PLAN.md §12 asks for completion photos, and a dispute six weeks later turns
  -- on whether they exist.
  if p_to = 'awaiting_signoff' and not exists (
    select 1 from public.job_photos
    where job_id = p_job_id and stage = 'completion'
  ) then
    raise exception 'Add at least one photo of the finished work before marking it done.'
      using errcode = '22023';
  end if;

  perform set_config('artisangh.job_status_change', 'on', true);

  update public.jobs set status = p_to where id = p_job_id;

  -- Setting out takes the artisan out of the matching pool. Finishing does not
  -- put them back — the balance is still to collect, and they are still on site.
  if p_to = 'en_route' and v_job.provider_id is not null then
    update public.providers
       set availability = 'on_job'
     where profile_id = v_job.provider_id;
  end if;

  perform set_config('artisangh.job_status_change', 'off', true);

  return p_to;
end;
$$;

revoke all on function public.advance_job_execution(uuid, public.job_status) from public, anon;
grant execute on function public.advance_job_execution(uuid, public.job_status) to authenticated;
