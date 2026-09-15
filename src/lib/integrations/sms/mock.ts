import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  estimateSmsCost,
  type SendSmsInput,
  type SendSmsResult,
  type SmsProvider,
} from "./types";

/**
 * Simulated SMS.
 *
 * Delivers nothing, but records the message and — importantly — the cost it
 * WOULD have incurred. By the time the client is ready to go live they will
 * have months of real traffic in `notifications_log` and therefore a real
 * monthly SMS budget, instead of a guess. See PLAN.md §3.
 */
export class MockSmsProvider implements SmsProvider {
  readonly name = "mock";
  readonly simulated = true;

  async send(input: SendSmsInput): Promise<SendSmsResult> {
    const cost = estimateSmsCost(input.body);
    const messageId = `mock_sms_${crypto.randomUUID()}`;

    const supabase = createAdminClient();
    const { error } = await supabase.from("notifications_log").insert({
      recipient_phone: input.to,
      recipient_id: input.recipientId ?? null,
      channel: "sms",
      template: input.template,
      body: input.body,
      cost,
      provider_message_id: messageId,
      status: "simulated",
      is_simulated: true,
    });

    if (error) {
      // A logging failure must never break the flow it is observing.
      console.error("[sms:mock] failed to write notifications_log", error.message);
    }

    if (process.env.NODE_ENV !== "production") {
      console.info(
        `\n  ┌─ SMS (simulated) ────────────────────────────────\n` +
          `  │ to:       ${input.to}\n` +
          `  │ template: ${input.template}\n` +
          `  │ cost:     GHS ${cost.toFixed(4)} (not charged)\n` +
          `  │ body:     ${input.body}\n` +
          `  └──────────────────────────────────────────────────\n`,
      );
    }

    return { ok: true, messageId, cost, simulated: true };
  }
}
