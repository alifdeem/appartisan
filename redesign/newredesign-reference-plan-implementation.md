# Implementation log

Append-only record of what has actually been built. Newest phase last.

---

## Phase 1 — Foundations & auth `@2-logging in`

### 1.1 Tokens and primitives — **done**

**`src/app/globals.css`**

- `--animate-indeterminate` + `@keyframes indeterminate` — the splash loader
  sweep. 900ms, `cubic-bezier(0.45, 0, 0.55, 1)`, `infinite alternate`.
- `.loader-sweep` with an explicit `prefers-reduced-motion` branch placed
  *before* the blanket block, following the countdown-ring precedent. Without it
  the blanket rule collapses the animation to 0.01ms and parks the bar at the
  right edge, reading as "finished" while the page is still loading.

**`src/components/ui/button-variants.ts`**

- New `shape` variant: `rect` (the existing `rounded-field`, still the default so
  nothing already built moves) and `pill` (`rounded-full`, the reference shape).
  `rounded-field` moved out of the base recipe into `shape.rect`.
- New `outline` variant — `bg-white`, `border-ink-200`, no shadow. `secondary`'s
  warm `ink-0` fill reads as a stain on the pure-white ground these screens use.

**`src/components/brand/logo.tsx`**

- `size` prop (`md` | `lg`). `lg` is for the splash, where the header's 32px mark
  reads as an icon that failed to load.
- Wordmark now uses `text-lede` / `text-title-sm` instead of an arbitrary
  `text-[1.0625rem]`.

**New — `src/components/mobile/`**

| file | what |
|---|---|
| `mobile-screen.tsx` | The centred ~400px column shell. `bg-white`. Hairline edges at `lg` only. `footer` slot uses `mt-auto`, not `position: sticky` — bottom-pinned when short, in-flow when long, and it translates to React Native unchanged. |
| `screen-header.tsx` | Back arrow (44px) + optional centred title + optional right action. Title is absolutely positioned so it centres on the *screen*, not in the space the side slots leave over. |
| `field-label.tsx` | The tiny letter-spaced uppercase group label. Renders `span` by default, `as="label"` when it really labels a field. |
| `splash-screen.tsx` | Logo `lg` + indeterminate sweep + version line. |

### 1.2 Loading screen — **done**

`src/components/mobile/splash-screen.tsx`, wired to `src/app/loading.tsx`.

Built as a **real Suspense fallback**, not a timed splash: it appears exactly as
long as a navigation actually takes. This also closes the worst finding in
`02-audit.md` — zero `loading.tsx` files in a codebase where every page awaits
`Promise.all` of database queries, so every navigation was a dead white screen.

Verified by pointing a deliberately slow route at it and sampling the DOM:

- `loading.tsx` **does** render (confirmed — it did not appear on `/signup`
  because that route resolves in under 100ms, where Next correctly holds the
  current page rather than flashing a loader)
- bar measures 42.66px against a 128px track — exactly the 1/3 the keyframe
  geometry assumes
- transform sampled every 100ms across 2s: `0 → 85 → 0`, **0 of 20 samples
  clipped**

**Motion was corrected after measuring.** The first version ran one-way from
`-100%` to `300%` on `--ease-in-out-strong`. Sampling showed that curve spends
most of the cycle near its endpoints — which is precisely where the bar is
clipped out of view — then crosses the visible middle in ~200ms. Invisible about
half the time and a blur the rest. Now it bounces edge to edge, fully visible
throughout, and needs no hidden restart.

### 1.3 Sign-up / log-in option screen — **done**

`src/app/(auth)/signup/page.tsx` — two screens on one route:

```
/signup                 the option screen
/signup?role=client     the form, role preselected
/signup?role=provider
```

One route rather than a new `/welcome`, because `/signup` is already in
`PUBLIC_PATHS` and already carries the "signed in? go home" rule in
`src/proxy.ts`. A new path would have meant editing routing logic to gain
nothing — see rules §1.

Reference mapping:

| reference | here |
|---|---|
| "Sign up or log in to enjoy effortless home repair." | "Sign up or log in to book verified artisans near you." at `text-title-sm` |
| `CONTINUE WITH YOUR PHONE NUMBER` | `I WANT TO` |
| Navy "Sign Up" pill | Green **Book a service** pill, `House` icon |
| `MORE WAYS TO SIGN UP` + Google/Apple | **Work as an artisan** outline pill, `Hammer` icon, then `EVERY JOB, EVERY TIME` + the three verification claims |
| "Already have an account ? Log In" | same, `brand-700` link |
| legal with inline links | same, real links to `/legal/terms` and `/legal/privacy` |

Two deliberate deviations:

- **No "Skip".** In the reference it skips onboarding to browse. Here the public
  landing page *is* the browse surface, so Skip and Back would go to the same
  place — a control that duplicates its neighbour is worse than no control.
- **The second labelled group is the verification triad, not social sign-in.**
  This product has no Google/Apple auth. Collapsing to one group left half the
  screen empty, so the slot carries the argument the screen is making. This is
  the copy the old desktop auth panel showed; the panel is gone, the argument is
  not.

Headline set at `text-title-sm` (22px), not `text-title` (28px): the reference
sets it ~23px in a geometric sans, and Bricolage is a display face carrying more
weight at the same size, so matching their pixel size overshot their tone.

### 1.4 Supporting changes — **done**

**`src/app/(auth)/layout.tsx`** — reduced to a pass-through. It used to impose a
two-column desktop split with a photo panel, which fights `<MobileScreen>`: two
headers, two footers, and a photograph the mobile design has no room for. Kept as
a file because the route group gives `/login` and `/signup` their URL shape, and
auth will want a shared `loading.tsx` / `error.tsx` here shortly.

**`src/app/(auth)/login/page.tsx`** — rewrapped in `MobileScreen` +
`ScreenHeader` so it is not left chrome-less by the above. Form itself unchanged;
its restyle is 1.5.

**`src/app/(auth)/_components/phone-auth-form.tsx`**

- New optional `initialRole` prop. When set, the in-form role picker is hidden
  and the value posts as a hidden input instead — asking the same question twice
  makes the first answer look ignored.
- `.tap` added to the "Create an account" and "Log in" switch links. These were
  measuring 17px against the app's own 44px rule — a real pre-existing failure
  the harness caught.
- **Server contract unchanged.** Verified by reading the live DOM at
  `/signup?role=client`: `mode=signup, role=client`.

**`scripts/shoot.ts`** — warm-up pass before shooting. The dev server compiles
CSS on demand, so the first request after an edit can be served a stylesheet
missing the classes just written, which shows up as a button measuring 18px
instead of 52px and sends you hunting a layout bug that does not exist. This
happened; the buttons were always correct.

### Regression introduced and fixed

While editing the loader comment in `globals.css` I left an orphan `*/`, which is
a CSS parse error and took **every route to HTTP 500**. Caught by a route check,
not by lint or typecheck — neither reads CSS. Fixed. Worth remembering that
`globals.css` is a single point of failure for the whole app and that `tsc` and
`eslint` passing says nothing about it.

### Verification

- `npx tsc --noEmit` — clean
- `npx eslint src scripts` — clean
- `/`, `/signup`, `/signup?role=client`, `/signup?role=provider`, `/login`,
  `/legal/terms` — all 200
- `npx tsx scripts/shoot.ts current --routes=/signup,/login,/` — no overflow, no
  tap-target failures at 360 / 390 / 768 / 1280 / 1440
- Shots: `redesign/shots/current/mobile-390/signup.png`,
  `splash-loading.png`, `signup-role-client.png`

### 1.5 — Form screens — **done**

**New — `src/components/mobile/underline-field.tsx`** (`UnderlineField`,
`UnderlineInput`). Label above, value on white, hairline rule under. A separate
primitive rather than a variant of `ui/input.tsx`: the boxed field is correct
everywhere it is already used — admin console, quote builder, settings — where
a form is a dense grid and the box is what separates one control from its
neighbour. These screens are one question on an empty page, where a box draws a
border around something with nothing to be separated from. Changing `Input`
would have dragged 40-odd existing fields along.

The rule carries focus (`focus-within`), because on these screens the rule *is*
the field — a ring around an invisible box lands nowhere. `text-base` on the
control: iOS Safari zooms the viewport for a focused input under 16px, which on
a one-field screen throws the layout sideways.

**No red asterisk.** Every field on these screens is required, so marking them
all is decoration. A problem is stated in words under the rule.

`phone-auth-form.tsx` — name and phone moved to the new field. The dial code is
a sibling of the input inside the rule, not an input: every number here is
Ghanaian, so a country picker offers a choice with one answer. Buttons are
`shape="pill"` with `ArrowUpRight` (rules §3 — the glyph is a signature, not a
tell). Legal text now carries real links to `/legal/terms` and `/legal/privacy`;
it was plain grey text.

**Server contract re-verified from the live DOM** — `/signup?role=provider`
posts `mode, role, fullName, phone, spokenLanguages`, unchanged.

### 1.6 — Verify-number step — **done**

Centred title + subtitle over the boxes, the way the reference sets it: on a
screen with one question the title belongs over the answer. Six boxes, not the
reference's four. Slots moved from `bg-ink-0` to `bg-white` — the warm fill
reads as a smudge on the pure-white auth ground, the same reason the `outline`
button variant exists.

**No "Resend Code".** The reference pairs it with "Didn't get the code?". Ours
offers "Wrong number? Change it" instead: `issueOtp` enforces a 60-second
cooldown and six sends an hour per number, so a resend that is refused most of
the times it is pressed teaches people the app is broken. Going back costs one
tap and goes through the same limits honestly. (Confirmed live — the cooldown
fired during testing and said `Wait 41s`.)

### 1.7 — Success screen — **built, not yet wired**

`src/app/welcome/page.tsx` + `src/components/mobile/success-mark.tsx`.

**Not in the flow, and that is a decision rather than an omission.**
`verifyCodeAction` ends `redirect(homePathForRole(profileRole))`, and rules §1
puts `actions.ts` off-limits. Wiring it is one line — redirect to `/welcome` —
but that changes auth behaviour, not presentation.

Role-aware, which is the argument for having it at all: a **client** has
nothing left to do, so it is a confirmation and a doorway to `/client/post`; an
**artisan** has the whole verification application ahead of them, so it names
that and opens `/provider/apply`. The reference's "Skip" is absent — it skips
profile completion, ArtisanGH has none for a client, and an artisan who skips
verification cannot be booked.

### Regression introduced and fixed (second)

Moving the page heading into the form gave the provider signup **two h1s** —
"Sign up" in `ScreenHeader` and "Create your account" over the fields. The
header's title is nav chrome, the same role a browser tab label plays, so it is
now a `<p>`. Caught by auditing the rendered outline at 360px, not by tsc or
eslint — neither has an opinion about heading structure.

The heading also had to move *into* `PhoneAuthForm` rather than stay in the
page: which step you are on is client state derived inside that component, and
the verify step needs its own title. Left in the page, "Create your account"
sat above "Check your phone number".

### Verification

- `npx tsc --noEmit`, `npm run lint`, `npm run build` — clean
- `npm run a11y` — every page clean; `npm run smoke` — every screen renders
- Heading outline across all four auth screens: `h1=1 skips=0`
- 360px: no overflow, zero sub-24px tap targets on `/welcome` and
  `/signup?role=provider`
- Walked `/signup?role=client` → code step → `/welcome` in the browser

### Still open in Phase 1

- **Wiring `/welcome`.** One line in `verifyCodeAction`, which rules §1 reserves
  for a decision rather than a redesign edit. Until then the screen is reachable
  directly but nothing routes to it.
- Landing-page CTAs still point at `/signup` and now land on the option screen,
  which is correct — but the landing page itself is Phase 6 and still carries the
  warm-paper design, so `/` → `/signup` is a visible change of visual language.
  Expected until Phase 6.

---

## Phase 2 — Home & bottom nav `@4-home`

### 2.1 Bottom nav — **done**

`src/components/mobile/bottom-nav.tsx`. Floating pill bar, active tab filled
and labelled, inactive tabs bare icons — which is what lets four tabs fit at
360px without truncating. Inactive labels stay in the DOM as `sr-only`.

**Four tabs, and what the third one is not.** The reference's third slot is
chat. PLAN.md §14 puts in-app messaging out of v1 and points at masked calling
or WhatsApp, so that slot carries **Jobs** — the thing a returning client
actually opens the app for. A chat tab opening an empty screen would be worse
than three tabs.

`position: fixed`, not `sticky`: rules §4 asks for RN-translatable CSS and a
fixed bottom bar maps onto a tab navigator directly. It lives in the layout
rather than in each page — a bar that appears a frame late reads as the page
jumping.

### 2.2 The shell — **done**

`src/app/(app)/layout.tsx` now serves **two shells, chosen by `profile.role`**.

The client app is the redesigned one: phone-width column on white, no top
chrome, floating tab bar. The admin console and provider screens are not
redesigned — they are dense and multi-column and still want the header with its
role badge and the wide container. Branching on role rather than pathname
because the layout already has the profile and a Server Component cannot read
the path. When the other two roles land, the fork disappears and the mobile
shell becomes the only one, which is what the plan means by "the app shell every
signed-in screen inherits".

### 2.3 Client home — **done**

`src/app/(app)/client/page.tsx`, rebuilt.

**The order is the whole argument.** The reference is browse-first: search,
categories, offers, a carousel of pros — a shape that assumes every visit starts
a new purchase. This product is not that. A client with a plumber currently on
the way opens the app to see where the plumber is, so live jobs come first when
there are any and browse comes first when there are none. The reference's
furniture is all present; it is sequenced by what the person came for.

**Four things from the reference are deliberately absent**, each because the
product has nothing behind them:

| reference | why not |
|---|---|
| "Get 40% Off" promo cards | §14 — promo codes are out of v1. A discount tile with nothing behind it is a lie on the first screen. |
| `$29/hr` on category cards | §9 — artisans price each job freely, there is no price guidance in v1, so any figure would be invented. |
| "Explore our top rated pros" | §14 — no public artisan browsing. Artisans are matched to a job, not shopped for. |
| Chat tab | §14 — no in-app messaging. |

`CategoryChips` uses **icons, not photographs**. The reference fills each card
with a stock photo; there are 26 trades here and four photographs in
`public/img/`, so matching it would mean either sourcing 26 images the client
has not paid for or repeating four across twenty-six tiles, which reads as a
bug. `categories.icon` is already in the database and already admin-editable.

No "Available · at your area" badge: in the reference it is decoration, here it
would be a claim about supply we cannot make until the matcher has actually run.

The search bar is a **link to the picker, not an input**. There is nothing to
search beyond 26 categories, and a box that filters a list the user is about to
see anyway costs a tap and returns nothing — but that is where a thumb goes
looking, so it keeps the shape.

### 2.4 Account tab — **done**

`src/app/(app)/client/account/page.tsx`. Deliberately small: who you are, how we
reach you, the documents you agreed to, and the way out. The reference's account
screen carries an earnings overview and a booking history — history has its own
tab here and a client has no earnings. It exists now because a fourth tab that
opens nothing is worse than three tabs; the fuller `@7-account` lands with that
screen's work.

### Fixed while building

- **Dev panel collided with the tab bar.** Both are fixed to the bottom; the dev
  pill sat on top of the Home tab. Raised to `bottom-24`.
- **`JobCard` kept its warm `ink-0` fill** on the new white ground, where it
  reads as a smudge. Now `bg-white` — the third time this exact correction has
  been needed, after the `outline` button variant and the OTP slots.

### Verification

- `tsc`, `lint`, `build`, `check:props` — clean
- `npm run a11y` — every page clean; `npm run smoke` — every screen renders
  **across all three roles**, so the layout fork did not strip the admin console
- `npm run e2e`, `e2e:execution`, `db:verify` — unchanged and passing
- Live DOM: 26 category tiles, 4 nav tabs with correct `aria-current`, zero
  horizontal overflow at 360px

### Still open in Phase 2

- Tab filters with the underline indicator (`All / Popular / Near you`) — needs
  data the product does not collect yet, so deferred rather than faked.
- The provider and admin shells still use the old header.

---

## Post a job — the 2026 reference flow

Reference: `designing-ui-ux/post a job/` (`@1-main` … `@6-review and confirm`).
Palette and type follow the home screen: navy `#0A2E73`, azure `#2F80ED`,
`bg-white`, Space Grotesk headings.

### The bug this started from

Tapping a trade on the home screen went to `/client/post?category=<slug>`. The
picker **ignored that parameter entirely**, so choosing "Plumbing" on the home
screen opened a screen asking you to choose a trade. The query string had never
been read by anything.

### The fix, and why the tiles are now buttons

Reaching the description form needs a draft `jobs` row to exist — that is the
`[jobId]` in the URL — and creating one is a write. A link is a GET, and Next
prefetches GETs on hover and on viewport entry, so a linked tile would create
draft jobs for every trade a thumb scrolled past.

So every trade tile now submits `startDraftAction`, the same action the picker
grid has always used. `src/components/mobile/start-draft.tsx` holds the form,
the pending bookkeeping and the submit button; the chips, the featured cards,
the explore grid and the picker all render through it, so the two entry points
cannot drift apart. The action already reuses an unfinished draft for the same
trade rather than making a second one — verified: no category has more than one
draft after repeated taps.

Cost, stated plainly: no prefetch, no open-in-new-tab, and a server round-trip
before the screen changes. The spinner lands on the tile that was actually
tapped, which is what makes the wait legible.

### Screens

| reference | here |
|---|---|
| `@1-main`, `@3-after-filling-form` | `describe` — chosen-trade chip, description, photos, voice note |
| `@2-browse` | `/client/post` — search pill, two-column trade grid |
| `@4-shedule-time` | **not built** — see below |
| `@5-location` | `location` — search, map, landmark, GhanaPostGPS |
| `@6-review and confirm` (left) | `review` — one card, a row per step, whole row tappable |
| `@6` (right, success) | `PostedBanner` on the job screen |

**`@4-schedule-time` has nothing behind it.** There is no scheduling column in
`jobs` and no scheduling anywhere in the product: a posted job goes to the
nearest *available* artisan now. The reference is a different product shape —
book Thursday at 10am — and building the picker would have meant either a schema
change (off-limits) or a control that discards what it collects.

### Decisions

- **One trade chip, not the reference's chip row.** The trade has already been
  chosen; re-offering twenty-five alternatives above a half-written description
  invites people to lose it. "Change" beside it is the rest of that row.
- **The tab bar hides inside a draft** (`/client/post/<id>/…`). It and the
  pinned Continue would stack two full-width controls at the bottom of a phone,
  and "Browse" mid-flow walks away from a half-written draft with no warning.
  `/client/post` itself is the Browse tab and keeps the bar.
- **Step rail is three bars, not numbered circles with labels and connectors.**
  A quarter of the height, and the step is still named in words beside the
  count.
- **No price row and no date row on review.** §9 — nothing has priced the job
  yet; that is what the flow after this one is for.
- **The review row is the link, not a small "Edit".** 44px tall and the width of
  the screen instead of a 30px word.
- **`?posted=1` finally does something.** `postJobAction` has always redirected
  with it. Success is a panel on the job itself rather than the reference's
  separate screen with a "Go Your Task" button — same reassurance, one less tap,
  and it clears itself on the next navigation with no dismissed-state to store.

### New primitives

- `start-draft.tsx` — `StartDraftForm`, `TradeTile`, `useStartDraft`
- `sticky-action.tsx` — the bottom-pinned action (fixed, not sticky: rules §4)
- `panel-field.tsx` — `PanelField` / `PanelInput` / `panelControlClasses`, the
  white-ground field. `ui/input.tsx` stays for the admin console and the quote
  builder, where the boxed warm control is right. Same split, and the same
  reasoning, as `UnderlineField` on the auth screens.

### Also restyled (leaf components the flow renders)

`photo-uploader`, `voice-recorder`, `location-picker`, `location-map`,
`discard-draft`. The discard confirmation became an anchored card: the trigger
now sits in a header row beside a back button and a title, and a sentence plus
two buttons inline overflowed that row at 360px.

### Fixed while building

- **Voice-note playback was lost on review.** The description row became a link,
  and an `<audio controls>` inside an anchor navigates when you press play.
  Playback moved to its own strip in the same card — hearing the note back is
  the only way to catch a recording that captured nothing.
- **Red asterisk on "Landmark".** Rules §2. Required fields are unmarked; the
  optional one says "optional".

### Verification

- `tsc`, `lint`, `build`, `check:props` — clean
- `a11y` — every page clean; the three `[jobId]` steps are not in that script's
  route list, so checked by hand: exactly one `h1` each, no skipped levels
- `smoke` — every screen renders across all three roles
- `e2e`, `e2e:execution`, `db:verify` — unchanged and passing
- Drove it live: Painting tapped on the home screen → `…/describe` with the
  Painting chip at step 1 of 3 and the tab bar gone → description saved →
  location at 2 of 3 → review at 3 of 3 showing the description, landmark,
  address and GhanaPost code. Zero horizontal overflow at 360px on every screen;
  no tap target under 44px.
- `?posted=1` renders the success panel; without it the panel is absent.

### Not verified interactively

The discard confirmation card could not be opened — the browser pane collapsed
to zero dimensions partway through and stopped dispatching clicks. Its geometry
is safe by construction (`absolute`, `w-56`, right-aligned → left edge at 124px
on a 360px screen) and being absolutely positioned it cannot affect page
overflow, but it has not been clicked in a real browser.

---

## Post a job, round two — and the home screen recut

Feedback: images not appearing, the OTP row overflowing, the home header too
tall, and the posting flow not matching `@1-main`.

### Images were on disk and invisible

`slot()` resolved every path **once, at module load**. Files dropped into
`public/img` after the dev server started stayed null until a restart, and the
symptom — a placeholder next to a file that plainly exists — looks exactly like
a wrong path. The documented handoff ("drop the file in, that's it") was
therefore untrue.

Now each read re-stats in development and is cached in production, via getters
rather than plain values. All six category photographs and the three auth plates
resolve without a restart.

### The verification code overflowed

Six 44px boxes plus gaps plus the 3+3 separator came to **320px**, inside a card
whose inner width at 360px is **264**. The boxes are `flex-1 min-w-0` now, so
they divide whatever width they are given; the separator is gone, since it cost
16px to say something the grouping already said.

### Home header: 280px → ~110px

It had a 28px headline over a gradient with a masked artisan plate. The
reference spends about 110px on the same job — greeting, one line of purpose, a
bell, the location — and on a 360px phone the difference was the whole first
screenful. Gradient, plate and headline all gone; greeting and subtitle in the
reference's own type. The photographs in the featured row supply the colour the
gradient was there for.

The filter row (`Short` / `5+ Years` / `Near within 5 Km` / `Low to high`)
stays out, as asked.

### `@1-main` — the trade row is on the form now

The flow's header bar carried a single navy chip with a "Change" link out to the
picker. The reference puts a **scrollable row of trades directly above the
description with the chosen one filled**, so changing your mind is one tap
without leaving the half-written form.

`TradeSwitcher` is that row. The chosen trade is pinned first (a `sort_order`
row would put Electrical at the left whatever you picked, leaving the one chip
whose state matters six flicks off-screen); eight are chips and **All trades**
opens `@2-browse` as a bottom sheet over the form, searchable, with the chosen
one marked. Switching writes immediately — `switchDraftCategoryAction`, draft
only — so the description, photographs, voice note and pin all survive it.

Heading is now **"Post a job and match an artisan"**.

### `@4-shedule-time` — built, as windows

Previously declined for having nothing behind it. Now asked for, so:
**migration 0023** adds `preferred_date` and `preferred_window` to `jobs`.

**It is a preference, not a booking, and the schema says so.** The matcher
offers a posted job to the nearest *available* artisan immediately; there is no
calendar, no hold, no accept-for-later. The reference's exact slots ("10.00 AM")
would be a promise the product cannot keep, on the screen where it asks to be
trusted. So: a day, and a part of it — Morning / Afternoon / Evening, or any
time — with "As soon as possible" first and pre-selected. The artisan sees it in
the offer; the two of them agree the hour on the call they already have, which
is how this trade is arranged in Accra anyway. The screen says that in as many
words.

`preferred_date` is a `date`, not a `timestamptz`: a window is a part of a day,
and an instant would invent precision nobody supplied. Two check constraints —
the window must be one of three values, and a window cannot exist without a
date. Both verified rejecting bad writes (`23514`).

The rail is four steps. Hours live in `src/lib/jobs/schedule.ts`, so changing
what "afternoon" means is one edit.

### The success and search screens

`?posted=1` shows `PostedBanner`, and `MatchingProgress` — which already existed,
with live polling and widening radar rings — is the searching screen underneath
it. No new work needed; the two now meet.

### Two bugs found by driving it

- **"Pick a day" was preselected on every new draft.** `useState(initialDate ===
  null)`, and PostgREST hands back `undefined` rather than null for a column it
  has not selected — `undefined === null` is false. Now `!initialDate`.
- **The schedule saved and never came back.** `JOB_COLUMNS` is an explicit list,
  by design, so a column nobody adds to it is simply absent — and absent reads
  as "the feature is broken" rather than as an error. Review said "As soon as
  possible" over a row holding a date. Both columns added, and the comment now
  says this is the cost of the explicit list.

### Verification

`tsc`, `lint`, `build`, `db:verify`, `a11y`, `smoke`, `e2e`, `e2e:execution` —
all clean. One `h1` on each of the four steps. Drove it live: Carpentry tapped
on home → `@1-main` with Carpentry filled in the chip row at 1 of 4 → schedule
at 2 of 4 → review showing "afternoon (12pm – 4pm)". Round-tripped the columns
through PostgREST as the client user and confirmed both constraints reject.

### Still not verified interactively

The browser pane keeps collapsing to zero dimensions, after which the page stops
hydrating and clicks do not dispatch. The schedule form's day and window
selection, and the discard confirmation card, have not been clicked in a real
browser — their server round-trips are verified, their DOM is verified, the
interaction is not.

---

## Login image, browse, account

### The white background was two JPEGs wearing a `.png` extension

`auth-skyline.png` and `auth-artisan-back.png` are **JPEGs**. JPEG has no alpha
channel, so both render as opaque rectangles — that is the white background.
Nothing complained: the file existed, and the browser sniffs the real format and
displays it happily.

`auth-artisan-portrait.png` is fine — a genuine RGBA PNG, 47% transparent by
sample — which is what made the login screen worth looking at more closely.

**Now the build says so.** `slot()` sniffs `.png` files in development and names
the offender on the server console with the fix. Twelve bytes per file, once. It
also catches the subtler case: a real PNG saved without an alpha channel
(colour type 0 or 2), which is just as opaque.

### Login: the artisan was sitting on the headline

The plate was `w-[17rem]` — 272px across a 400px column — so it ran straight
through the text and "for any service" was under the wrench. It is `12.5rem`
now, with the headline's measure set to match. **The two widths are set against
each other and the comment says so**, because changing one alone reintroduces
the overlap.

`mt-auto` on the card also ate every spare pixel on a tall viewport, leaving a
blank half-screen between the service circles and the card that read as a
missing section. Fixed margin now.

### Browse — photographs, not a list of words

Twenty-six identical tinted circles is a *list of words with decoration*:
nothing distinguishes Roofing from Upholstery at a glance, so the eye has to
read all twenty-six labels in order and the screen reads as a settings menu
rather than a place you buy something.

Now: 3:4 portrait photo cards, two per row, name and description over a gradient
scrim, brand icon chipped into the top-left. A ramp rather than a flat wash, so
26 photographs of wildly different brightness can all take the same treatment
and stay readable. A live result count, so a search that narrows 26 to 2 says so.

Six photographs exist; the other twenty fall back to the icon tile at the same
aspect ratio, so the grid stays even and nothing moves when they land. Prompts
for all twenty are in `IMAGE-PROMPTS-BROWSE.md`, along with corrected,
transparency-explicit prompts for the two auth plates.

`categoryPhotos` (a fixed six-key map) became `categoryPhoto(slug)` /
`categoryPhotoMap(slugs)`, since browse needs all 26 and home needs six.

### Account — the reference's band and sheet

A navy band carrying who you are, and a white sheet riding up over it holding
three labelled groups of plain rows. That overlap is the reference's one
structural move and the reason the screen reads as a single object.

Rows, against what exists:

- **Card Options** — no stored cards. Payment is Mobile Money per job; nothing
  is kept on file.
- **Notification Preferences** — nothing stores a preference and nothing reads
  one. Same reason the home bell became a link to the jobs list.
- **Personal information / How you sign in** — real.
- **Activity overview** — real, and the best idea on the reference. Posted, in
  progress, completed, from `summariseJobs` over the job list the page already
  loads.
- **Health & Safety Guidelines** — no such document. Terms and privacy are the
  two a client actually agreed to.
- **Help & Support (24/7)** — `support_phone` is in `settings`, which is
  admin-only under RLS (0003), and the value is still the placeholder
  `+233000000000` that migration 0004 says to replace before launch. Left out
  rather than filled with a number that does not answer — it needs a readable
  setting and a real number.

Avatar is initials, not a stock silhouette: there is no avatar upload, so a
photograph would be a placeholder for a feature that does not exist.

Counts are plain rows, not links. Each could plausibly filter the jobs tab, but
that tab has no filter to deep-link into.

### Fixed while building

- **`&amp;` inside a JSX string attribute renders literally.** Second time — the
  home subtitle had the same bug. Swept the whole `src` tree for entities in
  attributes; this was the only remaining one.

### Verification

`tsc`, `lint`, `build`, `a11y`, `smoke`, `check:props` — clean. Zero horizontal
overflow at 360px on browse and account. Login, browse and account all rendered
and compared against their references.

---

## Job history — photographs of your own work

### What decided the design

The history list is not a table of records. It is the client's evidence that
work happened in their home. Six months on the useful question is not "what was
reference AGH-260917-DF015" but **"which one was the bathroom"**, and the fastest
answer to that is the photograph taken at the time.

So every row carries a picture, and the picture is the job's own wherever one
exists — four tiers, none of them invented:

1. the job's **completion** photograph, if the artisan uploaded one;
2. otherwise its earliest photograph, which is the client's own shot of the
   problem;
3. otherwise the **trade's** photograph;
4. otherwise the trade's icon on the brand tint.

No stock image is ever invented for a job. Tiers 3 and 4 are labels for the
*kind* of work, not claims about this one.

### New: `coverPhotoByJob`

Two round trips for the whole page — one select over every photo belonging to
the visible jobs, then one batched signing call — rather than two per job. The
per-job pick happens in memory, because expressing it in PostgREST would take a
view, and a view is a migration for something the page can decide itself.

### New: `JobHistoryCard`, separate from `JobCard`

`JobCard` lives on the home screen, where it is one of three rows saying "this is
happening now". This is one of forty saying "which one was this" — a different
question, answered by a photograph rather than a line of description. Merging
them would have meant a `variant` prop that changes everything about the
component except its name.

### New: `JobThumb`, and why it is a Client Component

Supabase signs a storage path **without checking an object is there**, so a
`job_photos` row whose file has gone yields a perfectly valid URL that 404s.
Signed URLs also expire — ten minutes here — so a tab left open over lunch comes
back to a page of dead links. Neither is visible to the server: the only place
that knows the picture failed is the browser, in `onError`.

So the tiers degrade **at the point of failure**, not at the point of query. A
client's record of work in their own home should never show a broken-image glyph.

### The rest of the screen

- Filter pills in the navy/azure system, horizontally scrolled, each carrying
  its count. Still links with a query parameter, not client state: a filtered
  view stays shareable, bookmarkable and back-button-safe, and the list renders
  on the server in one pass instead of shipping the whole history to be hidden
  with CSS.
- A tab with nothing in it is still not offered.
- **Two empty states.** "No jobs yet" on a new account is an invitation and gets
  the button; "Nothing in this view" behind a filter is a dead end, so its way
  out is back to the full list rather than an offer nobody asked for.
- **No money on the rows.** A cost lives on a quote; one query per row to render
  a figure that means nothing until accepted. The job screen shows it.

### Bug found by driving it

The first version preferred `completion` photos **only for jobs whose status
group is `closed`**. Every photograph in this database is a completion shot and
every job carrying one is `paid` — which `jobStatus` groups as *active* — so the
query returned nothing at all and every row fell through to the trade
photograph. The rule now reads the photographs rather than the status: a rule
about which files exist cannot be wrong about which files exist.

### Verification

`tsc`, `lint`, `build`, `check:props`, `a11y`, `smoke` — clean. All four filters
and a bogus one return 200; exactly one `h1`; no horizontal overflow and no tap
target under 44px at 360px. Live DOM confirmed both tiers in use on one page:
four rows on the trade photograph, one on its own signed completion shot.

---

## The artisan side

No design reference for this one. The direction came from what the app *is*.

### The premise that decided everything

**The client app is a shop. The artisan app is a tool of work.** The client
browses, chooses and buys; the artisan is *offered* work and needs to know four
things — am I on, what have I got on, what have I been paid, who am I on this
platform. Closer to Uber Driver than Uber Rider: opened one-handed, standing in
traffic, between jobs.

Three consequences, all deliberate departures from the client side:

- **Denser.** Numbers where the client side has photographs.
- **No stock photography anywhere.** This person *is* the artisan. A stock
  picture of somebody else doing their trade on every row would be decoration
  standing where information belongs — and faintly insulting. Their own figures
  are the content.
- **Money is a tab, not a panel.** The entire pitch to artisans is that they get
  paid properly and can see it. Burying that one level down buries the pitch.

Same tokens as the client app, different treatment. That is the point of having
tokens.

### Screens

| | |
|---|---|
| **Shell** | `ProviderNav` — Today / Jobs / Earnings / Account. Same shape as the client bar (an artisan who also books work should not learn two navigations), different destinations. Hidden inside `/provider/apply`, where three of four tabs would open empty screens. |
| **Today** | Offer → availability → this week's money → work on now → reliability → verification. |
| **Jobs** | Assigned work, defaulting to **On now** rather than All. |
| **Earnings** | The ledger. New. |
| **Account** | Band-and-sheet, carrying verification state rather than a phone number. |

### Today: the order changes with state

An **offer** outranks everything — it is the only object in the app with a clock
on it. An **approved** artisan came to go online, so the toggle is the hero and
verification drops to a quiet footnote. An **unverified** one cannot go online
at all, so verification leads and the toggle sits underneath as the thing being
worked towards. The two audiences never overlap, so a fork is cheaper than a
compromise. Both were driven and checked.

The availability toggle stopped being a settings row and became the hero: three
states read from colour before a word is — navy at rest (the quiet state is the
one that needs the shout), green and pulsing when live, azure and locked on a
job.

### Earnings: only settled money is "earned"

The headline counts `paid` payouts and nothing else. Counting `pending` would
mean the total **drops** when a transfer fails — the worst thing an earnings
screen can do to someone's trust. Money in flight gets its own quiet line; a
failed transfer gets a loud one, because that is the case where the artisan has
to act.

This is visible in the seeded data right now: GHS 1,320 sits in "on the way" and
the headline reads GHS 0.00, because the mock payment adapter never settles a
payout. The screen is telling the truth about the simulation.

**No chart.** A weekly bar chart is the obvious move and would be decoration at
this volume — six bars from six rows the list already shows, inviting a trend to
be read into a sample too small to have one. It earns its place with months of
history, not weeks.

### Two voices for one status

`jobStatus().blurb` is written to the **client**: "Your artisan is travelling to
you." On an artisan's own job card that is nonsense. `providerBlurb` now sits
beside it for all 22 statuses, null for the ones an artisan never sees (anything
before `assigned`). Keeping both in the status machine rather than letting the
provider screens paraphrase is what stops two accounts of one state drifting
apart.

### Bug caught while building

`VERIFICATION_COPY` was keyed on `string` and carried an `unverified` entry — a
status that has never existed — while missing `unsubmitted`, which is the one
every new artisan actually starts on. Every new artisan would have seen a blank
badge. Now typed by `VerificationStatus`, so the next status added to the enum
is a compile error rather than a blank badge in production.

### Not done

The offer screen, the quote builder and the job execution screen still carry the
old warm palette. They are the next pass — the offer screen in particular
deserves its own treatment, since it is the single most important screen in the
artisan app and the only one with a clock.

### Verification

`tsc`, `lint`, `build`, `check:props`, `db:verify`, `a11y`, `smoke`, `e2e`,
`e2e:execution` — clean. All five routes 200 for **both** an approved artisan and
an unsubmitted one; one `h1` on each; no horizontal overflow and no tap target
under 44px at 360px. Driven live on real seeded data: 4 jobs done, GHS 1,320
pending, MTN payout number, Electrical trade.

---

## 21st.dev — first use, on the artisan offer screen

### What the account actually is

`get_usage` first, before spending anything: **free tier, 2 component retrievals
per day, AI generation disabled.** Searches are unmetered; pulling code is not.
That makes the interesting question *which two*, not *how many*.

### What was rejected, and why

- **Countdown components.** Every result was a marketing countdown — flip
  clocks, event cards, an OTP resend button. None was the decaying ring an
  Uber-style offer needs, and `OfferCountdown` already does that with a
  `ring-drain` keyframe. No spend.
- **Number tickers** for the earnings headline. Tempting and wrong: the figure
  is server-rendered and static per load, so rolling it up every visit animates
  a number that has not changed, on a screen an artisan opens constantly. By the
  Emil framework that is the "seen often, purpose is decoration" case — don't
  animate. Worse, money counting up from zero on every page view is a small lie
  about what just happened. No spend.

### What was pulled — `radiumcoders/slide-to-detonate` (1 of 2)

A slide-to-confirm gate, adapted into `components/ui/slide-to-confirm.tsx` and
wired to **accept** on the offer screen.

**The product argument, which came first.** Accepting is the consequential half
of that screen: it locks the artisan to a job, and abandoning one afterwards
costs them a cancellation against the reliability score in migration 0018. A
thumb resting on a phone in a trotro should not be able to take a job by
brushing the glass. Passing stays a plain button — declining costs nothing, the
offer just moves on, and the clock is running. The asymmetry *is* the design.

**Five things wrong with it for this use, all fixed:**

1. **Drag-only.** WCAG 2.2 AA 2.5.7 requires a single-pointer alternative for
   author-controlled drags — confirmed against the ui-ux-pro-max guideline
   database, severity High. The handle is now a real `<button>`: Enter, Space
   and ArrowRight confirm with no dragging, and it takes a tab stop. A control
   deciding whether somebody earns today cannot be gated behind a gesture.
2. **Reset itself after 1.6s.** Here confirming fires a server action and then
   navigates; springing back to "slide to accept" mid-flight invites a second
   attempt on a job already taken.
3. **No pending state.** `respondToOfferAction` is a round trip on a Ghanaian
   mobile connection. The track now locks and spins.
4. **Distance only, no velocity.** A confident flick stopping at 80% was
   rejected and sprang back, which reads as the control refusing you. It now
   also fires on velocity, guarded by a minimum travel so a stray swipe cannot
   accept a job.
5. **shadcn tokens and a Radix button** this project does not have.

`dragElastic={0}` was kept from the original: this is a commitment gate, and
rubber-banding past the end would suggest somewhere further to go.

### Verified live

Created a pending offer, drove the screen, and confirmed **by keyboard with no
drag at all**: `data-state` went to `confirmed`, the label showed "Accepting…",
the action fired, and the RPC's own refusal came back verbatim — "This job has
moved on to another artisan." Happy-path wiring and error path both proven.
Handle is a real button, 44×44, focusable. Test offer deleted afterwards.

### The second retrieval is deliberately unspent

Nothing else on the artisan side was worth it today. The remaining gaps there —
the quote builder and the job execution screen — are palette work on screens
whose structure is already right, not missing interaction patterns. An unspent
retrieval is worth more tomorrow than a number ticker we should not ship.

### Verification

`tsc`, `lint`, `build`, `check:props`, `a11y`, `smoke`, `e2e` — clean.

---

## Artisan dashboard, rebuilt against the brief

First pass matched the mockup's *inventory* and not its *composition*, which is
exactly what `artisan-dashboard-prompt.md` rule 1 warns about. Rebuilt against
the brief rule by rule.

### The rig, because eyeballing a thumbnail was the root cause

`scripts/compare-shot.ts` (`npm run compare`):

- `crop <png> <y> <h>` — pull a band out of a mockup at 1:1 so it can be *read*.
  `sips` crops from the centre and silently returns black out of bounds, which
  is how three attempts produced an empty image.
- `shoot <route> <userId>` — screenshot a live route at a phone width, signed in.

Two things it had to work around, both real:

- **Playwright cannot install Chromium on this Mac.** It is macOS 12, and
  `npx playwright install chromium` fails with *"does not support chromium on
  mac12"*. Every browser script here is dead without `channel: "chrome"`,
  including `npm run shots` — which has therefore never run on this machine.
- **`fullPage: true` lies.** Chrome stitches full-page captures from viewport
  slices, and `backdrop-filter` and `position: fixed` — the floating nav does
  both — composite differently per slice. One tall viewport paints once.

### The bug the rig caught

The earnings banner rendered as three navy smears with its content stacked. The
gradient was set the whole time: rewriting that class list had dropped
`flex items-center gap-4`, and `Link` renders an `<a>`, which is
**`display: inline`** by default — an inline box paints its background only
behind its own text fragments. Confirmed by probing the computed style, not by
guessing.

### Against the brief

| Rule | Was | Now |
|---|---|---|
| 2 — editorial hero | small masked plate, dead right third | 46% of the band, bleeding off top and right, blurred organic shapes behind it; reflows to a wider text measure when the photo is absent |
| 3 — stop outlining | every surface bordered | borders gone from tiles, job card, performance; depth from shadow |
| 4 — quick actions | outlined boxes | elevated tiles, 22px, navy circular icon, chevron opposite |
| 5 — premium earnings | flat 24px | 26px, lit gradient, glow behind, floating pill |
| 6 — job card breathes | compressed | 20px padding, 56px icon, landmark full width, time + "View details" pill |
| 7 — one performance module | four loose columns | single surface, hairline dividers, outline icons on tint |
| 8 — promo | flat, four lines tall | full-bleed gradient, 28px, compact copy, right third held for the illustration |
| 9 — layered background | flat white | pale canvas ground, gradient wash, blurred shapes |
| 10 — floating nav | inline pill, labels hidden | frosted, 32px, stacked icon over label, navy capsule, all four labelled |

### Fixed mid-review

- Landmark truncated to "Blue gate oppos…" once the pill shared its row. The
  landmark is the line an artisan navigates by, so it now gets the full width
  and the pill sits beside the *time*.
- Performance hints ran to five words and wrapped to three lines in a 93px
  column. Cut to two or three, as the reference's are.

### Still open — two images

Rules 2 and 11 lean on photography this build does not have:
`provider-hero-artisan.png` and the promo's 3D toolbox. Both slots reflow so
nothing reads as half-empty, but neither will match the mockup until the files
land. Hero prompt is in `IMAGE-PROMPTS-ARTISAN.md`.

### Verification

`tsc`, `lint`, `build`, `check:props`, `a11y`, `smoke` — clean. At 360px: no
overflow, nothing clipped, no tap target under 44px.

### Hero photography — reusing the login portrait

`photos.providerHero` is now a **list of candidates**, first-that-exists:
`provider-hero-artisan.png`, then `auth-artisan-portrait.png`. The login
portrait is the same artisan in the same navy and is already a verified
transparent RGBA PNG, so the dashboard gets its editorial hero today instead of
waiting on a second shoot, and a bespoke file takes over later with no code
change.

`object-position` needed one adjustment: at `52% 12%` the notification bell sat
squarely on the artisan's cap. The source has transparent headroom above him, so
aligning the top of the image with the top of the box (`50% 0%`) drops the head
clear of the bell — the composition the reference has.

The promo card's 3D toolbox is the one asset still missing.

---

## The live job card — both dashboards

Current work now outranks everything else on both home screens.

### What the reference draws that does not exist

The mockup carries a **route line and "8 min away"**. Neither is backed by
anything: `set_provider_location` and `record_location_ping` have been in the
schema since migration 0005 — commented *"used by the client's live tracking map
in Phase 5"* — and **nothing has ever called them.** No artisan position is
recorded anywhere and no ETA is computed.

An invented "8 min away" on the one card whose whole job is to reassure somebody
that a stranger is coming to their house is the worst possible thing to get
wrong. So the space the map occupied carries the **milestone rail**, enlarged —
it answers the same question and is the one thing on the card that genuinely
moves. Tracking can take that space back the day something writes those pings.

### What it does say, and one real gap it closes

`CLIENT_MILESTONES` and `milestoneIndex` already existed, five steps, exactly
the reference's "Step 4 of 5" model.

The client's card names **the artisan** — read from `provider_public`, the view
migration 0020 created for precisely this and which **nothing had ever read**.
The client job screen has never named the person coming to their house, which is
a strange gap on a product whose pitch is that the artisan is verified.

New artisans have no rating and no job count, which left that line reading
"Kwame Mensah / Electrical". `provider_public` only returns approved,
unsuspended artisans, so it falls back to **Verified** — not a consolation
prize, the strongest true thing about somebody on their first job.

### Placement, and the empty state

- **Client** — replaces the category chips, under the search pill.
- **Artisan** — replaces the earnings banner while work is live. Earnings is not
  lost: the quick-card row carries it with the amount on its way. An artisan
  outside somebody's gate needs the job, not this week's total; the two never
  both matter most, so they share the slot.

The client cascade, most useful first: **live job → unfinished draft → nothing
at all.** Collapsing is deliberate. The two sections below already answer "what
might I start" twice over, and a third prompt in the same scroll is noise — a
client with no history reads search → popular → explore, which is the
browse-first shape they need. Verified against a real zero-job account.

`Browse by category` is gone; **All categories** sits beside *Popular right now*
and opens the browse screen.

### Three bugs found while building

- **`Views: Record<string, never>`** in the Database type made the relation-name
  union `string`, so *any* table name type-checked. Two relations had been in
  use and never declared: **`signoffs`** (a real table, read by the invoice) and
  **`rating_public`**. Both declared now, and a typo in a table name is a
  compile error again.
- **`bg-success-300` does not exist** — the ramp is 50/500/600/700 — so the
  card's live status dot rendered invisible. A status light that was not lit.
- **`paid` is in the `active` group**, so a finished, settled job showed as
  "Live · Paid". `isLiveJob()` now lives in the status machine and both
  dashboards share it: active, except `paid`. Still true for `posted` and
  `matching`, because the anxious wait for an artisan is exactly when a client
  wants something on their home screen.

Plus one caught by `npm run a11y` rather than by eye: the card's title was an
`h3` directly under the page `h1`, skipping a level on **both** dashboards.
`titleAs` now defaults to `h2`.

### Verification

`tsc`, `lint`, `build`, `check:props`, `a11y`, `smoke`, `e2e` — clean. Driven
live: client with a live job (artisan named, Step 3 of 5), client with none
(slot collapses), artisan with only settled work (earnings banner).
