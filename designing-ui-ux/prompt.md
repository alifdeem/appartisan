ArtisanGH Authentication Redesign (Premium Mobile UI)

You are redesigning the ArtisanGH authentication flow using the two reference mockups I attached.

The existing screens already work functionally. Do not break the logic. Replace the visual design with a premium production-ready UI that matches the references.

Goal

Create a $10,000-quality mobile experience.

The app is ArtisanGH, a marketplace for services (similar to Uber, but for artisans and service providers).

The feeling should be:

Premium

Trustworthy

Modern

Soft luxury

Clean enterprise quality

Not flashy.

Brand System

Use this refined palette.

Purpose

	

Color




Primary Navy

	

#0A2E73




Deep Navy

	

#081F4D




Accent Blue

	

#2F80ED




Soft Blue

	

#EAF3FF




Background

	

#F8FBFF




White

	

#FFFFFF




Text

	

#111827




Secondary Text

	

#64748B




Border

	

#DCE8F7

Typography:

Space Grotesk → headings

Inter → body/UI

Use a 12-column spacing rhythm with 24–32px padding.

Everything should feel intentionally spaced.

IMPORTANT: Separate Images from UI

Do not bake UI into images.

The UI should remain fully coded.

Images should only be used as decorative background or hero elements.

Use this structure.

Correct architecture

```
Screen
├── Background layer
│ ├── hero image
│ ├── gradient overlays
│ ├── blue abstract shapes
│
└── UI layer
├── logo
├── text
├── cards
├── buttons
├── inputs
└── footer
```

This keeps the design responsive and easy to maintain.

Screen 1 — Login

Rebuild the login screen.

Keep:

back button

phone login flow

Ghana country selector

remember me

forgot option

login button

create account

Layout
Top

Logo.

Tagline.

Large heading.

Find trusted professionals for every service.

Two-line hero copy.

Hero Section

The artisan portrait should be a separate image positioned behind soft blue organic shapes.

Do not place text inside the image.

Layer order:

abstract blue background shapes

artisan portrait

white fade overlay

UI

This creates depth.

Service Quick Icons

Four circular icons.

Home

Repairs

Cleaning

More

Glass-style circles.

Soft shadows.

Login Card

White floating card.

Rounded 32px.

Very soft shadow.

Inside:

phone field

password/code field

remember me

forgot

primary button

Button:

full width

navy gradient

subtle glow

Footer

Small trust text.

Safe • Secure • Trusted

Screen 2 — Sign Up

Rebuild completely.

Keep the functionality.

Layout
Header

Back button.

Logo.

Large heading.

Create your account.

Supporting copy underneath.

Account Type Selection

These should become premium selectable cards.

Instead of plain buttons.

Each card contains:

icon

title

subtitle

selection indicator

Selected card:

blue border

light blue background

filled check circle

Unselected:

white

soft border

Cards should feel tappable.

Trust Card

Insert a floating security card.

Contains:

shield icon

"Your trust matters"

short supporting copy

Benefits

Keep the three existing promises.

But redesign them.

Use circular blue check icons.

Increase spacing.

Make the list breathe.

CTA

Large bottom button.

Rounded.

Navy gradient.

Arrow icon.

Decorative Bottom Section

The city skyline and artisan should become two separate assets.

Do not bake them together.

Structure:

skyline fades into background

blue wave overlays

artisan standing in foreground

This creates depth.

Image Strategy

Whenever an image is required, do not use placeholders.

Instead:

Tell me which image is needed.

Generate a detailed AI image prompt for it.

Explain where it should sit in the layout.

Example output.

Image Asset 01

Name

Hero Artisan Portrait

Placement

top-right

behind text

clipped by blue organic shape

Prompt

```
Ultra-realistic portrait of a confident Ghanaian artisan...
```

Do this for every image.

Required Image Assets

Provide prompts for these.

Asset 1 — Hero Artisan Portrait

Purpose

Login hero.

Requirements

Ghanaian artisan

navy uniform

premium

looking upward

transparent-friendly composition

soft studio lighting

4K

portrait

Asset 2 — Blue Organic Background

Abstract flowing shapes.

No text.

Used behind hero.

4K PNG.

Asset 3 — Soft White Fade Overlay

Creates depth.

Transparent PNG.

Asset 4 — Ghana City Skyline

Minimal blue-tinted skyline.

No text.

Used behind footer.

4K wide.

Asset 5 — Standing Artisan

Full-body artisan viewed from behind.

Navy uniform.

Holding tools.

Transparent PNG.

Used above skyline.

Micro Interactions

Implement premium interactions.

Buttons

lift slightly

shadow increases

Cards

- 150ms transition

Inputs

blue focus ring

subtle glow

Selection cards

- smooth animated check

Screen transitions

fade + slide

250ms

Technical Requirements

Keep all existing authentication logic.

Keep routing unchanged.

Make every UI component reusable.

Use responsive layouts.

Avoid hardcoded spacing.

Preserve accessibility.

Support light mode perfectly.

Deliverables

Fully coded Login screen.

Fully coded Sign-Up screen.

Reusable components.

Image placement architecture.

A separate AI image prompt for every required image asset.

Instructions on whether each image should be:

full background,

transparent PNG foreground,

gradient overlay,

decorative shape,

or layered behind coded UI.

The final implementation should match the premium reference mockups while remaining fully maintainable, responsive, and production-ready.

anywhere there is an  image provide me the prompt to go and generate in google flow with nana banana pro