ARTISANGH — NON-NEGOTIABLE DESIGN IMPLEMENTATION RULES

The attached mockup is now the visual source of truth. Do not interpret it loosely. Match its composition, spacing, layering, proportions, and visual hierarchy as closely as possible while keeping the UI fully coded.

Rule 1 — Match the composition before matching components

The goal is not to recreate the same components using Tailwind defaults.

First match:

overall silhouette

spacing rhythm

image proportions

section hierarchy

floating surfaces

visual weight

Only then build the components.

If the coded result looks flatter than the mockup, redesign it.

Rule 2 — The hero must look editorial

The current implementation leaves a large empty area.

Instead recreate this composition:

Requirements:

artisan occupies 40–45% of the hero width

artisan overlaps the background shapes

soft white fade behind the artisan

decorative blue organic shapes behind the photo

greeting aligned left

notification button floats independently

Do not leave unused whitespace.

Rule 3 — Stop outlining everything

Current problem:

every card has a visible border

every section looks identical

Instead:

Component

	

Style




Hero

	

No border




Earnings

	

Gradient surface




Job Card

	

Soft shadow only




Stats

	

Shared container




Promo

	

Full-bleed gradient




Verified

	

Soft tinted surface

Only use borders where necessary.

Rule 4 — Replace three separate shortcut cards

Current:

My Jobs

Earnings

Profile

They feel disconnected.

Instead create premium quick actions.

Each tile:

22px radius

icon inside navy circle

subtle elevation

no thick border

Rule 5 — Make earnings feel premium

Current earnings card is too flat.

Target:

Requirements:

rich navy gradient

internal lighting

rounded 26px

floating button inside

Rule 6 — The job card should breathe

Current card feels compressed.

Increase:

vertical spacing

image/icon size

padding

Structure:

Do not let text crowd the badge.

Rule 7 — Performance must become one premium module

Current metrics look like four separate columns.

Instead create:

This should feel like one dashboard module.

Rule 8 — Promotional section must match the mockup

Current promo is too flat.

Target:

full-width

28px radius

rich navy-to-blue gradient

large 3D toolbox illustration

oversized heading

white CTA pill

Layout:

text left

illustration right

Do not shrink the illustration.

Rule 9 — Use layered backgrounds

The mockup has subtle depth.

Add:

blurred blue circles

organic wave shapes

soft radial gradients

ambient lighting

Use CSS whenever possible.

Do not use flat white everywhere.

Rule 10 — Navigation must float

Current navigation still feels like a standard bottom bar.

Target:

frosted glass

floating

22px radius

soft shadow

backdrop blur

active icon inside a navy circular capsule

Rule 11 — Use oversized photography

Current implementation underuses imagery.

Rules:

hero artisan: 40–45% width

promo illustration: 35% width

service photos: edge-to-edge

no tiny stock images

Photography should become one of the dominant visual elements.

Rule 12 — Pixel-match checklist

Before finishing, compare against the mockup.

Hero image overlaps decorative shapes.
No large empty whitespace.
Earnings card uses a navy gradient.
Quick actions are elevated tiles, not outlined boxes.
Job card has generous spacing.
Performance is one unified container.
Promotion uses a large 3D illustration.
Navigation floats with blur.
Background has layered blue gradients.
Overall visual weight matches the mockup within roughly 95%.
Final instruction

Do not finish until the coded UI is visually difficult to distinguish from the provided mockup at first glance. Prioritize matching composition, spacing, depth, image scale, and hierarchy over simply recreating the same components.