import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarCheck,
  CheckCheck,
  ClipboardList,
  FileText,
  LogOut,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/mobile/field-label";
import { formatPhoneForDisplay } from "@/lib/phone";
import { getCurrentProfile } from "@/lib/supabase/server";
import { listClientJobs, summariseJobs } from "@/lib/jobs/queries";
import { signOutAction } from "@/app/(auth)/actions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Account" };

/**
 * The account tab — rebuilt against `designing-ui-ux/account.png`.
 *
 * The reference's shape, which is the good idea here: a navy band carrying who
 * you are, and a white sheet riding up over it holding three labelled groups of
 * plain rows. It reads as one object rather than as four stacked cards, and the
 * band gives the tab an identity the rest of the app does not have.
 *
 * **Its rows, against what this product actually has:**
 *
 *  • *Card Options* — there are no stored cards. Payment is Mobile Money, taken
 *    per job through the payment adapter, and nothing is kept on file. A screen
 *    offering to manage saved cards would be offering to manage nothing.
 *  • *Notification Preferences* — nothing in the schema stores a preference and
 *    nothing reads one. The same reason the home screen's bell became a link to
 *    the jobs list rather than a notification centre.
 *  • *Personal Information* — real, and here: your name, your number, and the
 *    fact that the number **is** the account.
 *  • *Activity overview* — real, and the best thing on the reference. Posted,
 *    in progress and completed all come from `summariseJobs` over the job list
 *    this page already has to load.
 *  • *Health & Safety Guidelines* — the product has no such document. The two
 *    it does have, and that a client agreed to, are the terms and the privacy
 *    notice.
 *  • *Help & Support (24/7)* — `support_phone` exists in `settings`, but that
 *    table is admin-only under RLS (0003) and the value is still the
 *    placeholder `+233000000000` the migration says to replace before launch.
 *    One honest row needs both of those fixed, so it is the one row from the
 *    reference deliberately left out rather than filled with a number that does
 *    not answer.
 *
 * **The counts are not links.** Each one could plausibly filter the jobs tab,
 * but that tab has no filter to deep-link into; a row that looks tappable and
 * goes nowhere is worse than a row that plainly reports a number. "All jobs"
 * under them is the real control.
 */
export default async function AccountPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const jobs = await listClientJobs();
  const counts = summariseJobs(jobs);

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
      {/* Full-bleed: the reference's band reaches the edge of the phone, and a
          band with the page's gutter either side reads as a wide card. */}
      <header className="-mx-5 -mt-6 bg-linear-to-b from-navy-800 to-navy-900 px-5 pt-8 pb-14">
        <h1 className="sr-only">Account</h1>

        <div className="flex items-center gap-4">
          {/* Initials, not a photograph. There is no avatar upload in this
              product, so a stock silhouette would be a placeholder for a
              feature that does not exist; initials are real information. */}
          <span
            aria-hidden
            className="grid size-16 shrink-0 place-items-center rounded-full bg-white/12 font-space text-lede font-bold text-white ring-2 ring-white/25"
          >
            {initials || <User className="size-7" />}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate font-space text-title-sm font-bold text-white">
              {profile.full_name}
            </p>
            <p className="tabular mt-0.5 truncate font-mono text-note text-white/70">
              {formatPhoneForDisplay(profile.phone)}
            </p>
          </div>
        </div>
      </header>

      {/* ---- The sheet --------------------------------------------------- */}
      {/* `-mt-8` rides it up over the band, which is the reference's one
          structural move and the whole reason the screen reads as a single
          object. */}
      <div className="-mx-5 -mt-8 min-h-[60dvh] rounded-t-[2rem] bg-white px-5 pt-7 pb-2">
        <Group label="Account">
          <Row icon={<User />} label="Personal information" detail={profile.full_name} />
          <Row
            icon={<Phone />}
            label="How you sign in"
            detail="Your number is your account, and we text you a code each time. There is no password to forget."
          />
        </Group>

        <Group label="Activity overview">
          <Row icon={<ClipboardList />} label="Jobs posted" value={counts.total - counts.drafts} />
          <Row icon={<CalendarCheck />} label="In progress" value={counts.active} />
          <Row icon={<CheckCheck />} label="Completed" value={counts.completed} />
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

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="not-first:mt-7">
      <FieldLabel>{label}</FieldLabel>
      {/* `divide-y` rather than a border on each row: one rule between two rows,
          and none under the last, without any `:last-child` bookkeeping. */}
      <div className="mt-1 divide-y divide-hairline">{children}</div>
    </section>
  );
}

/**
 * One row. A link when it goes somewhere, a plain div when it only reports —
 * never a div dressed as a link, which is the commonest way a settings screen
 * lies about what is tappable.
 */
function Row({
  icon,
  label,
  detail,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  detail?: string;
  /** A count. Rendered mono and tabular, like every other quantity. */
  value?: number;
  href?: string;
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
      </span>

      {value !== undefined && (
        <span className="tabular shrink-0 self-center font-mono text-lede font-bold text-navy-900">
          {value}
        </span>
      )}
    </>
  );

  const shared = "flex min-h-14 w-full items-start gap-3.5 py-3.5";

  if (!href) {
    return <div className={shared}>{body}</div>;
  }

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
