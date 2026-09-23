# Deploying ArtisanGH

Written after a Vercel import produced no deployment at all. Everything below
is a thing that actually blocked it, in the order it blocks you.

## 1. Cron jobs are not on Vercel any more

`vercel.json` used to declare four Cron Jobs, three of them sub-daily. **The
Vercel Hobby plan allows two cron jobs, running once per day.** A config that
exceeds that is rejected during validation, before a build starts - so the
project imports from GitHub cleanly and then shows no deployment and no build
log, which looks like nothing happened.

The sweeps now run from `.github/workflows/cron.yml`. Set two repository
secrets under **Settings > Secrets and variables > Actions**:

| Secret | Value |
| --- | --- |
| `APP_URL` | `https://your-deployment.vercel.app`, no trailing slash |
| `CRON_SECRET` | any long random string, the same one set in Vercel |

Generate one with:

```bash
openssl rand -hex 32
```

If you later move to Vercel Pro, the four entries can go back into
`vercel.json` and the workflow can be deleted. Do not run both.

### The offer sweep is the exception

GitHub Actions cannot run more often than every five minutes, and delays its
queue under load. An offer expires after **120 seconds**, so a five-minute
sweep leaves a job sitting with a dead offer for up to five minutes before it
moves to the next artisan.

The right home for that one is the database. `pg_cron` is available on this
Supabase project but **not currently installed**, so the conditional block at
the end of migration `0011_matching_and_quoting.sql` took its fallback branch.
Enabling it schedules the sweep every 30 seconds, inside Postgres, with no
external scheduler involved:

```sql
create extension if not exists pg_cron;

select cron.schedule(
  'artisangh-expire-offers',
  '30 seconds',
  $$ select public.expire_stale_offers(); $$
);
```

Run that in the Supabase SQL editor. Once it is scheduled, the `matching` step
in the workflow is a harmless belt-and-braces backup and can be removed.

## 2. Environment variables

Three are required, and the build **throws** without them - `src/lib/env.ts`
validates with zod before anything compiles:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Also set, or things break in ways that are hard to trace:

| Variable | Why |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Mobile Money callbacks are built from it. Left unset it defaults to `http://localhost:3000` and every payment return link points at the user's own machine. |
| `CRON_SECRET` | Without it the cron routes fall open in non-production and refuse everything in production. |
| `ALLOW_MOCK_IN_PROD` | See below. |

`.env.example` is the full list.

## 3. The app will refuse to boot without `ALLOW_MOCK_IN_PROD`

This one passes the build and then fails every request, which is the most
confusing possible order.

`PAYMENT_PROVIDER` and `SMS_PROVIDER` default to `mock`. The guardrail in
`src/lib/env.ts` lets the **build** through with a warning but makes the
**server** refuse to start, because a mock payment provider running in
production means jobs complete, invoices generate, artisans expect payouts, and
no money ever moved.

For a demo deployment on a real URL before the business is registered with
Paystack, that is exactly what the escape hatch is for:

```
ALLOW_MOCK_IN_PROD=true
```

Remove it the moment real credentials are in place.

## 4. Check the production branch

If Vercel shows zero deployments rather than a failed one, confirm the
production branch is `main`. Vercel follows what GitHub reports as the default
branch, and a `master`/`main` mismatch produces exactly this symptom.

## Order to do it in

1. Add the environment variables in Vercel, including `ALLOW_MOCK_IN_PROD=true`.
2. Redeploy. The cron config no longer blocks it.
3. Add `APP_URL` and `CRON_SECRET` as GitHub Actions secrets.
4. Run the workflow once by hand (**Actions > Scheduled sweeps > Run workflow**)
   to prove the secrets and the URL are right.
5. Enable `pg_cron` in Supabase for the 30-second offer sweep.
