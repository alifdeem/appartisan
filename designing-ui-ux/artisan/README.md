# Artisan side — flow and shot list

| file | what it is |
|---|---|
| `artisan-user-flow.html` | **The map.** Every route, every state, who is waiting at each step. Open it in a browser. Also published as an artifact. |
| `artisan-user-flow.svg` | Figma/FigJam auto-layout version of the same flow. Structurally right, visually sprawling — see the note below. |
| `artisan dasboard.png` | The dashboard design you generated. The standard the rest should match. |

## On the Figma test

`generate_diagram` builds FigJam diagrams from Mermaid. It works, and the FigJam
board is editable — but it is **auto-layout**, so it came out 4594 × 6596 with
connectors crossing the whole canvas and almost none of the colour the Mermaid
asked for. Next to the client's `@1-userflow` diagram it is plainly worse.

`use_figma` *can* build real designs, but by running JavaScript against the
Figma Plugin API — every frame, rect and label written by hand — and the tool
explicitly forbids `createImageAsync`, so **no photography can be placed**. The
artisan dashboard mockup is photo-led, so Figma cannot reproduce it.

**Verdict: keep the screenshot → image-generator workflow for design.** Figma's
value here is elsewhere — design tokens, Code Connect, inspecting a design
someone else made.

FigJam board: https://www.figma.com/board/02dZ2RH78yOmBt5qZZvbrU

## Dashboard — built from `artisan dasboard.png`

Structure, order and furniture all follow the mockup. Four things changed, each
because the product does not have the thing drawn:

| Mockup | Built | Why |
|---|---|---|
| **My Wallet · Withdraw earnings** | **Earnings** | PLAN.md §137/§141 — Bank of Ghana treats wallet creation and management as **E-Money Issuer** activity, **GHS 25m minimum capital**. The plan's rule is explicit: *never show a user-facing wallet balance, no stored credit, no top-ups.* Money moves per job straight to the artisan's own MoMo; nothing is held, so there is nothing to withdraw. |
| **On-time Rate 98%** | **Accept rate** | Nothing records a promised arrival time, so there is nothing to be on time against. Accept rate is real, is in migration 0018, and is what the matcher actually scores — the number that changes how much work reaches them. |
| **Verification 100%** | **Verified: Yes / No** | It is approved or it is not. A percentage implies partial states, and "0%" would tell a rejected artisan nothing about what to fix. |
| **Completed jobs (this month)** | **Completed jobs (all time)** | `providers.jobs_completed` is a lifetime counter; there is no monthly rollup. Relabelled rather than invented. |
| **Discover + Messages tabs** | four tabs | §14 — no in-app messaging, and an artisan discovers nothing: work is offered by the matcher. |

Two things are better than the mockup rather than merely different:

- **The three quick cards carry live numbers** ("3 on now", "GHS 1,320.00
  coming", "1 trade"). In the mockup they are pure navigation duplicating its
  own tab bar; with a figure on each they earn the space twice.
- **The "grow your business" panel appears only when it is true** — when the
  artisan covers two trades or fewer. Its mockup copy, *get discovered by more
  customers*, describes a marketplace this is not; clients never browse
  artisans. Covering more trades genuinely does mean more offers, because that
  is the filter the matcher runs, so that is what it says.

### Images

The hero reuses the **login portrait** (`auth-artisan-portrait.png`) — same
artisan, same navy, already a verified transparent PNG. `photos.providerHero`
is a list, so dropping a dedicated `provider-hero-artisan.png` in takes over
with no code change.

Still open: the promo card's **3D toolbox illustration**. Its right third is
held by a gradient wash until one exists, so the card does not read as
half-empty — but it is the one place still short of the mockup.
