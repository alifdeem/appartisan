"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateSettingAction, type AdminActionState } from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/button";

/**
 * One tunable setting.
 *
 * Its own form per row rather than one big save, because these are unrelated
 * values and a single submit turns "I changed the commission" into "I also
 * resubmitted every threshold on the page" — including any a colleague changed
 * while this tab was open.
 *
 * The value round-trips as JSON text: `settings.value` is jsonb and holds
 * numbers, arrays and objects depending on the key, so a typed input would
 * either lie about the shape or need a schema per key.
 */
export function SettingField({
  settingKey,
  label,
  description,
  value,
}: {
  settingKey: string;
  label: string;
  description: string | null;
  value: unknown;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [state, setState] = React.useState<AdminActionState | null>(null);
  const serialised = JSON.stringify(value);
  const [draft, setDraft] = React.useState(serialised);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const next = await updateSettingAction(null, formData);
      setState(next);

      if (next.ok) {
        toast.success(`${label} saved.`);
        router.refresh();
      } else if (next.error) {
        toast.error(next.error);
      }
    });
  }

  const dirty = draft !== serialised;
  const error = state?.fieldErrors?.[settingKey];

  return (
    <form onSubmit={onSubmit} className="space-y-2 border-b border-ink-100 py-4 last:border-0">
      <input type="hidden" name="key" value={settingKey} />

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label
          htmlFor={`setting-${settingKey}`}
          className="tabular font-mono text-[0.8125rem] font-medium text-ink-900"
        >
          {label}
        </label>
        {dirty && (
          <span className="font-mono text-[0.6875rem] tracking-wide text-accent-700 uppercase">
            unsaved
          </span>
        )}
      </div>

      {description && <p className="text-sm text-ink-500">{description}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <input
          id={`setting-${settingKey}`}
          name="value"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          spellCheck={false}
          className="tabular min-h-11 min-w-0 flex-1 rounded-field border border-ink-200 bg-ink-25 px-3 font-mono text-sm text-ink-900 focus:border-ink-400 focus:outline-none"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={pending || !dirty}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>

      {error && <p className="text-sm text-danger-700">{error}</p>}
    </form>
  );
}
