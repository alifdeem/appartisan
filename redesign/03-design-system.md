# Design system

Everything lives in `src/app/globals.css` under `@theme` (Tailwind v4, CSS-first
— there is no `tailwind.config`). Adding a token there makes the matching
utility exist everywhere, immediately.

## Type scale

The four text sizes below were **already** the ones this app used; they were
just written as arbitrary values 129 times. Naming them is the whole fix.

| token | size | job |
|---|---|---|
| `text-2xs` | 11px | mono indices, eyebrow labels |
| `text-xs` | 12px | *(Tailwind built-in)* |
| `text-note` | 13px | captions, helper text, fine print |
| `text-sm` | 14px | *(Tailwind built-in)* |
| `text-ui` | **15px** | **the workhorse** — dense interface text |
| `text-base` | 16px | *(Tailwind built-in)* |
| `text-lede` | 17px | standfirsts, list-item titles |

`text-ui` sits half a step above Tailwind's `sm` and is the right size for
interface text that still has to survive sunlight on a cracked screen.

## Display scale

The missing middle. Line-heights tighten as size grows, which is the correction
big type always needs and never gets from a blanket `leading-tight`.

| token | size | line-height | job |
|---|---|---|---|
| `text-title-sm` | 22px | 1.3 | card titles, step titles, promises |
| `text-title` | 28px | 1.2 | sub-section heads |
| `text-title-lg` | 36px | 1.12 | section heads |
| `text-title-xl` | 48px | 1.04 | — |
| `text-title-2xl` | 60px | 0.98 | the hero. Once per page, at most. |

`h1`–`h3` already inherit the display face and `-0.022em` tracking from the base
layer, so headings do not need to ask.

## Surfaces

See [`01-direction.md`](01-direction.md) for the reasoning.

| token | use |
|---|---|
| `bg-surface-sunken` | wells, table headers, inset summaries |
| `bg-surface-ground` | the page |
| `bg-surface-raised` | cards, panels |
| `bg-surface-overlay` | modals, popovers, menus |

`ink-25` and `ink-0` still resolve to the same values as `ground` and `raised`,
so nothing that already uses them has moved. New work should use the surface
names, because they say *what the thing is* rather than what colour it happens
to be.

## Unchanged, and deliberately so

Colour ramps (`brand` 155°, `accent` amber, `ink` warm 75°, semantics), shadows,
radii (`radius-field` 0.625rem, `radius-card` 1rem), motion curves and
durations, keyframes. All of these were already argued in `globals.css` and
`DESIGN.md`. Read the comments there before changing any of them.

## Still to build

Primitives that do not exist yet, in the order they are needed. Counts are
current hand-rolled duplicates from [`02-audit.md`](02-audit.md).

| primitive | why | replaces |
|---|---|---|
| `Surface` / `Panel` | the tier as a component | 46 hand-rolled card divs |
| `NavRow` | admin dashboard link rows | ~6 copies of one `className` |
| `PageHeader` | title + description + action | repeated in every page |
| `Skeleton` | `.skeleton` exists, unused | — |
| `EmptyState` | currently ad-hoc per page | — |
| `ErrorState` | — | — |
| `Table` | admin queues | — |
| `Tabs`, `Modal`, `Dropdown` | on Base UI, already a dependency | — |

## Rules for using it

- **Check the primitive exists before writing a `className`.** This is the gate
  that stops a 47th hand-rolled card.
- Arbitrary values (`text-[...]`, `p-[...]`) need a comment explaining why the
  scale did not fit. Usually it did.
- Never use a colour ramp step directly for a surface. Use the surface token.
- Amber is money. Nothing else.
- Any multi-column grid needs a responsive prefix, or a reason it does not.
- Minimum 44px tap targets on coarse pointers — use `.tap` for inline links so
  the hit area grows without disturbing layout.

## Breakpoints

Tailwind defaults, used with intent rather than sprinkled:

| | width | what changes |
|---|---|---|
| base | 360px | the real floor. Low-end Android. |
| `sm` | 640px | single → two columns; sticky bars unstick |
| `md` | 768px | landing nav appears |
| `lg` | 1024px | sidebar/split layouts become possible |
| `xl` | 1280px | wide multi-column layouts (e.g. the 5-step timeline) |

Test at 360 before 390. If it works at 360 it works everywhere.
