"use client";

import * as React from "react";
import { useActionState } from "react";
import { ArrowUpRight, Check, Zap } from "lucide-react";

import { saveScheduleAction } from "@/app/(app)/client/actions";
import { FieldLabel } from "@/components/mobile/field-label";
import { StickyAction } from "@/components/mobile/sticky-action";
import { Button } from "@/components/ui/button";
import {
  PREFERRED_WINDOWS,
  WINDOW_LABELS,
  dateLabel,
  dayLabel,
  upcomingDays,
  type PreferredWindow,
} from "@/lib/jobs/schedule";
import { cn } from "@/lib/utils";

/**
 * When the client would like the artisan — the reference's `@4-shedule-time`.
 *
 * **Windows, not times.** The reference offers exact slots ("10.00 AM"). This
 * product cannot honour one: the matcher offers the job to the nearest
 * *available* artisan the moment it is posted, and there is no calendar, no
 * hold, and no accept-for-later. A screen that took "Thursday, 10:00" and then
 * sent someone round on Tuesday afternoon would be the app's first broken
 * promise, on the screen where it asks to be trusted.
 *
 * So the client picks a day and a part of it, the artisan sees that in the
 * offer, and the two of them settle the actual hour on the call they already
 * have — which is how this trade is arranged in Accra anyway. The screen says
 * so in as many words rather than leaving it to be discovered.
 *
 * **"As soon as possible" is the default and comes first.** It is what most
 * people posting a job with no water want, it is the only option the product
 * can act on immediately, and making it the pre-selected first card means the
 * common case is Continue with nothing tapped.
 *
 * The date row only appears once a day is being chosen, so the screen opens as
 * one decision rather than three.
 */
export function ScheduleForm({
  jobId,
  initialDate,
  initialWindow,
}: {
  jobId: string;
  initialDate: string | null;
  initialWindow: PreferredWindow | null;
}) {
  const [state, formAction, pending] = useActionState(saveScheduleAction, null);

  // `!initialDate`, not `initialDate === null`. PostgREST omits a column that
  // is not in its schema cache rather than returning it as null, so a freshly
  // migrated table hands this `undefined` — and `undefined === null` is false,
  // which silently preselected "Pick a day" on every new draft.
  const [asap, setAsap] = React.useState(!initialDate);
  const [date, setDate] = React.useState(initialDate ?? null);
  const [window, setWindow] = React.useState<PreferredWindow | null>(initialWindow);

  // Computed once per mount, not per render: `new Date()` in the render body
  // would make "Today" drift if the component re-rendered across midnight, and
  // would give the server and the client different arrays during hydration.
  const days = React.useMemo(() => upcomingDays(7), []);
  const today = React.useMemo(() => new Date(), []);

  function chooseAsap() {
    setAsap(true);
    setDate(null);
    setWindow(null);
  }

  function chooseDay(key: string) {
    setAsap(false);
    setDate(key);
  }

  return (
    <form action={formAction} className="space-y-7">
      <input type="hidden" name="jobId" value={jobId} />
      {/* The action reads these, not the buttons — the buttons are the UI. */}
      <input type="hidden" name="preferredDate" value={asap ? "" : (date ?? "")} />
      <input type="hidden" name="preferredWindow" value={asap ? "" : (window ?? "")} />

      <div className="space-y-2">
        <h1 className="font-space text-title-sm font-bold text-balance text-navy-900">
          When suits you?
        </h1>
        <p className="text-note leading-relaxed text-copy-muted">
          We start looking for an artisan as soon as you post. This tells them when you&rsquo;d
          like them — you&rsquo;ll agree the exact time with them directly.
        </p>
      </div>

      <div className="space-y-2.5">
        <Option
          selected={asap}
          onSelect={chooseAsap}
          icon={<Zap className="size-5" aria-hidden />}
          title="As soon as possible"
          detail="The nearest available artisan, right away."
        />

        <Option
          selected={!asap}
          onSelect={() => {
            setAsap(false);
            if (!date) setDate(days[0].key);
          }}
          title="Pick a day"
          detail="Choose a day and roughly what time."
        />
      </div>

      {!asap && (
        <div className="animate-fade-in space-y-6">
          <div className="space-y-2">
            <FieldLabel>Which day</FieldLabel>
            <div
              role="radiogroup"
              aria-label="Which day"
              className="-mx-5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <div className="flex gap-2">
                {days.map(({ key, date: d }) => {
                  const selected = date === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => chooseDay(key)}
                      className={cn(
                        "flex min-h-16 w-[4.5rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-[1.25rem] border",
                        "transition-[background-color,border-color,color] duration-[var(--duration-fast)] ease-out-strong",
                        selected
                          ? "border-navy-800 bg-linear-to-b from-navy-800 to-navy-900 text-white"
                          : "border-hairline bg-white text-navy-900 hover:border-azure-300",
                      )}
                    >
                      <span className="text-2xs font-medium opacity-80">
                        {dayLabel(d, today)}
                      </span>
                      <span className="tabular font-mono text-note font-bold">{dateLabel(d)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="text-note text-copy-muted">
              Need it further out than a week? Post it nearer the time — artisans are matched on
              who is free now.
            </p>
          </div>

          <div className="space-y-2">
            <FieldLabel>
              Roughly what time
              <span className="ml-1.5 tracking-normal normal-case opacity-70">optional</span>
            </FieldLabel>

            <div role="radiogroup" aria-label="Roughly what time" className="space-y-2">
              <TimeChoice
                selected={window === null}
                onSelect={() => setWindow(null)}
                label="Any time that day"
                hours="Whenever they can get to you"
              />
              {PREFERRED_WINDOWS.map((key) => (
                <TimeChoice
                  key={key}
                  selected={window === key}
                  onSelect={() => setWindow(key)}
                  label={WINDOW_LABELS[key].label}
                  hours={WINDOW_LABELS[key].hours}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {state?.error && (
        <p role="alert" className="animate-fade-in text-note text-danger-600">
          {state.error}
        </p>
      )}

      <StickyAction>
        <Button type="submit" variant="navy" size="lg" shape="pill" block loading={pending}>
          Continue
          <ArrowUpRight />
        </Button>
      </StickyAction>
    </form>
  );
}

function Option({
  selected,
  onSelect,
  icon,
  title,
  detail,
}: {
  selected: boolean;
  onSelect: () => void;
  icon?: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-[1.25rem] border p-4 text-left",
        "transition-[background-color,border-color,box-shadow] duration-[var(--duration-fast)] ease-out-strong",
        selected
          ? "border-azure-500 bg-azure-50"
          : "border-hairline bg-white hover:border-azure-300",
      )}
    >
      {icon && (
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full transition-colors",
            selected ? "bg-navy-800 text-white" : "bg-azure-50 text-navy-800",
          )}
        >
          {icon}
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="block font-space text-note font-bold text-navy-900">{title}</span>
        <span className="mt-0.5 block text-note text-copy-muted">{detail}</span>
      </span>

      <SelectionMark selected={selected} />
    </button>
  );
}

function TimeChoice({
  selected,
  onSelect,
  label,
  hours,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  hours: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex min-h-13 w-full items-center gap-3 rounded-[1.25rem] border px-4 py-3 text-left",
        "transition-[background-color,border-color] duration-[var(--duration-fast)] ease-out-strong",
        selected
          ? "border-azure-500 bg-azure-50"
          : "border-hairline bg-white hover:border-azure-300",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-note font-semibold text-navy-900">{label}</span>
        <span className="block text-2xs text-copy-muted">{hours}</span>
      </span>
      <SelectionMark selected={selected} />
    </button>
  );
}

/**
 * The reference's filled check circle. Always rendered, so the row does not
 * reflow by 24px the moment something is selected.
 */
function SelectionMark({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-full border-2",
        "transition-[background-color,border-color] duration-[var(--duration-fast)] ease-out-strong",
        selected ? "border-azure-500 bg-azure-500 text-white" : "border-hairline bg-white",
      )}
    >
      {selected && <Check className="size-3.5" strokeWidth={3} />}
    </span>
  );
}
