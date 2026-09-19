# Rules — read before touching any page

These are binding for every screen in the new-reference redesign. If a rule and
an older document disagree, this file wins for app screens.

---

## 1. Backend is untouchable

Never change: `src/lib/**`, `src/proxy.ts`, any `actions.ts`, `supabase/**`,
schema, RLS, adapters, auth logic, business logic.

Server actions take `FormData` with specific field names. If you restyle a form,
**the names, the hidden inputs and the submitted values must be byte-identical**.
Before touching a form, read the action it posts to and list the fields it
expects. A prettier form that posts the wrong shape is a broken feature.

Known contracts:

| action | fields |
|---|---|
| `requestCodeAction` | `mode`, `role`, `fullName`, `phone`, `spokenLanguages` |
| `verifyCodeAction` | `mode`, `phone`, `fullName`, `role`, `spokenLanguages`, `code` |

## 2. Where the reference wins, and where it does not

**Copy:** layout, spacing rhythm, component shapes, screen structure, navigation
patterns, field styling, button shapes, interaction and motion.

**Do not copy:**

- **Navy.** Primary is ArtisanGH `brand-700` green. Links are `brand-700`.
- **Money colour.** Amber `accent-600`, cedi amounts only.
- **Passwords.** ArtisanGH is phone + OTP. There is no password field anywhere.
- **Google / Apple sign-in.** Not implemented. The reference's "more ways to
  sign up" slot is where ArtisanGH's two role paths go instead.
- **4-digit codes.** Ours are 6.
- **`+1` / US flag.** Ours is `🇬🇭 +233`.
- **Dollar amounts.** `GHS`, via `formatAmount` / `formatCedis`.
- **"Tasker" / "handyman".** Our word is **artisan**. The client **books a
  service**; the provider **works as an artisan**.

## 3. Deliberate exceptions to the frontend-design skill

The `frontend-design` skill lists these as generic AI tells. The reference uses
them as signature details, and a pinned brief wins — so they are **intentional
here and must not be "fixed"**:

- **Tiny letter-spaced uppercase labels** above form groups
  (`CONTINUE WITH YOUR PHONE NUMBER`). Use `<FieldLabel>`.
- **`↗` glyph inside primary buttons.**

Everything else in that skill still applies. In particular: no decorative
gradients, no fade-up on every section, one bold moment per screen.

## 4. Mobile is the product

- Design at **390px**. Verify **360px**. Never let 360 break.
- Desktop is the same screen in a centred ~400px column. Do not invent a desktop
  layout.
- Every screen goes inside `<MobileScreen>`.
- Primary actions that the reference pins to the bottom of the viewport stay
  pinned.
- Minimum **44px** tap targets. Use `.tap` for inline text links.
- This becomes React Native later: prefer flexbox, avoid CSS that has no RN
  equivalent (`float`, `columns`, complex grid, `position: sticky`).

## 5. Use the primitives

Before writing a `className`, check whether a primitive exists. The last audit
found 46 hand-rolled card surfaces against 18 uses of the `Card` primitive —
that is how a design system dies.

| need | use |
|---|---|
| screen shell | `<MobileScreen>` |
| top bar | `<ScreenHeader>` |
| tiny uppercase label | `<FieldLabel>` |
| underline form field | `<UnderlineField>` |
| button | `<Button shape="pill">` |
| loading | `<SplashScreen>` / `<Skeleton>` |

If something is needed twice, it becomes a primitive before the second use.

## 6. Colour and type on white

- Ground is `bg-white`. Not `ink-25`, not `ink-0`.
- Body text `ink-900`; secondary `ink-600`; the tiny labels `ink-500`.
- Hairlines and field underlines `ink-200`.
- Use the named type scale (`text-2xs`, `text-note`, `text-ui`, `text-lede`,
  `text-title*`). Arbitrary sizes need a comment saying why the scale failed.
- Quantities and identifiers — prices, codes, references, ratings, counts — are
  mono with `tabular`.

## 7. Motion

- Use the existing tokens: `--duration-instant|fast|base|slow`,
  `--ease-out-strong`, `--ease-drawer`, `--ease-spring`.
- Motion answers an action or shows a state change. It is not decoration.
- Presses resolve in `--duration-instant` (130ms) — before the finger lifts.
- Never animate from `scale(0)`.
- Any new looping animation needs an explicit `prefers-reduced-motion` branch
  **before** the blanket block in `globals.css`. The blanket rule collapses
  durations to 0.01ms, which snaps a loop to its end frame — see the countdown
  ring and the loader bar for the established pattern.

## 8. States are not optional

No screen ships with only its happy path. Every screen needs its loading, empty
and error states designed at the same time. The audit found zero `loading.tsx`
files and zero uses of the `.skeleton` utility; do not add to that.

## 9. Verify, then log

- `npm run lint` and `npx tsc --noEmit` clean before claiming done.
- `npx tsx scripts/shoot.ts current --routes=<route>` and **actually look at the
  screenshot**.
- Check the route still returns 200 and the form still submits.
- Append what you did to `newredesign-reference-plan-implementation.md`.
- Do not mark a phase done in `newredesign-reference-plan.md` until its screens
  are verified.
