---
name: beautiful-ui
description: Use this skill whenever building or restyling any user-facing screen, landing page, dashboard, or app UI — especially when prompting a vibe-coding tool (Lovable, Bolt, v0, Google AI Studio, Claude Code) to generate frontend code. Forces deliberate, non-templated visual design instead of default AI-generated UI. Trigger on requests like "build the UI for X", "make this look good", "design a landing page", "style this dashboard", or any app-building prompt that includes a UI component.
---

# Beautiful UI

Act like a senior product designer handing off a spec to an engineer, not like an engineer picking default styles. The goal on every screen: something a stranger would screenshot and ask "who designed this?" — never something that reads as "AI made this in one shot."

## Step 1 — Name the product before styling it

Before touching colors or components, state in one or two lines:
- What is this screen for, and who uses it?
- What's the ONE thing this screen should feel like (e.g. "a calm budgeting tool," "a bold booking flow for a beauty salon," "a fast internal ops dashboard")?

If the request doesn't say, make a reasonable assumption and state it. Never jump straight to a generic component library look.

## Step 2 — Avoid the AI-slop defaults

Right now, AI-generated UI clusters around a small set of tells. Actively avoid these unless the brief specifically calls for one:
- Purple-to-blue gradient hero sections
- Cream/off-white background + terracotta or orange accent (#D97757-ish) with a serif headline
- Generic "SaaS card grid" with a rounded icon-in-a-circle, bold title, one line of description, repeated 3x
- Overuse of soft drop shadows on every card, floating everything at the same elevation
- Inter/system-ui font with no pairing, no character
- Emoji used as icons instead of a real icon set
- Every button the same shade of indigo/blue-600

Pick a direction that fits the actual product instead — a fintech app, a beauty salon booking system, and a football tips platform should not look like the same template.

## Step 3 — Build a mini design system first (before code)

Define these explicitly, in a few lines, before generating any UI:

**Color** — 1 primary, 1 secondary/accent, neutrals (2–3 grays), 1 success, 1 error/warning. Give real hex values, not "blue" or "gray." Make sure primary + background pass basic contrast.

**Type** — one display/heading font with actual character, one clean body font (or one font, two weights, used very intentionally). Define a scale: h1/h2/h3, body, small/caption. Avoid using 5 different font weights randomly.

**Spacing & radius** — pick one spacing unit (e.g. 4px or 8px base) and one corner-radius value (or two: cards vs buttons) and use them consistently everywhere. Inconsistent radii/spacing is the #1 tell of un-designed UI.

**Elevation** — decide where shadows are allowed (e.g. only modals and dropdowns) instead of putting a shadow on every box.

## Step 4 — Design principles to apply

- **One clear focal point per screen.** Not everything can be bold — pick what the eye should land on first (a hero action, a key number, a primary CTA) and mute everything else around it.
- **Hierarchy through size/weight/color, not borders on everything.** Reach for whitespace and contrast before reaching for a border or a divider line.
- **Real content, not lorem ipsum.** Use realistic copy specific to the actual product (real-sounding salon services, real-sounding budget categories, real-sounding match fixtures) — placeholder-feeling text makes the whole UI feel unfinished.
- **States matter.** Design empty states, loading states, and error states with the same care as the "happy path" screen — these are usually skipped and are where AI-generated apps look cheapest.
- **Motion is a seasoning, not a base ingredient.** A couple of deliberate transitions (page load, button press, modal open) beat animating everything.
- **Mobile-first if the product is mobile-first.** Bright's users (e.g. Telegram Mini Apps, Ghana-market consumer apps) are often on phones — design for a 375–420px width first, not a shrunk desktop layout.

## Step 5 — Self-critique before calling it done

Ask, honestly:
- If I removed the brand name, could I tell this apart from a default template?
- Is there one deliberate, slightly bold choice (a color, a layout move, a type pairing) that makes this memorable — or is everything "safe"?
- Are spacing, radius, and shadow actually consistent across every screen, or did each screen invent its own values?
- Does it still look good with real (not lorem ipsum) content and on a small screen?

If the honest answer to any of these is "no," fix that before finishing.

## Notes for prompting vibe-coding tools (Lovable, Bolt, v0, Google AI Studio)

When handing this off as a prompt to a vibe-coding tool: give it the design system from Step 3 explicitly (exact hex codes, font names, spacing unit) rather than vague words like "modern and clean" — vague briefs are exactly what produces the generic default look. Reference the actual product and its real content, and explicitly call out 1–2 things to avoid from Step 2 if the tool's first pass tends to reach for them.