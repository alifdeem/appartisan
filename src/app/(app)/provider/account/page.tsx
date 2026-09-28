import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BadgeCheck,
  Briefcase,
  CheckCheck,
  FileText,
  LogOut,
  MapPin,
  Phone,
  ShieldCheck,
  Star,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/components/marketplace/category-icon";
import { FieldLabel } from "@/components/mobile/field-label";
import { formatPhoneForDisplay } from "@/lib/phone";
import { getCurrentProfile } from "@/lib/supabase/server";
import { getMyProvider, listProviderCategories } from "@/lib/providers/queries";
import { signOutAction } from "@/app/(auth)/actions";
import { cn } from "@/lib/utils";
import type { VerificationStatus } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Account" };

/**
 * Typed by `VerificationStatus`, not `string`, so a status added to the enum is
 * a compile error here rather than a blank badge in production. The first
 * version keyed this on `string` and carried an "unverified" entry — a status
 * that has never existed — while missing `unsubmitted`, which is the one every
 * new artisan actually starts on.
 */
const VERIFICATION_COPY: Record<
  VerificationStatus,
  { label: string; tone: "good" | "wait" | "bad" }
> = {
  unsubmitted: { label: "Application not sent", tone: "wait" },
  pending: { label: "Verification in review", tone: "wait" },
  approved: { label: "Verified artisan", tone: "good" },
  rejected: { label: "Verification declined", tone: "bad" },
  suspended: { label: "Account suspended", tone: "bad" },
};

/**
 * The artisan's account.
 *
 * Same band-and-sheet shape as the client's, deliberately — an artisan who also
 * books work should not meet two different account screens. What is *in* it is
 * entirely different, because an artisan's account is their standing on the
 * platform rather than a settings list: the verification badge, the trades they
 * are offered work for, where they work, and where their money goes.
 *
 * **The band carries the verification state**, because that is the single fact
 * that decides whether this person can earn at all. On the client's screen the
 * equivalent slot carries their phone number, which is the most important thing
 * about *that* account.
 *
 * **Trades are shown but not edited here.** Changing what work you are offered
 * is re-applying, not a settings toggle: `saveTradesAction` belongs to the
 * application flow and its own review. The row links there rather than
 * pretending to be an editor.
 */
export default async function ProviderAccountPage() {
  const [profile, provider] = await Promise.all([getCurrentProfile(), getMyProvider()]);
  if (!profile) redirect("/login");
  if (!provider) redirect("/");

  const trades = await listProviderCategories(provider.profile_id);
  const verification = VERIFICATION_COPY[provider.verification_status];

  const initials = profile.full_name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="pb-28">
      {/* ---- The navy band ---------------------------------------------- */}
      <header className="-mx-5 -mt-6 bg-linear-to-b from-navy-800 to-navy-900 px-5 pt-8 pb-14">
        <h1 className="sr-only">Account</h1>

        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className="grid size-16 shrink-0 place-items-center rounded-full bg-white/12 font-space text-lede font-bold text-white ring-2 ring-white/25"
          >
            {initials}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate font-space text-title-sm font-bold text-white">
              {profile.full_name}
            </p>

            <p
              className={cn(
                "mt-1.5 inline-flex items-center gap-1.5 rounded-full py-1 pr-3 pl-2 text-2xs font-semibold",
                verification.tone === "good" && "bg-success-500/20 text-success-50",
                verification.tone === "wait" && "bg-white/15 text-white/85",
                verification.tone === "bad" && "bg-danger-500/25 text-danger-50",
              )}
            >
              <BadgeCheck className="size-3.5" aria-hidden />
              {verification.label}
            </p>
          </div>
        </div>

        {/* The two numbers that are this artisan's standing. Only once the
            rating means something — see the note on the dashboard. */}
        <div className="mt-6 flex gap-3">
          <BandStat
            label="Jobs done"
            value={String(provider.jobs_completed)}
            icon={<CheckCheck className="size-4" />}
          />
          <BandStat
            label="Rating"
            value={provider.rating_count >= 3 ? provider.rating_avg.toFixed(1) : "-"}
            hint={
              provider.rating_count >= 3
                ? `${provider.rating_count} reviews`
                : "After 3 reviews"
            }
            icon={<Star className="size-4" />}
          />
        </div>
      </header>

      {/* ---- The sheet --------------------------------------------------- */}
      <div className="-mx-5 -mt-8 min-h-[60dvh] rounded-t-[2rem] bg-white px-5 pt-7 pb-2">
        <Group label="Your work">
          <Row
            icon={<Briefcase />}
            label="Trades you cover"
            href="/provider/apply/trades"
            detail={
              trades.length === 0
                ? "None chosen yet — you will not be offered any work."
                : undefined
            }
          >
            {trades.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {trades.map((trade) => (
                  <span
                    key={trade.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-azure-50 py-1 pr-2.5 pl-2 text-2xs font-semibold text-navy-800"
                  >
                    <CategoryIcon name={trade.icon} className="size-3.5" />
                    {trade.name}
                  </span>
                ))}
              </div>
            )}
          </Row>

          <Row
            icon={<MapPin />}
            label="Where you work"
            detail={
              provider.base_city
                ? `${provider.base_city} · within ${provider.service_radius_km} km`
                : `Within ${provider.service_radius_km} km of where you are`
            }
            href="/provider/apply/about"
          />
        </Group>

        <Group label="Getting paid">
          <Row
            icon={<Wallet />}
            label="Mobile Money"
            href="/provider/apply/payout"
            detail={
              provider.momo_number
                ? `${formatPhoneForDisplay(provider.momo_number)}${provider.momo_network ? ` · ${provider.momo_network.toUpperCase()}` : ""}`
                : "Not set — you cannot be paid without this."
            }
          />
          <Row icon={<Phone />} label="Your number" detail={formatPhoneForDisplay(profile.phone)} />
        </Group>

        <Group label="Safety & support">
          <Row
            icon={<FileText />}
            label="Terms of service"
            href="/legal/terms"
            detail="What you agreed to when you signed up."
          />
          <Row
            icon={<ShieldCheck />}
            label="Privacy notice"
            href="/legal/privacy"
            detail="What we keep, why, and for how long."
          />
        </Group>

        <div className="pt-6">
          <form action={signOutAction}>
            <Button type="submit" variant="navyOutline" shape="pill" size="lg" block>
              <LogOut />
              Log out
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function BandStat({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex-1 rounded-[1.25rem] bg-white/10 p-3.5">
      <p className="inline-flex items-center gap-1.5 text-2xs tracking-[0.07em] text-white/55 uppercase [&_svg]:size-3.5">
        {icon}
        {label}
      </p>
      <p className="tabular mt-1 font-mono text-lede font-bold text-white">{value}</p>
      {hint && <p className="mt-0.5 text-2xs text-white/50">{hint}</p>}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="not-first:mt-7">
      <FieldLabel>{label}</FieldLabel>
      <div className="mt-1 divide-y divide-hairline">{children}</div>
    </section>
  );
}

/**
 * One row. A link when it goes somewhere, a plain div when it only reports —
 * never a div dressed as a link.
 */
function Row({
  icon,
  label,
  detail,
  href,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  detail?: string;
  href?: string;
  children?: React.ReactNode;
}) {
  const body = (
    <>
      <span
        aria-hidden
        className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-azure-50 text-navy-800 [&_svg]:size-[1.125rem]"
      >
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-ui font-semibold text-navy-900">{label}</span>
        {detail && (
          <span className="mt-0.5 block text-note leading-relaxed text-copy-muted">{detail}</span>
        )}
        {children}
      </span>
    </>
  );

  const shared = "flex min-h-14 w-full items-start gap-3.5 py-3.5";

  if (!href) return <div className={shared}>{body}</div>;

  return (
    <Link
      href={href}
      className={cn(
        shared,
        "-mx-2 rounded-[1rem] px-2 transition-colors duration-[var(--duration-fast)] hover:bg-azure-50/60",
      )}
    >
      {body}
    </Link>
  );
}
