# references/

Inspiration material. Nothing here gets copied — the point is to extract
*principles* and translate them into something original for this product.

## How to add one

```
references/
  <product-name>/
    01-<screen>.png
    02-<screen>.png
    notes.md
```

## What to capture

**Flows, not hero shots.** A landing page tells us very little. A five-screenshot
sequence of someone completing a task tells us almost everything about
hierarchy, density and state design.

Worth capturing when you see them:

- empty states, loading states, error states — the rarest and most valuable
- a data-dense table or queue at desktop width
- the same screen on mobile
- navigation: how a product with many sections tells you where you are
- anything involving money, invoices or receipts

## Most useful categories for this product

| category | why | examples |
|---|---|---|
| Data-dense admin tools | the admin queues have no precedent in the app yet | Linear, Stripe Dashboard, Vercel |
| Money / fintech surfaces | the docket, invoices, payouts | Kuda, Wise, Mercury, Hubtel |
| Mobile-first marketplaces with live job state | the offer countdown, tracking | Uber, Bolt, Airtasker |
| Anything with excellent empty and loading states | our single biggest gap | — |

## `notes.md`

One short file per product. Three headings:

```markdown
## What works
## What to avoid
## What to steal (and how it would differ here)
```

The third is the one that matters. "Steal" means the principle — how they use
density, where they put the primary action, how they handle a long list on a
phone — not the pixels.

## Constraint

This product already has an original token system, three chosen typefaces, and
an argued colour palette. References inform **composition, density,
navigation, interaction and state design**. They do not get to change the
colours or the type.
