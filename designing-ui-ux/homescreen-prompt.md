ArtisanGH Home Screen Redesign (Premium Marketplace UI)

Use the attached reference as layout inspiration, not as a design to copy.

This is the ArtisanGH home screen — a premium marketplace for services (Uber for artisans). The goal is a $10,000-quality mobile experience that feels like Airbnb, Uber, and Apple combined: clean, trustworthy, spacious, and premium.

Do not change existing functionality. Only redesign the UI/UX while preserving navigation, search logic, location, and service flow.

Brand System

Use this design system consistently.

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




Secondary

	

#64748B




Border

	

#DCE8F7

Typography:

Space Grotesk → Headings

Inter → Body

Use generous spacing (24–32px padding), large rounded corners (20–28px), and soft layered shadows.

Design Principles

The screen should feel:

Premium

Trustworthy

Modern

Soft luxury

Clean enterprise quality

Avoid flat, generic UI.

Every card should have subtle depth.

Image Architecture (Very Important)

Do not bake UI into images.

Everything interactive must be coded.

Images should be layered behind or inside coded components.

Example architecture:

```
Home Screen
├── Background
│ ├── gradients
│ ├── decorative blue shapes
│
├── Hero Card
│ ├── coded text
│ ├── coded buttons
│ └── layered artisan image
│
├── Categories
├── Filters
├── Service Cards
├── Promo Cards
└── Bottom Navigation
```

Whenever an image is needed, provide me with an AI image-generation prompt instead of using placeholders.

Section 1 — Hero Header

Replace the plain header with a premium hero.

Layout:

greeting

notification button

location selector

soft decorative blue gradient

artisan hero image

Text:

Welcome back

Large headline:

Find trusted artisans across Ghana.

Supporting text:

Book verified professionals for home repairs, cleaning, moving, beauty, electrical work, and more.

The artisan image should sit on the right with a soft white fade into the background.

Hero Image

Instead of embedding it into the mockup:

Generate an image prompt for:

Asset 01 — Hero Ghanaian Artisan

Requirements:

confident Ghanaian artisan

navy uniform

holding professional tools

smiling naturally

portrait composition

transparent-friendly edges

premium commercial photography

4K

The image should be layered behind the hero text.

Section 2 — Location

Keep the location selector.

Redesign it into a pill.

Example:

📍 Accra, Ghana ▼

Soft blue background.

Hover/press animation.

Section 3 — Search

This becomes the primary action.

Design:

large floating search pill

search icon

voice icon

filter button

Height around 56px.

Soft shadow.

Rounded 28px.

The filter button should feel like a floating circular button.

Section 4 — Browse Categories

Instead of basic pills:

Create premium category chips.

Each chip contains:

circular icon

title

active state

Examples:

Cleaning

Plumbing

Electrical

Carpentry

Beauty

Painting

Moving

Active chip:

navy fill

white text

Inactive:

white

soft border

Section 5 — Smart Filters

Redesign filters.

Current inspiration:

Nearby

Experience

Price

Availability

Use floating pills with icons.

Examples:

Within 5 km

5+ Years

Available Today

Price

Selected filters animate smoothly.

Section 6 — Featured Professionals

This section deserves the biggest upgrade.

Instead of basic cards:

Create premium portrait cards.

Each card includes:

professional photo

verified badge

rating

completed jobs

experience

service title

starting price

Example:

Sarah Mensah

⭐ 4.9

1,240 jobs

Cleaning Specialist

From GH₵120

Rounded image corners.

Soft card shadow.

Service Card Image

Instead of placeholders:

Provide an AI image prompt.

Example:

Asset 02 — Professional Cleaner

Requirements:

Ghanaian professional

navy ArtisanGH uniform

premium home interior

realistic photography

portrait crop

4K

Do this for every service category.

Section 7 — Featured Promotions

Redesign completely.

Instead of flat rectangles.

Create premium promotional cards.

Examples:

First Booking Discount

Weekend Offers

Verified Pro Guarantee

Use:

soft gradients

layered illustrations

floating shapes

Each card needs its own image prompt.

Promotion Image Prompt

Generate:

Asset 03 — Discount Illustration

Requirements:

blue gradient

floating megaphone

modern 3D illustration

premium

no text

transparent-friendly

Section 8 — Explore Services

Replace the basic tabs.

Use segmented navigation.

Example:

All

Popular

Near You

Top Rated

New

Active tab:

navy underline

smooth animation

Service Grid

Below the tabs.

Premium responsive cards.

Each includes:

image

title

rating

starting price

Example:

Electrician

Hair Stylist

AC Technician

Carpenter

Bottom Navigation

Upgrade it.

Instead of generic icons.

Create a floating bottom bar.

Icons:

Home

Search

Bookings

Messages

Profile

Selected icon:

navy circle

white icon

Unselected:

- gray

Soft blur behind the navigation.

Micro Interactions

Every interaction should feel premium.

Buttons

lift slightly

stronger shadow

Cards

150ms transition

tiny scale

Search

- glowing focus ring

Category Chips

- smooth fill animation

Bottom Navigation

- spring animation

Required Image Assets

Instead of placeholders, provide detailed AI prompts for every asset.

Asset 01

Hero Ghanaian Artisan

Asset 02

Professional Cleaner

Asset 03

Plumber

Asset 04

Electrician

Asset 05

Carpenter

Asset 06

Beauty Professional

Asset 07

Moving Professional

Asset 08

Discount Illustration

Asset 09

Abstract Blue Background

Asset 10

Decorative Blue Gradient Shapes

For every asset provide:

purpose

placement

dimensions

transparent or full background

complete AI generation prompt

Technical Requirements

Preserve all existing functionality.

Make every section reusable.

Keep components modular.

Support responsive layouts.

Use coded gradients instead of image gradients whenever possible.

Maintain accessibility.

Keep image layers separate from interactive UI.

Optimize for mobile-first performance.

Deliverables

Fully redesigned ArtisanGH home screen.

Reusable UI components.

Layered image architecture.

AI image-generation prompt for every required image.

Clear instructions for where each image sits (background, foreground PNG, hero layer, or card image).

Production-ready implementation that feels significantly more premium than the reference while remaining fully maintainable.