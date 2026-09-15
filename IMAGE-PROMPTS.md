# Image prompts — ArtisanGH

Generate these elsewhere, then drop the files into `public/img/` using **exactly** the
filenames below. The code is already written against these paths and aspect ratios, so
correct names mean the images just appear with no further work.

If your generator lets you set aspect ratio directly, use the ratio column. If it only does
square, generate square and I'll crop.

| File | Ratio | Target px | Subject |
|---|---|---|---|
| `public/img/artisan-kwame.jpg` | 1:1 | 900×900 | Electrician portrait |
| `public/img/artisan-yaw.jpg` | 1:1 | 900×900 | Plumber portrait |
| `public/img/artisan-abena.jpg` | 1:1 | 900×900 | AC technician portrait |
| `public/img/work-electrical.jpg` | 4:3 | 1600×1200 | Ceiling fan / wiring, mid-task |
| `public/img/work-plumbing.jpg` | 4:3 | 1600×1200 | Under-sink repair, mid-task |
| `public/img/work-ac.jpg` | 4:3 | 1600×1200 | Split-unit servicing, mid-task |
| `public/img/work-carpentry.jpg` | 4:3 | 1600×1200 | Door / cabinet work, mid-task |
| `public/img/hero-wide.jpg` | 21:9 | 2400×1030 | Wide full-bleed environment |

---

## The house style — applies to every single one

Paste this **after** each individual prompt, every time. It is the thing that stops these
looking like stock.

> Shot on a 35mm lens, natural window light only, no flash and no fill light. Soft
> directional daylight through louvre windows. Muted warm colour grade, walls and
> background desaturated so a single saturated garment carries all the colour in the frame.
> Real lived-in Ghanaian home interior — glazed tile floor, painted plaster walls, burglar
> bars on the windows, a doorway showing depth into another room. Documentary photography,
> unposed, photorealistic, fine grain, shallow depth of field. Subject placed off-centre
> with generous headroom.
>
> Negative / must not appear: hi-vis safety vest, hard hat indoors, folded arms, thumbs-up,
> smiling at the camera, clipboard, white studio background or cyclorama, orange sunset
> colour grade, lens flare, HDR, oversaturation, kente cloth, mudcloth, acacia trees,
> tribal patterns, text, watermark, logo.

---

## 1. `artisan-kwame.jpg` — electrician portrait (1:1)

> Portrait of a Ghanaian man in his late thirties, an electrician, photographed in a
> domestic hallway. He is looking slightly off-camera at his own hands, not at the lens.
> Calm, focused, unsmiling but not stern. Short hair, close-trimmed beard. Wearing a plain
> deep-green work polo, sleeves slightly pushed up, a simple tool pouch on his belt. A
> screwdriver held loosely in one hand. Waist-up framing.

## 2. `artisan-yaw.jpg` — plumber portrait (1:1)

> Portrait of a Ghanaian man in his mid-forties, a plumber, standing in a small domestic
> bathroom doorway. Weathered, capable hands visible. Looking down and to the side at a pipe
> fitting he is holding, not at the camera. Plain charcoal work shirt, sleeves rolled to the
> elbow. Grey at the temples. Waist-up framing.

## 3. `artisan-abena.jpg` — AC technician portrait (1:1)

> Portrait of a Ghanaian woman in her early thirties, an air-conditioning technician,
> photographed in a living room below a wall-mounted split AC unit. Braided hair tied back.
> She is looking up at the unit, concentrating, not at the camera. Plain deep-green work
> polo, a multimeter in her hand. Confident and entirely unglamorous — this is a working
> photograph, not a fashion one. Waist-up framing.

## 4. `work-electrical.jpg` — ceiling fan replacement (4:3)

> Low angle shooting upward. A Ghanaian electrician on a step ladder, both hands working at
> the mounting bracket of a ceiling fan, wires visible between his fingers. His face is
> partly turned away — the hands and the fan are the subject. Ceiling and upper wall fill
> most of the frame. A doorway and a second room visible below and behind.

## 5. `work-plumbing.jpg` — under-sink repair (4:3)

> Close, slightly overhead. A Ghanaian plumber crouched beneath a kitchen sink, one hand
> bracing a trap fitting, the other turning an adjustable wrench. Cabinet doors open. A
> small pool of water on the tile. His head is down and in shadow; the hands, the wrench and
> the chrome pipe are the lit subject.

## 6. `work-ac.jpg` — split unit service (4:3)

> A Ghanaian AC technician reaching up into an opened wall-mounted split unit, removing the
> filter panel. Dust visible in the shaft of window light. Shot from the side at eye level
> so the arm, the open unit and the wall run diagonally through the frame. Living room
> behind, softly out of focus.

## 7. `work-carpentry.jpg` — door repair (4:3)

> A Ghanaian carpenter kneeling at the base of a wooden interior door, chiselling a hinge
> mortise. Wood shavings on the tile floor beside his knee. Hands and chisel sharply in
> focus in the lower third; the rest of the door and the hallway falling away behind.

## 8. `hero-wide.jpg` — wide environment (21:9)

> Very wide letterbox frame. Interior of a modest Ghanaian family home in the late morning.
> On the left third, a Ghanaian artisan works at a wall socket, turned away from the camera.
> The centre and right are the room itself — a sofa, a low table, louvre windows throwing
> long bars of light across a glazed tile floor, a doorway leading further into the house.
> Lots of empty wall in the upper right for text to sit over. Nobody is looking at the
> camera. Quiet, ordinary, mid-morning.

---

## After you bring them back

Drop them in `public/img/`. If a filename doesn't match, tell me and I'll adjust rather than
you renaming. JPEG is fine — I'll convert anything that needs converting and Next.js will
handle the responsive sizes and WebP conversion at build time.

Until they land, every slot renders a warm-paper placeholder with the correct dimensions, so
the layout is already final and nothing will shift when the real images arrive.
