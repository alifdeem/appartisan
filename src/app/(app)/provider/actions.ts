"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  MAX_BIO_LENGTH,
  MIN_BIO_LENGTH,
  SERVICE_RADIUS_OPTIONS,
  SPOKEN_LANGUAGES,
  isValidGhanaCardNumber,
} from "@/lib/providers/application";
import { PROVIDER_DOC_BUCKET, isSingletonDoc } from "@/lib/providers/documents";
import { getMyProvider } from "@/lib/providers/queries";
import { isValidGhanaPhone, normalisePhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import type { ProviderDocType, ProviderRow } from "@/lib/supabase/types";

/**
 * Artisan application actions.
 *
 * The same three rules as the client posting actions, for the same reasons — a
 * Server Action is a public POST endpoint, the caller sends a reference rather
 * than a record, and files never travel through here. Two more apply only to
 * this file:
 *
 *  4. **An application in review is not editable.** Every step action refuses
 *     anything but `unsubmitted` or `rejected`. An artisan editing their trades
 *     while an admin is halfway through reviewing them means the admin approves
 *     something that no longer exists.
 *  5. **Status is never written here.** `verification_status` and
 *     `availability` move through the RPCs in migration 0008, which hold the
 *     rules the matcher depends on. An action that could set `approved` would
 *     make the entire verification queue decorative.
 */

export interface ProviderActionState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Fresh on every result, so a form can tell "ran again" from "same result". */
  token: string;
}

function state(value: Omit<ProviderActionState, "token">): ProviderActionState {
  return { ...value, token: randomUUID() };
}

async function requireProviderId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("You need to be signed in.");
  return user.id;
}

/**
 * The caller's own provider row, or null if this account is not an artisan.
 *
 * `mustBeEditable` is the gate rule 4 describes. Returning null rather than
 * throwing lets each action phrase its own refusal — "that is no longer
 * editable" reads very differently on the trades step than on the review step.
 */
async function loadOwnProvider(
  { mustBeEditable = false }: { mustBeEditable?: boolean } = {},
): Promise<ProviderRow | null> {
  const providerId = await requireProviderId();
  const supabase = await createClient();

  const { data } = await supabase
    .from("providers")
    .select("*")
    .eq("profile_id", providerId)
    .maybeSingle();

  if (!data) return null;

  const provider = data as ProviderRow;
  if (
    mustBeEditable &&
    provider.verification_status !== "unsubmitted" &&
    provider.verification_status !== "rejected"
  ) {
    return null;
  }

  return provider;
}

const NOT_EDITABLE = "Your application is with our team, so it cannot be changed right now.";

// ---------------------------------------------------------------------------
// Step 1 — trades
// ---------------------------------------------------------------------------

/**
 * Replaces the whole set rather than diffing it.
 *
 * `provider_categories` is a join table with a composite primary key and no
 * other columns, so there is nothing in a row worth preserving. Delete-then-
 * insert is two statements and is correct; a diff is four and has an ordering
 * bug waiting in it.
 */
export async function saveTradesAction(
  _prev: ProviderActionState | null,
  formData: FormData,
): Promise<ProviderActionState> {
  const ids = formData
    .getAll("categoryId")
    .map(String)
    .filter((id) => z.string().uuid().safeParse(id).success);

  if (ids.length === 0) {
    return state({ ok: false, error: "Choose at least one trade to continue." });
  }

  // Six is not a rule the database enforces; it is a judgement. An artisan
  // claiming eleven trades is an artisan claiming none of them credibly, and
  // the matcher would offer them everything.
  if (ids.length > 6) {
    return state({ ok: false, error: "Choose up to six trades — the ones you actually work in." });
  }

  const provider = await loadOwnProvider({ mustBeEditable: true });
  if (!provider) return state({ ok: false, error: NOT_EDITABLE });

  const supabase = await createClient();

  // Confirm every id is a real, active category before writing. A retired
  // category is one the matcher will never offer against.
  const { data: categories } = await supabase
    .from("categories")
    .select("id")
    .in("id", ids)
    .eq("is_active", true);

  const valid = (categories ?? []).map((c) => c.id);
  if (valid.length === 0) {
    return state({ ok: false, error: "Those services are not available right now." });
  }

  await supabase.from("provider_categories").delete().eq("provider_id", provider.profile_id);

  const { error } = await supabase
    .from("provider_categories")
    .insert(valid.map((categoryId) => ({ provider_id: provider.profile_id, category_id: categoryId })));

  if (error) {
    console.error("[providers] saveTrades failed", error);
    return state({ ok: false, error: "Could not save your trades. Try again." });
  }

  revalidatePath("/provider/apply", "layout");
  redirect("/provider/apply/about");
}

// ---------------------------------------------------------------------------
// Step 2 — about you
// ---------------------------------------------------------------------------

const aboutSchema = z.object({
  bio: z
    .string()
    .trim()
    .min(MIN_BIO_LENGTH, `Write at least ${MIN_BIO_LENGTH} characters so clients know what you do.`)
    .max(MAX_BIO_LENGTH, `Keep it under ${MAX_BIO_LENGTH} characters.`),
  yearsExperience: z.coerce
    .number({ message: "Enter a number of years." })
    .int("Whole years, please.")
    .min(0, "That cannot be negative.")
    .max(70, "Enter a number of years up to 70."),
  baseCity: z
    .string()
    .trim()
    .min(2, "Where do you work from?")
    .max(80, "Keep this short — a town or an area."),
  serviceRadiusKm: z.coerce.number().refine(
    (value) => (SERVICE_RADIUS_OPTIONS as readonly number[]).includes(value),
    "Choose how far you are willing to travel.",
  ),
  languages: z.string().optional(),
});

export async function saveAboutAction(
  _prev: ProviderActionState | null,
  formData: FormData,
): Promise<ProviderActionState> {
  const parsed = aboutSchema.safeParse({
    bio: formData.get("bio") ?? "",
    yearsExperience: formData.get("yearsExperience"),
    baseCity: formData.get("baseCity") ?? "",
    serviceRadiusKm: formData.get("serviceRadiusKm"),
    languages: formData.get("languages") ?? undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return state({ ok: false, fieldErrors });
  }

  const provider = await loadOwnProvider({ mustBeEditable: true });
  if (!provider) return state({ ok: false, error: NOT_EDITABLE });

  const supabase = await createClient();

  const { error } = await supabase
    .from("providers")
    .update({
      bio: parsed.data.bio,
      years_experience: parsed.data.yearsExperience,
      base_city: parsed.data.baseCity,
      service_radius_km: parsed.data.serviceRadiusKm,
    })
    .eq("profile_id", provider.profile_id);

  if (error) {
    console.error("[providers] saveAbout failed", error);
    return state({ ok: false, error: "Could not save that. Try again." });
  }

  // Languages live on `profiles`, not `providers` — a client filtering for a
  // Twi speaker is filtering people, not trades (PLAN.md §2).
  const languages = (parsed.data.languages ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is (typeof SPOKEN_LANGUAGES)[number] =>
      (SPOKEN_LANGUAGES as readonly string[]).includes(value),
    );

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ spoken_languages: languages.length > 0 ? languages : ["English"] })
    .eq("id", provider.profile_id);

  if (profileError) {
    console.error("[providers] saveAbout languages failed", profileError);
  }

  revalidatePath("/provider/apply", "layout");
  redirect("/provider/apply/payout");
}

// ---------------------------------------------------------------------------
// Step 3 — getting paid
// ---------------------------------------------------------------------------

const payoutSchema = z.object({
  momoNumber: z.string().trim().min(1, "Enter the number your mobile money is on."),
  momoNetwork: z.enum(["mtn", "telecel", "airteltigo"], {
    message: "Choose your mobile money network.",
  }),
});

export async function savePayoutAction(
  _prev: ProviderActionState | null,
  formData: FormData,
): Promise<ProviderActionState> {
  const parsed = payoutSchema.safeParse({
    momoNumber: formData.get("momoNumber") ?? "",
    momoNetwork: formData.get("momoNetwork") ?? "",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return state({ ok: false, fieldErrors });
  }

  // Normalised to E.164 here rather than trusted from the form: the column has
  // a `^\+233[0-9]{9}$` check on it, and "0244 123 456" is what people type.
  const momoNumber = normalisePhone(parsed.data.momoNumber);
  if (!momoNumber || !isValidGhanaPhone(momoNumber)) {
    return state({
      ok: false,
      fieldErrors: { momoNumber: "That is not a Ghana mobile number. Example: 024 123 4567." },
    });
  }

  const provider = await loadOwnProvider({ mustBeEditable: true });
  if (!provider) return state({ ok: false, error: NOT_EDITABLE });

  const supabase = await createClient();

  const { error } = await supabase
    .from("providers")
    .update({ momo_number: momoNumber, momo_network: parsed.data.momoNetwork })
    .eq("profile_id", provider.profile_id);

  if (error) {
    console.error("[providers] savePayout failed", error);
    return state({ ok: false, error: "Could not save your payment details. Try again." });
  }

  revalidatePath("/provider/apply", "layout");
  redirect("/provider/apply/documents");
}

// ---------------------------------------------------------------------------
// Step 4 — identity
// ---------------------------------------------------------------------------

export async function saveGhanaCardNumberAction(
  _prev: ProviderActionState | null,
  formData: FormData,
): Promise<ProviderActionState> {
  const raw = String(formData.get("ghanaCardNumber") ?? "")
    .trim()
    .toUpperCase();

  if (!isValidGhanaCardNumber(raw)) {
    return state({
      ok: false,
      fieldErrors: {
        ghanaCardNumber: "That is not a Ghana Card number. It looks like GHA-123456789-0.",
      },
    });
  }

  const provider = await loadOwnProvider({ mustBeEditable: true });
  if (!provider) return state({ ok: false, error: NOT_EDITABLE });

  const supabase = await createClient();

  const { error } = await supabase
    .from("providers")
    .update({ ghana_card_number: raw })
    .eq("profile_id", provider.profile_id);

  if (error) {
    console.error("[providers] saveGhanaCardNumber failed", error);
    return state({ ok: false, error: "Could not save that number. Try again." });
  }

  revalidatePath("/provider/apply", "layout");
  return state({ ok: true });
}

const attachDocSchema = z.object({
  docType: z.enum(["ghana_card_front", "ghana_card_back", "selfie", "work_photo", "certificate"]),
  /**
   * The object's NAME inside the artisan's own folder, never a path. The full
   * key is built here from their id, so a caller cannot register a document
   * that lives under somebody else's folder.
   */
  objectName: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[A-Za-z0-9._-]+$/, "Unexpected file name."),
});

/**
 * Records a document the browser has already uploaded.
 *
 * For the three singleton types, a second upload replaces the first — the
 * unique index in 0008 would otherwise reject it, and "you already uploaded a
 * Ghana Card front, delete it first" is a worse answer than just replacing the
 * blurred one. The old object is removed after the row, best effort.
 */
export async function attachProviderDocumentAction(
  docType: ProviderDocType,
  objectName: string,
): Promise<ProviderActionState> {
  const parsed = attachDocSchema.safeParse({ docType, objectName });
  if (!parsed.success) return state({ ok: false, error: "That file could not be attached." });

  const provider = await loadOwnProvider({ mustBeEditable: true });
  if (!provider) return state({ ok: false, error: NOT_EDITABLE });

  const supabase = await createClient();
  const providerId = provider.profile_id;
  const storagePath = `${providerId}/${parsed.data.objectName}`;

  let replacedPath: string | null = null;

  if (isSingletonDoc(parsed.data.docType)) {
    const { data: existing } = await supabase
      .from("provider_documents")
      .select("id, storage_path")
      .eq("provider_id", providerId)
      .eq("doc_type", parsed.data.docType)
      .maybeSingle();

    if (existing) {
      replacedPath = existing.storage_path;
      await supabase.from("provider_documents").delete().eq("id", existing.id);
    }
  } else {
    // Ten work photos is a portfolio; fifty is a storage bill.
    const { count } = await supabase
      .from("provider_documents")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", providerId)
      .eq("doc_type", parsed.data.docType);

    if ((count ?? 0) >= 8) {
      return state({ ok: false, error: "You can add up to eight of these." });
    }
  }

  const { error } = await supabase.from("provider_documents").insert({
    provider_id: providerId,
    doc_type: parsed.data.docType,
    storage_path: storagePath,
  });

  if (error) {
    console.error("[providers] attachProviderDocument failed", error);
    return state({ ok: false, error: "Could not save that photo." });
  }

  // Only once the replacement is safely recorded. An orphaned object costs a
  // few kilobytes; deleting the old one first and then failing would leave the
  // artisan with neither.
  if (replacedPath) {
    const { error: storageError } = await supabase.storage
      .from(PROVIDER_DOC_BUCKET)
      .remove([replacedPath]);

    if (storageError) {
      console.warn("[providers] replaced doc row but object remains", replacedPath, storageError);
    }
  }

  revalidatePath("/provider/apply", "layout");
  return state({ ok: true });
}

export async function removeProviderDocumentAction(
  documentId: string,
): Promise<ProviderActionState> {
  const parsed = z.string().uuid().safeParse(documentId);
  if (!parsed.success) return state({ ok: false, error: "That file could not be removed." });

  const provider = await loadOwnProvider({ mustBeEditable: true });
  if (!provider) return state({ ok: false, error: NOT_EDITABLE });

  const supabase = await createClient();

  // Read the row first: after it is gone nothing records which object it was.
  const { data: doc } = await supabase
    .from("provider_documents")
    .select("id, provider_id, storage_path")
    .eq("id", parsed.data)
    .maybeSingle();

  if (!doc || doc.provider_id !== provider.profile_id) {
    return state({ ok: false, error: "That file could not be removed." });
  }

  const { error } = await supabase.from("provider_documents").delete().eq("id", parsed.data);

  if (error) {
    console.error("[providers] removeProviderDocument failed", error);
    return state({ ok: false, error: "Could not remove that file." });
  }

  const { error: storageError } = await supabase.storage
    .from(PROVIDER_DOC_BUCKET)
    .remove([doc.storage_path]);

  if (storageError) {
    console.warn("[providers] doc row deleted but object remains", doc.storage_path, storageError);
  }

  revalidatePath("/provider/apply", "layout");
  return state({ ok: true });
}

// ---------------------------------------------------------------------------
// Step 5 — send it
// ---------------------------------------------------------------------------

export async function submitApplicationAction(): Promise<ProviderActionState> {
  const supabase = await createClient();

  // Completeness is validated inside `submit_provider_application`, not here.
  // The form is not a security boundary, and an incomplete application costs an
  // admin a phone call — so the rule lives where it cannot be skipped.
  const { error } = await supabase.rpc("submit_provider_application");

  if (error) {
    console.error("[providers] submitApplication failed", error);
    return state({
      ok: false,
      // Postgres raises these with a human sentence already (see 0008).
      error: error.message.replace(/^.*?:\s*/, "") || "Could not send your application. Try again.",
    });
  }

  revalidatePath("/provider", "layout");
  redirect("/provider?submitted=1");
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

/**
 * The one control that decides whether the matcher can see this artisan.
 *
 * Returns the availability the database settled on rather than the one asked
 * for, so the toggle can correct itself instead of showing "Online" while the
 * row says otherwise — the exact desync that would have an artisan waiting for
 * offers that are going to somebody else.
 */
export async function setAvailabilityAction(
  online: boolean,
): Promise<ProviderActionState & { availability?: "offline" | "online" | "on_job" }> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("set_provider_availability", { p_online: online });

  if (error) {
    console.error("[providers] setAvailability failed", error);
    return {
      ...state({
        ok: false,
        error: error.message.replace(/^.*?:\s*/, "") || "Could not change your availability.",
      }),
    };
  }

  revalidatePath("/provider");
  return { ...state({ ok: true }), availability: data ?? undefined };
}

// ---------------------------------------------------------------------------
// Offers — Phase 3
// ---------------------------------------------------------------------------

/**
 * Accept or pass on a job.
 *
 * Returns the status the *database* settled on, not the one that was asked for.
 * Two artisans can tap Accept in the same second and only one can win; the
 * loser needs to be told what actually happened rather than shown a screen that
 * behaves as though they got it.
 */
export async function respondToOfferAction(
  offerId: string,
  accept: boolean,
): Promise<ProviderActionState & { status?: string }> {
  const parsed = z.string().uuid().safeParse(offerId);
  if (!parsed.success) return state({ ok: false, error: "That offer could not be found." });

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("respond_to_offer", {
    p_offer_id: parsed.data,
    p_accept: accept,
  });

  if (error) {
    console.error("[offers] respondToOffer failed", error);
    return state({
      ok: false,
      // Postgres raises these with a human sentence already (see 0011).
      error: error.message.replace(/^.*?:\s*/, "") || "Could not send your answer.",
    });
  }

  revalidatePath("/provider", "layout");
  return { ...state({ ok: true }), status: data ?? undefined };
}

// ---------------------------------------------------------------------------
// Quoting — Phase 3
// ---------------------------------------------------------------------------

/**
 * Line items only.
 *
 * `amount` is absent on purpose, and so are the subtotal, the service fee, the
 * transport band and the deposit. `save_quote` derives every one of them. A
 * quote is a number somebody pays — it does not come off a form, and a client
 * who tampers with this payload can change what the *artisan* asked for, never
 * what anybody is charged.
 */
const quoteItemSchema = z.object({
  kind: z.enum(["labour", "material"]),
  description: z.string().trim().min(1, "Describe the line.").max(200),
  quantity: z.coerce.number().positive("Quantity must be more than zero.").max(9999),
  unitPrice: z.coerce.number().min(0, "A price cannot be negative.").max(1_000_000),
});

const saveQuoteSchema = z.object({
  jobId: z.string().uuid("That job could not be found."),
  items: z.array(quoteItemSchema).min(1, "Add at least one line.").max(30, "Up to 30 lines."),
  notes: z.string().trim().max(1000).optional(),
});

export type QuoteItemDraft = z.input<typeof quoteItemSchema>;

export async function saveQuoteAction(input: {
  jobId: string;
  items: QuoteItemDraft[];
  notes?: string;
}): Promise<ProviderActionState & { quoteId?: string }> {
  const parsed = saveQuoteSchema.safeParse(input);

  if (!parsed.success) {
    return state({
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the quote and try again.",
    });
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("save_quote", {
    p_job_id: parsed.data.jobId,
    p_items: parsed.data.items.map((item) => ({
      kind: item.kind,
      description: item.description,
      quantity: Number(item.quantity),
      unit_price: Number(item.unitPrice),
    })),
    p_notes: parsed.data.notes ?? null,
  });

  if (error) {
    console.error("[quotes] saveQuote failed", error);
    return state({
      ok: false,
      error: error.message.replace(/^.*?:\s*/, "") || "Could not save the quote.",
    });
  }

  revalidatePath(`/provider/jobs/${parsed.data.jobId}`, "layout");
  return { ...state({ ok: true }), quoteId: data ?? undefined };
}

export async function sendQuoteAction(quoteId: string): Promise<ProviderActionState> {
  const parsed = z.string().uuid().safeParse(quoteId);
  if (!parsed.success) return state({ ok: false, error: "That quote could not be found." });

  const supabase = await createClient();

  const { error } = await supabase.rpc("send_quote", { p_quote_id: parsed.data });

  if (error) {
    console.error("[quotes] sendQuote failed", error);
    return state({
      ok: false,
      error: error.message.replace(/^.*?:\s*/, "") || "Could not send the quote.",
    });
  }

  revalidatePath("/provider", "layout");
  return state({ ok: true });
}

/* -------------------------------------------------------------------------
 * Phase 5 — driving the job on site
 * ---------------------------------------------------------------------- */

const EXECUTION_STEPS = ["en_route", "arrived", "in_progress", "awaiting_signoff"] as const;

const advanceSchema = z.object({
  jobId: z.string().uuid("That job could not be found."),
  to: z.enum(EXECUTION_STEPS, { message: "That is not a step on this job." }),
});

/**
 * Move the job to its next execution state.
 *
 * Every rule lives in `advance_job_execution` (migrations 0015-0017): that the
 * caller is the assigned artisan, that the requested edge is a legal
 * transition rather than whatever the client asked for, and that work cannot
 * be marked done without a completion photo. The action parses a form and
 * reports the outcome.
 *
 * Existed only as an RPC until now. The database layer and its e2e suite were
 * both complete, which is exactly why this was easy to miss — `e2e:execution`
 * passes by calling the function directly, so a job driven through the real UI
 * stopped dead at `deposit_paid` with no button to press.
 */
export async function advanceJobAction(
  jobId: string,
  to: (typeof EXECUTION_STEPS)[number],
): Promise<ProviderActionState> {
  const parsed = advanceSchema.safeParse({ jobId, to });

  if (!parsed.success) {
    return state({ ok: false, error: parsed.error.issues[0]?.message ?? "That step is not valid." });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("advance_job_execution", {
    p_job_id: parsed.data.jobId,
    p_to: parsed.data.to,
  });

  if (error) {
    console.error("[provider] advance_job_execution failed", error.message);
    return state({ ok: false, error: error.message });
  }

  revalidatePath(`/provider/jobs/${parsed.data.jobId}`);
  revalidatePath("/provider");
  return state({ ok: true });
}

const completionPhotoSchema = z.object({
  jobId: z.string().uuid("That job could not be found."),
  objectName: z
    .string()
    .trim()
    .min(1)
    .max(200)
    // Generated by the uploader, never taken from the user's filename — the
    // storage key is part of a policy expression.
    .regex(/^completion-[0-9a-f-]{36}\.[a-z0-9]{1,5}$/i, "That photo could not be attached."),
});

/**
 * Record a photo of the finished work.
 *
 * The client-side `attachJobPhotoAction` cannot serve this: it requires the
 * caller to own the job as a client AND the job to still be a draft. The
 * artisan is neither.
 *
 * `advance_job_execution` refuses to move a job to `awaiting_signoff` with no
 * completion photo (0015), so this is what unlocks the last step — and the
 * photo is what the client signs off on and what settles a dispute six weeks
 * later.
 */
export async function attachCompletionPhotoAction(
  jobId: string,
  objectName: string,
): Promise<ProviderActionState> {
  const parsed = completionPhotoSchema.safeParse({ jobId, objectName });
  if (!parsed.success) {
    return state({ ok: false, error: parsed.error.issues[0]?.message ?? "Could not attach that." });
  }

  const provider = await getMyProvider();
  if (!provider) return state({ ok: false, error: "You need an artisan account." });

  const supabase = await createClient();

  // Ownership is re-checked here rather than trusted from the page: a Server
  // Action is a public POST endpoint, and a well-formed payload can name
  // somebody else's job.
  const { data: job } = await supabase
    .from("jobs")
    .select("id, status, provider_id")
    .eq("id", parsed.data.jobId)
    .maybeSingle();

  if (!job || job.provider_id !== provider.profile_id) {
    return state({ ok: false, error: "That is not your job." });
  }

  if (job.status !== "in_progress") {
    return state({ ok: false, error: "You can add these once the work is under way." });
  }

  const { error } = await supabase.from("job_photos").insert({
    job_id: parsed.data.jobId,
    storage_path: `${parsed.data.jobId}/${parsed.data.objectName}`,
    stage: "completion",
    uploaded_by: provider.profile_id,
  });

  if (error) {
    console.error("[provider] completion photo insert failed", error.message);
    return state({ ok: false, error: "Could not save that photo. Try again." });
  }

  revalidatePath(`/provider/jobs/${parsed.data.jobId}`);
  return state({ ok: true });
}
