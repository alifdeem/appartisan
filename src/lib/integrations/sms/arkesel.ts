import "server-only";

import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  estimateSmsCost,
  type SendSmsInput,
  type SendSmsResult,
  type SmsProvider,
} from "./types";

/**
 * Live SMS via Arkesel (https://arkesel.com), a Ghanaian provider.
 *
 * NOT YET EXERCISED. Written now so the shape is settled, but it has never sent
 * a real message — treat the first live send as a test, not a formality.
 *
 * Before this can work the client needs:
 *   • an Arkesel account with credit
 *   • an approved sender ID (takes several days — start it early)
 *
 * Swapping to Hubtel means writing a sibling class and changing one line in
 * ./index.ts. Nothing else in the app knows which provider is in use.
 */
export class ArkeselSmsProvider implements SmsProvider {
  readonly name = "arkesel";
  readonly simulated = false;

  async send(input: SendSmsInput): Promise<SendSmsResult> {
    const cost = estimateSmsCost(input.body);
    const supabase = createAdminClient();

    try {
      const response = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
        method: "POST",
        headers: {
          "api-key": env.ARKESEL_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: env.ARKESEL_SENDER_ID ?? "ArtisanGH",
          message: input.body,
          recipients: [input.to.replace("+", "")],
        }),
      });

      const payload = (await response.json()) as {
        status?: string;
        data?: { id?: string }[];
        message?: string;
      };

      const ok = response.ok && payload.status === "success";
      const messageId = payload.data?.[0]?.id ?? `arkesel_${Date.now()}`;

      await supabase.from("notifications_log").insert({
        recipient_phone: input.to,
        recipient_id: input.recipientId ?? null,
        channel: "sms",
        template: input.template,
        body: input.body,
        cost,
        provider_message_id: messageId,
        status: ok ? "sent" : "failed",
        is_simulated: false,
      });

      return {
        ok,
        messageId,
        cost,
        simulated: false,
        error: ok ? undefined : (payload.message ?? `HTTP ${response.status}`),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";

      await supabase.from("notifications_log").insert({
        recipient_phone: input.to,
        recipient_id: input.recipientId ?? null,
        channel: "sms",
        template: input.template,
        body: input.body,
        cost: 0,
        status: "failed",
        is_simulated: false,
      });

      return { ok: false, messageId: "", cost: 0, simulated: false, error: message };
    }
  }
}
