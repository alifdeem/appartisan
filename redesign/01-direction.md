# Paper & Depth

The visual direction for the whole application.

## The short version

Warm paper ground. Opaque surfaces stacked in four tiers. Depth from shadow,
spacing and type hierarchy — never from translucency. Blur exists, but only
where content genuinely moves underneath it. Boldness spent in exactly two
places.

## Why not glass

"Glass & layered" was the starting brief, and half of it is right. Layering is
precisely what this app lacks: everything is one flat card on one flat ground at
one container width. But the *glass* half was rejected, for four reasons.

**Glass is a dark-mode aesthetic.** It reads on Linear, Arc and Vercel because
those are dark, saturated surfaces with something worth blurring behind them.
This theme is warm paper (`#FBF7F1`) in light mode only — a deliberate decision
recorded in `globals.css`, because a half-finished dark theme looks broken in a
client demo. Blurring `#FBF7F1` over `#FEFCFA` produces almost no visible
difference. You pay the full cost for an invisible effect.

**The audience is wrong for it.** Artisans use this outdoors, one-handed, on
low-end Android — a constraint the codebase already designs around (Inter was
chosen over a more characterful face for exactly this reason). `backdrop-filter`
is the most expensive compositing operation on entry-level Mali and Adreno GPUs,
and it forces repaints on scroll. The one screen where frames matter most is the
120-second offer countdown. Translucency also lowers effective contrast, which
is the last thing a screen read in Accra sunlight needs.

**It contradicts the product.** The promise is verifiability: ID checked, price
agreed before anyone travels, money held until sign-off. Translucency literally
means *you cannot quite see what is behind this*. Documents that look like
documents sell trust. Frosted panels do not.

**It does not print.** The invoice is a real artifact a client forwards to
whoever pays their bills, and `globals.css` already carries a print stylesheet
for it.

## The four surface tiers

Defined in `globals.css` under `@theme`. Each step is lighter than the one
below, so the implied light always comes from above and a raised thing never has
to be outlined to read as raised.

```
surface-sunken    oklch(0.958 0.008 78)   wells, table heads, inset summaries
surface-ground    oklch(0.977 0.007 78)   the page              (= ink-25)
surface-raised    oklch(0.993 0.004 78)   cards, panels         (= ink-0)
surface-overlay   oklch(0.999 0.002 78)   modals, popovers, menus
```

`sunken` is the tier that was missing. Anything that should read as *recessed* —
a well, a table header, a summary pulled out of the thing beside it — was
previously faked with a border. It now has a tone.

Elevation on top of the tier comes from the existing warm-tinted shadow ramp
(`shadow-xs` … `shadow-xl`). The shadows are tinted warm rather than black so
they sit on the warm neutrals without turning them grey — that was already
right and does not change.

## Where blur is still allowed

Four cases, all of them functional, all of them already in the codebase:

1. Sticky headers, where page content scrolls underneath.
2. Sticky action bars at the bottom of a long form.
3. Modal and lightbox scrims.
4. Labels and controls sitting directly on a photograph or a map.

Anywhere else, use a surface tier. Blur is not part of the surface language and
must never be the thing that makes a panel read as a panel.

## Where the boldness goes

Per `DESIGN.md`: two signature objects, which are the actual React components
the app renders rather than mockups of them.

- **The Verified Artisan Card** — photo, name, trade, distance, the badge triad
  (Ghana Card / phone / paid through ArtisanGH), a decimal rating and a hard
  count.
- **The Quote Docket** — an itemised quote set in mono with tabular figures,
  like a paper docket.

Nothing else on any screen competes with these two. Everything else is quiet,
consistent, and gets out of the way.

## Rules

- Every visual choice has a job. If it cannot be named, remove it.
- Amber means money. Only money. If it appears anywhere that is not a cedi
  amount, the cedi amounts stop meaning anything.
- Anything that is a quantity or an identifier — price, ETA, rating, job count,
  reference, OTP — is mono with tabular figures.
- Depth is a tier plus a shadow, not an effect.
- Motion is feedback for a state change, never decoration.
- No pure white and no pure black anywhere.
