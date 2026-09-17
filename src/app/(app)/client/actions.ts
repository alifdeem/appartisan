"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { JOB_PHOTO_BUCKET, MAX_JOB_PHOTOS, VOICE_NOTE_BUCKET } from "@/lib/jobs/media";
import { isValidGhanaPostCode } from "@/lib/integrations/maps/types";
import { getPaymentProvider } from "@/lib/integrations/payments";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import type { JobRow, MomoNetwork } from "@/lib/supabase/types";

/**
 * Client job-posting actions.
 *
 * Three rules hold across every function here, and they are the reason this
 * file is longer than the forms it serves:
 *
 *  1. **A Server Action is a public POST endpoint.** Rendering the form behind
 *     an authenticated page proves nothing about who called the action. Every
 *     one of these re-reads the session and re-checks ownership.
 *  2. **The client sends a reference, never a record.** Actions take a job id
 *     and the field being changed; everything else is read back from the
 *     database under RLS. A well-formed payload can still name somebody else's
 *     job.
 *  3. **Photos and voice notes never travel through here.** Server Action
 *     bodies are capped at 1MB by default and a job photo is allowed to be
 *     10MB. The browser uploads straight to Supabase Storage — where the same
 *     RLS policies apply — and these actions only record the resulting path.
 */

export interface JobActionState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /**
   * Fresh on every result, so a form can tell "the action ran again" from "the
   * state happens to look the same" during render rather than in an effect.
   * Same device as the auth forms use.
   */
  token: string;
}

function state(value: Omit<JobActionState, "token">): JobActionState {
  return { ...value, token: randomUUID() };
}

/**
 * The session's own id, or a thrown error. Never accepts a caller-supplied id.
 */
async function requireClientId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("You need to be signed in.");
  return user.id;
}

/**
 * Load a job the caller owns, optionally insisting it is still a draft.
 *
 * Returns null rather than throwing on a miss, so callers can decide between a
 * 404 and a form error. RLS would already hide another client's job; the
 * explicit `client_id` check is here because this module is what stops a
 * provider or admin session from driving a client-only flow by hand.
 */
async function loadOwnedJob(
  jobId: string,
  { mustBeDraft = false }: { mustBeDraft?: boolean } = {},
): Promise<JobRow | null> {
  const clientId = await requireClientId();
  const supabase = await createClient();

  const { data } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (!data) return null;
  if (mustBeDraft && data.status !== "draft") return null;

  return data as JobRow;
}

const uuid = z.string().uuid("That job could not be found.");

// ---------------------------------------------------------------------------
// Step 1 — choose a category, which creates the draft
// ---------------------------------------------------------------------------

/**
 * The draft row exists from the first step on purpose.
 *
 * Photos and voice notes are stored under a folder named for the job id, and
 * every storage policy on those buckets resolves that folder through
 * `can_view_job()`. There is no valid upload path before a job exists. Creating
 * the draft up front also makes the flow resumable: a dropped connection
 * halfway through costs the user the current field, not the four photos they
 * already uploaded.
 */
export async function startDraftAction(
  _prev: JobActionState | null,
  formData: FormData,
): Promise<JobActionState> {
  const categoryId = uuid.safeParse(formData.get("categoryId"));
  if (!categoryId.success) {
    return state({ ok: false, error: "Choose a service to continue." });
  }

  const clientId = await requireClientId();
  const supabase = await createClient();

  // Confirm the category is real and open for business before writing a job
  // against it — `jobs.category_id` is a restrict-on-delete foreign key, and a
  // job pointing at a retired category is a job nobody will ever be offered.
  const { data: category } = await supabase
    .from("categories")
    .select("id, is_active")
    .eq("id", categoryId.data)
    .maybeSingle();

  if (!category?.is_active) {
    return state({ ok: false, error: "That service is not available right now." });
  }

  // One unfinished draft per category is plenty. Reusing it stops a client who
  // taps back and forth from leaving a trail of empty jobs behind them.
  const { data: existing } = await supabase
    .from("jobs")
    .select("id")
    .eq("client_id", clientId)
    .eq("category_id", categoryId.data)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    redirect(`/client/post/${existing.id}/describe`);
  }

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({ client_id: clientId, category_id: categoryId.data })
    .select("id")
    .single();

  if (error || !job) {
    console.error("[jobs] startDraft failed", error);
    return state({ ok: false, error: "Could not start that request. Try again." });
  }

  revalidatePath("/client");
  redirect(`/client/post/${job.id}/describe`);
}

// ---------------------------------------------------------------------------
// Step 2 — describe the job
// ---------------------------------------------------------------------------

const describeSchema = z.object({
  jobId: uuid,
  description: z
    .string()
    .trim()
    .max(2000, "Keep the description under 2000 characters.")
    .optional(),
});

export async function saveDescriptionAction(
  _prev: JobActionState | null,
  formData: FormData,
): Promise<JobActionState> {
  const parsed = describeSchema.safeParse({
    jobId: formData.get("jobId"),
    description: formData.get("description") ?? undefined,
  });

  if (!parsed.success) {
    return state({
      ok: false,
      fieldErrors: { description: parsed.error.issues[0]?.message ?? "Check the details." },
    });
  }

  const { jobId, description } = parsed.data;

  const job = await loadOwnedJob(jobId, { mustBeDraft: true });
  if (!job) return state({ ok: false, error: "That draft is no longer editable." });

  const trimmed = description?.trim() ?? "";

  // The same either-or the database enforces in `post_job`, checked here so the
  // user is told at the step where they can still fix it rather than two
  // screens later at the point of no return.
  if (trimmed === "" && !job.voice_note_path) {
    return state({
      ok: false,
      fieldErrors: {
        description: "Describe the problem, or record a voice note below.",
      },
    });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("jobs")
    .update({ description: trimmed === "" ? null : trimmed })
    .eq("id", jobId);

  if (error) {
    console.error("[jobs] saveDescription failed", error);
    return state({ ok: false, error: "Could not save that. Try again." });
  }

  revalidatePath(`/client/post/${jobId}`, "layout");
  redirect(`/client/post/${jobId}/location`);
}

// ---------------------------------------------------------------------------
// Step 3 — pin the location
// ---------------------------------------------------------------------------

const locationSchema = z.object({
  jobId: uuid,
  // Coerced because they arrive from hidden inputs the map component writes.
  lat: z.coerce.number({ message: "Drop a pin on the map." }).min(4.5).max(11.2),
  lng: z.coerce.number({ message: "Drop a pin on the map." }).min(-3.3).max(1.2),
  addressText: z.string().trim().max(300).optional(),
  ghanapostCode: z.string().trim().max(20).optional(),
  /**
   * Required, and it is the pin that makes it so rather than the other way
   * round. PostGIS gets the artisan to the right street; a street in Accra can
   * be four unmarked gates and no numbers. The landmark is the half of the
   * address a human actually uses on arrival, which is why the picker has
   * always drawn it with a required marker — this is where that marker became
   * true. Mirrored in `post_job` (migration 0009), which is what enforces it.
   */
  landmark: z
    .string()
    .trim()
    .min(10, "Describe how to find the place — “blue gate opposite Melcom”.")
    .max(200, "Keep the landmark under 200 characters."),
});

export async function saveLocationAction(
  _prev: JobActionState | null,
  formData: FormData,
): Promise<JobActionState> {
  const parsed = locationSchema.safeParse({
    jobId: formData.get("jobId"),
    lat: formData.get("lat"),
    lng: formData.get("lng"),
    addressText: formData.get("addressText") || undefined,
    ghanapostCode: formData.get("ghanapostCode") || undefined,
    // Not coalesced to undefined like the two above it: an empty landmark is a
    // *missing required value*, and it should meet the length rule's sentence
    // rather than zod's generic "Required".
    landmark: formData.get("landmark") ?? "",
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = String(issue?.path[0] ?? "form");
    return state({
      ok: false,
      fieldErrors: {
        // lat and lng are one control as far as the user is concerned.
        [field === "lat" || field === "lng" ? "pin" : field]:
          field === "lat" || field === "lng"
            ? "Drop a pin inside Ghana to continue."
            : (issue?.message ?? "Check this field."),
      },
    });
  }

  const { jobId, lat, lng, addressText, ghanapostCode, landmark } = parsed.data;

  // A GhanaPostGPS code is optional, but a malformed one is worse than none —
  // an artisan typing GA-543-012 into the app will be sent to the wrong place.
  if (ghanapostCode && !isValidGhanaPostCode(ghanapostCode)) {
    return state({
      ok: false,
      fieldErrors: { ghanapostCode: "That is not a GhanaPostGPS code. Example: GA-543-0125." },
    });
  }

  const job = await loadOwnedJob(jobId, { mustBeDraft: true });
  if (!job) return state({ ok: false, error: "That draft is no longer editable." });

  const supabase = await createClient();

  // PostGIS geography cannot be written through PostgREST, and the RPC is also
  // where the Ghana bounds check lives — so this is not a convenience wrapper,
  // it is the only way to set a pin.
  const { error } = await supabase.rpc("set_job_location", {
    p_job_id: jobId,
    p_lng: lng,
    p_lat: lat,
    p_address_text: addressText ?? null,
    p_ghanapost_code: ghanapostCode ?? null,
    p_landmark: landmark ?? null,
  });

  if (error) {
    console.error("[jobs] setJobLocation failed", error);
    return state({ ok: false, error: "Could not save that location. Try again." });
  }

  revalidatePath(`/client/post/${jobId}`, "layout");
  redirect(`/client/post/${jobId}/review`);
}

// ---------------------------------------------------------------------------
// Step 4 — post it
// ---------------------------------------------------------------------------

export async function postJobAction(
  _prev: JobActionState | null,
  formData: FormData,
): Promise<JobActionState> {
  const parsed = uuid.safeParse(formData.get("jobId"));
  if (!parsed.success) return state({ ok: false, error: "That job could not be found." });

  const jobId = parsed.data;

  const job = await loadOwnedJob(jobId, { mustBeDraft: true });
  if (!job) return state({ ok: false, error: "That draft has already been posted." });

  const supabase = await createClient();

  // Completeness is validated inside `post_job`, not here. The form is not a
  // security boundary and a half-described job wastes an artisan's trip, so the
  // rule lives where it cannot be skipped.
  const { error } = await supabase.rpc("post_job", { p_job_id: jobId });

  if (error) {
    console.error("[jobs] postJob failed", error);
    return state({
      ok: false,
      // Postgres raises these with a human sentence already (see 0007).
      error: error.message.replace(/^.*?:\s*/, "") || "Could not post the job. Try again.",
    });
  }

  revalidatePath("/client");
  revalidatePath("/client/jobs");
  redirect(`/client/jobs/${jobId}?posted=1`);
}

// ---------------------------------------------------------------------------
// Media — recording what the browser uploaded
// ---------------------------------------------------------------------------

const attachPhotoSchema = z.object({
  jobId: uuid,
  /**
   * The object's NAME inside the job folder, not a path. The full key is built
   * here from the job id, so a caller cannot register a photo that lives under
   * somebody else's job.
   */
  objectName: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[A-Za-z0-9._-]+$/, "Unexpected file name."),
});

export async function attachJobPhotoAction(
  jobId: string,
  objectName: string,
): Promise<JobActionState> {
  const parsed = attachPhotoSchema.safeParse({ jobId, objectName });
  if (!parsed.success) return state({ ok: false, error: "That photo could not be attached." });

  const clientId = await requireClientId();
  const job = await loadOwnedJob(parsed.data.jobId, { mustBeDraft: true });
  if (!job) return state({ ok: false, error: "That draft is no longer editable." });

  const supabase = await createClient();

  const { count } = await supabase
    .from("job_photos")
    .select("id", { count: "exact", head: true })
    .eq("job_id", parsed.data.jobId);

  if ((count ?? 0) >= MAX_JOB_PHOTOS) {
    return state({ ok: false, error: `You can attach up to ${MAX_JOB_PHOTOS} photos.` });
  }

  const storagePath = `${parsed.data.jobId}/${parsed.data.objectName}`;

  const { error } = await supabase.from("job_photos").insert({
    job_id: parsed.data.jobId,
    storage_path: storagePath,
    stage: "request",
    uploaded_by: clientId,
  });

  if (error) {
    console.error("[jobs] attachJobPhoto failed", error);
    return state({ ok: false, error: "Could not attach that photo." });
  }

  revalidatePath(`/client/post/${parsed.data.jobId}`, "layout");
  return state({ ok: true });
}

export async function removeJobPhotoAction(photoId: string): Promise<JobActionState> {
  const parsed = uuid.safeParse(photoId);
  if (!parsed.success) return state({ ok: false, error: "That photo could not be removed." });

  const clientId = await requireClientId();
  const supabase = await createClient();

  // Read the row first: the storage object has to be deleted too, and after the
  // row is gone there is nothing left that says which object it was.
  const { data: photo } = await supabase
    .from("job_photos")
    .select("id, job_id, storage_path, uploaded_by")
    .eq("id", parsed.data)
    .maybeSingle();

  if (!photo || photo.uploaded_by !== clientId) {
    return state({ ok: false, error: "That photo could not be removed." });
  }

  const job = await loadOwnedJob(photo.job_id, { mustBeDraft: true });
  if (!job) return state({ ok: false, error: "This job can no longer be edited." });

  const { error } = await supabase.from("job_photos").delete().eq("id", parsed.data);

  if (error) {
    console.error("[jobs] removeJobPhoto failed", error);
    return state({ ok: false, error: "Could not remove that photo." });
  }

  // Best effort. An orphaned object costs a few kilobytes; a failure here must
  // not leave the user staring at a photo the database says is gone.
  const { error: storageError } = await supabase.storage
    .from(JOB_PHOTO_BUCKET)
    .remove([photo.storage_path]);

  if (storageError) {
    console.warn("[jobs] photo row deleted but object remains", photo.storage_path, storageError);
  }

  revalidatePath(`/client/post/${photo.job_id}`, "layout");
  return state({ ok: true });
}

const voiceNoteSchema = z.object({
  jobId: uuid,
  objectName: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[A-Za-z0-9._-]+$/, "Unexpected file name."),
});

export async function setVoiceNoteAction(
  jobId: string,
  objectName: string,
): Promise<JobActionState> {
  const parsed = voiceNoteSchema.safeParse({ jobId, objectName });
  if (!parsed.success) return state({ ok: false, error: "That recording could not be saved." });

  const job = await loadOwnedJob(parsed.data.jobId, { mustBeDraft: true });
  if (!job) return state({ ok: false, error: "That draft is no longer editable." });

  const supabase = await createClient();
  const { error } = await supabase
    .from("jobs")
    .update({ voice_note_path: `${parsed.data.jobId}/${parsed.data.objectName}` })
    .eq("id", parsed.data.jobId);

  if (error) {
    console.error("[jobs] setVoiceNote failed", error);
    return state({ ok: false, error: "Could not save that recording." });
  }

  revalidatePath(`/client/post/${parsed.data.jobId}`, "layout");
  return state({ ok: true });
}

export async function clearVoiceNoteAction(jobId: string): Promise<JobActionState> {
  const parsed = uuid.safeParse(jobId);
  if (!parsed.success) return state({ ok: false, error: "That recording could not be removed." });

  const job = await loadOwnedJob(parsed.data, { mustBeDraft: true });
  if (!job) return state({ ok: false, error: "That draft is no longer editable." });

  const supabase = await createClient();

  const { error } = await supabase
    .from("jobs")
    .update({ voice_note_path: null })
    .eq("id", parsed.data);

  if (error) {
    console.error("[jobs] clearVoiceNote failed", error);
    return state({ ok: false, error: "Could not remove that recording." });
  }

  if (job.voice_note_path) {
    await supabase.storage.from(VOICE_NOTE_BUCKET).remove([job.voice_note_path]);
  }

  revalidatePath(`/client/post/${parsed.data}`, "layout");
  return state({ ok: true });
}

// ---------------------------------------------------------------------------
// Leaving
// ---------------------------------------------------------------------------

export async function discardDraftAction(
  _prev: JobActionState | null,
  formData: FormData,
): Promise<JobActionState> {
  const parsed = uuid.safeParse(formData.get("jobId"));
  if (!parsed.success) return state({ ok: false, error: "That draft could not be discarded." });

  const jobId = parsed.data;
  const job = await loadOwnedJob(jobId, { mustBeDraft: true });
  if (!job) return state({ ok: false, error: "That draft is already gone." });

  const supabase = await createClient();

  // Clear the bucket before the row: `job_photos` cascades on job delete, and
  // once the rows are gone nothing records which objects belonged to this job.
  const { data: photos } = await supabase
    .from("job_photos")
    .select("storage_path")
    .eq("job_id", jobId);

  if (photos && photos.length > 0) {
    await supabase.storage.from(JOB_PHOTO_BUCKET).remove(photos.map((p) => p.storage_path));
  }

  if (job.voice_note_path) {
    await supabase.storage.from(VOICE_NOTE_BUCKET).remove([job.voice_note_path]);
  }

  const { error } = await supabase.from("jobs").delete().eq("id", jobId);

  if (error) {
    console.error("[jobs] discardDraft failed", error);
    return state({ ok: false, error: "Could not discard that draft." });
  }

  revalidatePath("/client");
  redirect("/client");
}

// ---------------------------------------------------------------------------
// The quote — Phase 3
// ---------------------------------------------------------------------------

/**
 * Accept the price, or send the job back out.
 *
 * **Declining is not a failure and must not be built like one.** With no price
 * guidance in v1 (PLAN.md §2) artisans price freely and clients decline, so
 * this path gets walked often — `respond_to_quote` puts the job straight back
 * into matching, and the declined artisan is never re-offered it because the
 * candidate query already excludes anyone who has seen the job.
 *
 * The reason is optional on purpose. Requiring a client to justify declining a
 * price they did not like would depress the decline rate rather than improve
 * the data, and a job bounced back with no explanation still tells us the
 * number was wrong.
 */
export async function respondToQuoteAction(
  quoteId: string,
  accept: boolean,
  reason?: string,
): Promise<JobActionState & { status?: string }> {
  const parsed = uuid.safeParse(quoteId);
  if (!parsed.success) return state({ ok: false, error: "That quote could not be found." });

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("respond_to_quote", {
    p_quote_id: parsed.data,
    p_accept: accept,
    p_reason: reason?.trim().slice(0, 300) || null,
  });

  if (error) {
    console.error("[quotes] respondToQuote failed", error);
    return state({
      ok: false,
      error: error.message.replace(/^.*?:\s*/, "") || "Could not send your answer.",
    });
  }

  revalidatePath("/client", "layout");
  return { ...state({ ok: true }), status: data ?? undefined };
}

// ---------------------------------------------------------------------------
// The deposit — Phase 4
// ---------------------------------------------------------------------------

/**
 * Start a deposit charge and hand back where to complete it.
 *
 * Three rules hold here and none of them are negotiable:
 *
 *  1. **The amount is never sent from the browser.** It comes from
 *     `deposit_due_for_job`, which reads the accepted quote. A client who
 *     tampers with this payload can pick a network, and nothing else.
 *  2. **This does not mark anything paid.** It creates a `pending` row and a
 *     provider reference. Only the webhook may settle it — see
 *     `settle_payment` in migration 0012.
 *  3. **A previous failure is not an obstacle.** The partial unique index in
 *     0012 allows any number of attempts, so a declined prompt simply gets
 *     retried with a fresh reference.
 */
export async function startDepositAction(
  jobId: string,
  network: MomoNetwork,
): Promise<JobActionState & { authorizationUrl?: string }> {
  const parsedJob = uuid.safeParse(jobId);
  const parsedNetwork = z.enum(["mtn", "telecel", "airteltigo"]).safeParse(network);

  if (!parsedJob.success || !parsedNetwork.success) {
    return state({ ok: false, error: "That payment could not be started." });
  }

  const job = await loadOwnedJob(parsedJob.data);
  if (!job) return state({ ok: false, error: "That job could not be found." });

  if (job.status !== "awaiting_deposit") {
    return state({
      ok: false,
      error:
        job.status === "deposit_paid"
          ? "This deposit has already been paid."
          : "This job is not waiting for a deposit.",
    });
  }

  const supabase = await createClient();

  const { data: amount, error: amountError } = await supabase.rpc("deposit_due_for_job", {
    p_job_id: parsedJob.data,
  });

  if (amountError || amount === null) {
    console.error("[payments] deposit amount failed", amountError?.message);
    return state({ ok: false, error: "We could not work out what is due. Try again." });
  }

  const profile = await getCurrentProfile();
  if (!profile) return state({ ok: false, error: "You need to be signed in." });

  try {
    const provider = getPaymentProvider();
    const charge = await provider.initializeCharge({
      jobId: parsedJob.data,
      leg: "deposit",
      amountGhs: Number(amount),
      customerPhone: profile.phone,
      channel: "momo",
      momoNetwork: parsedNetwork.data,
      metadata: { reference: job.reference },
    });

    revalidatePath(`/client/jobs/${parsedJob.data}`);
    return { ...state({ ok: true }), authorizationUrl: charge.authorizationUrl };
  } catch (error) {
    console.error("[payments] initializeCharge failed", error);
    return state({
      ok: false,
      error: "We could not reach the payment service. Nothing was charged — try again.",
    });
  }
}

export async function cancelJobAction(
  _prev: JobActionState | null,
  formData: FormData,
): Promise<JobActionState> {
  const parsed = uuid.safeParse(formData.get("jobId"));
  if (!parsed.success) return state({ ok: false, error: "That job could not be cancelled." });

  const jobId = parsed.data;
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300);

  const job = await loadOwnedJob(jobId);
  if (!job) return state({ ok: false, error: "That job could not be found." });

  const supabase = await createClient();

  // Which statuses may still be cancelled without a charge is the database's
  // call (PLAN.md §7) — the UI only decides whether to offer the button.
  const { error } = await supabase.rpc("cancel_job", {
    p_job_id: jobId,
    p_reason: reason || null,
  });

  if (error) {
    console.error("[jobs] cancelJob failed", error);
    return state({
      ok: false,
      error: error.message.replace(/^.*?:\s*/, "") || "Could not cancel that job.",
    });
  }

  revalidatePath("/client");
  revalidatePath("/client/jobs");
  revalidatePath(`/client/jobs/${jobId}`);
  return state({ ok: true });
}

/* -------------------------------------------------------------------------
 * Phase 6 — rating and disputes
 * ---------------------------------------------------------------------- */

const rateSchema = z.object({
  jobId: z.string().uuid("That job could not be found."),
  stars: z.coerce.number().int().min(1, "Choose between 1 and 5 stars.").max(5, "Choose between 1 and 5 stars."),
  comment: z.string().trim().max(1000, "Keep the comment under 1000 characters.").optional(),
  tags: z.string().optional(),
});

/**
 * Rate the artisan.
 *
 * Every rule lives in `rate_job` (migration 0018): that the caller booked the
 * job, that the job is actually paid for, that one job carries one rating. The
 * action's job is to parse a form and report the outcome — same delegation as
 * the admin actions, for the same reason.
 */
export async function rateJobAction(
  _prev: JobActionState | null,
  formData: FormData,
): Promise<JobActionState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const parsed = rateSchema.safeParse({
    jobId: formData.get("jobId"),
    stars: formData.get("stars"),
    comment: formData.get("comment") || undefined,
    tags: formData.get("tags") || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? "form")] = issue.message;
    }
    return state({ ok: false, fieldErrors });
  }

  const { jobId, stars, comment, tags } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("rate_job", {
    p_job_id: jobId,
    p_stars: stars,
    p_comment: comment ?? null,
    p_tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
  });

  if (error) {
    console.error("[client] rate_job failed", error.message);
    return state({ ok: false, error: error.message });
  }

  revalidatePath(`/client/jobs/${jobId}`);
  return state({ ok: true });
}

const disputeSchema = z.object({
  jobId: z.string().uuid("That job could not be found."),
  reason: z.string().trim().min(5, "Say what went wrong.").max(200, "Keep the summary short."),
  detail: z.string().trim().max(2000, "Keep the detail under 2000 characters.").optional(),
  evidencePaths: z.string().optional(),
});

/**
 * Raise a dispute.
 *
 * Evidence images follow the same rule as job photos: the browser uploads
 * straight to Storage and only the resulting paths come through here, because
 * a Server Action body is capped at 1MB and a photo is not.
 */
export async function raiseDisputeAction(
  _prev: JobActionState | null,
  formData: FormData,
): Promise<JobActionState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const parsed = disputeSchema.safeParse({
    jobId: formData.get("jobId"),
    reason: formData.get("reason"),
    detail: formData.get("detail") || undefined,
    evidencePaths: formData.get("evidencePaths") || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? "form")] = issue.message;
    }
    return state({ ok: false, fieldErrors });
  }

  const { jobId, reason, detail, evidencePaths } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("raise_dispute", {
    p_job_id: jobId,
    p_reason: reason,
    p_detail: detail ?? null,
    p_evidence_paths: evidencePaths
      ? evidencePaths.split(",").map((p) => p.trim()).filter(Boolean)
      : [],
  });

  if (error) {
    console.error("[client] raise_dispute failed", error.message);
    return state({ ok: false, error: error.message });
  }

  revalidatePath(`/client/jobs/${jobId}`);
  return state({ ok: true });
}
