# Home screen image assets

Generation prompts for **Google Flow / Nano Banana Pro**. Companion to
`IMAGE-PROMPTS.md`, which covers the auth screens.

Same rules as before: every file here is a **plate** — no text, no UI, no
buttons, no interface chrome. The interface is code.

**Seven files.** One hero, six category photographs. Everything else the brief
listed as an image — the blue gradient shapes, the abstract background, the
promo illustration — is either built in code or not needed; the reasons are at
the bottom.

---

## How to install

1. Save with **exactly** the filename given.
2. Restart or rebuild. Nothing else.

Until a file exists, that slot renders its coded fallback: the hero shows the
gradient alone, a category card shows a tinted panel with the trade's icon at
size. **The home screen is complete and shippable today without any of these** —
they make it richer, they are not load-bearing.

---

## Asset 01 — Hero Ghanaian Artisan ⭐

| | |
|---|---|
| **File** | `public/img/home-hero-artisan.png` |
| **Type** | Transparent PNG foreground |
| **Placement** | Top-right of the hero band, behind the headline, above the coded gradient |
| **Rendered** | 160 × 224 pt, masked to an organic silhouette and faded out at the bottom |
| **Aspect** | 5:7 portrait |
| **Resolution** | 1500 × 2100 minimum |

Masked with a radial gradient and faded below the chest — **nothing below the
chest will be seen**. The headline sits to its left, so keep the subject in the
right two-thirds of the frame.

```
Ultra-realistic editorial portrait photograph of a Ghanaian artisan, a man in
his thirties with a warm natural smile, wearing a deep navy work shirt with the
sleeves rolled, navy bib overall straps, holding a cordless drill upright in one
hand at shoulder height. Relaxed, approachable, genuinely pleased — a craftsman
at the start of a good day, not a model.

Soft diffused daylight from the upper left, gentle fill, subtle rim light
separating his shoulder from the background. Natural warm skin tones, realistic
skin texture, sharp focus on the eyes.

Isolated subject on a fully transparent background, clean alpha cutout around
the hair, shoulders and drill, no drop shadow, no ground plane.

Framing: head and upper chest only, subject in the right two-thirds of the
frame, clear empty space at the left edge.

Absolutely no text, no letters, no numbers, no logos, no watermarks, no user
interface elements, no phone mockups, no borders.

Vertical 5:7 portrait, 4K, photorealistic, commercial photography.
```

---

## Assets 02–07 — The six featured trades ⭐

These fill the **"Popular right now"** row. Card art only — the trade name and
its description are coded text below the photograph.

| | |
|---|---|
| **Files** | `public/img/category/<slug>.jpg` — slugs below |
| **Type** | Full-background JPEG, no transparency needed |
| **Rendered** | 168 × 126 pt, `object-cover`, 4:3, with a navy scrim over the lower half |
| **Aspect** | 4:3 landscape |
| **Resolution** | 1600 × 1200 minimum |

The scrim darkens the bottom half — **keep the subject in the upper two-thirds**
and do not put detail along the bottom edge.

**These six must look like one set.** Same lighting, same navy uniform, same
treatment. Six photographs in six different styles is worse than none, because
the row is read as a row. Generate them in one session.

### Shared style block

Append this to every one of the six prompts:

```
Style: ultra-realistic commercial photography, soft natural daylight from a
window to the left, shallow depth of field with the subject sharp, warm natural
Ghanaian skin tones, clean modern Ghanaian home interior in the background,
slightly desaturated with a cool blue cast to the shadows.

The artisan wears a deep navy work shirt or navy overalls — navy only, never
red, green, orange or yellow.

Composition: subject occupying the upper two-thirds of the frame, uncluttered
space along the bottom edge, no objects at the very bottom of the frame.

Absolutely no text, no letters, no numbers, no logos, no brand names on clothing
or tools, no watermarks, no user interface elements, no borders.

Horizontal 4:3 landscape, 4K.
```

### 02 — Electrical → `public/img/category/electrical.jpg`

```
A Ghanaian electrician in navy overalls working at an open wall-mounted
consumer unit, testing a circuit with a multimeter, concentrating on the work.
Clean modern Ghanaian living room behind him.
```

### 03 — Plumbing → `public/img/category/plumbing.jpg`

```
A Ghanaian plumber in navy overalls kneeling beside a modern bathroom sink,
tightening a chrome fitting under the basin with an adjustable wrench. Clean
tiled Ghanaian bathroom, natural light.
```

### 04 — Cleaning → `public/img/category/cleaning.jpg`

```
A Ghanaian cleaner in a navy uniform polish-wiping a large window in a bright
modern Ghanaian living room, microfibre cloth in hand, caddy of supplies on the
floor beside her. Sunlight coming through the glass.
```

### 05 — AC & Refrigeration → `public/img/category/ac-refrigeration.jpg`

```
A Ghanaian air-conditioning technician in navy overalls on a short stepladder
servicing a wall-mounted split-unit air conditioner, its front cover open,
cleaning the filter. Modern Ghanaian bedroom interior.
```

### 06 — Carpentry → `public/img/category/carpentry.jpg`

```
A Ghanaian carpenter in a navy work shirt fitting a hinge to a new wooden
wardrobe door, cordless screwdriver in hand, wood shavings on the floor. Modern
Ghanaian bedroom under finishing.
```

### 07 — Painting → `public/img/category/painting.jpg`

```
A Ghanaian painter in navy overalls rolling pale paint onto an interior wall
with an extension roller, crisp cut-in edge already visible along the ceiling
line. Bright empty Ghanaian room, dust sheets on the floor.
```

---

## Adding a seventh trade later

1. Generate it with the shared style block.
2. Save as `public/img/category/<slug>.jpg` — the slug is the one in
   `supabase/migrations/0004_reference_data.sql`.
3. Add that slug to `FEATURED_SLUGS` in `src/lib/images.ts`.

That list is also the **order** the row appears in, so it is the editorial
decision, not `sort_order`.

---

## What the brief asked for that is not a file

### Asset 08 — Discount illustration ❌ not needed

The promo cards are gone. PLAN.md §14 puts promo codes out of v1, and that slot
now carries the client's real jobs — which is where you asked for them. There is
nothing for the illustration to sit in.

### Asset 09 — Abstract blue background ✅ already coded

`src/components/mobile/home-hero.tsx`. Two blurred blue shapes plus a gradient,
about 400 bytes of SVG. As a PNG it would be roughly a megabyte, would blur on a
3× screen, would need a separate file per screen height, and would have to be
re-exported the first time the navy moves. As code it recolours itself from the
same tokens the buttons use.

### Asset 10 — Decorative blue gradient shapes ✅ already coded

Same component, same reasoning. Coded gradients were what the brief itself asked
for — *"use coded gradients instead of image gradients whenever possible"*.

---

## Quality checklist

- [ ] **No text anywhere**, including on clothing, tools, packaging or walls
- [ ] Navy uniform in every one of the six — a stray red shirt breaks the row
- [ ] Subject in the upper two-thirds; nothing important at the bottom edge
- [ ] All six generated in one session so the lighting matches
- [ ] Hero is a transparent PNG; the six trades are JPEGs
- [ ] Filenames exactly as listed, category photos inside `public/img/category/`
