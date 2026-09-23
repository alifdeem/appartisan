# Artisan side — image assets

For **Google Flow / Nano Banana Pro**. One file.

---

## ⚠️ Export as PNG, not JPEG

`auth-skyline.png` and `auth-artisan-back.png` came back as JPEGs renamed
`.png`, which is why they show a white box — JPEG cannot store transparency.
The dev server now catches this and names the file on the console.

Check before you drop anything in:

```bash
file public/img/*.png
```

Every line must read `PNG image data … RGBA`. `JPEG image data` is the bug.

---

## The dashboard hero is already filled

`provider-hero-artisan.png` does **not** exist, and the dashboard does not need
it to look finished: the slot falls back to `auth-artisan-portrait.png` — the
login portrait. Same artisan, same navy, already a real transparent PNG.

Drop a dedicated file in at the filename below and it takes over automatically,
no code change. The prompt below is for that optional bespoke version; the
brief for it is genuinely different from the login shot, because on this screen
the photograph is of the **reader**.

---

## Optional — Artisan Dashboard Hero

| | |
|---|---|
| **File** | `public/img/provider-hero-artisan.png` |
| **Type** | Transparent PNG, foreground plate |
| **Placement** | Top-right of the dashboard header, behind the greeting, over a coded gradient |
| **Rendered** | 192 × 256 pt, masked to an organic silhouette, faded out below the chest |
| **Aspect** | 3:4 portrait |
| **Resolution** | 1500 × 2000 minimum |

**This one is different from every other photograph in the app.** The client-side
images show work being done *for* somebody. This one shows the person holding the
phone. It should read as how a good artisan wants to be seen at the start of a
working day — capable, unhurried, proud of the trade. Not a stock smile.

The greeting sits to its left and the plate is masked and faded below the chest,
so keep the subject in the right two-thirds and nothing important low in frame.

```
Ultra-realistic editorial portrait photograph of a Ghanaian artisan, a man in
his mid-thirties, arms folded, looking slightly off-camera with a calm confident
half-smile. He wears a deep navy work shirt with the sleeves rolled and navy bib
overall straps, a navy cap, and a tool pouch strap across one shoulder with a
screwdriver and pliers visible in the chest pocket.

Soft diffused morning daylight from the upper left, gentle fill, subtle rim light
separating his shoulder from the background. Natural warm skin tones, realistic
skin texture, sharp focus on the eyes. Shallow depth of field.

Isolated subject on a fully transparent background — the background must be
transparent, not white and not blue. Clean alpha cutout around the cap, hair,
folded arms and tools. No drop shadow, no ground plane, no vehicle, no scenery.

Framing: head, shoulders and folded arms only, cropped at the waist. Subject in
the right two-thirds of the frame, clear empty space at the left edge.

Absolutely no text, no letters, no numbers, no logos or brand marks on the
clothing or cap, no watermarks, no user interface elements, no phone mockups,
no borders.

Vertical 3:4 portrait, 4K, photorealistic commercial photography.
PNG with alpha channel.
```

---

## Not needed

The mockup's **toolbox-and-hard-hat illustration** on the "grow your business"
card is not required. That panel is now a coded navy-to-azure gradient that
appears only when it is actionable, and a 3D illustration on a card that comes
and goes would be a megabyte fetched for a panel most artisans never see.

## Checklist

- [ ] `file public/img/provider-hero-artisan.png` says **RGBA**
- [ ] Background transparent, not white
- [ ] Subject right-of-centre, nothing important below the chest
- [ ] Navy clothing, no logos
- [ ] Exact filename, in `public/img/`
