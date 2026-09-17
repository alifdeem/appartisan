import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { MomoPrompt } from "@/app/pay/simulate/[reference]/_components/momo-prompt";
import { devToolsEnabled, env } from "@/lib/env";
import { getPaymentByReference } from "@/lib/payments/queries";
import { getCurrentProfile } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Confirm payment" };

/**
 * The simulated mobile money prompt.
 *
 * This screen is the answer to PLAN.md §4 Finding 2: **mobile money cannot be
 * charged silently.** There is no tokenisation and no recurring billing on the
 * MoMo channel — every charge requires the customer to be physically present
 * and approve a fresh USSD prompt with their PIN.
 *
 * That constraint shapes the whole end of a job (the balance is collected on
 * site, before the artisan leaves), so the simulation has to *teach* it rather
 * than paper over it. A mock that looked like a card form would let everyone
 * build the wrong mental model for months and then discover the truth at
 * go-live.
 *
 * So the page waits. The approval happens on a simulated handset beside it,
 * which fires the real webhook — and the page only believes the payment landed
 * when the database says so.
 */
export default async function SimulatePaymentPage({
  params,
}: PageProps<"/pay/simulate/[reference]">) {
  const { reference } = await params;

  // A live provider has its own hosted page; this route would be a way to
  // settle real charges by hand. It does not exist outside simulation.
  if (env.PAYMENT_PROVIDER !== "mock") notFound();

  const [payment, profile] = await Promise.all([
    getPaymentByReference(reference),
    getCurrentProfile(),
  ]);

  if (!payment || !profile) notFound();

  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, reference, client_id, status")
    .eq("id", payment.job_id)
    .maybeSingle();

  // RLS already scopes `payments` to job participants, but this route is
  // reached by a reference in a URL — so ownership is checked, not assumed.
  if (!job || job.client_id !== profile.id) notFound();

  // Already settled. Sending them back to the job beats showing a prompt for a
  // payment that has finished.
  if (payment.status === "succeeded") {
    redirect(`/client/jobs/${job.id}?paid=1`);
  }

  return (
    <MomoPrompt
      reference={payment.provider_reference}
      amount={Number(payment.amount)}
      network={payment.momo_network}
      phone={profile.phone}
      jobId={job.id}
      jobReference={job.reference}
      status={payment.status}
      failureReason={payment.failure_reason}
      showDevControls={devToolsEnabled}
    />
  );
}
