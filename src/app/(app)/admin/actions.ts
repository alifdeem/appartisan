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

/* -------------------------------------------------------------------------
 * Phase 6 — disputes and platform configuration
 * ---------------------------------------------------------------------- */

const resolveSchema = z.object({
  disputeId: z.string().uuid("That dispute could not be found."),
  status: z.enum(["investigating", "resolved", "rejected"], {
    message: "Choose investigating, resolved or rejected.",
  }),
  resolution: z.string().trim().max(2000, "Keep the note under 2000 characters.").optional(),
});

/**
 * Resolve a dispute.
 *
 * `resolve_dispute` (migration 0018) holds the rules: only an admin, only the
 * three legal outcomes, and a closing outcome must carry a written decision.
 * Six weeks later that sentence is the only thing that will explain why the
 * money went where it went.
 */
export async function resolveDisputeAction(
  _prev: AdminActionState | null,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = resolveSchema.safeParse({
    disputeId: formData.get("disputeId"),
    status: formData.get("status"),
    resolution: formData.get("resolution") || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? "form")] = issue.message;
    }
    return state({ ok: false, fieldErrors });
  }

  const { disputeId, status: decision, resolution } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_dispute", {
    p_dispute_id: disputeId,
    p_status: decision,
    p_resolution: resolution ?? "",
  });

  if (error) {
    console.error("[admin] resolve_dispute failed", error.message);
    return state({ ok: false, error: error.message });
  }

  revalidatePath("/admin/disputes");
  return state({ ok: true });
}

const settingSchema = z.object({
  key: z.string().min(1),
  value: z.string().trim().min(1, "Enter a value."),
});

/**
 * Change a platform setting.
 *
 * The value arrives as a string from a form and has to become JSON, because
 * `settings.value` is jsonb and holds numbers, arrays and objects depending on
 * the key. Parsing here rather than in the database keeps the error message
 * something a person can act on; `update_setting` still enforces the ranges
 * that matter, so a bad value cannot get in through another caller.
 */
export async function updateSettingAction(
  _prev: AdminActionState | null,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = settingSchema.safeParse({
    key: formData.get("key"),
    value: formData.get("value"),
  });

  if (!parsed.success) {
    return state({ ok: false, error: parsed.error.issues[0]?.message ?? "Enter a value." });
  }

  const { key, value } = parsed.data;

  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(value);
  } catch {
    return state({
      ok: false,
      fieldErrors: {
        [key]: "That is not valid JSON. A number is just 12; a list looks like [5,10,20].",
      },
    });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_setting", { p_key: key, p_value: parsedValue });

  if (error) {
    console.error("[admin] update_setting failed", error.message);
    return state({ ok: false, fieldErrors: { [key]: error.message } });
  }

  revalidatePath("/admin/settings");
  return state({ ok: true });
}

const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Give the trade a name.").max(60, "Keep the name short."),
  slug: z
    .string()
    .trim()
    .min(2, "A slug is needed.")
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only."),
  icon: z.string().trim().min(1, "Choose an icon.").max(40),
  description: z.string().trim().max(300, "Keep the description under 300 characters.").optional(),
  isActive: z.coerce.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
});

/**
 * Add or edit a service category.
 *
 * PLAN.md §9: "admin can add more without a deploy." Retiring rather than
 * deleting is the only option offered, and deliberately — a category is
 * referenced by every job ever booked under it, so a delete either fails on
 * the foreign key or takes history with it. `is_active` hides it from the
 * posting flow and leaves the record intact.
 */
export async function saveCategoryAction(
  _prev: AdminActionState | null,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = categorySchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    slug: formData.get("slug"),
    icon: formData.get("icon"),
    description: formData.get("description") || undefined,
    isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
    sortOrder: formData.get("sortOrder") || 0,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? "form")] = issue.message;
    }
    return state({ ok: false, fieldErrors });
  }

  const { id, name, slug, icon, description, isActive, sortOrder } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_category", {
    p_id: id ?? null,
    p_name: name,
    p_slug: slug,
    p_icon: icon,
    p_description: description ?? null,
    p_is_active: isActive ?? true,
    p_sort_order: sortOrder ?? 0,
  });

  if (error) {
    console.error("[admin] save_category failed", error.message);
    return state({
      ok: false,
      error: /duplicate|unique/i.test(error.message)
        ? "That slug is already taken by another trade."
        : error.message,
    });
  }

  revalidatePath("/admin/categories");
  revalidatePath("/client/post");
  return state({ ok: true });
}
