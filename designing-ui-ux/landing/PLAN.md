# Landing page redesign

## Where it stands

`src/app/page.tsx`, 626 lines, is the last surface still on the pre-redesign
system: **57 legacy `ink-*` / `brand-*` / `surface-*` tokens against 2 new
ones**. Warm paper ground, green accent, a hero built from two floating product
cards (`ArtisanCard` + `QuoteDocket`). Every other screen in the product moved
to navy/azure months of work ago. Somebody arriving from an ad lands on a page
that looks like a different company than the app they then sign into.

So this is not a hero swap. The hero is the headline change; the palette
migration is the rest of it.

Sections today: Hero, WorkBand, Promises, HowItWorks, Trades, Pricing,
ForArtisans, Footer.

## The reference

`redesign/new-reference-shots/artimockss/@3-hero/6e7f432e....webp` - a billboard
mockup for an app called FixPro. What to take from it, and what to leave.

**Take: the split.** Logo lockup, headline, one line of subtext and the calls to
action stacked down the left; phones large on the right, overlapping, angled,
breaking out of the text column's rhythm. Exactly the shape planned below.

**Take: the ground.** The panel is a deep blue with a radial glow sitting
directly behind the phones, so the light screens read as lit objects rather
than as pictures pasted on. That gradient is very close to this project's
`LIVE_SURFACE` (`azure-600 -> azure-700`), which means the hero can be built
from tokens the app already owns instead of a one-off.

**Take: the containment.** The blue is a *panel with rounded corners* hanging
on a dark wall, not an edge-to-edge background. That solves a problem: a
full-bleed dark hero on a light page is a theme inversion, and this page
already spends its one permitted inversion on the artisan band. A rounded navy
panel inset from the page edges keeps the page light and puts a dark *object*
on it. Same look, no rule broken.

**Leave: the second phone showing its back.** The reference angles one handset
face-on and one rear-on, camera array forward. That is a hardware flex, and it
works for Apple because the hardware *is* the product. Here the hardware is
irrelevant and interchangeable - a stock camera bump would spend half the hero
advertising somebody else's industrial design. Both phones face front.

**Leave: the app store badges.** ArtisanGH is a web app. There is no App Store
listing, so a badge would be a claim that is not true, and the first person to
tap it learns the page lies.

**Leave: the room.** The ceiling rig, the floor reflection and the silhouetted
onlookers are the mockup, not the design. The design is the panel.

## The hero idea

Two phones, angled, on the right of a split hero. One shows the **client**
dashboard, one the **artisan** dashboard.

This is the right instinct and worth saying why, because it decides everything
downstream: a marketplace has to convince two different people of two different
things, and the usual landing page picks one and relegates the other to a link
in the nav. Two phones state the two-sidedness without spending a word of copy
on it. The client's screen says *your artisan is on the way*. The artisan's
says *you're online, here is your job, here is your money*. That is the entire
product thesis, legible in one glance.

It also means the hero object is **the product**, not an illustration of it.

## The decision: DOM-composed, not a flattened image, not video

Three ways to build it.

### Rejected: a pre-rendered image

Composite the two phones into one PNG and drop it in.

Fastest to produce and wrong on four counts. It is fixed at one resolution, so
it is soft on a retina display unless exported at 3x, which then costs 600KB+.
It cannot restack for a phone, so the mobile view is a crop of a picture of two
phones, which is absurd. The screenshots inside go stale the moment the app
changes, silently. And the UI inside becomes a flat raster: no text, nothing a
screen reader can reach, nothing indexable.

### Rejected: video

The strongest argument for video is showing real interaction. Every other
argument is against it, and one of them is decisive.

**This product's visitors are in Accra on mobile data.** A hero video is a
hero-sized download before anything renders, it needs a poster frame anyway (so
we build the static version regardless), autoplay is unreliable, and it has to
collapse under `prefers-reduced-motion`. Spending someone's data bundle to
animate a hero, for an app whose pitch is *we don't waste your money*, is the
wrong trade.

### Chosen: phones drawn in the DOM, screenshots as real images

Device frames in CSS, screenshots inside via `next/image` with `priority`.

- Sharp at every DPI, because the frame is vector-ish and the screenshot is
  served at the size actually needed.
- Genuinely responsive: two phones angled at `lg`, one phone upright below it,
  rather than a crop.
- Screenshots are swappable, and can be **regenerated from the live app** by
  `scripts/compare-shot.ts` at `deviceScaleFactor: 3`, so they never drift from
  what the product actually looks like.
- `next/image priority` on the front phone makes it a proper LCP element.
- Motion is `transform` and `opacity` only, so it stays on the compositor.

## Composition

Split hero, copy left, phones right. Centred heroes are banned above
`DESIGN_VARIANCE 4` and this sits at 7.

    ┌──────────────────────────────┬──────────────────┐
    │ eyebrow: serving Accra, Tema │      ╭──────╮    │
    │                              │   ╭──┤artisan   │
    │ HEADLINE, two lines max      │   │  ╰──────╯    │
    │                              │   │ client │     │
    │ subtext, ≤ 20 words          │   ╰────────╯     │
    │                              │                  │
    │ [Book an artisan] [Work…]    │                  │
    └──────────────────────────────┴──────────────────┘

**Angles.** Stronger than first drafted, after the reference: the FixPro phones
sit at roughly `-10deg` and `+8deg`, and at my original `-5/+4` the pair read as
slightly crooked rather than deliberately arranged. Front phone (client)
`rotate(-9deg)`, low and left. Back phone (artisan) `rotate(7deg)`, higher and
right, ~88% scale, partially behind the front one.

**Two front-facing screens is the risk to manage.** The reference gets its
variety free, because a phone back and a phone front are obviously different
objects. Two screenshots of two dashboards can read as one screen duplicated.
The separation has to be carried by depth instead: clearly different scale, a
real overlap where the front phone occludes the back, and the back phone pushed
further into the glow so it sits behind the light rather than in front of it.

Deliberately **2D rotation, not 3D `rotateY` with perspective.** A heavy
perspective tilt is the 2019 app-landing-page look, and worse, it distorts the
UI into illegibility. The screenshots *are* the argument here, so they stay
readable. Depth comes from overlap, scale and a tinted shadow, not from
foreshortening.

**Ground.** A `navy-900 -> azure-700` panel, `rounded-[2.5rem]`, inset from the
page edges, with a soft azure radial glow centred behind the phones so the two
light screens read as lit. The page around it stays on `canvas`.

**Device frame.** Rounded rect, ~`2.5rem` radius, 8px bezel in near-black, a
1px inner highlight so the edge catches light, and a soft shadow falling
down-right. No notch, no home indicator, no chrome pretending to be
iOS: the moment a frame imitates a specific handset it dates itself and invites
the question of why the other platform is missing.

## Motion

`MOTION_INTENSITY: 5`. Everything below is `transform`/`opacity`, all of it
collapses under `prefers-reduced-motion`.

1. **Entrance.** Both phones rise 24px and fade in, `ease-out`, 520ms, client
   first and artisan 90ms behind. Never from `scale(0)`.
2. **Scroll drift.** The two phones move at slightly different rates through
   the first viewport, about 14px of separation total. Enough that the hero
   feels like it has depth, small enough that nobody consciously notices.
3. **One product beat.** About 1.8s after load, the step rail inside the client
   phone advances one step and its label changes. Once, not a loop.

That third one is the whole reason to animate anything here. It is the only
moment that says *this is a live product, not a screenshot* - and it says it by
showing the product doing its actual job, which is the one animation on this
page that can be justified in a sentence.

## The rest of the page

Palette migration throughout, plus:

- **Promises** is three equal cards, which is the most templated shape there
  is. Re-cut as an asymmetric 2+1.
- **HowItWorks** currently numbers its steps. Numbered step labels are filler;
  the verbs are the labels.
- **Trades** is a flat list of 26. Group it, or show 8 with a real link out.
- **ForArtisans** is a full dark band, and it should stay dark - it is the one
  place on the page where the audience changes, and the tonal switch earns
  itself. It is the single permitted theme inversion.
- Eyebrow budget: 8 sections means **at most 3** eyebrows on the page, hero
  included.

## Build order

0. Extract the reference's palette and glow geometry at 1:1 rather than by eye.
1. Regenerate both screenshots from the live app at 3x.
2. `PhoneMock` component: frame, screen, shadow, responsive sizes.
3. Hero: split layout, new copy, two phones, entrance motion.
4. Scroll drift and the product beat, both reduced-motion gated.
5. Palette migration across the remaining seven sections.
6. Section re-cuts above.
7. Verify: build, a11y, Lighthouse on LCP/CLS, and both themes.
