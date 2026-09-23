# Auth screen image assets

Generation prompts for **Google Flow / Nano Banana Pro**, one per asset.

Everything here is a **plate** — a background or foreground layer with no text,
no UI, no buttons and no interface chrome of any kind. The interface is code.
That separation is what keeps the screens responsive, keeps them working at
360px and at 430px, and lets these files be re-shot later without anyone
touching a component.

---

## How to install a generated file

1. Save it under `public/img/` with **exactly** the filename given below.
2. Restart or rebuild. Nothing else. `src/lib/images.ts` checks the filesystem
   at build time and the slot lights up on its own.

Until a file exists, its layer renders as nothing and the screen falls back to
its coded backdrop — which is already a finished composition. **The screens are
complete and shippable today without any of these.** They get richer with them.

Only three of the five assets below are actually needed as files. Assets 2 and 3
are already implemented in code, and should stay that way — the reasons are
under each one. Their prompts are included because you asked for all five, and
because you may want raster versions for a pitch deck or an app-store
screenshot, where none of the reasons apply.

---

## Asset 1 — Hero Artisan Portrait ⭐ needed

| | |
|---|---|
| **File** | `public/img/auth-artisan-portrait.png` |
| **Type** | Transparent PNG foreground |
| **Screen** | Login (`/login`) |
| **Placement** | Top-right, bleeding off the top and right edges, behind the headline and above the coded blue shapes |
| **Rendered size** | 272 × 416 pt, `object-cover` at 60% 18% |
| **Aspect** | 2:3 portrait |
| **Resolution** | 2048 × 3072 minimum (rendered at 3× on a phone) |

The component masks this with a radial gradient and fades the lower third out,
so **the bottom of the frame will not be seen** — do not put anything important
below the chest. The right side bleeds off screen; keep the face in the left
two-thirds of the frame.

```
Ultra-realistic editorial portrait photograph of a confident Ghanaian artisan,
a man in his early thirties with a short well-kept beard, wearing a clean deep
navy work shirt and navy bib overalls with a visible strap buckle, a navy
baseball cap, arms folded across his chest, one hand resting on a chrome
adjustable wrench. He is looking upward and slightly off-camera to the left,
with a calm, self-assured half-smile — proud and competent, not posed or
grinning.

Soft diffused studio key light from the upper left, gentle fill on the shadow
side, subtle rim light separating his shoulder from the background. Natural
warm skin tones, realistic skin texture, sharp focus on the eyes, shallow depth
of field.

Isolated subject on a fully transparent background, clean alpha cutout around
the cap, shoulders and wrench, no drop shadow, no ground plane, no reflections.

Framing: head and upper body only, cropped mid-torso, subject occupying the
left two-thirds of the frame with clear empty space at the right edge.

Absolutely no text, no letters, no numbers, no logos, no watermarks, no user
interface elements, no phone mockups, no borders or frames.

Vertical 2:3 portrait, 4K, photorealistic, commercial photography.
```

---

## Asset 2 — Blue Organic Background ✅ already coded

| | |
|---|---|
| **File** | none — implemented in `src/components/mobile/auth-backdrop.tsx` |
| **Type** | Decorative shape layer, behind everything |

**Recommendation: keep this as code.** It is three flat blurred blue shapes.
As SVG it is about 1KB, sharp at every pixel density, recolours itself when the
navy moves because it reads the same tokens the buttons do, and adapts to any
viewport height. As a PNG it would be roughly a megabyte on a metered
connection, would need separate files for the login and signup compositions,
would blur on a 3× screen, and would have to be re-exported the first time the
palette shifts.

Prompt, if a raster version is ever wanted:

```
Abstract soft organic background composition. Two or three large overlapping
flowing blob shapes with smooth rounded irregular edges, layered at different
opacities to create depth. Colour palette strictly light blue: #EAF3FF, #BDD8F7
and #8FBDF0, on a very pale blue-white #F8FBFF ground. Heavy gaussian blur on
all shape edges so nothing has a hard outline. Shapes weighted to the upper
right, bleeding off the top and right edges of the frame.

Completely flat — no gradient mesh noise, no grain, no texture, no 3D, no
lighting, no shadows.

Absolutely no text, no letters, no logos, no icons, no user interface elements.

Vertical 9:19.5 mobile aspect ratio, 4K, minimal, clean, corporate.
```

---

## Asset 3 — Soft White Fade Overlay ✅ already coded

| | |
|---|---|
| **File** | none — implemented as `WhiteFade` in `src/components/mobile/auth-backdrop.tsx` |
| **Type** | Gradient overlay |

**Recommendation: keep this as code.** It is a three-stop CSS gradient. A PNG of
a gradient is the one asset that is strictly worse as a file in every respect:
larger, bandable on 8-bit displays, fixed in height, and impossible to tune.
The coded version uses an extra midpoint stop specifically to correct the
visible banding a naive white-to-transparent fade produces.

Prompt, if a raster version is ever wanted:

```
A pure vertical gradient, solid opaque white #FFFFFF at the bottom fading
smoothly to fully transparent at the top, with a soft eased falloff rather than
a linear ramp. Transparent PNG with a clean alpha channel, no colour cast, no
banding, no dithering, no noise, no texture.

Absolutely no text, no shapes, no objects, no imagery of any kind.

Vertical, 4K.
```

---

## Asset 4 — Ghana City Skyline ⭐ needed

| | |
|---|---|
| **File** | `public/img/auth-skyline.png` |
| **Type** | Background plate, full width |
| **Screen** | Sign up (`/signup`, the choice screen) |
| **Placement** | Foot of the page, full-bleed, `object-cover object-bottom` at 90% opacity, with coded blue waves drawn over its lower half |
| **Rendered size** | 390 × 176 pt |
| **Aspect** | 16:7 wide |
| **Resolution** | 3000 × 1300 minimum |

Coded wave shapes cover the **bottom third** of this band, so the waterline and
anything below it will be hidden. Keep the towers in the upper two-thirds.

```
Minimal stylised city skyline of Accra, Ghana, seen across open water from a
distance. A row of modern mid-rise and high-rise towers with varied heights and
simple rectangular silhouettes, a few slender spires, sitting on a calm flat
waterfront with soft still reflections.

Rendered as a flat monochromatic blue illustration: deep blue #2F80ED for the
nearest buildings, mid blue #7FB0E8 for the middle distance, pale blue #C7DEF7
for the furthest, against a very pale blue-white #F8FBFF sky. Clean vector-like
flat shapes with no outlines, no windows drawn in detail, no people, no cars,
no birds, no clouds.

Composition: buildings occupying the upper two-thirds of the frame, calm water
across the bottom third, horizon roughly two-thirds down.

Absolutely no text, no letters, no signage, no logos, no watermarks, no user
interface elements.

Wide 16:7 landscape, 4K, minimal, flat illustration, corporate, serene.
```

---

## Asset 5 — Standing Artisan, from behind ⭐ needed

| | |
|---|---|
| **File** | `public/img/auth-artisan-back.png` |
| **Type** | Transparent PNG foreground |
| **Screen** | Sign up (`/signup`, the choice screen) |
| **Placement** | Bottom-right, standing in front of the skyline and above the coded blue waves |
| **Rendered size** | 128 × 160 pt, `object-contain object-bottom` |
| **Aspect** | 4:5 portrait |
| **Resolution** | 1600 × 2000 minimum |

`object-contain` means this is never cropped — the whole figure will be visible,
so the composition must be complete inside the frame with a little margin.

```
Ultra-realistic photograph of a Ghanaian artisan photographed from directly
behind, standing and facing away from the camera, looking out toward a distant
horizon. He wears a bright blue short-sleeved work shirt with navy bib overall
straps crossing his back, and a blue baseball cap. A wooden-handled tool is
tucked under one arm, partly visible at his side. Relaxed, still, contemplative
stance — someone pausing at the end of a day's work.

Soft natural daylight from the front so his back is gently shaded, subtle rim
light along his shoulders and cap.

Isolated subject on a fully transparent background, clean alpha cutout, no drop
shadow, no ground plane, no reflections.

Framing: full upper body from mid-thigh up, centred, with clear empty margin on
all four sides. Face is not visible at all.

Absolutely no text, no letters, no logos, no watermarks, no user interface
elements, no background scenery.

Vertical 4:5 portrait, 4K, photorealistic, commercial photography.
```

---

## Quality checklist before dropping a file in

- [ ] **No text anywhere in the image**, including on clothing, tools or signage
- [ ] Transparent PNG for assets 1 and 5 — check the alpha, not just the preview
- [ ] No baked-in drop shadow (the coded layers supply depth)
- [ ] Navy and blue clothing only — a red or green shirt fights the palette
- [ ] Ghanaian subject, and dressed as a tradesperson rather than a model
- [ ] Filename is exactly as listed, in `public/img/`
