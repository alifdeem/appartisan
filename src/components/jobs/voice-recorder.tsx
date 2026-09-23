"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mic, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { clearVoiceNoteAction, setVoiceNoteAction } from "@/app/(app)/client/actions";
import { Button } from "@/components/ui/button";
import {
  ACCEPTED_AUDIO_TYPES,
  MAX_VOICE_BYTES,
  MAX_VOICE_SECONDS,
  VOICE_NOTE_BUCKET,
  extensionForAudioType,
  formatBytes,
  formatDuration,
} from "@/lib/jobs/media";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

/**
 * A spoken description of the job.
 *
 * This is not a nice-to-have. The interface is in English (PLAN.md §2) because
 * maintaining Twi and Ga translations is a phase nobody has paid for, but a
 * large share of the people who most need an electrician would rather say what
 * is wrong than type it — and "the socket in the hall sparks when I plug the
 * fridge in" is a sentence that survives being spoken far better than being
 * typed on a cracked phone. The database treats a voice note as fully
 * equivalent to a written description: `post_job` accepts either.
 *
 * Browser reality this has to absorb:
 *
 *  • Chrome and Firefox record Opus in a WebM container; Safari records AAC in
 *    MP4 and has never supported WebM. The container is negotiated rather than
 *    assumed, and the bucket's allow-list covers both.
 *  • `MediaRecorder.mimeType` comes back as `audio/webm;codecs=opus`. Storage
 *    compares Content-Type against an exact allow-list, so the codec parameter
 *    is stripped before upload or the object is rejected as the wrong type.
 *  • The microphone stream stays live until every track is stopped. Leaving it
 *    open keeps the browser's recording indicator on after the user has
 *    finished, which reads as an app that is still listening.
 */

/** In preference order. The first the browser admits to is used. */
const CANDIDATE_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return CANDIDATE_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

/** `audio/webm;codecs=opus` → `audio/webm`, which is what the bucket allows. */
function baseMimeType(mimeType: string): string {
  const base = mimeType.split(";")[0].trim();
  return (ACCEPTED_AUDIO_TYPES as readonly string[]).includes(base) ? base : "audio/webm";
}

type Phase = "idle" | "recording" | "uploading";

/**
 * Whether the browser can record does not change while the page is open, so the
 * store never notifies. The unsubscribe is a no-op for the same reason.
 */
function subscribeToNothing(): () => void {
  return () => {};
}

export function VoiceRecorder({
  jobId,
  existingUrl,
  hasRecording,
  disabled = false,
}: {
  jobId: string;
  existingUrl: string | null;
  hasRecording: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [seconds, setSeconds] = React.useState(0);
  const [removing, setRemoving] = React.useState(false);

  /**
   * Can this browser record at all?
   *
   * A capability read, not application state — `useSyncExternalStore` is what
   * that is for. The alternatives are both wrong: a lazy `useState` initialiser
   * runs during the server render too and hydrates into a mismatch, and setting
   * it from an effect is a cascading render React 19 rightly flags.
   *
   * The server snapshot is optimistic. Assuming "yes" means the markup ships
   * with the recorder present and the rare incapable browser corrects on
   * hydration; assuming "no" would hide the control from everyone for a frame.
   */
  const supported = React.useSyncExternalStore(
    subscribeToNothing,
    () => navigator.mediaDevices?.getUserMedia !== undefined && pickMimeType() !== null,
    () => true,
  );

  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const streamRef = React.useRef<MediaStream | null>(null);
  const tickRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const releaseMic = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  // A navigation mid-recording must not leave the microphone open.
  React.useEffect(() => releaseMic, [releaseMic]);

  async function start() {
    const mimeType = pickMimeType();
    if (!mimeType) {
      toast.error("This browser cannot record audio. Type the description instead.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error("Microphone permission was refused. Type the description instead.");
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];

    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      const type = baseMimeType(recorder.mimeType || mimeType);
      const blob = new Blob(chunksRef.current, { type });
      releaseMic();
      void persist(blob, type);
    };

    recorder.start();
    setSeconds(0);
    setPhase("recording");

    tickRef.current = setInterval(() => {
      setSeconds((current) => {
        const next = current + 1;
        // Stop ourselves at the ceiling rather than letting the user record
        // three minutes and be told afterwards that it was too long.
        if (next >= MAX_VOICE_SECONDS) {
          recorderRef.current?.stop();
        }
        return next;
      });
    }, 1000);
  }

  function stop() {
    recorderRef.current?.stop();
    recorderRef.current = null;
  }

  async function persist(blob: Blob, type: string) {
    if (blob.size === 0) {
      setPhase("idle");
      toast.error("Nothing was recorded. Try again.");
      return;
    }

    if (blob.size > MAX_VOICE_BYTES) {
      setPhase("idle");
      toast.error(`That recording is ${formatBytes(blob.size)} — the limit is ${formatBytes(MAX_VOICE_BYTES)}.`);
      return;
    }

    setPhase("uploading");

    const supabase = createClient();
    const objectName = `voice-note.${extensionForAudioType(type)}`;

    // `upsert` because re-recording replaces the note in place. The bucket has
    // an UPDATE policy for exactly this (migration 0007) — without it the
    // second recording would be rejected while the first still existed.
    const { error } = await supabase.storage
      .from(VOICE_NOTE_BUCKET)
      .upload(`${jobId}/${objectName}`, blob, { contentType: type, upsert: true });

    if (error) {
      console.error("[voice] upload failed", error);
      setPhase("idle");
      toast.error("Could not save that recording.");
      return;
    }

    const result = await setVoiceNoteAction(jobId, objectName);
    setPhase("idle");

    if (!result.ok) {
      await supabase.storage.from(VOICE_NOTE_BUCKET).remove([`${jobId}/${objectName}`]);
      toast.error(result.error ?? "Could not save that recording.");
      return;
    }

    toast.success("Voice note saved.");
    router.refresh();
  }

  async function remove() {
    setRemoving(true);
    const result = await clearVoiceNoteAction(jobId);
    setRemoving(false);

    if (!result.ok) {
      toast.error(result.error ?? "Could not remove that recording.");
      return;
    }

    router.refresh();
  }

  if (!supported && !hasRecording) {
    return (
      <p className="rounded-[1.25rem] border border-dashed border-hairline bg-azure-50/60 px-4 py-3 text-note text-copy-muted">
        This browser cannot record audio — describe the job in writing above instead.
      </p>
    );
  }

  if (hasRecording && phase === "idle") {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-[1.25rem] border border-hairline bg-azure-50/60 p-3">
        {existingUrl ? (
          // Native controls on purpose: a hand-built scrubber is one more thing
          // to get wrong on a phone, and every browser already ships a good one.
          <audio src={existingUrl} controls preload="none" className="h-10 min-w-0 flex-1" />
        ) : (
          <p className="min-w-0 flex-1 text-note text-copy-muted">Voice note attached.</p>
        )}

        {!disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void remove()}
            loading={removing}
          >
            <Trash2 />
            Remove
          </Button>
        )}
      </div>
    );
  }

  if (disabled) return null;

  return (
    <div className="flex items-center gap-3">
      {phase === "recording" ? (
        <>
          <button
            type="button"
            onClick={stop}
            className={cn(
              "inline-flex min-h-11 items-center gap-2.5 rounded-full px-5",
              "bg-danger-600 text-white shadow-sm transition-transform duration-[var(--duration-instant)] active:scale-[0.98]",
            )}
          >
            <Square className="size-4 fill-current" aria-hidden />
            Stop
          </button>

          <div className="flex items-center gap-2" aria-live="polite">
            <span className="relative flex size-2.5" aria-hidden>
              <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-danger-500" />
              <span className="relative inline-flex size-2.5 rounded-full bg-danger-500" />
            </span>
            <span className="tabular font-mono text-sm font-medium text-navy-900">
              {formatDuration(seconds)}
            </span>
            <span className="text-2xs text-copy-muted">
              / {formatDuration(MAX_VOICE_SECONDS)}
            </span>
          </div>
        </>
      ) : (
        <Button
          type="button"
          variant="navyOutline"
          shape="pill"
          onClick={() => void start()}
          disabled={phase === "uploading"}
        >
          {phase === "uploading" ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Mic aria-hidden />
          )}
          {phase === "uploading" ? "Saving…" : "Record a voice note"}
        </Button>
      )}
    </div>
  );
}
