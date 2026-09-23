# Redesign context

Working knowledge for the ArtisanGH redesign. Written to survive a compacted
session: everything here is what a fresh session would otherwise have to
re-derive from the code.

Read this before touching any screen. The long-form log of *what* was built and
*why* is `redesign/newredesign-reference-plan-implementation.md` — this file is
the *how*.

---

## 1. The method

The loop that works, in order. Skipping step 1 or step 4 is how the artisan
dashboard had to be built twice.

1. **Read the brief AND crop the mockup at 1:1.** A thumbnail is not a
   reference. `npm run compare crop "<mockup>.png" <y> <h> out.png`, then read
   the crop. Measure proportions off it — how wide is the photo, how tall is the
   card, does the label wrap.
2. **Check what data exists before designing anything.** Grep the schema, the
   queries, the status machine. Half of every mockup turns out to be unbacked —
   see §4. Decide the honest substitute *before* writing JSX, not after.
3. **Build.**
4. **Shoot it and look.** `npm run compare shoot <route> <userId> out.png 443`,
   crop the bands, read them. Compare against the mockup crops side by side.
5. **Fix, re-shoot.** Usually two rounds.
6. **Run the suites** (§3). `a11y` in particular catches things the eye does not.
7. **Log it** in `redesign/newredesign-reference-plan-implementation.md`.

**443px is the shooting width.** The mockups are 887px wide at 2×, so 443 CSS px
compares 1:1 against a crop. **360px is the floor that must not break**; 390 is
the design width.

---

## 2. The design system

All tokens live in `src/app/globals.css` under `@theme`. Tailwind v4, CSS-first,
**no `tailwind.config`**.

| | |
|---|---|
| **Navy** | `navy-800` `#0A2E73` primary · `navy-900` `#081F4D` deep · ramp 50–950 |
| **Two dark surfaces** | **azure = state** (live job card, status hero — `LIVE_SURFACE` in `jobs/live-surface.ts`) · **navy = money** (earnings hero, pay panel, quote total). One screen may carry both; neither may borrow the other's job. |
| **Azure** | `azure-500` `#2F80ED` accent · `azure-50` `#EAF3FF` soft · ramp 50–700 |
| **Neutrals** | `canvas` `#F8FBFF` ground · `hairline` `#DCE8F7` rules · `copy-muted` `#64748B` |
| **Semantic** | `success-*` (50/500/600/700 **only**) · `danger-*` · `accent-*` = money |
| **Type** | `font-space` (Space Grotesk) headings · Inter body · **mono + `tabular` for every quantity and identifier** |
| **Scale** | `text-2xs` 11 · `text-note` 13 · `text-ui` 15 · `text-lede` 17 · `text-title-sm` 22 · `text-title` 28 · `text-title-lg` 36 |
| **Radii** | `1.25rem` cards · `1.5rem` panels · `1.75rem` heroes · `2rem` sheets/nav · `rounded-full` pills |
| **Shadow** | `--shadow-float` lift · `--shadow-sheet` overlay · `--shadow-glow-navy(-lg)` navy surfaces |
| **Motion** | `--duration-instant` 130ms presses · `fast` · `base` · `slow`; `--ease-out-strong`, `--ease-drawer`, `--ease-spring` |

**Contrast on azure is tight — measure it.** White on `azure-500` is 3.55:1 and
`white/75` on it is 2.67:1, against a WCAG AA floor of 4.5 for anything that is
not large text. `LIVE_SURFACE` therefore runs `azure-600 → azure-700` rather
than `azure-600 → azure-500`, and every muted white on it sits at `/85`, not
`/60`–`/80`. Navy has three times the headroom and hides this; azure does not.

**Depth comes from shadow, not borders.** Outlining every surface is what made
the first artisan dashboard read flat. Spend border/fill/radius/shadow by role.

### Shells

`src/app/(app)/layout.tsx` forks on `profile.role`:

- **client** — `bg-white`, `<BottomNav>` (Home · Browse · Jobs · Account)
- **provider** — `bg-canvas`, `<ProviderNav>` (Today · Jobs · Earnings · Account)
- **admin** — keeps `<AppHeader>` and the wide container; it is a desk tool

Both app shells are a `max-w-[26rem]` column, `px-5 py-6`. **Fixed bars reserve
no space**, so every page owns its own bottom padding: `pb-28` under a tab bar,
`pb-32` under a `<StickyAction>`.

### Primitives — check before writing a `className`

`src/components/mobile/` — `mobile-screen`, `screen-header`, `field-label`,
`underline-field` (auth), `panel-field` (white-ground forms), `floating-card`,
`option-card`, `trust-note`, `service-badges`, `auth-backdrop`, `auth-scenery`,
`bottom-nav`, `category-chips`, `home-hero`, `search-pill`, `segmented-section`,
`service-cards`, `start-draft`, `sticky-action`, `success-mark`, `splash-screen`,
`trade-switcher`

`src/components/jobs/` — `live-job-card`, `job-history-card`, `job-thumb`,
`posted-banner`, `job-detail-chrome` (`JobDetailHeader` / `DetailSection` /
`DetailPanel`), `job-status-hero`, `job-progress`, `counterparty-card`,
`photo-grid`, `momo-pay-panel`, plus the restyled execution/payment set

`src/components/provider/` — `provider-nav`, `provider-hero`, `performance-panel`,
`availability-toggle`, `verification-panel`, `reliability-panel`, `incoming-offer`,
`offer-countdown`

`src/components/ui/` — `slide-to-confirm` (adapted from 21st.dev)

**`ui/input.tsx` and `ui/card.tsx` stay for the admin console and the quote
builder** — dense grids where a boxed, warm-filled control is correct. The
redesign's white-ground equivalents are `panel-field` and `underline-field`. Do
not "unify" them.

---

## 3. Tooling

```bash
npm run compare crop  "<file>.png" <y> <h> [out.png]
npm run compare shoot <route> <userId> [out.png] [width]
```

Two environment facts that cost hours to find:

- **Playwright cannot install Chromium on this Mac.** It is macOS 12;
  `npx playwright install chromium` fails with *"does not support chromium on
  mac12"*. Everything drives the installed Chrome via `channel: "chrome"`.
  **`npm run shots` has therefore never worked on this machine.**
- **Never `fullPage: true`.** Chrome stitches full-page captures from viewport
  slices and composites `backdrop-filter` / `position: fixed` differently in
  each — the floating nav does both. `compare shoot` resizes the viewport to the
  page height and paints once instead.

`sips` also crops from the **centre** and returns black out of bounds; Chrome's
image viewer **shrink-fits** to the viewport. `compare crop` handles both.

### Verification suites

`npx tsc --noEmit` · `npm run lint` · `npm run build` · `npm run check:props` ·
`npm run a11y` · `npm run smoke` · `npm run db:verify` · `npm run e2e` ·
`npm run e2e:execution`

`a11y` and `smoke` need the dev server up (`PORT=3000`). `smoke` renders every
screen **across all three roles** — it is what catches a layout fork stripping
the admin console.

### Test accounts

| who | id | state |
|---|---|---|
| Ama Boateng — client | `bcb3856f-7fea-4c79-9e17-39295910be6a` | 5 jobs, one live (`awaiting_deposit`) |
| BRIGHT SALIFU — client | `03521671-f652-4f22-8d0d-37fd903c7c93` | **zero jobs** — the empty state |
| Payments Test Artisan | `19023409-2933-41c5-879b-69b89a93d47c` | approved, 4 done, all `paid`, GHS 1,320 pending |
| unsubmitted artisan | `8404b12b-f236-443a-9f15-0371a4b6e302` | `verification_status = unsubmitted` |

---

## 4. The honesty rules

These decide most design questions and are why the build diverges from every
mockup in the same predictable ways.

1. **Never show a figure the product cannot compute.** No invented ETA, price,
   on-time rate, or percentage.
2. **Never ship a control that opens nothing.** A bell with no notification
   centre becomes a link to the jobs list. A tab with nothing behind it is
   deleted, not stubbed.
3. **Degrade at the point of failure, not the point of query.** A signed URL can
   404 or expire, and only the browser knows — hence `JobThumb` being a client
   component with `onError`.
4. **Two voices for one status.** `blurb` addresses the client, `providerBlurb`
   the artisan. Both live in `src/lib/jobs/status.ts` so they cannot drift.
5. **Show a number only once it means something.** A rating needs 3 reviews; an
   accept rate needs `reliability.scored`.
6. **When a mockup element is unbacked, replace it with the truest thing that
   fills the same space** — and say so in a comment at the call site.

### What the product does *not* have

Checked repeatedly; assume these are still true.

- **No wallet, no withdrawal, no stored balance.** PLAN.md §137/§141 — Bank of
  Ghana treats wallet creation and management as **E-Money Issuer** activity,
  **GHS 25m minimum capital**. Money moves per job straight to the artisan's own
  MoMo. This is a licensing constraint, not a design preference.
- **No in-app messaging, no promo codes, no public artisan browsing** (§14).
- **No price guidance** (§9) — artisans price each job after seeing it.
- **No notification centre**, no avatar upload, no on-time rate, no monthly
  rollups (`jobs_completed` is lifetime).
- **No live artisan tracking or ETA.** `set_provider_location` and
  `record_location_ping` exist since migration 0005 — commented *"used by the
  client's live tracking map in Phase 5"* — and **nothing calls them**.
- **`settings` is admin-only** under RLS, so `support_phone` is unreadable by
  clients, and its value is still the placeholder `+233000000000`.

**Money out now exists** — `/api/cron/payouts` (every 5 min in `vercel.json`)
initiates the transfer for each queued payout. Before it, "earnings" could only
ever read GHS 0.00.

**Scheduling does now exist** — migration 0023 added `preferred_date` /
`preferred_window` as a *preference, not a booking*. Jobs still dispatch
immediately.

---

## 5. Traps that have bitten more than once

1. **HTML entities in JSX string attributes render literally.**
   `label="Safety &amp; support"` shows `&amp;`. Hit twice. Use the character.
2. **`Link` renders an `<a>` — `display: inline`.** Dropping `flex`/`block` from
   a class list kills the background: an inline box paints only behind its text
   fragments. Cost a "broken" earnings banner.
3. **A colour token that does not exist renders nothing, silently.**
   `bg-success-300` — the ramp is 50/500/600/700.
4. **`JOB_COLUMNS` is an explicit list.** A new column is invisible to every
   screen until added there. Cost one build where scheduling saved and never
   came back.
5. **PostgREST returns `undefined`, not `null`, for a column it did not select.**
   `x === null` is false. Use `!x`.
6. **`paid` is in the `active` status group** until the client rates it. Filter
   with `isLiveJob()`.
7. **Image slots cache.** `slot()` re-stats in dev and caches in production —
   dropping a file in used to need a restart.
8. **A JPEG renamed `.png` has no transparency.** The dev server now warns by
   filename. Check with `file public/img/*.png` — every line must say `RGBA`.
9. **Heading levels.** A card's title dropped under a page `h1` skips a level.
   `npm run a11y` catches it; the eye does not.
10. **Typed `Views: Record<string, never>`** made every relation name valid, so
    `signoffs` and `rating_public` went undeclared for months. Both declared now.
11. **A `lg:grid-cols-…` inside the phone shell renders as one column, forever.**
    Both job screens carried a two-column layout that has never applied, so the
    reading order was decided by which `<div>` a panel sat in. If a page lives
    under `(app)/layout.tsx`, it is 26rem wide and that is the whole story.
12. **Check the RLS before deciding a feature is impossible.** The counterparty
    phone policy (`0003_rls.sql:74`) sat unused from the first migration, and
    its own comment named the gap it was written to close.
13. **A Server Action call that is not wrapped in try/catch loses the tap.** The
    POST fails on a dropped signal, the throw escapes the transition, no toast
    appears and the control unmounts. Every call site goes through
    `callAction()` in `src/lib/action-call.ts`. Never call an action bare.
14. **An interface being implemented is not the same as it being called.** Both
    payment adapters implemented `transfer()`, the webhook handled
    `transfer.success`, and nothing anywhere invoked it — so every artisan
    payout sat `pending` for ever. `grep` for the *call*, not the definition.
15. **Two halves written to different contracts still compile.** `settle_payment`
    inserts the payout row; both adapters also inserted one. Neither side was
    wrong on its own.

---

## 6. Where things stand

### Done — redesigned to the 2026 reference

**Client:** `/login` · `/signup` · `/client` · `/client/post` (browse) ·
`/client/post/[jobId]/{describe,schedule,location,review}` · `/client/jobs` ·
`/client/jobs/[jobId]` · `/client/account`

**Artisan:** `/provider` (Today) · `/provider/jobs` · `/provider/jobs/[jobId]` ·
`/provider/earnings` · `/provider/account` · the shell and tab bar

### Not redesigned — old warm `ink`/`brand-green` palette

| Screen | Note |
|---|---|
| `/provider/offers/[offerId]` | Slide-to-accept is in; the rest is old palette. **Highest value left** — only screen with a clock. |
| `/provider/apply/*` | Six screens, one coherent funnel — redesign as a set. |
| `/` (landing) | Deliberately still warm. `QuoteDocket` keeps `tone="warm"` for it. |
| `/client/jobs/[jobId]/invoice` | A print document, not a screen. Left as a document. |
| `/admin/*` | Untouched, deliberately — desk tool, keeps the header. |

### Images

`public/img/` — `auth-artisan-portrait.png` ✅ real RGBA (also the artisan
dashboard hero, via a fallback list in `src/lib/images.ts`);
`auth-skyline.png` and `auth-artisan-back.png` ❌ **are JPEGs** and show white
boxes — need re-exporting. Six category photos ✅; twenty outstanding, prompts in
`IMAGE-PROMPTS-BROWSE.md`. The promo card's 3D toolbox is the one asset still
missing from the artisan dashboard.

### Reference material

`designing-ui-ux/` — `prompt.md` (auth), `homescreen-prompt.md`,
`post a job/@1…@6`, `account.png`, `artisan/artisan-dashboard-prompt.md`,
`artisan/artisan dasboard.png`, `artisan/artisan-user-flow.html` (the full
artisan screen map), plus `redesign/new-reference-shots/artimockss/` for the
client mockups.

---

## 7. Third-party notes

- **21st.dev** — free tier, **2 component retrievals/day**, AI generation off.
  Search is unmetered; `get_component` is not. Components arrive as
  shadcn + Radix + Tailwind-v3 tokens, none of which this project has, so
  **nothing drops in** — the value is the pattern, not the code. One pulled so
  far (`slide-to-detonate` → `ui/slide-to-confirm`), and it needed a WCAG 2.5.7
  keyboard path added before it was shippable.
- **Figma MCP** — `generate_diagram` makes FigJam diagrams from Mermaid
  (auto-layout, sprawling). `use_figma` can build designs but only by hand-coded
  Plugin API calls, and **`createImageAsync` is forbidden**, so no photography.
  Verdict: keep the screenshot → image-generator workflow for design.
