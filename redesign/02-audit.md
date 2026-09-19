# Audit

Measured against the repo at `eec623d`, before any redesign work. Numbers come
from `grep` over `src/` and from `scripts/shoot.ts`, not from impressions.

## First, what is already good

This is not a basic interface, and treating it as one would mean paying twice
for work that is already done. Preserve:

- **The token layer.** A warm-neutral OKLCH ramp with a written rationale (pure
  white makes photographs of warm interiors look pasted on), amber reserved for
  money, warm-tinted shadows, four named easing curves, four durations.
- **The type system.** Three faces with assigned jobs: Bricolage Grotesque for
  display, Inter for UI (chosen for legibility at 13–15px on low-end Android),
  IBM Plex Mono for money and identifiers. All self-hosted via `next/font`.
- **The accessibility work.** `:focus-visible` rings, a 44px tap-target rule,
  the `.tap` utility that grows hit areas with a pseudo-element on coarse
  pointers only, `prefers-reduced-motion` honoured globally *and* a bespoke
  variant for the countdown ring so reduced motion does not snap it to "your
  time is up".
- **The print stylesheet**, because the invoice is a real deliverable.
- **The Server/Client split** — interactivity isolated into `_components/`
  islands, mutations through server actions.
- **`Stat`**, deliberately de-duplicated from two drifting copies, with a
  comment explaining why.
- **`RoadmapPanel`**, correctly gated behind `ENABLE_DEV_TOOLS`.

## The problems, worst first

### 1. There is no navigation

`grep '<nav'` returns five matches across the whole codebase. None of them are
application navigation — they are the landing page header, the landing footer,
the legal header, and two filter bars.

The entire app shell is a 16px-tall header containing a logo, a role badge, a
name and a logout button. Admin has **seven routes**. They are reachable only by
clicking rows on the dashboard, and the only way back is the browser button.
There is no sidebar, no tab bar, no breadcrumbs, no active-state indicator, and
no way to know where you are or what else exists.

This is the largest single gap between "functional" and "product".

### 2. One container width for everything

`src/app/(app)/layout.tsx` wraps every authenticated screen in `max-w-5xl`. A
client's two-job list, an admin verification queue, and a zone editor with a map
all get the same measure. Data-dense admin work and a consumer task list have
opposite layout needs.

### 3. The Card primitive is bypassed more often than it is used

| | |
|---|---|
| Hand-rolled `rounded-card border border-ink-200 bg-ink-0 shadow-sm` | **46 occurrences across 30 files** |
| Files importing the `Card` primitive | **18** |

The admin dashboard repeats an identical six-line `className` for each
navigation row. This is the same "one rhythm repeated" flaw `DESIGN.md`
criticised on the landing page, now inside the app — and it is how a design
system dies.

### 4. Zero loading states

- `loading.tsx` files: **0**
- `not-found.tsx` files: **0**
- Uses of the `.skeleton` utility defined in `globals.css`: **0**

Every page is an async Server Component awaiting `Promise.all([...])` of
database queries. So every navigation is a dead screen with no feedback. This is
the highest-leverage fix in the project: it is most of what separates "demo"
from "product", and it costs almost nothing.

### 5. The type scale is not tokenised

142 arbitrary font sizes:

| value | px | uses |
|---|---|---|
| `text-[0.9375rem]` | 15 | 57 |
| `text-[0.6875rem]` | 11 | 50 |
| `text-[0.8125rem]` | 13 | 17 |
| `text-[1.0625rem]` | 17 | 5 |
| one-offs | 10, 12, 28, 40, 60 | 13 |

A real scale was being used by hand but had no names, so it could not be
enforced, reviewed, or changed in one place. **Fixed in Phase 1** — see
[`03-design-system.md`](03-design-system.md).

### 6. No mid-scale in the display type

Visible on the landing page: a 60px headline, then almost everything below it at
13–16px. Section headings, step titles and body text all landed within a few
pixels of each other, so the page read as one big moment followed by
undifferentiated small print. **Fixed in Phase 1.**

### 7. Unconditional multi-column grids

Ten instances of `grid-cols-3` / `grid-cols-4` with no responsive prefix. The
client dashboard's three `Stat` tiles at 360px give each tile ~93px to hold a
24px mono figure plus an uppercase label.

### 8. Tap targets under the codebase's own rule

Measured by the harness on touch viewports:

- the logo link — 32px, on every page
- "Create an account" / "Log in" on the auth screens — 17px

The `.tap` utility exists precisely to fix this and was not applied to them.
The landing page instances are **fixed**; the auth screens are outstanding.

### 9. `motion` is installed and never imported

`motion@13.2.0` is a dependency with zero imports anywhere in `src/`. All
animation is CSS, which is the right call — but the dependency should either be
used deliberately or removed.

### 10. The photography is mixed, and one asset is actively harmful

`work-electrical.jpg` and `work-carpentry.jpg` are strong and exactly on the
`DESIGN.md` brief: burglar bars on louvre windows, patterned tile, hands on the
fixture, eyes on the work rather than the camera, a saturated garment against
desaturated warm walls.

`hero-wide.jpg` is neither. It is a luxury office-tower lobby — travertine,
leather armchairs, marble table, city skyline — sitting under the words "Real
artisans, in real homes". It is also visibly synthetic: the shadow cast on the
wall is a detached blob that does not match the figure. On a product whose
entire argument is *you can verify this*, a fake hero photograph is the worst
asset on the page.

**Resolved** by dropping it and promoting `work-electrical` into the full-bleed
band. The file is still in `public/img/` and should be deleted once that is
confirmed; `photos.heroWide` in `src/lib/images.ts` is now an unused slot.

## What the harness could not tell us

Everything that matters about composition, hierarchy, character, and whether the
thing feels like it was designed by a person. Overflow, contrast, hit areas and
focus order are machine-checkable. Taste is not.
