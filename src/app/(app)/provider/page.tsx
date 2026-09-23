import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  MapPin,
  TrendingUp,
  User,
} from "lucide-react";

import { AvailabilityToggle } from "@/components/provider/availability-toggle";
import { CategoryIcon } from "@/components/marketplace/category-icon";
import { FieldLabel } from "@/components/mobile/field-label";
import { IncomingOffer } from "@/components/provider/incoming-offer";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { LiveJobCard } from "@/components/jobs/live-job-card";
import { PerformancePanel } from "@/components/provider/performance-panel";
import { ProviderHero } from "@/components/provider/provider-hero";
import { VerificationPanel } from "@/components/provider/verification-panel";
import { formatCedis } from "@/lib/money";
import { getLiveOffer, listProviderJobs } from "@/lib/jobs/matching";
import { isLiveJob, jobStatus } from "@/lib/jobs/status";
import { photos } from "@/lib/images";
import {
  getMyProvider,
  getMyReliability,
  listMyPayouts,
  listProviderCategories,
  listProviderDocuments,
  listVerificationReviews,
  summarisePayouts,
} from "@/lib/providers/queries";
import { getCurrentProfile } from "@/lib/supabase/server";
import { cn, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Today" };

/**
 * The artisan's dashboard, built to `designing-ui-ux/artisan/artisan dasboard.png`.
 *
 * **The order changes with state rather than being one compromise.** An offer
 * outranks everything — it is the only object in the app with a clock on it. An
 * approved artisan came to go online, so the toggle is the hero and
 * verification drops to a footnote. An unverified one cannot go online at all,
 * so verification leads and the toggle sits underneath as the thing being
 * worked towards. The two audiences never overlap, so a fork is cheaper than a
 * compromise.
 *
 * **Three things the reference draws that are not here, and why:**
 *
 *  • **"My Wallet — withdraw earnings".** Not a design decision. PLAN.md §137
 *    and §141: Bank of Ghana treats creating and managing a wallet as E-Money
 *    Issuer activity, which carries a **GHS 25m minimum capital requirement**,
 *    and the plan's rule is explicit — *never show a user-facing wallet
 *    balance, no stored credit, no top-ups*. ArtisanGH sits in the PSP lane:
 *    money moves per job, straight to the artisan's own Mobile Money, and there
 *    is nothing to withdraw because nothing is ever held. The card is
 *    **Earnings** instead, which is the same destination told truthfully.
 *  • **A "Messages" tab with an unread dot.** §14 — there is no in-app
 *    messaging.
 *  • **A "Discover" tab.** An artisan discovers nothing; work is offered to
 *    them by the matcher. Two tabs that open nothing are worse than four that
 *    do, so the bar carries Today, Jobs, Earnings and Account.
 *
 * **The three quick cards carry live numbers**, unlike the reference's, where
 * they are pure navigation duplicating its own tab bar. A card that says
 * "2 on now" or "GHS 460 on the way" is a status row that happens to be
 * tappable, which earns the space twice over.
 */
export default async function ProviderDashboard({ searchParams }: PageProps<"/provider">) {
  const [profile, provider, params] = await Promise.all([
    getCurrentProfile(),
    getMyProvider(),
    searchParams,
  ]);

  if (!profile) redirect("/login");

  // An admin or client that reached /provider without a provider row. The proxy
  // normally prevents this; a Server Component must never assume it ran.
  if (!provider) redirect("/");

  const [trades, documents, reviews, liveOffer, jobs, reliability, payouts] = await Promise.all([
    listProviderCategories(provider.profile_id),
    listProviderDocuments(provider.profile_id),
    listVerificationReviews(provider.profile_id),
    getLiveOffer(),
    listProviderJobs(),
    getMyReliability(),
    listMyPayouts(),
  ]);

  const status = provider.verification_status;
  const approved = status === "approved";
  const earnings = summarisePayouts(payouts);

  const activeJobs = jobs.filter((job) => jobStatus(job.status).group === "active");

  /**
   * The job to lead with. `listProviderJobs` orders by `updated_at`, so this is
   * whatever moved most recently — which for work in hand is the one that needs
   * them next.
   */
  const liveJob = activeJobs.find((job) => isLiveJob(job.status)) ?? null;
  const firstName = profile.full_name.split(" ")[0];
  const justSubmitted = params.submitted === "1" && status === "pending";

  const verification = (
    <VerificationPanel
      provider={provider}
      tradeCount={trades.length}
      docTypes={documents.map((doc) => doc.doc_type)}
      latestReview={reviews[0] ?? null}
    />
  );

  const availability = (
    <AvailabilityToggle
      availability={provider.availability}
      canGoOnline={approved}
      blockedReason={
        status === "pending"
          ? "You can go online once our team has approved you."
          : status === "suspended"
            ? "Your account is suspended, so you will not receive offers."
            : "Finish getting verified to start receiving jobs."
      }
    />
  );

  return (
    <div className="space-y-5 pb-28">
      <ProviderHero
        greeting={greetingFor(new Date())}
        name={firstName}
        blurb={
          approved
            ? "Keep up the good work. Here is where you stand today."
            : "Finish getting verified and jobs near you start coming through."
        }
        city={provider.base_city}
        radiusKm={provider.service_radius_km}
        activeCount={activeJobs.length}
        heroSrc={photos.providerHero}
      >
        {availability}
      </ProviderHero>

      {/* Shown once, on the redirect that follows submitting. Not a toast: the
          artisan has just navigated, and a message that disappears after four
          seconds is the wrong medium for "we have your application". */}
      {justSubmitted && (
        <div className="animate-fade-up flex items-start gap-3 rounded-[1.25rem] border border-success-500/35 bg-success-50 px-4 py-3.5">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-700" aria-hidden />
          <div className="space-y-0.5">
            <p className="text-note font-semibold text-success-700">Application sent</p>
            <p className="text-note leading-relaxed text-navy-900/80">
              Our team will review your documents and call you on{" "}
              <span className="tabular font-mono">{profile.phone}</span>. You will see the result
              on this screen.
            </p>
          </div>
        </div>
      )}

      {/* Above everything, including the availability toggle. An offer has a
          clock on it; nothing else on this screen does. */}
      <IncomingOffer
        offer={
          liveOffer && liveOffer.job
            ? {
                id: liveOffer.id,
                expiresAt: liveOffer.expires_at,
                sentAt: liveOffer.sent_at,
                distanceKm: liveOffer.distance_km === null ? null : Number(liveOffer.distance_km),
                categoryName: liveOffer.job.category?.name ?? "Job",
                categoryIcon: liveOffer.job.category?.icon ?? "wrench",
                landmark: liveOffer.job.landmark,
              }
            : null
        }
        listening={approved && provider.availability === "online"}
      />

      {!approved && verification}

      {approved && (
        <>
          {/**
           * Work in hand outranks money earned.
           *
           * An artisan standing outside somebody's gate does not need this
           * week's total; they need the job and the next button on it. When
           * nothing is live the question flips — *was switching on worth it* —
           * and the earnings banner is the answer. The two never both matter
           * most, so they share the slot rather than stacking.
           *
           * Earnings is not lost either way: the quick-card row below carries
           * it, with the amount on its way.
           */}
          {liveJob ? (
            <LiveJobCard
              href={`/provider/jobs/${liveJob.id}`}
              eyebrow={jobStatus(liveJob.status).label}
              title={liveJob.category?.name ?? "Your job"}
              subtitle={liveJob.landmark}
              status={liveJob.status}
              // No person: the artisan already knows whose house it is, and the
              // client's name is not what they need at a glance. What they need
              // is the next thing to do.
              action={jobStatus(liveJob.status).providerBlurb}
            />
          ) : (
            <EarningsBanner week={earnings.thisWeek} />
          )}

          <div className="grid grid-cols-3 items-stretch gap-2.5">
            <QuickCard
              href="/provider/jobs"
              icon={<ClipboardList />}
              title="My jobs"
              detail={activeJobs.length > 0 ? `${activeJobs.length} on now` : "Nothing on"}
            />
            <QuickCard
              href="/provider/earnings"
              icon={<Banknote />}
              title="Earnings"
              detail={
                earnings.onTheWay > 0 ? `${formatCedis(earnings.onTheWay)} coming` : "View payouts"
              }
            />
            <QuickCard
              href="/provider/account"
              icon={<User />}
              title="Profile"
              detail={
                trades.length > 0
                  ? `${trades.length} trade${trades.length === 1 ? "" : "s"}`
                  : "No trades yet"
              }
            />
          </div>
        </>
      )}

      {activeJobs.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-space text-title-sm font-bold text-navy-900">Today&rsquo;s jobs</h2>
            <Link
              href="/provider/jobs"
              className="tap text-note font-semibold text-azure-600 underline-offset-4 hover:underline"
            >
              View all
            </Link>
          </div>

          <ul className="space-y-2.5">
            {activeJobs.slice(0, 3).map((job) => {
              const presentation = jobStatus(job.status);

              return (
                <li key={job.id}>
                  <Link
                    href={`/provider/jobs/${job.id}`}
                    className={cn(
                      // Soft shadow only, and room to breathe — the brief's
                      // rule 6. The old card was bordered and compressed.
                      "group block rounded-[1.25rem] bg-white p-5",
                      "shadow-[var(--shadow-float)]",
                      "transition-[box-shadow,border-color,transform] duration-[var(--duration-fast)] ease-out-strong",
                      "hover:-translate-y-0.5 hover:shadow-[var(--shadow-sheet)] active:translate-y-0",
                    )}
                  >
                    <div className="flex items-start gap-3.5">
                      <span className="grid size-14 shrink-0 place-items-center rounded-[1.125rem] bg-azure-50 text-navy-800 [&_svg]:size-7">
                        <CategoryIcon name={job.category?.icon ?? "wrench"} />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <h3 className="truncate font-space text-note font-bold text-navy-900">
                            {job.category?.name ?? "Job"}
                          </h3>
                          <JobStatusBadge status={job.status} />
                        </div>

                        <p className="mt-1.5 line-clamp-2 text-ui leading-relaxed text-copy-muted">
                          {presentation.providerBlurb ?? presentation.label}
                        </p>

                        {/* The landmark gets the full width; the pill sits
                            beside the *time* only. Sharing one row with the
                            pill truncated "Blue gate opposite the pharmacy" to
                            "Blue gate oppos…", and the landmark is the line an
                            artisan navigates by. */}
                        {job.landmark && (
                          <p className="mt-2.5 flex items-center gap-1.5 text-note text-copy-muted">
                            <MapPin className="size-3.5 shrink-0" aria-hidden />
                            <span className="truncate">{job.landmark}</span>
                          </p>
                        )}

                        <div className="mt-1.5 flex items-center justify-between gap-3">
                          <p className="flex shrink-0 items-center gap-1.5 text-note text-copy-muted">
                            <Clock className="size-3.5 shrink-0" aria-hidden />
                            {timeAgo(job.updated_at)}
                          </p>

                          {/* Not a nested link — the whole card already
                              navigates, and an anchor inside an anchor is
                              invalid markup that swallows the card's target. */}
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-azure-50 px-3.5 py-2 text-note font-semibold text-azure-700 transition-colors duration-[var(--duration-fast)] group-hover:bg-azure-100">
                            View details
                            <ChevronRight className="size-3.5" aria-hidden />
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Only once approved: an artisan still waiting on their Ghana Card review
          has no record to have a performance panel about, and a row of dashes
          reads as a problem with them. */}
      {approved && (
        <section className="space-y-3">
          <h2 className="font-space text-title-sm font-bold text-navy-900">Your performance</h2>
          <PerformancePanel
            ratingAvg={provider.rating_avg}
            ratingCount={provider.rating_count}
            jobsCompleted={provider.jobs_completed}
            verification={status}
            reliability={reliability}
          />
        </section>
      )}

      {/**
       * The reference's "grow your business" panel, shown only when it is true.
       *
       * Its copy — *get discovered by more customers* — describes a marketplace
       * this is not: clients never browse artisans, the matcher assigns them.
       * What genuinely decides how much work reaches someone is how many trades
       * they cover, because that is the filter the matcher runs. So the card
       * says that, and appears only while it is actionable. A permanent promo
       * panel is furniture.
       */}
      {approved && trades.length > 0 && trades.length <= 2 && (
        <Link
          href="/provider/apply/trades"
          className="relative isolate block overflow-hidden rounded-[1.75rem] bg-linear-to-r from-navy-900 via-navy-800 to-azure-600 p-6 shadow-[var(--shadow-glow-navy-lg)] transition-transform duration-[var(--duration-fast)] ease-out-strong hover:-translate-y-0.5 active:translate-y-0"
        >
          {/* The lighter wash the reference puts behind its illustration. It
              stays whether or not a 3D render ever lands, so the right-hand
              side is never dead space. */}
          <span
            aria-hidden
            className="absolute -top-8 -right-12 -z-10 size-44 rounded-full bg-azure-300/45 blur-2xl"
          />

          <FieldLabel className="text-white/65">Grow your business</FieldLabel>
          {/* `pr-28` holds the right third clear for the illustration the
              reference puts there. The wash below fills it until a render
              exists, so the card never reads as half-empty. */}
          <p className="mt-2 pr-24 font-space text-title-sm leading-tight font-bold text-balance text-white">
            Cover more trades
          </p>
          <p className="mt-1.5 max-w-[15rem] pr-20 text-note leading-snug text-white/80">
            Jobs only reach artisans who cover the trade.
          </p>
          <span className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-5 text-note font-bold text-navy-900">
            Add trades
            <ArrowUpRight className="size-4" aria-hidden />
          </span>
        </Link>
      )}

      {/* Approved artisans get verification as a quiet footnote rather than a
          panel — it is settled, and repeating it above the fold every day
          suggests it might not be. */}
      {approved && <div className="opacity-90">{verification}</div>}
    </div>
  );
}

/**
 * Good morning / afternoon / evening, in **Accra time**.
 *
 * Ghana is UTC+0 year round with no DST, so the server's UTC hour *is* the
 * artisan's local hour. Written out rather than left implicit because it is
 * only true for this market, and a deploy region change would not make it
 * false — but a second market would.
 */
function greetingFor(now: Date): string {
  const hour = now.getUTCHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** This week's money, as the reference's navy banner. */
function EarningsBanner({ week }: { week: number }) {
  return (
    <Link
      href="/provider/earnings"
      className={cn(
        // `flex` is load-bearing, not decoration: `Link` renders an `<a>`,
        // which is `display: inline` by default. A rewrite of this class list
        // once dropped it, and an inline box paints its background only behind
        // its text fragments — the gradient was set the whole time and the
        // banner rendered as three navy smears with the content stacked.
        "flex items-center gap-4",
        // 26px and a lit surface, per the brief: a flat navy fill reads as a
        // block of colour, so a soft highlight sits over the gradient at the
        // top-left and falls away — the "internal lighting" the reference has.
        "relative isolate overflow-hidden rounded-[1.625rem] p-5",
        "bg-linear-to-br from-navy-700 via-navy-800 to-navy-900",
        "shadow-[var(--shadow-glow-navy-lg)]",
        "transition-transform duration-[var(--duration-fast)] ease-out-strong",
        "hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]",
      )}
    >
      <span
        aria-hidden
        className="absolute -top-16 -left-10 -z-10 size-48 rounded-full bg-azure-400/25 blur-3xl"
      />

      <span
        aria-hidden
        className="grid size-11 shrink-0 place-items-center rounded-full bg-white/12 text-white"
      >
        <TrendingUp className="size-5" />
      </span>

      {/* `min-w-0` plus nowrap on both lines: at 360px the middle column is
          about 150px, and without these the eyebrow broke across two lines and
          "GHS 1,320.00" wrapped mid-figure. The number is the point of this
          banner — it is the one thing here allowed to push the pill. */}
      <span className="min-w-0 flex-1">
        <FieldLabel className="whitespace-nowrap text-white/60">Earnings this week</FieldLabel>
        <span className="tabular mt-1 block truncate font-mono text-title-sm leading-none font-bold text-white">
          {formatCedis(week)}
        </span>
      </span>

      <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-white/15 px-3 py-2 text-2xs font-semibold whitespace-nowrap text-white">
        Details
        <ChevronRight className="size-3.5" aria-hidden />
      </span>
    </Link>
  );
}

function QuickCard({
  href,
  icon,
  title,
  detail,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        // No border. The brief is explicit that outlining every surface is what
        // made the first build read flat — these are lifted by shadow instead.
        "flex h-full flex-col gap-2.5 rounded-[1.375rem] bg-white p-4",
        "shadow-[var(--shadow-float)]",
        "transition-[box-shadow,transform] duration-[var(--duration-fast)] ease-out-strong",
        "hover:-translate-y-0.5 hover:shadow-[var(--shadow-sheet)]",
        "active:translate-y-0 active:scale-[0.97]",
      )}
    >
      <span className="flex items-start justify-between gap-1">
        <span
          aria-hidden
          className="grid size-11 place-items-center rounded-full bg-linear-to-b from-navy-800 to-navy-900 text-white [&_svg]:size-5"
        >
          {icon}
        </span>
        {/* Opposite the icon rather than beside the text: at a third of a
            360px screen there is no room for a chevron next to "GHS 1,320.00
            coming" without squeezing the figure. */}
        <ChevronRight className="mt-1 size-4 shrink-0 text-azure-400" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-note font-bold text-navy-900">{title}</span>
        {/* Wraps rather than truncates. At a third of a 360px screen
            "GHS 1,320.00 coming" does not fit on one line, and truncating it
            to "GHS 1,320.0…" turns the only number on the card into a
            half-read figure — worse than two lines. */}
        <span className="mt-0.5 block line-clamp-2 text-2xs leading-tight text-copy-muted">
          {detail}
        </span>
      </span>
    </Link>
  );
}
