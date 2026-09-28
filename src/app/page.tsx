import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";

import { HeroPhones } from "@/components/landing/hero-phones";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { QuoteDocket } from "@/components/marketplace/quote-docket";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Photo } from "@/components/ui/photo";
import { photos } from "@/lib/images";
import { computeQuote, formatAmount } from "@/lib/money";

export const metadata: Metadata = {
  title: "Verified artisans, booked in minutes",
};

/**
 * Landing page.
 *
 * The whole argument is trust. Anyone in Accra can find an electrician — the
 * hard part is knowing whether he will show up, whether he is who he says he
 * is, and what it will cost when he is done.
 *
 * The design answer to that is the hero: instead of a stock photograph or a
 * gradient, the first thing on the page is the artisan card and the quote
 * docket, which are the *actual components the app renders*. Every competitor
 * in this category asserts trust in prose and shows nothing. Showing the
 * verified person and the itemised price, in the product's own type and colour,
 * is both the differentiator and proof the thing is built.
 *
 * Three structural rules, because breaking them is what makes a page read as a
 * template:
 *   1. No two adjacent sections share a container width.
 *   2. At most one card grid on the whole page. The 26 trades are a typographic
 *      list — the list itself is the proof of breadth, and it reads faster.
 *   3. Depth comes from the surface tiers (sunken / ground / raised), never
 *      from translucency. See the surface note in globals.css.
 *
 * Deliberately static: no database read, so the front door keeps rendering even
 * if Supabase is unreachable. The category list is duplicated from
 * 0004_reference_data.sql, which is a trade worth making for that.
 */

/** All 26, in the order 0004_reference_data.sql inserts them. */
const CATEGORIES = [
  "Electrical",
  "Plumbing",
  "AC & Refrigeration",
  "Carpentry",
  "Painting",
  "Cleaning",
  "Masonry & Tiling",
  "Welding & Metalwork",
  "Appliance Repair",
  "Generator Repair",
  "Roofing",
  "Aluminium & Glass",
  "CCTV & Security",
  "Pest Control",
  "Landscaping & Gardening",
  "Borehole & Water Systems",
  "POP & Ceiling Works",
  "Upholstery",
  "Curtains & Blinds",
  "Locksmith",
  "Satellite & TV Installation",
  "Solar Installation",
  "Mobile Auto Mechanic",
  "Interior Fit-out",
  "Tailoring",
  "Hair & Beauty (Home)",
];

/**
 * The example job, run through the same function the booking flow uses. If the
 * platform commission ever changes, this page changes with it — a marketing
 * page that quietly disagrees with the product is worse than no page.
 */
const EXAMPLE = computeQuote({ subtotal: 400, transportFee: 40 });

const EXAMPLE_LINES = [
  { kind: "Labour", description: "Fuse board rewire, 6 circuits", amount: 260 },
  { kind: "Materials", description: "MCBs ×6, 2.5mm cable, trunking", amount: 140 },
  { kind: "Transport", description: "Osu → Labone, 8 km", amount: 40 },
];

export default function LandingPage() {
  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        <Hero />
        <WorkBand />
        <Promises />
        <HowItWorks />
        <Trades />
        <Pricing />
        <ForArtisans />
      </main>

      <SiteFooter />
    </>
  );
}

/* ------------------------------------------------------------------------- */

function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-hairline/60 bg-canvas/85 backdrop-blur-md">
      {/* One of the four places blur is allowed: real content moves underneath
          it. Everywhere else, depth is a surface tier. */}
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-5 sm:px-8">
        {/* min-h-11 rather than the mark's natural 32px — the audit measured
            this link at 32px on a touch viewport, under the 44px the rest of
            the app holds itself to. */}
        <Link href="/" className="inline-flex min-h-11 items-center rounded-field">
          <Logo />
        </Link>

        <nav className="ml-auto hidden items-center gap-7 text-ui text-copy-muted md:flex">
          <a href="#how-it-works" className="tap transition-colors hover:text-navy-900">
            How it works
          </a>
          <a href="#services" className="tap transition-colors hover:text-navy-900">
            Services
          </a>
          <a href="#for-artisans" className="tap transition-colors hover:text-navy-900">
            For artisans
          </a>
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="max-md:min-h-11">
              Log in
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm" className="max-md:min-h-11">
              Get started
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------------- */

/**
 * The hero.
 *
 * **A dark panel, not a dark page.** The reference this is drawn from is a
 * billboard: a deep blue panel with rounded corners, hanging on a wall. That
 * detail solves a real problem. A full-bleed dark hero on a light page is a
 * theme inversion, and this page already spends its one permitted inversion on
 * the artisan band further down. An inset panel keeps the page light and puts
 * a dark *object* on it - same look, nothing broken.
 *
 * **The gradient is measured, not guessed.** Sampling the reference across its
 * copy side gives #03225E -> #1A3A7E -> #204EA0 -> #2F5CA8: a dark pocket
 * behind the words, brightening toward the phones, with the glow centred
 * behind them. That maps almost exactly onto tokens this project already owns
 * (`navy-900` is #081F4D), so the panel needs no one-off colours.
 *
 * **Four text elements, which is the cap.** Eyebrow, headline, one line of
 * subtext, two calls to action. No trust strip, no tagline under the buttons,
 * no app-store badges - the reference has badges and this product is a web
 * app, so a badge would be a claim that is not true.
 */
function Hero() {
  return (
    <section className="px-4 pt-4 pb-14 sm:px-6 sm:pb-18">
      <div
        className={cn(
          "relative isolate mx-auto w-full max-w-7xl overflow-hidden rounded-[2rem] sm:rounded-[2.5rem]",
          "bg-linear-to-br from-navy-900 via-navy-800 to-azure-700",
        )}
      >
        {/* A second light source, high and right, so the panel is not a flat
            ramp. Sits behind everything including the phones' own glow. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -right-24 -z-10 size-[42rem] rounded-full bg-azure-500/22 blur-3xl"
        />

        <div className="grid gap-6 px-5 pt-10 pb-8 sm:gap-8 sm:px-10 sm:pt-16 sm:pb-12 lg:grid-cols-[1fr_minmax(0,26rem)] lg:items-center lg:gap-6 lg:pt-16 lg:pb-16 xl:grid-cols-[1fr_minmax(0,30rem)] xl:px-16">
          <div className="max-w-xl">
            <p className="animate-fade-up inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-2xs font-semibold text-white ring-1 ring-white/20 ring-inset">
              <MapPin className="size-3.5" aria-hidden />
              Serving Accra and Tema
            </p>

            <h1
              className="animate-fade-up mt-5 font-space text-title font-bold text-balance text-white sm:text-title-lg xl:text-title-xl"
              style={{ animationDelay: "60ms" }}
            >
              Know who&rsquo;s coming.
              <br />
              <span className="text-azure-200">Know what it costs.</span>
            </h1>

            <p
              className="animate-fade-up mt-5 max-w-md text-lede text-white/75"
              style={{ animationDelay: "120ms" }}
            >
              Every artisan checked against their Ghana Card. Every price agreed before anyone
              travels.
            </p>

            <div
              className="animate-fade-up mt-8 flex flex-col gap-3 sm:flex-row"
              style={{ animationDelay: "180ms" }}
            >
              <Link
                href="/signup"
                className={cn(
                  buttonVariants({ size: "lg", shape: "pill" }),
                  "bg-white text-navy-900 shadow-sm hover:bg-azure-50 sm:w-auto",
                )}
              >
                Book an artisan
                <ArrowRight />
              </Link>
              <a
                href="#for-artisans"
                className={cn(
                  buttonVariants({ size: "lg", shape: "pill" }),
                  "bg-white/12 text-white ring-1 ring-white/25 ring-inset hover:bg-white/20 sm:w-auto",
                )}
              >
                Work as an artisan
              </a>
            </div>
          </div>

          {/* The product, not a picture of the product. */}
          <HeroPhones />
        </div>
      </div>
    </section>
  );
}

function WorkBand() {
  return (
    <section className="relative">
      <Photo
        src={photos.workElectrical}
        alt=""
        sizes="100vw"
        className="h-[20rem] w-full sm:h-[26rem]"
        /* A 4:3 photograph in a 3.5:1 band loses two-thirds of its height, and
           a centred crop spends that budget on blank wall — the hands, the
           fixture and the barred window all sit in the upper third. Pulling the
           crop up to 25% keeps the subject of the photograph in the band. */
        imageClassName="object-[50%_25%]"
      >
        {/* The subject sits right of frame, so the scrim is weighted left and
            the text lands on wall rather than on him. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-navy-950/90 via-navy-950/55 to-navy-950/10"
        />
        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-6xl px-5 pb-9 sm:px-8 sm:pb-12">
            <p className="max-w-xl font-display text-title font-semibold text-balance text-white sm:text-title-lg">
              Real artisans, in real homes, doing work you can inspect before you pay for it.
            </p>
          </div>
        </div>
      </Photo>
    </section>
  );
}

/* ------------------------------------------------------------------------- */

const PROMISES = [
  {
    id: "verified",
    title: "Ghana Card verified",
    body: "Every artisan submits their Ghana Card and a selfie. Our team reviews each one and calls them before approving. Nobody accepts work unverified.",
  },
  {
    id: "priced",
    title: "Price agreed upfront",
    body: "The artisan sends an itemised quote: labour, materials, transport. Nobody travels, and nothing starts, until you have approved it.",
  },
  {
    id: "held",
    title: "Money held until sign-off",
    body: "Your deposit sits with ArtisanGH, not with the artisan. They are paid after you have looked at the work and said it is done.",
  },
];

/** Three claims, set as editorial columns on hairlines. Explicitly not three
 *  cards with icons in rounded squares — that pattern is the single most
 *  recognisable thing about a generated page.
 *
 *  Titles moved up to `title-sm` (22px). They were 17px sitting above 14px
 *  body, which is not a hierarchy, it is a rounding error. */
function Promises() {
  return (
    <section className="border-b border-hairline bg-white">
      {/**
       * Three promises, and deliberately not three equal cards in a row.
       *
       * Two things were wrong with the previous version. It numbered them
       * `01 / 02 / 03`, and a number above a heading is filler: "Ghana Card
       * verified" is already the label, and the reader can count. And three
       * identical columns is the most templated shape on the web - the eye
       * takes it in as one block of texture and reads none of it.
       *
       * So: the first promise is given the width to be read, the other two
       * stack beside it. Same content, a shape that has somewhere to start.
       */}
      <div className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8 sm:py-18">
        <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[1.25fr_1fr]">
          <div className="lg:border-r lg:border-hairline lg:pr-10">
            <h2 className="font-space text-title font-bold text-balance text-navy-900">
              {PROMISES[0].title}
            </h2>
            <p className="mt-3 max-w-md text-lede leading-relaxed text-copy-muted">
              {PROMISES[0].body}
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1 lg:gap-7">
            {PROMISES.slice(1).map(({ id, title, body }) => (
              <div key={id}>
                <h3 className="font-space text-title-sm font-bold text-navy-900">{title}</h3>
                <p className="mt-1.5 text-ui leading-relaxed text-copy-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */

const STEPS = [
  [
    "Describe the job",
    "Pick a service, add photos, record a voice note if it is easier to say out loud.",
  ],
  [
    "We find the nearest artisan",
    "The job goes to the closest available verified artisan. Two minutes to accept, then it moves on.",
  ],
  [
    "Approve the price",
    "An itemised quote: labour, materials, transport. Approve it, decline it, or ask for someone else.",
  ],
  [
    "Pay the deposit",
    "Half the job plus transport, by mobile money. Your artisan is on the way and you can watch them coming.",
  ],
  [
    "Sign off, then pay the balance",
    "Inspect the work while they are still there. Sign off, pay the rest, rate them. Then they get paid.",
  ],
];

/**
 * A numbered timeline, not five cards.
 *
 * Three layouts, because one does not fit. Five columns only survive at `xl`,
 * where each gets ~230px; the previous version ran them from `lg` at ~180px and
 * the result was five columns of cramped four-line paragraphs. Below `xl` it is
 * a two-up grid, and on a phone it becomes a *vertical* timeline — which is the
 * shape a sequence actually wants on a narrow screen, and lets the rule and the
 * dots keep doing their job instead of being dropped.
 */
function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20">
      <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <h2 className="max-w-xl text-title font-semibold text-balance text-navy-900 sm:text-title-lg">
          Five steps, and you decide at every one
        </h2>

        <ol className="relative mt-10 grid gap-y-7 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-9 xl:grid-cols-5 xl:gap-x-6">
          {/* The rule. Vertical on a phone, horizontal at `xl`, absent in the
              two-up middle where there is no single axis to draw along. One
              continuous line rather than one per step — five separate rules
              with gaps between them read as five cards again, which is the
              thing this section exists to avoid. */}
          <span
            aria-hidden
            className="absolute top-2 bottom-2 left-[0.3125rem] w-px bg-hairline sm:hidden"
          />
          <span
            aria-hidden
            className="absolute top-6 left-0 hidden h-px w-full bg-hairline xl:block"
          />

          {STEPS.map(([title, body], i) => (
            <li key={title} className="relative pl-7 sm:pl-0 xl:pt-11">
              {/* The ring is the page ground, so the dot punches a hole in the
                  rule instead of sitting on top of it. */}
              <span
                aria-hidden
                className="absolute top-[0.4375rem] left-0 size-2.5 rounded-full bg-azure-500 ring-4 ring-canvas sm:hidden xl:left-0 xl:block xl:top-[1.1875rem]"
              />
              <span className="font-mono text-2xs tabular text-copy-muted xl:absolute xl:top-0 xl:left-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-1 text-lede font-semibold text-navy-900 xl:mt-0 xl:pr-4">{title}</h3>
              <p className="mt-1.5 text-ui text-copy-muted xl:pr-4">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */

/** 26 trades as a typographic list. The density is the argument.
 *
 *  Two columns from the smallest screen up. As a single column this was 26 full
 *  rows — about a third of the page's mobile height spent on a list nobody
 *  reads linearly. The point of the list is that it is *long*, which you can
 *  see at a glance in two columns and have to scroll to discover in one. */
function Trades() {
  return (
    <section id="services" className="scroll-mt-20 border-y border-hairline bg-white">
      <div className="mx-auto w-full max-w-4xl px-5 py-14 sm:px-8 sm:py-18">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1.5">
          <h2 className="text-title font-semibold text-navy-900 sm:text-title-lg">
            Twenty-six trades
          </h2>
          <p className="text-ui text-copy-muted">If it happens in a Ghanaian home, someone here does it.</p>
        </div>

        <ul className="mt-8 columns-2 gap-x-6 sm:gap-x-10 lg:columns-3">
          {CATEGORIES.map((label, i) => (
            <li
              key={label}
              className="flex items-baseline gap-2.5 break-inside-avoid border-b border-azure-50 py-2 text-note text-navy-900 sm:gap-3 sm:py-2.5 sm:text-ui"
            >
              <span className="font-mono text-2xs tabular text-copy-muted">
                {String(i + 1).padStart(2, "0")}
              </span>
              {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */

/** Docket on the left this time — the hero put it on the right, and repeating
 *  the same side is how a page starts to feel like one template applied twice.
 *
 *  The two figures sit in a `azure-50` well: the first use of the new
 *  recessed tier, and the right one, because these two numbers are a summary
 *  pulled *out* of the docket beside them rather than a new claim. */
function Pricing() {
  return (
    <section>
      <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[24rem_1fr] lg:items-center lg:gap-20">
          <QuoteDocket
            reference="AGH-4471"
            title="Rewiring a fuse board"
            lines={EXAMPLE_LINES}
            breakdown={EXAMPLE}
          />

          <div>
            <h2 className="text-title font-semibold text-balance text-navy-900 sm:text-title-lg">
              The whole price, before anyone moves
            </h2>
            <p className="mt-4 text-lede text-copy-muted">
              No call-out surprises, no &ldquo;we&rsquo;ll see when we get there&rdquo;. The artisan
              sets their price, we add a clear {EXAMPLE.commissionPct}% service fee, and transport
              is charged at the published rate for your distance, all of it on one screen before
              you pay a pesewa.
            </p>

            <dl className="mt-7 grid gap-x-8 gap-y-6 rounded-card bg-azure-50 p-5 sm:grid-cols-2 sm:p-6">
              <div>
                <dt className="text-note text-copy-muted">Pay now, to get them moving</dt>
                <dd className="mt-1 font-mono text-title font-semibold tabular text-navy-900">
                  GHS {formatAmount(EXAMPLE.depositDue)}
                </dd>
                <p className="mt-1.5 text-note text-copy-muted">
                  Half the work plus transport in full, so your artisan is never out of pocket for
                  showing up.
                </p>
              </div>
              <div>
                <dt className="text-note text-copy-muted">Pay after you sign off</dt>
                <dd className="mt-1 font-mono text-title font-semibold tabular text-navy-900">
                  GHS {formatAmount(EXAMPLE.balanceDue)}
                </dd>
                <p className="mt-1.5 text-note text-copy-muted">
                  Due only once you have inspected the work and said you are happy with it.
                </p>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */

/** The one dark band on the page. Charcoal rather than black, and photographic
 *  rather than another grid, so the scroll has somewhere to land before the
 *  footer.
 *
 *  `work-carpentry` replaces `work-electrical`, which has gone up to the
 *  full-bleed band. It is the same register — kneeling at a door jamb, chisel
 *  in hand, shavings on patterned tile — and it is the one photograph in the
 *  library that reads as *craft* rather than *repair*, which is the argument
 *  this section is making to artisans. */
function ForArtisans() {
  const artisanExample = computeQuote({ subtotal: 400, transportFee: 40 });

  return (
    <section id="for-artisans" className="scroll-mt-20 bg-navy-950">
      <div className="mx-auto grid w-full max-w-6xl gap-9 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-16">
        <Photo
          src={photos.workCarpentry}
          alt=""
          sizes="(min-width: 1024px) 40rem, 100vw"
          className="aspect-[4/3] rounded-card"
          placeholderClassName="img-slot-dark"
        />

        <div>
          <h2 className="text-title font-semibold text-balance text-white sm:text-title-lg">
            Good work deserves steady work
          </h2>
          <p className="mt-4 text-lede text-hairline">
            Job offers from clients near you. No chasing, no haggling, no waiting weeks to be
            paid. You set what the job is worth; our fee sits on top for the client rather than
            coming out of your quote.
          </p>

          {/* The recruitment argument is a number, so it is set as one. */}
          <dl className="mt-7 divide-y divide-white/10 border-y border-white/10">
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-ui text-hairline">You quote</dt>
              <dd className="font-mono text-ui tabular text-white">
                GHS {formatAmount(artisanExample.subtotal)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-ui text-hairline">Transport, passed to you whole</dt>
              <dd className="font-mono text-ui tabular text-white">
                GHS {formatAmount(artisanExample.transportFee)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-ui font-medium text-white">You receive</dt>
              <dd className="font-mono text-lede font-semibold tabular text-azure-400">
                GHS {formatAmount(artisanExample.providerPayout)}
              </dd>
            </div>
          </dl>

          <div className="mt-7">
            <Link href="/signup" className="inline-block">
              <Button size="lg" variant="money">
                Apply as an artisan
                <ArrowRight />
              </Button>
            </Link>
            <p className="mt-3 text-note text-copy-muted">
              You will need your Ghana Card and a selfie. Approval usually takes a day or two.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */

function SiteFooter() {
  return (
    <footer className="border-t border-hairline bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-9 sm:flex-row sm:items-center sm:px-8">
        <div className="space-y-2">
          <Link href="/" className="inline-flex min-h-11 items-center rounded-field">
            <Logo />
          </Link>
          <p className="text-note text-copy-muted">Verified home services for Accra and Tema.</p>
        </div>

        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-ui text-copy-muted sm:ml-auto">
          <a href="#how-it-works" className="tap transition-colors hover:text-navy-900">
            How it works
          </a>
          <a href="#services" className="tap transition-colors hover:text-navy-900">
            Services
          </a>
          <a href="#for-artisans" className="tap transition-colors hover:text-navy-900">
            For artisans
          </a>
          <Link href="/legal/terms" className="tap transition-colors hover:text-navy-900">
            Terms
          </Link>
          <Link href="/legal/privacy" className="tap transition-colors hover:text-navy-900">
            Privacy
          </Link>
          <Link href="/login" className="tap transition-colors hover:text-navy-900">
            Log in
          </Link>
        </nav>
      </div>

      <div className="border-t border-azure-50">
        <p className="mx-auto w-full max-w-6xl px-5 py-5 text-2xs text-copy-muted sm:px-8">
          © {new Date().getFullYear()} ArtisanGH. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
