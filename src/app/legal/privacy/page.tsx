import type { Metadata } from "next";

import { DraftNotice } from "../_components/draft-notice";

export const metadata: Metadata = { title: "Privacy notice" };

/**
 * Privacy notice.
 *
 * PLAN.md §13 lists Ghana Data Protection Act compliance as a Medium risk with
 * four mitigations: register as a data controller, publish a privacy policy,
 * keep documents in private buckets, and set a retention policy for ID
 * documents. Three of those are engineering and were already true — the
 * buckets have been private since 0001 and are served through short-lived
 * signed URLs. This is the fourth, and it states the retention policy that
 * §13 asks for rather than leaving it implied.
 *
 * Written to describe what the system actually stores. Every claim here is
 * checkable against the schema, which is the only kind of privacy notice worth
 * publishing.
 */
export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy notice</h1>
      <p className="meta">Last updated 17 September 2026 · Ghana Data Protection Act, 2012</p>

      <DraftNotice />

      <p className="lede">
        We collect what we need to book a job, pay the right person, and prove what happened. This
        explains exactly what that is, why we hold it, how long for, and what you can ask us to do
        about it.
      </p>

      <h2>1. Who we are</h2>
      <p>
        ArtisanGH is the data controller for the information described here. We will complete
        registration with Ghana&rsquo;s Data Protection Commission before launch.
      </p>

      <h2>2. What we collect, and why</h2>

      <h3>Everyone</h3>
      <ul>
        <li>
          <strong>Your phone number.</strong> It is how you sign in — there is no password on this
          platform — and how an artisan or a client reaches you about a job in progress.
        </li>
        <li>
          <strong>Your name</strong> and the languages you speak, so the person turning up knows
          who they are meeting and can be matched on language.
        </li>
      </ul>

      <h3>When you book a job</h3>
      <ul>
        <li>
          <strong>The address, a map pin, a landmark and a GhanaPost GPS code.</strong> An artisan
          cannot find a house in Accra from a street name alone.
        </li>
        <li>
          <strong>Photos and a voice note</strong>, if you add them, so the artisan can see the
          problem before quoting.
        </li>
        <li>
          <strong>Payment records</strong> — amounts, mobile money network and the provider&rsquo;s
          reference. We never see or store your mobile money PIN.
        </li>
      </ul>

      <h3>When you register as an artisan</h3>
      <ul>
        <li>
          <strong>Your Ghana Card and a photograph of you.</strong> This is how clients can trust
          that a stranger in their home has been identified.
        </li>
        <li>
          <strong>Your mobile money number</strong>, so we can pay you.
        </li>
        <li>
          <strong>Your location while you are on a job</strong>, so the client can see you are on
          the way. We record it only between accepting a job and completing it, never otherwise,
          and never when you are offline.
        </li>
      </ul>

      <h2>3. Who can see it</h2>
      <p>
        Access is enforced by the database itself, per row, not by the app asking politely.
      </p>
      <ul>
        <li>
          <strong>A client and an artisan on the same job</strong> can see each other&rsquo;s name
          and phone number, and nothing else about each other.
        </li>
        <li>
          <strong>Ghana Cards and photographs</strong> are visible only to the person they belong
          to and to the staff who review applications. They are kept in private storage and served
          through links that expire in minutes. They are never public and never sent by email.
        </li>
        <li>
          <strong>Your mobile money number</strong> is visible to you and to our staff. It is not
          visible to clients, to other artisans, or to anyone browsing.
        </li>
        <li>
          <strong>Ratings and comments</strong> about an artisan are public, because that is what
          makes them useful. <strong>Who left them is not published.</strong>
        </li>
      </ul>
      <p>
        We do not sell your information and we do not use it for advertising.
      </p>

      <h2>4. How long we keep it</h2>
      <ul>
        <li>
          <strong>Identity documents</strong> — while the account is active, and for{" "}
          <strong>90 days</strong> after it is closed or an application is refused. After that they
          are deleted. We keep a record that the check was done and its outcome, without the
          images.
        </li>
        <li>
          <strong>Job records, invoices and payment references</strong> — six years, which is what
          tax and accounting rules require of us.
        </li>
        <li>
          <strong>Location records</strong> — 90 days. They exist to settle a dispute about a
          journey, and after three months they cannot.
        </li>
        <li>
          <strong>Job photos and voice notes</strong> — twelve months after the job closes.
        </li>
        <li>
          <strong>Verification codes</strong> — ten minutes, then they stop working. We store them
          hashed, never as the digits you were sent.
        </li>
      </ul>

      <h2>5. Your rights</h2>
      <p>Under the Data Protection Act you can ask us to:</p>
      <ul>
        <li>tell you what we hold about you, and give you a copy;</li>
        <li>correct anything that is wrong;</li>
        <li>delete your account and your personal information;</li>
        <li>stop using your information in a particular way.</li>
      </ul>
      <p>
        Some records we must keep even if you ask us to delete them — a paid invoice, for instance,
        because tax law requires it. We will tell you when that applies and why, rather than
        quietly keeping it.
      </p>
      <p>
        To exercise any of these, contact our support line. You also have the right to complain to
        the Data Protection Commission.
      </p>

      <h2>6. Security</h2>
      <p>
        Identity documents and job photos are in private storage and reachable only through
        short-lived signed links. Verification codes are hashed. Access rules are enforced in the
        database, so a bug in the app cannot expose another person&rsquo;s data by mistake.
      </p>
      <p>
        No system is perfect. If we ever have a breach that affects you, we will tell you and the
        Commission.
      </p>

      <h2>7. Changes</h2>
      <p>
        If this notice changes in a way that affects you, we will say so in the app rather than
        quietly editing the page.
      </p>
    </>
  );
}
