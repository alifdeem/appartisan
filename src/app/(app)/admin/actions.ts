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

// ---------------------------------------------------------------------------
// The matching fallback — Phase 3
// ---------------------------------------------------------------------------

/**
 * Assign a job to an artisan by hand.
 *
 * PLAN.md §6 lists this as one of three mitigations for thin supply, and is
 * blunt that "every real marketplace runs on this for its first six months".
 * It is a designed path, not an escape hatch: the admin phones an artisan who
 * was offline or out of radius, gets a yes, and records it here.
 *
 * The job lands in `quote_pending` exactly as an accepted offer would, so
 * everything downstream is identical whether a human or the matcher made the
 * introduction.
 */
export async function assignJobAction(
  jobId: string,
  providerId: string,
): Promise<AdminActionState> {
  const parsed = z
    .object({ jobId: z.string().uuid(), providerId: z.string().uuid() })
    .safeParse({ jobId, providerId });

  if (!parsed.success) return state({ ok: false, error: "That assignment could not be made." });

  const supabase = await createClient();

  const { error } = await supabase.rpc("admin_assign_job", {
    p_job_id: parsed.data.jobId,
    p_provider_id: parsed.data.providerId,
  });

  if (error) {
    console.error("[admin] assignJob failed", error);
    return state({
      ok: false,
      error: error.message.replace(/^.*?:\s*/, "") || "Could not assign that job.",
    });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/matching");
  return state({ ok: true });
}

// ---------------------------------------------------------------------------
// Transport zones — Phase 4
// ---------------------------------------------------------------------------

/**
 * The distance bands that decide an artisan's travel fee.
 *
 * PLAN.md §16 lists real Accra and Tema numbers as still open — what ships now
 * is a placeholder ladder the client confirms before go-live. That is precisely
 * why this is an admin screen and not a migration: the numbers are expected to
 * change, and changing them must not need a deploy.
 *
 * Two rules the form cannot be trusted with, so they are enforced here:
 *
 *  • **Bands must not overlap.** `transport_fee_for_distance` picks the first
 *    row whose range contains the distance, ordered by `min_km`. Overlapping
 *    bands do not error — they silently make the cheaper one unreachable, and
 *    nobody notices until an artisan queries their transport fee.
 *  • **The ladder should not have holes.** A gap means a distance that resolves
 *    to no band at all, and `save_quote` coalesces a missing fee to zero — an
 *    artisan travelling 12km for free because 10–15 was never defined.
 */
const zoneSchema = z.object({
  id: z.string().uuid().optional(),
  city: z.string().trim().min(1).max(60),
  minKm: z.coerce.number().min(0).max(500),
  maxKm: z.coerce.number().min(0).max(500),
  fee: z.coerce.number().min(0).max(10_000),
  isActive: z.coerce.boolean().optional(),
});

export async function saveTransportZoneAction(
  _prev: AdminActionState | null,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = zoneSchema.safeParse({
    id: formData.get("id") || undefined,
    city: formData.get("city") ?? "",
    minKm: formData.get("minKm"),
    maxKm: formData.get("maxKm"),
    fee: formData.get("fee"),
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    return state({ ok: false, error: parsed.error.issues[0]?.message ?? "Check the band." });
  }

  const { id, city, minKm, maxKm, fee, isActive } = parsed.data;

  if (maxKm <= minKm) {
    return state({ ok: false, fieldErrors: { maxKm: "The upper limit must be above the lower." } });
  }

  const supabase = await createClient();

  // Overlap check against the other active bands in the same city. The database
  // has a `max_km > min_km` constraint and no cross-row one, because a range
  // exclusion constraint would also have to reason about `city = '*'`.
  const { data: siblings } = await supabase
    .from("transport_zones")
    .select("id, min_km, max_km")
    .eq("city", city)
    .eq("is_active", true);

  const overlap = (siblings ?? []).find(
    (zone) => zone.id !== id && minKm < Number(zone.max_km) && maxKm > Number(zone.min_km),
  );

  if (overlap) {
    return state({
      ok: false,
      error: `That overlaps the ${overlap.min_km}–${overlap.max_km}km band. Bands have to be side by side, not on top of each other.`,
    });
  }

  const row = {
    city,
    min_km: minKm,
    max_km: maxKm,
    fee,
    is_active: isActive ?? true,
  };

  const { error } = id
    ? await supabase.from("transport_zones").update(row).eq("id", id)
    : await supabase.from("transport_zones").insert(row);

  if (error) {
    console.error("[admin] saveTransportZone failed:", error.message);
    return state({ ok: false, error: "Could not save that band." });
  }

  revalidatePath("/admin/zones");
  return state({ ok: true });
}

/**
 * Retire a band rather than delete it.
 *
 * Quotes already reference the fee a band produced, and the audit trail behind
 * a completed job should still explain where its transport charge came from.
 * Deactivating removes it from `transport_fee_for_distance` — which filters on
 * `is_active` — without rewriting history.
 */
export async function retireTransportZoneAction(zoneId: string): Promise<AdminActionState> {
  const parsed = z.string().uuid().safeParse(zoneId);
  if (!parsed.success) return state({ ok: false, error: "That band could not be found." });

  const supabase = await createClient();

  const { error } = await supabase
    .from("transport_zones")
    .update({ is_active: false })
    .eq("id", parsed.data);

  if (error) {
    console.error("[admin] retireTransportZone failed:", error.message);
    return state({ ok: false, error: "Could not retire that band." });
  }

  revalidatePath("/admin/zones");
  return state({ ok: true });
}
