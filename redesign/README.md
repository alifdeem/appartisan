# redesign/

Working documentation for the UI/UX redesign. Backend is out of scope throughout:
no migrations, no RLS, no adapters, no `src/proxy.ts`, no server actions, no
business logic.

This folder **extends** `DESIGN.md` at the repo root rather than replacing it.
`DESIGN.md` argued the landing page, the auth screens, the colour ramp and the
three typefaces, and those arguments still hold. It also explicitly put the
client / provider / admin dashboards **out of scope** (§7) — which is exactly
where the product feels unfinished. That gap is what this folder covers.

| | |
|---|---|
| [`01-direction.md`](01-direction.md) | "Paper & Depth" — the visual direction, and why not glass |
| [`02-audit.md`](02-audit.md) | What is wrong now, measured rather than asserted |
| [`03-design-system.md`](03-design-system.md) | Tokens, primitives, and the rules for using them |
| `shots/baseline/` | Every public screen × 5 viewports, captured before any change |
| `shots/current/` | The same screens, re-captured as work lands |
| `references/` | Inspiration. See [`references/README.md`](references/README.md) |

## The screenshot harness

```bash
npx tsx scripts/shoot.ts baseline              # all public routes
npx tsx scripts/shoot.ts current --routes=/    # one route
```

Drives the dev server on `localhost:3000` through the Chrome already installed
on this machine (`channel: "chrome"` — no 130MB Chromium download). Writes one
full-page PNG per route per viewport, then runs the objective checks that do not
need a human: horizontal overflow, and tap targets under the 44px this codebase
holds itself to.

It deliberately does **not** try to judge design. It catches the things that are
true or false — overflow, contrast, hit areas, focus order — and leaves
composition, hierarchy and whether the thing has any character to people.

## Order of work

1. **Phase 0** — baseline capture, harness, this documentation. *Done.*
2. **Phase 1** — design system: the missing token layers, then the missing
   primitives.
3. **Phase 2** — app shell: real navigation, per-route container widths.
4. **Phase 3** — states: `loading.tsx` and skeletons, `not-found.tsx`, designed
   empty and error states.
5. **Phase 4** — page by page, highest traffic first.
6. **Phase 5** — the two signature objects: artisan card, quote docket.
7. **Phase 6** — validation: full matrix, a11y, throttled-mobile Lighthouse,
   print check.

The landing page was pulled forward out of that order, as a taste gate: something
real to react to before committing to the rest.
