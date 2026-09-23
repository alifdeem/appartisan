# Browse — the remaining 20 trade photographs

For **Google Flow / Nano Banana Pro**. Companion to `IMAGE-PROMPTS-HOME.md`,
which covers the six you have already generated.

---

## ⚠️ Read this first — two files came back as JPEGs

`auth-skyline.png` and `auth-artisan-back.png` are **JPEGs that have been renamed
`.png`**. JPEG cannot store transparency at all, so both render as opaque
rectangles — that is the white background on the signup screen.

The app now catches this: the dev server prints

```
[images] public/img/auth-skyline.png is named .png but is a JPEG.
It will render as an opaque rectangle — JPEG cannot store transparency.
```

**When you regenerate them, the prompt must end with the transparency line and
you must export as PNG, not JPEG.** `auth-artisan-portrait.png` came back
correct — it is a real RGBA PNG, 47% transparent — so that one is the proof the
workflow can do it.

Check any file in one command:

```bash
file public/img/*.png
```

Every line must say `PNG image data … RGBA`. A line saying `JPEG image data` is
the bug.

---

## The other 20 trades

| | |
|---|---|
| **Files** | `public/img/category/<slug>.jpg` — slugs below |
| **Type** | Full-background **JPEG**. No transparency needed or wanted here. |
| **Rendered** | ~200 × 266 pt, `object-cover`, **3:4 portrait**, dark gradient over the lower third |
| **Aspect** | **3:4 portrait** (taller than wide) |
| **Resolution** | 1200 × 1600 minimum |

**Portrait, not landscape.** The browse grid is two portrait cards per row —
that is what shows a person actually doing the work at a readable size. The six
you already made are 4:3 landscape for the home row; they still work, but if you
ever regenerate them, make them 3:4 too.

**The name sits over the bottom of the image in white.** Keep the bottom third
uncluttered — no faces, no hands, no tools down there.

**Generate them in one session.** Twenty photographs in twenty different
lighting styles is worse than none, because the grid is read as a grid.

### Shared style block — append to every one of the twenty

```
Style: ultra-realistic commercial photography, soft natural daylight from the
left, shallow depth of field with the subject sharp, warm natural Ghanaian skin
tones, slightly desaturated with a cool blue cast to the shadows.

The artisan wears deep navy work clothing — navy only, never red, green, orange
or yellow.

Composition: vertical portrait, subject in the upper two-thirds, uncluttered
space across the bottom third of the frame, nothing important near the bottom
edge.

Absolutely no text, no letters, no numbers, no logos, no brand names on clothing
or tools, no watermarks, no user interface elements, no borders, no frames.

Vertical 3:4 portrait, 4K.
```

---

### `masonry-tiling.jpg`
```
A Ghanaian tiler in navy overalls kneeling to lay a large floor tile, spirit
level in hand, freshly combed adhesive visible beside him. Half-tiled modern
Ghanaian bathroom floor.
```

### `welding-metalwork.jpg`
```
A Ghanaian metalworker in navy overalls and a welding mask pushed up on his
forehead, inspecting a newly fabricated steel security gate in a workshop yard.
Bright overcast daylight.
```

### `appliance-repair.jpg`
```
A Ghanaian appliance technician in a navy work shirt crouched beside a pulled-out
front-loading washing machine, testing the back panel with a multimeter. Modern
Ghanaian kitchen.
```

### `generator-repair.jpg`
```
A Ghanaian technician in navy overalls servicing a standby generator in a
compound, checking the oil with a rag in one hand. Bright daylight, concrete
compound wall behind.
```

### `roofing.jpg`
```
A Ghanaian roofer in navy overalls on a low pitched roof, fixing an aluminium
roofing sheet into place. Clear sky, other rooftops soft in the distance.
```

### `aluminium-glass.jpg`
```
A Ghanaian glazier in navy overalls fitting a large pane into a sliding aluminium
window frame, gloved hands on the glass. Bright modern Ghanaian interior.
```

### `cctv-security.jpg`
```
A Ghanaian security technician in a navy work shirt on a short ladder mounting a
CCTV camera to the outside wall of a house, adjusting its angle. Warm afternoon
light on a cream wall.
```

### `pest-control.jpg`
```
A Ghanaian pest-control technician in navy coveralls and a face mask, spraying
along the skirting board of a modern Ghanaian kitchen with a pressure sprayer.
```

### `landscaping.jpg`
```
A Ghanaian gardener in a navy work shirt trimming a hedge with shears in a
walled garden, cut leaves on the grass. Bright green foliage, morning light.
```

### `borehole-water.jpg`
```
A Ghanaian technician in navy overalls fitting pipework to a water pump beside a
black polytank on a raised stand. Compound yard, clear sky.
```

### `pop-ceiling.jpg`
```
A Ghanaian ceiling installer in navy overalls on a step platform, fixing a POP
ceiling board overhead, arms raised. Room under finishing, bare walls.
```

### `upholstery.jpg`
```
A Ghanaian upholsterer in a navy work shirt stretching new fabric over a sofa
cushion frame, staple gun in hand. Workshop bench, natural side light.
```

### `curtains-blinds.jpg`
```
A Ghanaian curtain fitter in navy work clothes on a step stool hanging a curtain
rail above a tall window, fabric draped over one arm. Bright modern Ghanaian
living room.
```

### `locksmith.jpg`
```
A Ghanaian locksmith in a navy work shirt fitting a mortice lock into a wooden
front door, chisel and lock body in hand. Doorway with daylight behind.
```

### `satellite-tv.jpg`
```
A Ghanaian installer in navy overalls aligning a satellite dish on an exterior
wall bracket, one hand on the LNB arm. Rooftop, clear sky.
```

### `solar.jpg`
```
A Ghanaian solar technician in navy overalls on a flat roof, positioning a solar
panel onto its mounting rail. Strong daylight, blue sky.
```

### `auto-mechanic.jpg`
```
A Ghanaian mobile mechanic in navy overalls leaning over the open engine bay of a
car parked in a residential compound, spanner in hand. Daylight, no garage.
```

### `interior-fitout.jpg`
```
A Ghanaian fit-out carpenter in a navy work shirt fixing a floating shelf to a
partition wall, cordless drill raised. Room mid-renovation, clean plastered
walls.
```

### `tailoring.jpg`
```
A Ghanaian tailor in a navy work shirt guiding fabric through a sewing machine at
a home workroom table, measuring tape round the neck. Warm window light.
```

### `hair-beauty.jpg`
```
A Ghanaian hairstylist in a navy tunic braiding a seated client's hair in a
bright Ghanaian living room, hands mid-braid. Natural window light.
```

---

## Re-export these two as real PNGs

Same prompts as in `IMAGE-PROMPTS.md`, with the transparency requirement made
unmissable. **Export format: PNG. Not JPEG.**

### `auth-skyline.png`
```
A minimal Accra city skyline, tinted in deep blue monochrome, low and wide —
towers, mid-rise blocks and a water line along the bottom. Flat, graphic,
slightly hazy, like a distant backdrop.

Isolated on a fully transparent background: the sky must be transparent, not
white, not light blue. Only the buildings and the water carry pixels. Clean alpha
edge along the rooflines. No ground plane, no shadow, no frame.

Absolutely no text, no letters, no logos, no watermarks, no user interface.

Wide 16:9 landscape, 4K, PNG with alpha channel.
```

### `auth-artisan-back.png`
```
A Ghanaian artisan photographed from behind, standing, seen from the waist up,
wearing a deep navy work shirt with bib overall straps and a navy cap, a tool
handle visible over one shoulder. Calm, upright, looking ahead at the horizon.

Isolated on a fully transparent background, clean alpha cutout around the cap,
shoulders and tool. No drop shadow, no ground plane, no background scenery of any
kind — the background must be transparent, not white.

Framing: figure centred, head and upper body only, cropped at the waist.

Absolutely no text, no letters, no logos, no watermarks, no user interface.

Vertical 2:3 portrait, 4K, PNG with alpha channel.
```

---

## Checklist

- [ ] `file public/img/*.png` says **RGBA** on every line
- [ ] The 20 trade photographs are **JPEG**, 3:4 portrait
- [ ] Navy work clothing in all twenty
- [ ] Bottom third of every trade photograph is clear — the name sits there
- [ ] All twenty generated in one session so the lighting matches
- [ ] Filenames exactly as listed, inside `public/img/category/`
