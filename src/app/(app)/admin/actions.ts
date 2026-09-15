"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/**
 * Admin verification actions.
 *
 * Thin on purpose. Every rule that matters — who may decide, which decisions
 * are legal, that a refusal must carry a reason, that a suspended artisan
 * leaves the matching pool in the same transaction — lives in
 * `review_provider_application` (migration 0008).
 *
 * That is not delegation for tidiness. This action runs as the admin's own
 * session, so if the authority check lived here, a second caller written later
 * against the same table would not inherit it. In the function, it holds for
 * every caller there will ever be.
 */

export interface AdminActionState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  token: string;
}

function state(value: Omit<AdminActionState, "token">): AdminActionState {
  return { ...value, token: randomUUID() };
}

const reviewSchema = z.object({
  providerId: z.string().uuid("That artisan could not be found."),
  decision: z.enum(["approved", "rejected", "suspended"], {
    message: "Choose approve, reject or suspend.",
  }),
  callNotes: z.string().trim().max(2000, "Keep the notes under 2000 characters.").optional(),
});

export async function reviewProviderAction(
  _prev: AdminActionState | null,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = reviewSchema.safeParse({
    providerId: formData.get("providerId"),
    decision: formData.get("decision"),
    callNotes: formData.get("callNotes") || undefined,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return state({ ok: false, error: issue?.message ?? "Check the form and try again." });
  }

  const { providerId, decision, callNotes } = parsed.data;

  // Checked here as well as in the function, purely so the admin gets the
  // message next to the textarea rather than as a red banner at the top. The
  // database is what enforces it.
  if (decision !== "approved" && !callNotes) {
    return state({
      ok: false,
      fieldErrors: {
        callNotes:
          decision === "rejected"
            ? "Say why. This is what the artisan will be told when they ask."
            : "Record why this artisan is being suspended.",
      },
    });
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("review_provider_application", {
    p_provider_id: providerId,
    p_decision: decision,
    p_call_notes: callNotes ?? null,
  });

  if (error) {
    console.error("[admin] reviewProvider failed", error);
    return state({
      ok: false,
      error: error.message.replace(/^.*?:\s*/, "") || "Could not record that decision.",
    });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/verification");
  revalidatePath(`/admin/verification/${providerId}`);

  return state({ ok: true });
}
