# ArtisanGH — Build Plan

Verified home-services marketplace for Ghana. Launch: Accra & Tema. Then countrywide.

Status: **planning — no code written yet.**
Last updated: 2026-09-14 (rev 2)

---

## 1. Commercial frame

| Item | Decision |
|---|---|
| Price | $10,000 USD, full build start to finish |
| Delivery | Responsive web app (PWA). Native apps are a later, separately-priced phase |
| Ownership | App belongs to the client. Code and infrastructure stay with you |
| Operating model | You build it, roll it out with the client, and run it until they can take over |
| Running costs | Client pays. Accounts sit under you during build and management, transfer at handover |
| **Not included in the $10k** | Legal fees for terms and contract review. Liability insurance. Business registration. Paid advertising |
| Admin staffing | The client has their own workforce to run the admin panel |
| Timeline | No fixed deadline. Phased, with a client demo at the end of each phase |
| Brand | Client has none yet. You'll design the identity later using your own design skills |

Put the exclusions in the contract in writing. "Legal review not included" is a sentence that costs nothing now and saves an argument later.

---

## 2. Decisions locked

| Area | Decision |
|---|---|
| Platform | Next.js PWA, mobile-first. Native Android for artisans in Phase 2 |
| Backend | Supabase — Postgres + PostGIS, Auth, Storage, Realtime, RLS |
| Hosting | Vercel + Supabase (fresh Supabase account, keys supplied via `.env`) |
| Auth | Phone number + SMS OTP — **simulated in v1** |
| Maps | Leaflet + OpenStreetMap behind an adapter. Google Maps swaps in later |
| Payments | Paystack, charge-to-platform then Transfer API — **simulated in v1** |
| Matching | Sequential offer to nearest available artisan with a timeout, then next |
| Quoting | Structured itemised quote builder (labour and materials as separate lines) |
| Price guidance | **None.** Artisans price freely; the client declines quotes they don't like |
| Platform fee | 12% added on top of the artisan's quote |
| Transport fee | Admin-set zone rates by distance band, charged upfront, **passed to the artisan in full** |
| Deposit | 50% of the marked-up quote, plus transport, before the artisan travels |
| Verification | Full artisan details + Ghana Card + selfie → admin reviews in-app → vetting call happens offline → admin approves |
| Language | Interface and text in English. Voice notes and photos for anything else. Artisans declare spoken languages at signup so clients can request Twi/Ga speakers |
| Cancellations | Tiered, auto-enforced (see §7) |
| Seed data | Three real test accounts, one per role. Public signup works normally |

---

## 3. v1 simulation strategy

**Nothing that costs money gets wired up until the client's business is registered.** No Paystack account, no SMS credits, no Google Cloud billing. But every one of those code paths gets written now, behind an interface, so switching to live is a config change rather than a rebuild.

### The rule

Three integration points get an adapter. Each has a mock implementation and a real one, selected by environment variable.

```
lib/integrations/
  payments/   PaymentProvider   → MockPayments   | PaystackPayments
  sms/        SmsProvider       → MockSms        | ArkeselSms
  maps/       MapProvider       → OsmMaps        | GoogleMaps
```

```
PAYMENT_PROVIDER=mock      # → paystack
SMS_PROVIDER=mock          # → arkesel
MAP_PROVIDER=osm           # → google
```

Application code only ever talks to the interface. It never imports Paystack or Leaflet directly.

### What the mocks must do

The mocks are not stubs that return `true`. They have to exercise the same code paths as the real thing, or the switch-over becomes a second project.

**Payments.** `MockPayments` implements the same four methods the real one will — `initializeCharge`, `verifyCharge`, `refund`, `transfer`. It writes a real row to `payments` with a generated reference, and then **fires a simulated webhook back into the same handler Paystack will call.** This is the critical detail: if the mock resolves the charge with a direct function return instead of a webhook, the entire asynchronous half of the payment code stays unwritten and untested until the day real money is involved. Simulate the webhook.

The UI is the full mock MoMo experience: network picker (MTN / Telecel / AirtelTigo), a simulated USSD prompt screen, a spinner on a realistic delay, then success. A hidden dev panel forces failure, timeout and insufficient-funds so the unhappy paths get built and tested now, not discovered in production.

Invoices, receipts, payout records and the platform's ledger all generate for real. Only the money is fake.

**SMS.** `MockSms` logs the message to the `notifications_log` table, with the cost it *would* have incurred, and surfaces it in a dev panel. The OTP screen is exactly what ships — phone number, six boxes, resend timer — but the code is always `000000`, shown in an on-screen dev banner. A dev-only role switcher sits alongside it for jumping between the three test accounts while building.

Logging the simulated SMS cost from day one means that by the time you go live you'll have a real number to show the client for their monthly SMS budget, instead of a guess.

**Maps.** `OsmMaps` uses Leaflet with OpenStreetMap tiles and Nominatim for geocoding. Free, no card, no account. Distance for matching comes from PostGIS, which is real regardless of which map renders it — so **matching quality does not depend on the map provider at all**. Only address search quality does, and that's mitigated by the location picker leaning on a dropped pin, a landmark field, and a GhanaPostGPS code, which is how Ghanaians give directions anyway.

### The guardrail

Ship a runtime check that **throws on boot** if any provider is set to `mock` while `NODE_ENV=production`, unless `ALLOW_MOCK_IN_PROD=true` is explicitly set. A mock payment provider silently running in production is the kind of mistake that is obvious in hindsight and catastrophic in the moment.

### Going live later

When the client has their registration documents, bank account and merchant accounts:

1. Create Paystack, Arkesel and Google Cloud accounts, add keys to env
2. Flip the three env vars
3. Test one real GHS 1 transaction end to end
4. Register the SMS sender ID — **this takes several days, start it first**

That's the whole switch-over. Budget a week for it including real-money testing, not a phase.

---

## 4. Payments architecture

I checked the Ghanaian rails before committing. Two findings force a different design than the obvious one, and they apply to how the mock is built too.

### Finding 1 — do not use split payments

Neither Paystack nor Flutterwave can **hold** a sub-merchant's share and release it later on a signal from our backend. The split is fixed at the moment of charge and settles on the provider's own schedule.

Worse: **refunding a split transaction debits the platform's balance, and the subaccount's share is not clawed back.** Since a pre-travel cancellation is a routine event in this product, splits would put you out of pocket on every single one.

**Instead: charge 100% to the platform's Paystack account, then pay the artisan with a separate Transfer API call once the job is signed off.** Paystack's Manual Payouts mode lets the balance sit indefinitely, provided at least one transfer goes out every 90 days.

### Finding 2 — mobile money cannot be charged silently

There is no tokenisation or recurring billing on the MoMo channel. **Every charge requires the customer to be physically present and approve a fresh USSD prompt with their PIN.**

This dictates the shape of the end of the job. The balance payment happens **while the artisan is still on site**:

> work done → artisan marks complete → client reviews and signs → client taps "Pay balance" → MoMo prompt fires on their phone → confirmed → artisan leaves

Design it any other way and you get unpaid balances and angry artisans. The mock must enforce the same sequence.

### Provider choice: Paystack

1.95% flat across cards, MoMo and bank transfer. MTN, Telecel and AirtelTigo for both collection and payout, confirmed against the live API. Manual Payouts gives the float.

Keep **Hubtel documented as a fallback** for the collection leg. Because we charge to the platform account rather than splitting, swapping the collection provider later is cheap.

### Regulatory position

Bank of Ghana treats "creation and management of wallet" as E-Money Issuer activity — GHS 25m minimum capital. A payment solution built on a licensed Enhanced PSP sits in **PSP Standard, no capital requirement.** That is the lane every Ghanaian marketplace operates in.

Three consequences that constrain the build permanently:

1. **Never show a user-facing wallet balance.** No stored credit, no top-ups, no "ArtisanGH balance". Money moves in and out per job.
2. **Write the artisan terms as an agency relationship** — the platform collects payment *as agent of the artisan*.
3. Have a Ghanaian fintech lawyer read the terms before launch. Outside the $10k, but not optional.

### The economics, worked through

Artisan quotes **GHS 400**. Client is in the 5–15km band, transport **GHS 40**. Transport passes to the artisan in full.

| Step | Amount |
|---|---|
| Client-facing job total (400 × 1.12) | GHS 448 |
| Deposit leg (50% of 448, plus transport) | GHS 264 |
| Balance leg, on site | GHS 224 |
| **Total collected** | **GHS 488** |
| Paystack fees at 1.95% | −GHS 9.52 |
| Payout to artisan (400 quote + 40 transport) | −GHS 440 |
| **Platform net** | **~GHS 38.48** |

Two consequences worth raising with the client now:

- **Payout transfer fees will eat a thin margin on small jobs.** On a GHS 100 job the platform nets around GHS 10 before the transfer fee. Batch payouts weekly rather than per job, and consider a minimum job value — say GHS 80 — below which the economics don't work.
- **12% is the only revenue line.** With transport passing straight through, the platform has no second income stream. That's clean and honest and easy to explain, but it means volume is the entire business model. Worth the client understanding that explicitly.

**Show the artisan the client-facing total, not just their own quote.** If the artisan thinks the job is GHS 400 and the client is paying GHS 448, they will have that conversation on the customer's doorstep and it will go badly. Display both numbers with the fee labelled.

---

## 5. Roles

**Client** — posts jobs, gets matched, reviews quotes, pays deposit and balance, tracks the artisan, signs off, rates.

**Provider (artisan)** — applies and gets verified, toggles availability, receives offers, builds itemised quotes, updates travel status, marks work complete, receives payouts.

**Admin** — reviews verification applications, monitors live jobs, intervenes when matching stalls, handles disputes, manages categories and transport zones, sets commission, watches platform health. Staffed by the client's own team.

---

## 6. The job lifecycle

This state machine is the spine of the product. Everything else hangs off it.

```
DRAFT
  └─> POSTED ──────────> MATCHING
                            │
              ┌─────────────┼──────────────┐
              ▼             ▼              ▼
         OFFER_SENT    (all declined)  (no artisans)
              │             │              │
      accepted│             └──────> UNMATCHED ──> admin assigns
              ▼                                        │
          ASSIGNED <─────────────────────────────────┘
              │
              ▼
        QUOTE_PENDING ──> QUOTE_SENT
                             │
                   ┌─────────┴─────────┐
            client │                   │ client
            accepts▼                   ▼ rejects
        AWAITING_DEPOSIT          back to MATCHING
                   │                (or CANCELLED)
            paid   ▼
            DEPOSIT_PAID
                   │
                   ▼
              EN_ROUTE  ──(location pings, client sees map)
                   │
                   ▼
               ARRIVED
                   │
                   ▼
             IN_PROGRESS
                   │
                   ▼
            WORK_COMPLETE  (artisan marks done, uploads photos)
                   │
                   ▼
          AWAITING_SIGNOFF  (client reviews, signs digitally)
                   │
                   ▼
          AWAITING_BALANCE  (MoMo prompt, artisan still on site)
                   │
                   ▼
                 PAID ──> invoice generated ──> payout queued
                   │
                   ▼
               CLOSED  (after rating, or auto after 7 days)
```

Terminal states outside the happy path: `CANCELLED_BY_CLIENT`, `CANCELLED_BY_PROVIDER`, `EXPIRED_NO_MATCH`, `DISPUTED`.

Every transition writes to `job_events` with actor, timestamp and reason. When a dispute arrives six weeks later, that log is the only thing that will tell you what actually happened.

Note the quote-rejected path: the client declining a quote sends the job **back to matching**, not to cancellation. Since there is no price guidance in v1, artisans price freely and clients decline — so this path will be walked often. It needs to feel smooth, not like a failure, and the client should see something like "We'll find you another artisan" rather than an error.

### Matching mechanics

On `POSTED`, a Postgres function selects candidates: verified, currently online, matching category, within their service radius, not already on an active job. Ordered by PostGIS distance.

Offers go out one at a time with a **120-second expiry**. A `pg_cron` job runs every 30 seconds, expires stale offers and advances to the next candidate.

**This is the part most likely to hurt at launch.** Sequential offers are true to the "no bidding" vision and feel like Uber — but Uber has density. With 30 artisans across Accra and Tema, a plumbing job in Spintex at 8pm may walk a very short list and find nobody. Three mitigations, all cheap, all built now:

1. **Widen the radius progressively** — pass 1 at 5km, pass 2 at 10km, pass 3 at 20km
2. **Fall through to an admin queue** — a human phones an artisan directly. Every real marketplace runs on this for its first six months
3. **Tell the client what's happening** — "Finding your artisan — we've contacted 3 so far" beats a silent spinner

If fill rate is poor after the pilot, the fix is broadcasting to the nearest 3–5 simultaneously. Build the matcher so that's a config change, not a rewrite.

### Live tracking — be honest about what a PWA can do

Browser geolocation stops when the artisan locks their phone or switches apps. Anyone promising real-time tracking in a web app is overpromising.

What gets built: `watchPosition` pings every 20–30 seconds while the tab is open, held awake with the Wake Lock API, pushed to the client's map over Supabase Realtime. **The UI says "updated 30 seconds ago", not a fake smoothly-moving car.** When pings stop, it says so and offers a call button.

This is a genuine reason for the Phase 2 native Android app, and worth framing to the client that way rather than as a defect.

---

## 7. Cancellation policy

Auto-enforced by the state machine. No human needed for the common cases.

| Cancelled at | Client pays | Artisan gets |
|---|---|---|
| Before deposit | Nothing | Nothing |
| After deposit, before `EN_ROUTE` | Nothing — full refund | Nothing |
| After `EN_ROUTE`, before `IN_PROGRESS` | Transport fee only | Full transport fee |
| After `IN_PROGRESS` | Deposit forfeited | Deposit less platform fee |
| Artisan cancels at any point | Nothing — full refund | Nothing, plus a reliability strike |

Because we hold the gross in the platform's account and pay artisans separately, every one of these refunds is clean. That's the payoff from Finding 1.

---

## 8. Artisan reliability thresholds

You asked me to decide. These are the starting numbers — all stored in `settings` so the client can tune them without a deploy.

Scoring runs on a **rolling 30-day window** and only applies once an artisan has received **at least 5 offers**, so nobody gets suspended on their first bad day.

| Signal | Threshold | Consequence |
|---|---|---|
| Offer accept rate | Below 40% | Deprioritised in matching (moves down the distance-ordered queue) |
| Offer accept rate | Below 20% | Flagged for admin review |
| Cancels after accepting | 3 in 30 days | Auto-suspended, admin must reinstate |
| No-show (accepted, never `EN_ROUTE` within 2 hours) | 2 in 30 days | Auto-suspended, admin must reinstate |
| Average rating | Below 3.0 across 5+ rated jobs | Flagged for admin review |
| Average rating | Below 2.5 across 10+ rated jobs | Auto-suspended |

**Suspension is never automatic-permanent.** It removes the artisan from matching and puts them in front of an admin, who calls them — the same offline human judgement the client already uses for verification. That's consistent with how they want to run the platform, and it avoids the failure mode where a good artisan loses their income to an algorithm over a week of bad traffic.

Artisans see their own reliability stats in their dashboard. Hiding the score and then punishing people for it is how you lose supply.

---

## 9. Service categories

Launch broad — the client wants as many services as possible, and admin can add more without a deploy. Proposed starting set:

Electrical · Plumbing · Carpentry · Painting · AC & refrigeration · Cleaning · Masonry & tiling · Welding & metalwork · Appliance repair · Generator repair & servicing · Roofing · Aluminium & glass works · CCTV & security installation · Pest control · Landscaping & gardening · Borehole & water systems · POP & ceiling works · Upholstery · Curtains & blinds · Locksmith · Satellite & TV installation · Solar installation · Mobile auto mechanic · Interior fit-out · Tailoring · Hair & beauty (home service)

Each category carries a name, icon, description and active flag. **No price ranges in v1** — artisans quote freely and clients decline what they don't like.

One caution to revisit after the pilot: with no price signal at all, some clients will abandon at the posting step because they have no idea whether they're about to be quoted GHS 200 or GHS 2,000. The data you need to fix that is exactly the data the pilot will generate. After 100 or so completed jobs you'll have real median prices per category, and displaying those costs almost nothing to add. Worth planning for even though it isn't in v1.

---

## 10. Data model

Core tables. Every table gets row-level security, scoped by role.

**Identity**
`profiles` (id, role, phone, full_name, avatar, spoken_languages[], created_at)
`clients` (profile_id, saved_addresses)
`providers` (profile_id, bio, years_experience, verification_status, availability, current_location `geography(Point)`, service_radius_km, rating_avg, rating_count, momo_number, momo_network, paystack_recipient_code, reliability stats)
`provider_categories` (provider_id, category_id)
`provider_documents` (provider_id, doc_type, storage_path) — Ghana Card front/back, selfie, work photos
`verification_reviews` (provider_id, admin_id, decision, call_notes, reviewed_at)

**Catalogue & config**
`categories` (name, slug, icon, description, active, sort_order)
`transport_zones` (city, min_km, max_km, fee, provider_share_pct)
`settings` (key, value) — commission %, offer timeout, radius passes, reliability thresholds

**Jobs**
`jobs` (client_id, provider_id, category_id, description, voice_note_path, status, location `geography(Point)`, address_text, ghanapost_code, landmark, created_at)
`job_photos` (job_id, storage_path, uploaded_by, stage)
`job_offers` (job_id, provider_id, sequence_no, sent_at, expires_at, status)
`job_events` (job_id, from_status, to_status, actor_id, reason, created_at) — the audit log
`location_pings` (job_id, provider_id, location, recorded_at)
`signoffs` (job_id, signature_data, client_notes, signed_at)

**Money**
`quotes` (job_id, provider_id, subtotal, service_fee_pct, service_fee_amount, transport_fee, total, status)
`quote_items` (quote_id, kind [labour|material], description, qty, unit_price, amount)
`payments` (job_id, leg [deposit|balance], amount, provider_reference, channel, status, is_simulated, paid_at, raw_payload)
`payouts` (job_id, provider_id, amount, transfer_reference, status, is_simulated, initiated_at, settled_at)

**Trust & support**
`ratings` (job_id, stars, comment, tags[])
`disputes` (job_id, raised_by, reason, evidence_paths[], status, resolution, admin_id)
`notifications_log` (recipient, channel, template, cost, provider_msg_id, status, is_simulated)

Note `is_simulated` on every money and messaging table. When the switch to live happens, you need to be able to tell real transactions from test ones forever — retrofitting that flag onto existing rows is guesswork.

Ghana Card images are sensitive personal data. **Private** storage bucket, short-lived signed URLs to admins only. Never a public bucket.

---

## 11. Screens

**Public** — landing page (how it works, categories, dual CTA), login, client signup, provider application with document upload, terms and privacy.

**Client** — dashboard, post a job (category → photos/voice → describe → pin location), job tracking (one screen that changes with state), job history, invoice view, account settings.

**Provider** — dashboard (availability toggle, incoming offer, active job, earnings summary), offer screen with countdown, quote builder, active job with status buttons, earnings history, reliability stats, verification status, settings.

**Admin** — dashboard, verification queue, live jobs monitor, stalled-jobs queue, disputes, categories, transport zones, commission and threshold settings, user management, payouts.

**Dev-only (stripped from production)** — role switcher, simulated payment outcome controls, SMS log viewer, job state advancer.

The provider side is built around **large icons, photos and colour-coded states rather than paragraphs**. Decide this now; retrofitting it is expensive.

---

## 12. Build phases

Each phase ends in something demonstrable to the client.

**Phase 0 — Foundations**
Next.js + Supabase, schema and PostGIS, RLS for all three roles, the three integration adapters with mocks wired, phone OTP with fixed dev code, role-based routing, dev role switcher, design system, landing page. Three seeded test accounts, working public signup.
*Demo: a real landing page and working signup.*

**Phase 1 — Client posting**
Categories, job creation with photos and voice notes, Leaflet location picker with landmark and GhanaPostGPS fields, client dashboard, job history.
*Demo: a client can post a real job.*

**Phase 2 — Providers & verification**
Provider application, document upload to private storage, admin verification queue with approve/reject and call notes, provider profile, availability toggle.
*Demo: the client's admin can approve a real artisan.*

**Phase 3 — Matching & quoting**
Matching function, sequential offers with expiry, `pg_cron` advancer, radius widening, admin fallback queue, offer screen with countdown, itemised quote builder, client quote review and decline-back-to-matching.
*Demo: end to end from posting to an accepted quote.*

**Phase 4 — Money in (simulated)**
Payment adapter, mock MoMo UX, simulated webhook round-trip, transport zones, idempotent webhook handler, payment state reconciliation, refunds, failure and timeout paths.
*Demo: the full payment experience, no money.*

**Phase 5 — Execution & money out (simulated)**
Travel status, location pings and client map, work-complete with photos, digital sign-off, on-site balance payment, invoice PDF, payout records via the adapter.
*Demo: a complete job, start to finish.*

**Phase 6 — Trust & admin**
Ratings, disputes with evidence upload, admin dashboards and metrics, category, zone, commission and threshold management, reliability scoring and auto-suspend.

**Phase 7 — Hardening**
OTP rate limiting, mock-in-production guardrail, error monitoring, RLS security review, terms and privacy policy, Data Protection Commission registration, accessibility and low-bandwidth pass.

**Phase 8 — Go live**
Real Paystack, SMS and Google Maps accounts. Flip three env vars. One real GHS 1 transaction end to end. Sender ID registration.

**Phase 9 — Pilot & handover**
Onboard the first artisans, train the client's admin staff, operations documentation, transfer accounts.

Building payments early even in simulated form is deliberate — the asynchronous webhook logic is where the unknown-unknowns live, and it wants to be written and tested long before real money touches it.

---

## 13. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Mock payments mask a real integration problem, surfacing only at go-live | **High** | Mock fires a real webhook round-trip, not a direct return. Build failure and timeout paths now. Budget a week for go-live, not a day |
| Mock provider accidentally running in production | **High** | Runtime guard that throws on boot. `is_simulated` flag on every money row |
| Not enough artisans online, jobs go unfilled | **High** | Radius widening, admin fallback, onboard 30+ per category before launch |
| No price guidance causes clients to abandon at posting | Medium | Accept for v1, measure abandonment, add median prices per category after the pilot |
| Client refuses to pay the balance after work is done | **High** | Balance collected on site before the artisan leaves. Artisan flags non-payment straight to dispute |
| Thin margin on small jobs after transfer fees | Medium | Weekly batched payouts, minimum job value |
| SMS costs run away, or OTP endpoint gets pumped | **High** (post-launch) | Rate limit per number and per IP, daily spend cap, alerts. SMS for OTP and critical events only. Simulated cost logging gives a real budget figure before go-live |
| Artisan damages property or a client is harmed | **High** | Ghana Card on file, terms placing liability on the artisan, clear incident path. Insurance is the client's decision but must not go unaddressed |
| Ghana Data Protection Act compliance | Medium | Register as data controller, privacy policy, private buckets, retention policy for ID documents |
| PWA tracking stops when the phone locks | Medium | Wake Lock, honest "last updated" UI, native app in Phase 2 |
| Scope creep pushing a $10k build to $20k of work | **High** | This document is the scope. Anything not in it is a change request |

---

## 14. Explicitly not in v1

Naming these protects the budget. Each is a credible paid follow-on.

Native iOS/Android apps · in-app chat (use masked calling or WhatsApp) · scheduled and recurring bookings · subscriptions or maintenance plans · multi-artisan jobs · materials marketplace · artisan referrals · loyalty and promo codes · multi-city config beyond Accra and Tema · Twi/Ga interface translation · AI photo-based price estimation · public artisan profile browsing · category price guidance · simulated artisan movement and scripted demo mode.

---

## 15. Resolved

| Question | Answer |
|---|---|
| Transport fee split | Passes to the artisan in full |
| Reliability thresholds | Decided — §8, all tunable in settings |
| Admin staffing | The client's own workforce |
| Categories and price ranges | Broad category list, no price guidance; artisans price freely |
| Verification bar | Offline vetting call is sufficient; no guarantors |
| Legal and insurance | Outside the $10k; the client arranges |
| First 50 artisans | Deferred until after the app is testable |

---

## 16. Still open

1. **Transport zone bands and amounts** — needs real numbers for Accra and Tema. Placeholder values go in now; the client confirms before go-live.
2. **Minimum job value**, if any. Recommend around GHS 80 once real payout fees are known.
3. **Is 12% final?** It's the only revenue line now that transport passes through. Worth confirming the client has done that arithmetic.
4. **Cancellation window for the client** — is there a grace period after paying the deposit, or does `EN_ROUTE` start the clock immediately?
5. **What happens to a job the client declines three times?** Endless rematching wastes artisan goodwill. Suggest capping at 3 quote rejections, then offering an admin callback.

---

## 17. Before writing code

- [ ] Client signs off on this document
- [ ] Supabase project created on the new account, keys in `.env.local`
- [ ] Design skills / references supplied
- [ ] Placeholder transport zone bands agreed
- [ ] Repo initialised with git

Not needed yet, and deliberately so: Paystack account, Google Cloud billing, SMS provider, sender ID.
