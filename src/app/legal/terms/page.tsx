import type { Metadata } from "next";

import { DraftNotice } from "../_components/draft-notice";
import { DEFAULT_COMMISSION_PCT, DEFAULT_DEPOSIT_PCT } from "@/lib/money";

export const metadata: Metadata = { title: "Terms of service" };

/**
 * Terms of service.
 *
 * Written against what the code actually does, not against a template. The
 * commission and deposit percentages are imported from `money.ts` rather than
 * typed in, so the contract cannot drift from the arithmetic the app charges —
 * that is the single most likely way a document like this becomes untrue.
 *
 * Two clauses are load-bearing for reasons beyond contract hygiene, both from
 * PLAN.md §4:
 *
 *   • The agency clause. ArtisanGH collects payment AS AGENT of the artisan.
 *     Bank of Ghana treats "creation and management of wallet" as E-Money
 *     Issuer activity, which carries a GHS 25m capital requirement. Collecting
 *     as agent, holding nothing, and never showing a user-facing balance keeps
 *     the platform in PSP Standard, where there is no capital requirement.
 *
 *   • No stored value. There is no ArtisanGH balance, no top-up and no credit,
 *     and saying so in the terms is part of what makes the position defensible.
 */
export default function TermsPage() {
  return (
    <>
      <h1>Terms of service</h1>
      <p className="meta">Last updated 17 September 2026 · Accra and Tema</p>

      <DraftNotice />

      <p className="lede">
        ArtisanGH connects you with verified artisans — electricians, plumbers, carpenters and
        other trades — and holds the money until the work is signed off. These terms explain
        what we do, what we do not do, and who is responsible when something goes wrong.
      </p>

      <h2>1. What ArtisanGH is</h2>
      <p>
        We are a booking and payment platform. <strong>We do not carry out the work.</strong> Every
        job is performed by an independent artisan who contracts directly with you. We verify who
        they are, we introduce them to you, we hold the payment, and we keep a record of what
        happened.
      </p>
      <p>
        We are not an employer of artisans, and artisans are not our agents or subcontractors.
      </p>

      <h2>2. How money works</h2>
      <p>
        <strong>ArtisanGH collects payment as agent of the artisan.</strong> The money you pay is
        the artisan&rsquo;s money from the moment it is collected; we hold it on their behalf until
        the job is signed off, then pass it on.
      </p>
      <p>
        <strong>There is no ArtisanGH balance.</strong> We do not issue credit, we do not accept
        top-ups, and you cannot store value with us. Money moves in and out for a specific job and
        nothing else.
      </p>

      <h3>What you pay</h3>
      <ul>
        <li>
          The artisan sets their own price and itemises it as labour and materials. We do not set,
          cap or recommend prices.
        </li>
        <li>
          We add a service fee of <span className="amount">{DEFAULT_COMMISSION_PCT}%</span> on top
          of the artisan&rsquo;s price. That fee is our only charge to you and it is shown before
          you agree to anything.
        </li>
        <li>
          A transport fee applies by distance band. It is{" "}
          <strong>passed to the artisan in full</strong> — we take nothing from it.
        </li>
        <li>
          You pay a deposit of <span className="amount">{DEFAULT_DEPOSIT_PCT}%</span> of the marked-up
          price plus the whole transport fee before the artisan travels, and the balance on site
          once you have signed the work off.
        </li>
      </ul>
      <p>
        The balance is collected while the artisan is still with you. Mobile money in Ghana cannot
        be charged without you approving a prompt on your own phone, so there is no way for us to
        take it later.
      </p>

      <h2>3. Cancelling</h2>
      <p>These rules are applied automatically by the platform, not case by case.</p>
      <ul>
        <li>
          <strong>Before you pay the deposit</strong> — cancel freely. Nothing is charged.
        </li>
        <li>
          <strong>After the deposit, before the artisan sets out</strong> — full refund.
        </li>
        <li>
          <strong>After the artisan sets out, before work begins</strong> — you pay the transport
          fee only, and the artisan receives all of it. They made the journey.
        </li>
        <li>
          <strong>After work has begun</strong> — the deposit is forfeited and paid to the artisan
          less our service fee.
        </li>
        <li>
          <strong>If the artisan cancels</strong>, at any point — you are refunded in full and they
          receive nothing. It also counts against their reliability record.
        </li>
      </ul>

      <h2>4. Verification, and its limits</h2>
      <p>
        Before an artisan can accept work we collect their Ghana Card, a photograph of them, and
        their trade details, and a member of our team speaks to them. This is a real check and we
        take it seriously.
      </p>
      <p>
        <strong>It is not a guarantee of workmanship.</strong> Verification confirms that we know
        who someone is and that they presented as competent. It does not make us responsible for
        the quality of what they do.
      </p>

      <h2>5. Responsibility for the work</h2>
      <p>
        The artisan is responsible for the work, for doing it safely and competently, and for any
        loss or damage they cause. Your contract for the work is with them.
      </p>
      <p>
        We are responsible for running the platform: verifying identity, handling your payment
        correctly, keeping accurate records, and dealing with reported problems. We are not liable
        for the artisan&rsquo;s work, and our liability to you is limited to the fees we charged on
        the job in question.
      </p>
      <p>
        Nothing here limits any right you have under Ghanaian law that cannot be limited by
        agreement.
      </p>

      <h2>6. If something goes wrong</h2>
      <p>
        Report it on the job, with photos. Either party can. We hold the artisan&rsquo;s payout
        while it is looked at, and a member of our team reviews it and records a decision and the
        reason for it.
      </p>
      <p>
        Every status change on every job is logged with a timestamp. If a dispute arrives weeks
        later, that log is what we rely on.
      </p>

      <h2>7. For artisans</h2>
      <p>By accepting work through ArtisanGH you agree that:</p>
      <ul>
        <li>
          you are self-employed and responsible for your own tax, tools, insurance and safety;
        </li>
        <li>
          we collect payment <strong>as your agent</strong>, and pass it to you after sign-off,
          less our service fee;
        </li>
        <li>
          you set your own prices and may decline any job — but your acceptance rate,
          cancellations, no-shows and ratings are recorded and affect how often you are offered
          work;
        </li>
        <li>
          your account may be suspended if you fall below the published reliability thresholds. A
          suspension is never automatic and final: it removes you from matching and puts your
          account in front of a person, who will call you.
        </li>
      </ul>
      <p>
        You can see your own reliability figures on your dashboard at any time. We will not
        measure you against something we have hidden from you.
      </p>

      <h2>8. Changes</h2>
      <p>
        We may change these terms. A job already agreed keeps the terms and the prices it was
        agreed under — changes apply to the next one.
      </p>

      <h2>9. Contact</h2>
      <p>
        Questions about these terms, or about a job, go to our support line. It is shown in the
        app and on your invoice.
      </p>
    </>
  );
}
