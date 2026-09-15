/**
 * Media limits for a job request.
 *
 * These mirror the bucket definitions in migration 0001 exactly. Storage
 * enforces them server-side and will reject an oversized file regardless of
 * what this module says — the point of duplicating them here is that the user
 * finds out before a 9MB upload over a metered connection, not after.
 *
 * Keep the numbers in step with `storage.buckets` if either ever changes.
 */

export const JOB_PHOTO_BUCKET = "job-photos";
export const VOICE_NOTE_BUCKET = "voice-notes";

/** Mirrors `job_photo_max_count` in settings (migration 0007). */
export const MAX_JOB_PHOTOS = 6;

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_VOICE_BYTES = 5 * 1024 * 1024;

/** Two minutes is long enough to describe a leak and short enough to upload. */
export const MAX_VOICE_SECONDS = 120;

export const ACCEPTED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
] as const;

/**
 * What the bucket accepts. Chrome and Firefox record `audio/webm`; Safari only
 * does `audio/mp4`. Both are allowed, so the recorder picks whichever the
 * browser actually supports rather than forcing one and failing on iOS.
 */
export const ACCEPTED_AUDIO_TYPES = [
  "audio/webm",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
] as const;

/** The `accept` attribute for the photo input. HEIC comes off every iPhone. */
export const PHOTO_ACCEPT_ATTR = ACCEPTED_PHOTO_TYPES.join(",");

export function isAcceptedPhoto(file: File): boolean {
  return (ACCEPTED_PHOTO_TYPES as readonly string[]).includes(file.type);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Storage keys are `<job id>/<name>`, because every policy on these buckets
 * reads `storage.foldername(name)[1]` as the job id and hands it to
 * `can_view_job()`. Getting this shape wrong does not fail loudly — it fails as
 * a permission denied on upload, which looks like a broken app.
 */
export function jobPhotoPath(jobId: string, fileName: string): string {
  return `${jobId}/${fileName}`;
}

export function voiceNotePath(jobId: string, extension: string): string {
  return `${jobId}/voice-note.${extension}`;
}

/** `audio/webm;codecs=opus` → `webm`. */
export function extensionForAudioType(mimeType: string): string {
  const base = mimeType.split(";")[0].trim();
  switch (base) {
    case "audio/mp4":
      return "m4a";
    case "audio/mpeg":
      return "mp3";
    case "audio/ogg":
      return "ogg";
    default:
      return "webm";
  }
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
