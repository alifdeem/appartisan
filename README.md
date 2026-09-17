# ArtisanGH

A verified home-services marketplace for Ghana — clients book plumbers, electricians,
carpenters and 20-odd other trades; artisans are ID-verified before they can accept work;
the platform holds the money until the job is signed off.

Launching in Accra and Tema, then countrywide.

> **Phases 0–6 are built.** A job now runs the whole way: a client posts it with photos
> and a voice note; the matcher offers it to the nearest verified artisan on a 120-second
> clock, widening 5km → 10km → 20km before falling through to an admin queue; the artisan
> quotes it itemised; the client pays a deposit; the artisan travels, works and marks it
> done with a photo; the client signs off and pays the balance on the doorstep; a payout
> is queued and an invoice is generated. Then the client rates the artisan, either party
> can raise a dispute with photo evidence, and an admin resolves it. See the
> [Roadmap](#roadmap).
>
> Payments, SMS and maps run against **mock adapters**. Nothing here moves real money or
> sends real messages — see [Simulation mode](#simulation-mode) below and `PLAN.md` §3.

---

## Requirements

| | |
|---|---|
| Node | 20.9+ (22 LTS recommended) |
| npm | 10+ |
| Supabase CLI | `brew install supabase/tap/supabase` — only needed for migrations |
| A Supabase project | Free tier is fine. **PostGIS must be enabled** (migration `0001` does it). |

---

## Setup

### 1. Install

```bash
npm install
```

### 2. Fill in the four Supabase values

`.env.local` already exists with every non-secret value set correctly. Only these four are
blank:

```bash
NEXT_PUBLIC_SUPABASE_URL=       # Project Settings → Data API → Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Project Settings → API Keys → anon / publishable
SUPABASE_SERVICE_ROLE_KEY=      # Project Settings → API Keys → service_role / secret
SUPABASE_PROJECT_REF=           # Project Settings → General → Reference ID
```

Newer Supabase dashboards renamed the keys: **anon → publishable**, **service_role →
secret**. Same values.

> `SUPABASE_SERVICE_ROLE_KEY` bypasses every RLS policy. It is read only in
> `src/lib/supabase/admin.ts`, which imports `server-only`, so it can never reach the
> browser bundle. Never put it in a `NEXT_PUBLIC_` variable.

`.env.example` is the fully annotated reference if you want to know what any other
variable does.

### 3. Push the schema

```bash
supabase link --project-ref "$SUPABASE_PROJECT_REF"
npm run db:push
```

Eleven migrations run in order:

| File | What it creates |
|---|---|
| `0001_init.sql` | Extensions (PostGIS), enums, all tables, indexes |
| `0002_functions.sql` | `is_admin()`, quote maths, job state transitions |
| `0003_rls.sql` | Row-level security for client / provider / admin |
| `0004_reference_data.sql` | 26 service categories, transport-fee distance bands, tunable settings |
| `0005_location.sql` | `set_provider_location()`, `record_location_ping()` |
| `0006_column_guards.sql` | Column-level write guards — see below |
| `0007_job_posting.sql` | Client posting: PostGIS pin, `post_job()`, draft cleanup |
| `0008_provider_verification.sql` | Artisan application, `review_provider_application()`, availability |
| `0009_landmark_and_gaps_fixes.sql` | Landmark made mandatory at post time |
| `0010_gaps_hardening.sql` | Revokes the default PUBLIC execute grant; array-build fix |
| `0011_matching_and_quoting.sql` | The matcher, offers with expiry, quotes, admin assignment |

`0006` is the one to read before changing any policy. RLS decides which **rows** you may
touch and has no opinion on which **columns**, so every "update your own row" policy in
`0003` also handed the owner write access to `profiles.role`, `providers.verification_status`
and `providers.payout_recipient_code`. An artisan could approve their own Ghana Card review.
`0006` closes that with `BEFORE UPDATE` triggers rather than column `GRANT`s, because grants
apply per role and admins are also `authenticated` — revoking the column would disarm the
admin console along with the attacker.

If you would rather paste SQL by hand, run the files in that order in the dashboard's SQL
editor, or paste `supabase/apply_all.sql`, which is all eleven concatenated.

### 4. Seed the test accounts

```bash
npm run db:seed
```

Idempotent — safe to run repeatedly. It refuses to touch a production project unless
`SEED_ALLOW_PRODUCTION=true`.

### 5. Check it landed

```bash
npm run db:verify
```

57 assertions against the live database: anonymous access is refused, the privilege-escalation
paths above are actually blocked, PostGIS resolves inside the `SECURITY DEFINER` functions,
the seed is present, and a real session can be minted and cannot be replayed. Read-only apart
from a few writes it rolls back. Run it after any schema change.

```bash
npm run dev          # in another terminal — these need the server up
npm run e2e          # Phase 3: matching and quoting
npm run e2e:payments # Phase 4: the deposit leg
npm run e2e:execution# Phase 5: travel, sign-off, balance, payout
npm run e2e:trust    # Phase 6: ratings, disputes, reliability
npm run smoke        # every screen renders, and the crons are reachable
npm run check:props  # no function props cross a server/client boundary
```

Four suites that drive real jobs end to end under real client, artisan and admin
sessions, so RLS and the column guards are in the loop throughout. They need the dev
server because the mock payment provider settles through the same signed webhook
Paystack will call — see `PLAN.md` §3 for why that matters. Each cleans up the jobs it
creates.

`npm run demo:job` is the exception: it drives one job from draft to paid and **leaves
it**, so there is something to show a client. The e2e suites delete what they touch,
which is right for a test and useless for a demo.

### 6. Run

```bash
npm run dev
```

<http://localhost:3000>

---

## Signing in

There is no password anywhere in this app. Identity is the phone number.

Three seeded accounts:

| Role | Number | Name |
|---|---|---|
| Client | `024 111 1111` | Ama Boateng |
| Provider | `024 222 2222` | Kwame Mensah — approved, online, Electrical, in Osu |
| Admin | `024 333 3333` | ArtisanGH Admin |

**The OTP is always `000000`** while `SMS_PROVIDER=mock`. The code is also printed on the
verify screen in a dashed amber box so nobody has to remember it. Public signup at
`/signup` works normally and creates a real account.

The login screen lists the three numbers when `ENABLE_DEV_TOOLS=true`.

---

## Simulation mode

The client's business is not yet registered with Paystack, so **nothing that costs money is
live**. Every paid integration sits behind an adapter chosen by an env var:

| Variable | `mock` (now) | `live` (go-live) |
|---|---|---|
| `PAYMENT_PROVIDER` | Fake MoMo flow, forced outcomes, no money moves | Paystack charge + Transfer API |
| `SMS_PROVIDER` | OTP is `DEV_OTP_CODE`, shown on screen | Arkesel |
| `MAP_PROVIDER` | `osm` — Leaflet + OpenStreetMap, free | `google` — Google Maps, billed |

The code paths either side of the adapter are the real ones. Flipping the variable and
supplying credentials is the whole of the go-live change.

Anywhere the user could mistake simulated for real, the UI says so — the "Simulated" badge
in the header, the dashed OTP box, the mock payment sheet.

### The guardrail

`src/lib/env.ts` **refuses to boot** a production server with any provider set to `mock`.
A mock payment provider running silently in production is the failure where jobs complete,
invoices generate, artisans expect payouts, and no money ever moved.

For the pre-launch demo deployment — real URL, no Paystack account yet — set
`ALLOW_MOCK_IN_PROD=true` in the Vercel environment. That is a deliberate, visible opt-in,
not a default.

(`next build` runs with `NODE_ENV=production`, so the build only *warns*. A build is not a
running server; the check belongs at boot, where a real request could be served against a
mock.)

---

## Commands

```bash
npm run dev        # dev server (Turbopack)
npm run build      # production build — fails on any type error
npm run start      # serve the production build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm run db:push    # apply migrations to the linked project
npm run db:reset   # drop and rebuild local db, then re-run migrations
npm run db:types   # dump the live schema to types.generated.ts, for diffing
npm run db:seed    # idempotent test accounts
npm run db:verify  # 57 assertions against the live database

npm run e2e          # Phase 3 — matching and quoting
npm run e2e:payments # Phase 4 — the deposit leg, refunds, hostile webhooks
npm run e2e:execution# Phase 5 — travel, sign-off, balance, payout, cancellation tiers
npm run e2e:trust    # Phase 6 — ratings, disputes, reliability, admin config
npm run smoke        # every screen renders; the cron routes are reachable
npm run a11y         # alt text, form labels, heading outline, lang
npm run monitoring:check  # nothing personal reaches the error monitor
npm run check:props  # no function props cross a server/client boundary
npm run demo:job     # one complete paid job, left in place for a demo
```

The four `e2e` suites and `smoke` need `npm run dev` running in another terminal — the
mock payment provider settles through the same signed webhook Paystack will call, over
real HTTP.

`src/lib/supabase/types.ts` is **hand-maintained** — it carries comments explaining the
columns, and the RPC signatures the generator gets wrong. `db:types` writes a separate
`types.generated.ts` so you can diff it against the hand-written file after a migration and
catch drift. Nothing imports the generated file.

Run `lint`, `typecheck` and `build` before every push. `next.config.ts` deliberately keeps
`typescript.ignoreBuildErrors: false` so nobody can "temporarily" ship a type error.

---

## Design system

`DESIGN.md` holds the reasoning — why the product looks the way it does, and which rules
exist to stop it drifting back to a generic dashboard. The short version:

**Type.** Three faces, each with one job. Bricolage Grotesque for headings (applied by a
base rule on `h1, h2, h3` in `globals.css` — do not reach for it manually), Inter for
everything you read as prose, IBM Plex Mono for everything that is a *quantity*. If it is a
cedi amount, a rating, a job count, a phone number or an OTP, it sets in mono with the
`tabular` utility so columns of figures line up. `src/components/app/stat.tsx` and
`src/components/marketplace/quote-docket.tsx` are the reference implementations.

**Colour.** Warm paper, not white. `ink-25` is the page ground and `ink-0` the raised card
surface, so a card reads as lifted without needing a heavy border. `ink-975` is the single
dark band. Amber (`accent-*`) is reserved for money that is owed or held — a quote total, a
deposit — and appears nowhere else; the moment it becomes a decorative colour it stops
signalling anything.

**Layout.** Two rules on the landing page, both written into the header comment of
`src/app/page.tsx` because both are easy to violate by accident: no two adjacent sections
share a container width, and there is at most **one** card grid on the whole page. The
second rule is the one that matters — a marketplace landing page collapses into a
dashboard the moment everything becomes a card.

### Photography

Images live in `public/img/` and are declared in `src/lib/images.ts`, which checks at build
time whether each file actually exists. A missing photo renders a hatched `.img-slot`
placeholder instead of a broken image, so the product is presentable with none of them
present and lights up as they arrive — **dropping files into `public/img/` and rebuilding
is the whole integration; there is no code change.** Use `.img-slot-dark` via the `Photo`
component's `placeholderClassName` on dark backgrounds, or the placeholder becomes the
brightest thing on the section.

`IMAGE-PROMPTS.md` is the generation brief: the exact eight filenames, their aspect ratios
and pixel sizes, a per-image prompt, and a shared house-style block. The filenames there
are a contract with `src/lib/images.ts` — rename one and it silently stops loading.

---

## Layout

```
src/
  app/
    (auth)/            login, signup, OTP verify, auth server actions
    (app)/             signed-in shell — /client, /provider, /admin
    api/webhooks/      payment webhook — the only place a payment changes state
    page.tsx           public landing page (static, no DB read)
    globals.css        design tokens — colour ramps, type, motion, img-slot
  components/
    ui/                design primitives — button, input, card, badge, otp, photo
    marketplace/       artisan card + quote docket, the two signature components
    app/               signed-in chrome — header, stat, roadmap panel
    dev/               dev panel + role switcher, stripped in production
  lib/
    images.ts          build-time photo manifest — missing files degrade to slots
    auth/              OTP issue/verify, session mint, role → home path
    integrations/      payments, sms, maps — adapter + mock + live
    supabase/          server / browser / admin clients, generated types
    env.ts             validated server env + the mock-in-prod guardrail
  proxy.ts             Next 16 middleware — session refresh, role gating
supabase/migrations/   schema, RLS, reference data
scripts/seed.ts        test accounts
```

### Things worth knowing before you change them

- **`src/proxy.ts` is not the security boundary.** It is a redirect for humans. Every
  Server Component re-checks the session itself, because route handlers, prefetches and
  direct RSC requests can all arrive without it. RLS is the actual boundary.
- **Rows in `src/lib/supabase/types.ts` are `type` aliases, not `interface`s.** Supabase's
  `GenericTable` needs `Row: Record<string, unknown>`, and TypeScript only gives implicit
  index signatures to type aliases. Convert one to an `interface` and every query on that
  table silently resolves to `never`.
- **PostGIS takes longitude first.** `ST_MakePoint(lng, lat)`. Ghana sits near 0°,0°, so a
  swapped pair still lands somewhere plausible instead of erroring.
- **Accounts are created only after the OTP verifies**, so an abandoned signup leaves
  nothing behind and a number cannot be squatted by someone who does not control it.
- **The login form never reveals whether an account exists.** "Send code" behaves
  identically either way — otherwise it becomes a free lookup for whether a given Ghanaian
  number is registered.
- **Tailwind v4 has no `--duration-*` theme namespace.** Motion durations are tokens used
  as `duration-[var(--duration-fast)]`.
- **`src/lib/images.ts` is `server-only` and resolves paths at build time.** It calls
  `fs.existsSync` against `public/`, so a photo added after a build will not appear until the
  next one. That is the trade for being able to ship with the slots empty.
- **`RoadmapPanel` returns `null` outside dev.** The three dashboards each pass it their own
  list, but the gate lives in the component so they cannot drift apart on it. A screen that
  enumerates what has not been built yet makes a finished product look unfinished, and this
  is the screen a prospective client lands on.
- **The proxy must never redirect a Server Action.** Actions POST back to whatever URL the
  page was rendered under and speak their own wire protocol; a 307 elsewhere makes the client
  throw "An unexpected response was received from the server" and the action never runs. Since
  a form rendered on `/login` keeps posting to `/login`, the "signed in? bounce away from
  /login" rule would break the first action a user triggers after signing in. `redirectTo()`
  detects the `next-action` header and passes those through.
- **Every redirect out of `src/proxy.ts` must go through `redirectTo()`.** A bare
  `NextResponse.redirect()` is a fresh response and silently drops the refreshed session
  cookies Supabase wrote earlier in the same request — while the old refresh token has
  already been spent. The user gets logged out on their next click. It cannot be reproduced
  in the first hour of a session, because nothing needs refreshing yet.
- **`input-otp` has two mutually exclusive APIs.** The `render` prop is handed slot state
  directly; `children` read it from `OTPInputContext`. Only the `children` path is wrapped in
  the provider, so a context-reading child under `render` gets the empty default and crashes.
  `src/components/ui/otp-input.tsx` uses `render` and passes `SlotProps` down as plain props.

---

## Deploying (Vercel)

Set every variable from `.env.local` in the Vercel project, plus:

```bash
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
ALLOW_MOCK_IN_PROD=true   # only while still in simulation
```

Supabase → Authentication → URL Configuration must list the deployed origin, otherwise the
session mint fails.

`robots: { index: false }` is set in `src/app/layout.tsx` for the pre-launch period. Remove
it at launch.

---

## Roadmap

`PLAN.md` is the source of truth — architecture, unit economics, the Ghana payment and
regulatory constraints, and the phase breakdown. Read §3 before touching anything to do
with money. `DESIGN.md` covers the visual language and `IMAGE-PROMPTS.md` the photography
brief.

| Phase | | What it delivers |
|---|---|---|
| 0 | ✅ | Schema, PostGIS, RLS, phone OTP, role routing, design system, landing page |
| 1 | ✅ | Client posting — categories, photos, voice notes, Leaflet pin, dashboard, history |
| 2 | ✅ | Artisan application, private document upload, admin verification queue, availability |
| 3 | ✅ | Matching, sequential offers with expiry, radius widening, quote builder, admin fallback |
| 4 | ✅ | Money in — payment adapter, mock MoMo, simulated webhook round-trip, refunds |
| 5 | ✅ | Execution and money out — travel status, sign-off, invoice, payout records |
| 6 | ✅ | Ratings, disputes with evidence, reliability scoring, trades, zones, thresholds |
| 7 | ◐ | Hardening — abuse limits, spend cap, RLS review, legal, a11y, monitoring |
| 8 | — | Go live — real Paystack, SMS and Maps accounts |
| 9 | — | Pilot and handover |
