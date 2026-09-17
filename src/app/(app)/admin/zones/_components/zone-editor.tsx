"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, Check, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { retireTransportZoneAction, saveTransportZoneAction } from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatAmount } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { TransportZoneRow } from "@/lib/supabase/types";

/**
 * The band ladder, edited in place.
 *
 * Built as a table rather than a stack of cards because the whole point is
 * reading the ladder as a ladder — an admin is checking that 0–5, 5–15, 15–30
 * line up without gaps or overlaps, and that comparison is vertical. Cards
 * would make every row pretty and the sequence illegible.
 *
 * A row becomes editable in place rather than opening a modal. There are four
 * short fields; a dialog would be more ceremony than the task deserves and
 * would hide the neighbouring bands, which are the only context that matters
 * when changing one.
 *
 * `city = '*'` is shown as "Everywhere" — it is the fallback
 * `transport_fee_for_distance` falls back to when no city-specific band
 * matches, and spelling that out beats leaving an asterisk to be decoded.
 */

interface Draft {
  id?: string;
  city: string;
  minKm: string;
  maxKm: string;
  fee: string;
  isActive: boolean;
}

function toDraft(zone: TransportZoneRow): Draft {
  return {
    id: zone.id,
    city: zone.city,
    minKm: String(zone.min_km),
    maxKm: String(zone.max_km),
    fee: String(zone.fee),
    isActive: zone.is_active,
  };
}

const BLANK: Draft = { city: "*", minKm: "", maxKm: "", fee: "", isActive: true };

export function ZoneEditor({ zones }: { zones: TransportZoneRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [editing, setEditing] = React.useState<Draft | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function save(draft: Draft) {
    setError(null);

    const formData = new FormData();
    if (draft.id) formData.set("id", draft.id);
    formData.set("city", draft.city.trim() || "*");
    formData.set("minKm", draft.minKm);
    formData.set("maxKm", draft.maxKm);
    formData.set("fee", draft.fee);
    if (draft.isActive) formData.set("isActive", "on");

    startTransition(async () => {
      const result = await saveTransportZoneAction(null, formData);

      if (!result.ok) {
        setError(result.error ?? Object.values(result.fieldErrors ?? {})[0] ?? "Could not save.");
        return;
      }

      toast.success(draft.id ? "Band updated." : "Band added.");
      setEditing(null);
      router.refresh();
    });
  }

  function retire(zoneId: string) {
    startTransition(async () => {
      const result = await retireTransportZoneAction(zoneId);
      if (!result.ok) {
        toast.error(result.error ?? "Could not retire that band.");
        return;
      }
      toast.success("Band retired. Existing quotes keep the fee they were built with.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-card border border-ink-200 bg-ink-0 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-200 bg-ink-25 text-left">
              <Th>City</Th>
              <Th className="text-right">From</Th>
              <Th className="text-right">To</Th>
              <Th className="text-right">Fee</Th>
              <Th className="w-px" />
            </tr>
          </thead>

          <tbody className="divide-y divide-ink-100">
            {zones.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-ink-500">
                  No bands yet. Add the first one below.
                </td>
              </tr>
            )}

            {zones.map((zone) =>
              editing?.id === zone.id ? (
                <EditRow
                  key={zone.id}
                  draft={editing}
                  onChange={setEditing}
                  onSave={() => save(editing)}
                  onCancel={() => {
                    setEditing(null);
                    setError(null);
                  }}
                  pending={pending}
                />
              ) : (
                <tr
                  key={zone.id}
                  className={cn(
                    "transition-colors duration-[var(--duration-instant)] hover:bg-ink-50",
                    !zone.is_active && "opacity-50",
                  )}
                >
                  <Td>
                    {zone.city === "*" ? (
                      <span className="text-ink-600">Everywhere</span>
                    ) : (
                      zone.city
                    )}
                    {!zone.is_active && (
                      <span className="ml-2 text-xs text-ink-400">retired</span>
                    )}
                  </Td>
                  <Td className="tabular text-right font-mono">{Number(zone.min_km)} km</Td>
                  <Td className="tabular text-right font-mono">{Number(zone.max_km)} km</Td>
                  <Td className="tabular text-right font-mono font-medium text-accent-900">
                    {formatAmount(Number(zone.fee))}
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing(toDraft(zone))}
                        className="rounded-field px-2.5 py-1 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50"
                      >
                        Edit
                      </button>
                      {zone.is_active && (
                        <button
                          type="button"
                          onClick={() => retire(zone.id)}
                          title="Retire this band"
                          className="grid size-8 place-items-center rounded-field text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
                        >
                          <Archive className="size-4" aria-hidden />
                          <span className="sr-only">Retire</span>
                        </button>
                      )}
                    </div>
                  </Td>
                </tr>
              ),
            )}

            {editing && !editing.id && (
              <EditRow
                draft={editing}
                onChange={setEditing}
                onSave={() => save(editing)}
                onCancel={() => {
                  setEditing(null);
                  setError(null);
                }}
                pending={pending}
              />
            )}
          </tbody>
        </table>
      </div>

      {error && (
        <p role="alert" className="animate-fade-in text-sm text-danger-600">
          {error}
        </p>
      )}

      {!editing && (
        <Button type="button" variant="secondary" onClick={() => setEditing({ ...BLANK })}>
          <Plus />
          Add a band
        </Button>
      )}
    </div>
  );
}

function EditRow({
  draft,
  onChange,
  onSave,
  onCancel,
  pending,
}: {
  draft: Draft;
  onChange: (draft: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
  pending: boolean;
}) {
  return (
    <tr className="bg-brand-50/50">
      <Td>
        <Input
          value={draft.city}
          onChange={(event) => onChange({ ...draft, city: event.target.value })}
          placeholder="*"
          aria-label="City, or * for everywhere"
          className="min-h-9 py-1"
        />
      </Td>
      <Td>
        <Input
          value={draft.minKm}
          onChange={(event) => onChange({ ...draft, minKm: event.target.value })}
          inputMode="decimal"
          placeholder="0"
          aria-label="From, km"
          className="tabular min-h-9 py-1 text-right font-mono"
        />
      </Td>
      <Td>
        <Input
          value={draft.maxKm}
          onChange={(event) => onChange({ ...draft, maxKm: event.target.value })}
          inputMode="decimal"
          placeholder="5"
          aria-label="To, km"
          className="tabular min-h-9 py-1 text-right font-mono"
        />
      </Td>
      <Td>
        <Input
          value={draft.fee}
          onChange={(event) => onChange({ ...draft, fee: event.target.value })}
          inputMode="decimal"
          placeholder="20"
          aria-label="Fee in cedis"
          className="tabular min-h-9 py-1 text-right font-mono"
        />
      </Td>
      <Td>
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            title="Save"
            className="grid size-8 place-items-center rounded-field bg-brand-700 text-white transition-transform duration-[var(--duration-instant)] hover:bg-brand-800 active:scale-90 disabled:opacity-50"
          >
            <Check className="size-4" strokeWidth={3} aria-hidden />
            <span className="sr-only">Save</span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            title="Cancel"
            className="grid size-8 place-items-center rounded-field text-ink-500 transition-colors hover:bg-ink-100"
          >
            <X className="size-4" aria-hidden />
            <span className="sr-only">Cancel</span>
          </button>
        </div>
      </Td>
    </tr>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-2.5 text-xs font-semibold tracking-wide text-ink-500 uppercase",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-2.5 text-ink-800", className)}>{children}</td>;
}
