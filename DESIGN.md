# ArtisanGH — design direction

Written after auditing what the category actually ships (Sept 2026, from their live CSS)
and what the current build looks like. Backend is untouched by everything below: no
migrations, no RLS, no adapters, no `src/proxy.ts`.

---

## 1. The opening

**Urban Company** is the closest analogue by far — home services, similar market context,
huge scale. Its neutrals are literally Google's Material grey ramp and its trust argument is
*text*: "Quality Assured", "Trained professionals". It never **shows** verification, it only
**asserts** it. **TaskRabbit** has the strongest system in the category (green-tinted
neutrals, Inter, hard counts, TaskProtect badge) and still ships a file called
`AdobeStock_197426992.jpeg` on its homepage. **Airtasker** is the only one doing the right
thing: three discrete badges on every profile card — Digital ID, Payment Method, Mobile.

So: **nobody in this category has turned verification into a visual system.** That is the
entire product promise here, and it is sitting unclaimed.

The second gap is price. Every one of them hides the number until late. ArtisanGH agrees the
price before work starts. That is a *thing you can draw*.

---

## 2. The one bold move

Per "spend your boldness in one place": two signature objects, which are **literally the
React components the app uses**, not mockups of them.

### The Verified Artisan Card

Photo, name, trade, distance, "online now". Then the Airtasker badge triad, localised:

```
  Ghana Card verified   ·   Phone verified   ·   Paid through ArtisanGH
```

Plus a decimal rating (`4.9`, not four stars) and a hard count (`128 jobs completed`).
Decimals and counts read as *measured*; stars read as *decorative*.

### The Quote Docket

An itemised quote set in mono with tabular figures, like a real paper docket:

```
  LABOUR      Ceiling fan replacement, 2 pts    GHS   180.00
  MATERIALS   Capacitor, 3-core cable 4m        GHS    64.00
  TRANSPORT   Osu → Labone, band 1              GHS    25.00
  ─────────────────────────────────────────────────────────
  PLATFORM    12%                               GHS    32.28
  TOTAL                                         GHS   301.28   ← amber, only here
  DEPOSIT DUE NOW                               GHS   150.64
```

These two, overlapped, **are the hero image.** Stripe does exactly this with its payment
form. It is honest (real components), unclaimed in this category, and it doubles as proof
the thing is actually built. Photography surrounds it but does not carry the argument.

---

## 3. Colour

The existing system is good and stays: deep green at hue 155 (Urban Company is purple,
Thumbtack blue, Hubtel teal, TaskRabbit's "green" is teal-leaning `#0D7A5F` — a true deep
green is open), amber reserved strictly for money, warm neutrals at hue 75. Four changes.

| | Now | Becomes | Why |
|---|---|---|---|
| `--color-ink-0` | `oklch(1 0 0)` — pure white | `oklch(0.993 0.004 78)` ≈ `#FEFCFA` | Every sophisticated African product studied — Kuda, Hubtel, Moniepoint — grounds on warm paper, never `#FFF`. Highest ratio of "stops looking like a template" to effort in the whole plan. |
| page ground | `ink-50` | `oklch(0.977 0.007 78)` ≈ `#FBF7F1` | Kuda's `#FCF7F2` territory. Makes photographs of real rooms sit *in* the page instead of on it. |
| — | — | **new** `--color-ink-975: oklch(0.178 0.012 75)` | One full-bleed warm-charcoal band (the artisan-recruitment section) so the scroll has rhythm instead of four screens of unbroken off-white. |
| amber | used for money **and** decoration | money only, enforced | Amber is the loudest thing on the page. If it appears anywhere that isn't a cedi amount, the cedi amounts stop meaning anything. |

Named palette:

```
  Paper      #FBF7F1   page ground
  Card       #FEFCFA   raised surfaces
  Green 700  #2A5D3F   brand, primary action  (already the themeColor)
  Green 950  #10241A   deep green for green-on-green depth
  Charcoal   #1C1916   the one dark band
  Amber 600  #C97B1E   money, and only money
```

---

## 4. Type

**Drop Geist.** It is the Vercel default and in 2026 it is *the* tell that a page was
generated rather than designed. Three faces, all OFL, all free:

- **Bricolage Grotesque** — display. Headlines, section titles, the big numbers. Variable,
  with `wdth` and `opsz` axes, so headlines can set tight and dense without collapsing into
  something that looks like a system font. Odd enough to read as art-directed, grotesque
  enough to read as competent.
- **Inter** — text and UI. Body, labels, forms. Boring on purpose: it is the best-tested
  face at 13–15px on the low-end Android screens most of Accra is actually on. The display
  face carries the personality; this one carries the legibility.
- **IBM Plex Mono** — the docket. Quote line items, reference numbers, the OTP, amounts in
  receipts. This is what makes a quote look like a document instead of a div.

`font-variant-numeric: tabular-nums` on every price, ETA and countdown — the `.tabular`
utility already exists in `globals.css` and is currently underused.

*Rejected:* Fraunces and Instrument Serif. A serif display reads boutique. The person
buying this has a broken ceiling fan.

---

## 5. Layout

The current page has one rhythm repeated eight times: `max-w-6xl`, centred heading, grid of
identical cards. That single fact is most of why it reads as a template. The rebuild
alternates.

```
┌──────────────────────────────────────────────────────────────┐
│  header — logo · how it works · for artisans · [Sign in]     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   Know who's coming.          ┌───────────────────────┐      │
│   Know what it costs.         │  [photo] Kwame Mensah │      │
│                               │  Electrician · 2.1 km │      │
│   Verified artisans across    │  ✓ Ghana Card  ✓ Phone│      │
│   Accra and Tema. Price       │  4.9 · 128 jobs       │      │
│   agreed before work starts.  └───────┬───────────────┘      │
│                                  ┌────┴──────────────────┐   │
│   [ Book an artisan ]            │ LABOUR      180.00    │   │
│   [ Work with us ]               │ MATERIALS    64.00    │   │
│                                  │ TRANSPORT    25.00    │   │
│                                  │ TOTAL       301.28    │   │
│                                  └───────────────────────┘   │
├──────────────────────────────────────────────────────────────┤
│  full-bleed photograph — hands, tool, fixture, mid-task      │
│  one line of text over it                                    │
├──────────────────────────────────────────────────────────────┤
│  26 trades — dense two-column text list, not a card grid     │
│  Electrical   Plumbing   AC & Refrigeration   Carpentry ...  │
├──────────────────────────────────────────────────────────────┤
│  How it works — 4 steps as a horizontal rule-and-number      │
│  timeline, NOT four cards                                    │
├──────────────────────────────────────────────────────────────┤
│  ████ CHARCOAL BAND ████                                     │
│  For artisans: what you earn, when you're paid.              │
│  Photo left, payout figures right, in mono.                  │
├──────────────────────────────────────────────────────────────┤
│  footer                                                      │
└──────────────────────────────────────────────────────────────┘
```

Rules that break the template rhythm:
- No section may use the same container width as the one above it.
- At most **one** card grid on the whole page.
- The 26 categories become a typographic list, not 26 tiles — the list itself is the proof
  of breadth, and it is faster to read.
- "How it works" is a numbered timeline on a rule, not four cards with icons.

Auth screens get the same treatment: a two-column split at `sm:` and up — form on the left,
a photograph and the verification promise on the right — instead of a narrow form marooned
in the middle of an empty viewport.

---

## 6. Photography

Art direction, reverse-engineered from TaskRabbit's actual hero assets, which are the best
in the category despite being stock:

- Hands, tool and fixture in frame, **mid-task**. The work is the subject.
- Eyes on the work, **never on the camera**.
- Soft directional daylight — through louvre windows. No flash, no fill.
- Real Ghanaian rooms: tile floors, burglar bars, a ceiling fan, visible depth through a
  doorway. Not a set.
- Walls desaturated warm-neutral so a single saturated garment carries all the colour.
- Subject off-centre, generous headroom.

**Banned:** hi-vis vests, hard hats indoors, folded arms, thumbs-up, toothy camera smiles,
white cyclorama backgrounds, orange sunset colour grades, anyone holding a clipboard, and
every "Africa" motif — kente borders, mudcloth, acacia silhouettes. None of the products
worth copying (Kuda, Hubtel, Moniepoint, Flutterwave) use a single one.

Shot list: 3 artisan portraits (matching the seeded accounts), 4 work-in-progress scenes
(electrical, plumbing, AC, carpentry), 1 wide environment for the full-bleed band.

---

## 7. Scope

**In:** landing page rebuilt; auth screens; design tokens and primitives; app shell and
header; the two signature components (artisan card, quote docket).

**Out:** deep redesign of the client / provider / admin dashboards. Phase 1 replaces their
contents anyway; they inherit the new tokens and shell for free. One exception — the
"What's coming to this screen" roadmap panels move behind `ENABLE_DEV_TOOLS`. A product
that tells you what isn't built yet does not look like a finished product.

**Untouched:** schema, RLS, migrations, integration adapters, `src/proxy.ts`, auth logic.
