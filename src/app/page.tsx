import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { ArtisanCard } from "@/components/marketplace/artisan-card";
import { QuoteDocket } from "@/components/marketplace/quote-docket";
import { Button } from "@/components/ui/button";
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
 * Two structural rules kept throughout, because breaking them is what made the
 * first version read as a template:
 *   1. No two adjacent sections share a container width.
 *   2. At most one card grid on the whole page. The 26 trades are a typographic
 *      list — the list itself is the proof of breadth, and it reads faster.
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
    <header className="sticky top-0 z-30 border-b border-ink-200/60 bg-ink-25/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-5 sm:px-8">
        <Link href="/" className="rounded-field">
          <Logo />
        </Link>

        <nav className="ml-auto hidden items-center gap-7 text-sm text-ink-600 md:flex">
          <a href="#how-it-works" className="transition-colors hover:text-ink-900">
            How it works
          </a>
          <a href="#services" className="transition-colors hover:text-ink-900">
            Services
          </a>
          <a href="#for-artisans" className="transition-colors hover:text-ink-900">
            For artisans
          </a>
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Log in
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">Get started</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* A single hairline grid, barely visible, so the warm paper reads as a
          surface rather than as a blank. It is not a gradient and it is not
          decoration for its own sake — it gives the floating cards something to
          sit on. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.45] [background-image:linear-gradient(var(--color-ink-200)_1px,transparent_1px),linear-gradient(90deg,var(--color-ink-200)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:radial-gradient(80%_60%_at_50%_0%,black,transparent)]"
      />

      {/* The right column narrows between 1024 and 1280 rather than the
          headline wrapping. "Know who's coming." breaking across two lines is
          the difference between a statement and a paragraph. */}
      <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-5 pt-14 pb-16 sm:px-8 sm:pt-20 lg:grid-cols-[1fr_21rem] lg:items-center lg:gap-12 lg:pb-24 xl:grid-cols-[1fr_25rem] xl:gap-16">
        <div>
          <p className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-ink-300 bg-ink-0 px-3 py-1 text-xs font-medium text-ink-700">
            <MapPin className="size-3.5 text-brand-600" />
            Now serving Accra and Tema
          </p>

          <h1
            className="animate-fade-up mt-6 text-[2.5rem] leading-[0.98] font-bold text-balance text-ink-900 sm:text-[3.75rem]"
            style={{ animationDelay: "60ms" }}
          >
            Know who&rsquo;s coming.
            <br />
            <span className="text-brand-700">Know what it costs.</span>
          </h1>

          <p
            className="animate-fade-up mt-6 max-w-lg text-lg leading-relaxed text-ink-600"
            style={{ animationDelay: "120ms" }}
          >
            Electricians, plumbers, carpenters and 22 other trades across Accra and Tema. Every
            artisan checked against their Ghana Card. Every price agreed before anyone travels.
          </p>

          <div
            className="animate-fade-up mt-9 flex flex-col gap-3 sm:flex-row"
            style={{ animationDelay: "180ms" }}
          >
            <Link href="/signup">
              <Button size="lg" block className="sm:w-auto">
                Book an artisan
                <ArrowRight />
              </Button>
            </Link>
            <a href="#for-artisans">
              <Button size="lg" variant="secondary" block className="sm:w-auto">
                Work as an artisan
              </Button>
            </a>
          </div>
        </div>

        {/* The hero object. Not an illustration of the product — the product. */}
        <div
          className="animate-fade-up relative mx-auto w-full max-w-[24rem] lg:mx-0"
          style={{ animationDelay: "240ms" }}
        >
          <ArtisanCard
            elevated
            priority
            name="Kwame Mensah"
            trade="Electrician"
            baseCity="Osu"
            avatarUrl={photos.artisanKwame}
            verification="approved"
            availability="online"
            ratingAvg={4.9}
            ratingCount={128}
            jobsCompleted={214}
            distanceKm={2.1}
            className="lg:mr-8"
          />

          <QuoteDocket
            elevated
            className="relative z-10 mt-4 lg:-mt-3 lg:ml-8"
            reference="AGH-4471"
            title="Quote · fuse board"
            showDeposit={false}
            lines={EXAMPLE_LINES}
            breakdown={EXAMPLE}
          />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */

/** Full-bleed. Deliberately the widest thing on the page, right after the
 *  narrowest — the change in width is what stops the scroll feeling uniform. */
function WorkBand() {
  return (
    <section className="relative">
      <Photo
        src={photos.heroWide}
        alt=""
        sizes="100vw"
        className="h-[22rem] w-full sm:h-[26rem]"
      >
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-ink-975/85 via-ink-975/45 to-transparent"
        />
        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-6xl px-5 pb-10 sm:px-8 sm:pb-14">
            <p className="max-w-lg font-display text-2xl leading-snug font-semibold text-balance text-white sm:text-3xl">
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
    k: "01",
    title: "Ghana Card verified",
    body: "Every artisan submits their Ghana Card and a selfie. Our team reviews each one and calls them before approving. Nobody accepts work unverified.",
  },
  {
    k: "02",
    title: "Price agreed upfront",
    body: "The artisan sends an itemised quote — labour, materials, transport. Nobody travels, and nothing starts, until you have approved it.",
  },
  {
    k: "03",
    title: "Money held until sign-off",
    body: "Your deposit sits with ArtisanGH, not with the artisan. They are paid after you have looked at the work and said it is done.",
  },
];

/** Three claims, set as editorial columns on hairlines. Explicitly not three
 *  cards with icons in rounded squares — that pattern is the single most
 *  recognisable thing about a generated page. */
function Promises() {
  return (
    <section className="border-b border-ink-200 bg-ink-0">
      <div className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="grid gap-px bg-ink-200 sm:grid-cols-3">
          {PROMISES.map(({ k, title, body }) => (
            <div key={k} className="bg-ink-0 sm:px-6 sm:first:pl-0 sm:last:pr-0">
              <span className="font-mono text-xs tabular text-brand-600">{k}</span>
              <h2 className="mt-2 text-[1.0625rem] font-semibold text-ink-900">{title}</h2>
              <p className="mt-2 pb-6 text-sm leading-relaxed text-ink-600 sm:pb-0">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */

const STEPS = [
  ["Describe the job", "Pick a service, add photos, record a voice note if it is easier to say out loud."],
  ["We find the nearest artisan", "The job goes to the closest available verified artisan. Two minutes to accept, then it moves on."],
  ["Approve the price", "An itemised quote — labour, materials, transport. Approve it, decline it, or ask for someone else."],
  ["Pay the deposit", "Half the job plus transport, by mobile money. Your artisan is on the way and you can watch them coming."],
  ["Sign off, then pay the balance", "Inspect the work while they are still there. Sign off, pay the rest, rate them. Then they get paid."],
];

/** A numbered timeline on a rule, not five cards. */
function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <h2 className="max-w-xl text-3xl font-semibold text-balance text-ink-900 sm:text-4xl">
          Five steps, and you decide at every one
        </h2>

        <ol className="relative mt-12 grid gap-y-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-x-6">
          {/* One continuous rule across all five, rather than one per step —
              five separate rules with gaps between them read as five cards
              again, which is the thing this section exists to avoid. Absolutely
              positioned, so it takes no grid cell. Desktop only: stacked on
              mobile it would be a line to nowhere. */}
          <span
            aria-hidden
            className="absolute top-6 left-0 hidden h-px w-full bg-ink-200 lg:block"
          />

          {STEPS.map(([title, body], i) => (
            <li key={title} className="relative lg:pt-11">
              <span className="font-mono text-xs tabular text-ink-400 lg:absolute lg:top-0 lg:left-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              {/* The ring is the page ground, so the dot punches a hole in the
                  rule instead of sitting on top of it. */}
              <span
                aria-hidden
                className="absolute top-[1.1875rem] left-0 hidden size-2.5 rounded-full bg-brand-600 ring-4 ring-ink-25 lg:block"
              />
              <h3 className="mt-2 text-base leading-snug font-semibold text-ink-900 lg:mt-0 lg:pr-4">
                {title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600 lg:pr-4">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */

/** 26 trades as a typographic list. The density is the argument. */
function Trades() {
  return (
    <section id="services" className="scroll-mt-20 border-y border-ink-200 bg-ink-0">
      <div className="mx-auto w-full max-w-4xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 className="text-3xl font-semibold text-ink-900 sm:text-4xl">Twenty-six trades</h2>
          <p className="text-ink-600">If it happens in a Ghanaian home, someone here does it.</p>
        </div>

        <ul className="mt-10 columns-1 gap-x-10 sm:columns-2 lg:columns-3">
          {CATEGORIES.map((label, i) => (
            <li
              key={label}
              className="flex items-baseline gap-3 break-inside-avoid border-b border-ink-100 py-2.5 text-[0.9375rem] text-ink-800"
            >
              <span className="font-mono text-[0.6875rem] tabular text-ink-400">
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
 *  the same side is how a page starts to feel like one template applied twice. */
function Pricing() {
  return (
    <section>
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-[24rem_1fr] lg:items-center lg:gap-20">
          <QuoteDocket
            reference="AGH-4471"
            title="Rewiring a fuse board"
            lines={EXAMPLE_LINES}
            breakdown={EXAMPLE}
          />

          <div>
            <h2 className="text-3xl font-semibold text-balance text-ink-900 sm:text-4xl">
              The whole price, before anyone moves
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-ink-600">
              No call-out surprises, no &ldquo;we&rsquo;ll see when we get there&rdquo;. The artisan
              sets their price, we add a clear {EXAMPLE.commissionPct}% service fee, and transport
              is charged at the published rate for your distance — all of it on one screen before
              you pay a pesewa.
            </p>

            <dl className="mt-8 grid gap-x-10 gap-y-5 sm:grid-cols-2">
              <div className="border-t border-ink-300 pt-3">
                <dt className="text-sm text-ink-600">Pay now, to get them moving</dt>
                <dd className="mt-1 font-mono text-2xl font-semibold tabular text-ink-900">
                  GHS {formatAmount(EXAMPLE.depositDue)}
                </dd>
                <p className="mt-1 text-sm text-ink-500">
                  Half the work plus transport in full, so your artisan is never out of pocket for
                  showing up.
                </p>
              </div>
              <div className="border-t border-ink-300 pt-3">
                <dt className="text-sm text-ink-600">Pay after you sign off</dt>
                <dd className="mt-1 font-mono text-2xl font-semibold tabular text-ink-900">
                  GHS {formatAmount(EXAMPLE.balanceDue)}
                </dd>
                <p className="mt-1 text-sm text-ink-500">
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
 *  footer. */
function ForArtisans() {
  const artisanExample = computeQuote({ subtotal: 400, transportFee: 40 });

  return (
    <section id="for-artisans" className="scroll-mt-20 bg-ink-975">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-2 lg:items-center lg:gap-16">
        <Photo
          src={photos.workElectrical}
          alt=""
          sizes="(min-width: 1024px) 40rem, 100vw"
          className="aspect-[4/3] rounded-card"
          placeholderClassName="img-slot-dark"
        />

        <div>
          <h2 className="text-3xl font-semibold text-balance text-white sm:text-4xl">
            Good work deserves steady work
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-ink-300">
            Job offers from clients near you — no chasing, no haggling, no waiting weeks to be
            paid. You set what the job is worth; our fee sits on top for the client rather than
            coming out of your quote.
          </p>

          {/* The recruitment argument is a number, so it is set as one. */}
          <dl className="mt-8 divide-y divide-white/10 border-y border-white/10">
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-sm text-ink-300">You quote</dt>
              <dd className="font-mono text-sm tabular text-white">
                GHS {formatAmount(artisanExample.subtotal)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-sm text-ink-300">Transport, passed to you whole</dt>
              <dd className="font-mono text-sm tabular text-white">
                GHS {formatAmount(artisanExample.transportFee)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-sm font-medium text-white">You receive</dt>
              <dd className="font-mono text-base font-semibold tabular text-accent-400">
                GHS {formatAmount(artisanExample.providerPayout)}
              </dd>
            </div>
          </dl>

          <div className="mt-8">
            <Link href="/signup" className="inline-block">
              <Button size="lg" variant="money">
                Apply as an artisan
                <ArrowRight />
              </Button>
            </Link>
            <p className="mt-3 text-sm text-ink-400">
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
    <footer className="border-t border-ink-200 bg-ink-0">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:px-8">
        <div className="space-y-2">
          <Logo />
          <p className="text-sm text-ink-500">Verified home services for Accra and Tema.</p>
        </div>

        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-500 sm:ml-auto">
          <a href="#how-it-works" className="transition-colors hover:text-ink-900">
            How it works
          </a>
          <a href="#services" className="transition-colors hover:text-ink-900">
            Services
          </a>
          <a href="#for-artisans" className="transition-colors hover:text-ink-900">
            For artisans
          </a>
          <Link href="/legal/terms" className="transition-colors hover:text-ink-900">
            Terms
          </Link>
          <Link href="/legal/privacy" className="transition-colors hover:text-ink-900">
            Privacy
          </Link>
          <Link href="/login" className="transition-colors hover:text-ink-900">
            Log in
          </Link>
        </nav>
      </div>

      <div className="border-t border-ink-100">
        <p className="mx-auto w-full max-w-6xl px-5 py-5 text-xs text-ink-400 sm:px-8">
          © {new Date().getFullYear()} ArtisanGH. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
