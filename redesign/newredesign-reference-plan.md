# New reference redesign — master plan

**Reference:** `redesign/new-reference-shots/artimockss/` — the "FixPro" mobile
handyman app, 7 categorised folders.

**What we are copying:** UI and UX only. Layout, spacing, component shapes,
navigation patterns, screen structure, interaction and motion.

**What we are NOT copying:** the backend, the data model, the feature set, or the
brand colour. ArtisanGH's phone+OTP auth, `client`/`provider` roles, Ghana
`+233` numbers, 6-digit codes, itemised quotes and escrow all stay exactly as
built.

**Target viewport:** mobile. 390px is the design width; 360px is the floor that
must not break. Desktop renders the same screens as a centred column — this app
is going to React Native later, so every screen is designed once, for a phone.

---

## Decisions already locked

| | |
|---|---|
| **Background** | Pure white (`#FFF`), per the reference. This overrides the warm-paper argument in `DESIGN.md` §3 for app screens. |
| **Primary colour** | ArtisanGH deep green (`brand-700`), **not** the reference's navy. Brand survives; the reference supplies layout, not palette. |
| **Money** | Amber (`accent-600`) stays reserved for cedi amounts. |
| **Links** | `brand-700`, taking the role the reference gives blue. |
| **Button shape** | Full pill (`rounded-full`), per the reference. |
| **Desktop** | Centred ~400px column, white throughout, hairline edges at `lg`. |
| **Splash** | A real `loading.tsx` Suspense fallback — logo plus an indeterminate bar beneath it, Uber-style. **No artificial delay.** |

---

## The seven phases

Folder numbers are the reference's own. `@1-userflow` is not a phase — it is the
information architecture that informs all of them.

### Phase 1 — Foundations & auth `@2-logging in`

The token and shell work, then every auth screen.

- White app surface tokens; `shape="pill"` on `Button`; indeterminate loader keyframe
- `<MobileScreen>` — the centred column shell
- `<ScreenHeader>` — back arrow, centred title, optional right action
- `<FieldLabel>` + `<UnderlineField>` — the reference's label-above-hairline form style
- `<SplashScreen>` + `src/app/loading.tsx`
- `/signup` — the sign-up/log-in option screen, carrying **Book a service** and **Work as an artisan**
- `/signup?role=client|provider` — the form (no password field; ArtisanGH has none)
- `/login` — redesigned
- Verify-number step — 6 boxes, not the reference's 4
- Success screen

### Phase 2 — Home & bottom nav `@4-home`

The app shell every signed-in screen inherits. This is where the audit's
"there is no navigation" finding gets fixed.

- Floating pill bottom nav — active item as a filled pill with a visible label
- Horizontal scroll tab filters with underline indicator
- Horizontal scroll photo cards with gradient overlay label + price
- Tinted promo callout panel
- Client home rebuilt on all of the above

### Phase 3 — Browse categories `@5-browse-categories`

- Search field pattern
- Category grid/list
- Filter and sort controls
- Wired to the real 26 categories from `0004_reference_data.sql`

### Phase 4 — Post a job `@6post a job`

Six reference screens, mapping onto the existing multi-step posting flow.

- `@1-main` → describe
- `@2-browse` → category picker modal
- `@3-after-filling-form` → filled state
- `@4-shedule-time` → scheduling
- `@5-location` → location picker
- `@6-review and confirm` → review

Existing server actions, draft handling, photo upload and voice note all stay.

### Phase 5 — Account `@7-account`

- Profile header, settings list rows, activity overview, safety & support
- Maps onto existing profile and role data

### Phase 6 — Landing & hero `@3-hero`

The public marketing page. Last, because it is the only screen a signed-in user
never sees — and because the app should be settled before the shopfront is.

### Phase 7 — Validation & polish

- Full Playwright matrix at 360 / 390 / 768 / 1280
- Accessibility pass (`npm run a11y`), focus order, contrast on white
- Throttled-mobile performance
- Print check on the invoice
- Reduced-motion audit

---

## Working method, per screen

1. Read the reference image again. Do not work from memory.
2. Identify what the screen must preserve — actions, fields, server contracts.
3. Build or reuse primitives. **Never** hand-roll a style that exists.
4. Implement at 390px first.
5. Verify 360px does not break.
6. `npx tsx scripts/shoot.ts current --routes=<route>` and look at the result.
7. Compare against the reference side by side.
8. Fix, re-shoot.
9. Log it in `newredesign-reference-plan-implementation.md`.

## Progress

| Phase | Status |
|---|---|
| 1 — Foundations & auth | **in progress** — tokens, primitives, splash and the option screen done; form screens, verify step and success outstanding |
| 2 — Home & bottom nav | not started |
| 3 — Browse categories | not started |
| 4 — Post a job | not started |
| 5 — Account | not started |
| 6 — Landing & hero | not started |
| 7 — Validation & polish | not started |
