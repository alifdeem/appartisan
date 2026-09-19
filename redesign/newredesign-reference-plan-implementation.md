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
