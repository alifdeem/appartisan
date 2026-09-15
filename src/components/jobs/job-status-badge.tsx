import { Badge } from "@/components/ui/badge";
import { jobStatus } from "@/lib/jobs/status";
import { cn } from "@/lib/utils";
import type { JobStatus } from "@/lib/supabase/types";

/**
 * A job's state, in the client's language.
 *
 * The live states get a quiet pulsing dot. It is doing real work: "Finding an
 * artisan" and "No artisan found" are both small text on a warm card, and
 * without motion a client on a stalled screen cannot tell at a glance whether
 * anything is still happening. The dot is the difference between waiting and
 * wondering.
 */
export function JobStatusBadge({
  status,
  className,
}: {
  status: JobStatus;
  className?: string;
}) {
  const presentation = jobStatus(status);
  const live = presentation.group === "active" && presentation.awaitingUs;

  return (
    <Badge tone={presentation.tone} className={cn("shrink-0", className)}>
      {live && (
        <span className="relative flex size-1.5" aria-hidden>
          <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-current" />
          <span className="relative inline-flex size-1.5 rounded-full bg-current" />
        </span>
      )}
      {presentation.label}
    </Badge>
  );
}
