"use client";

import * as React from "react";
import { useActionState } from "react";
import { Check, Info, Smartphone } from "lucide-react";

import { savePayoutAction } from "@/app/(app)/provider/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { MOMO_NETWORK_LABELS, detectMomoNetwork, normalisePhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import type { MomoNetwork } from "@/lib/supabase/types";

const NETWORKS: MomoNetwork[] = ["mtn", "telecel", "airteltigo"];

/**
 * The mobile money number an artisan gets paid on.
 *
 * **The network is detected, then confirmed.** Ghanaian prefixes map cleanly to
 * networks, so asking somebody to pick from three buttons when the number they
 * just typed already answers the question is asking them to do the computer's
 * job. It is a suggestion rather than a lock, because ported numbers exist and
 * a wrong network on a payout is a support ticket rather than a retry.
 *
 * **The networks are not in their brand colours.** MTN yellow sitting next to
 * this app's amber would be the loudest thing on the screen, and amber in this
 * design system means money and nothing else (DESIGN.md §3). A yellow tile that
 * is not a cedi amount devalues every tile that is.
 *
 * **It offers the account number rather than pre-filling it.** Most artisans are
 * paid on the phone they signed up with, and most is not all — a silently
 * pre-filled payout destination is the kind of default nobody reads and
 * everybody regrets.
 */
export function PayoutForm({
  momoNumber,
  momoNetwork,
  accountPhone,
}: {
  momoNumber: string | null;
  momoNetwork: MomoNetwork | null;
  accountPhone: string | null;
}) {
  const [state, formAction, pending] = useActionState(savePayoutAction, null);

  const [number, setNumber] = React.useState(momoNumber ?? "");
  /** Null means "follow the number". Set only when the artisan overrides it. */
  const [override, setOverride] = React.useState<MomoNetwork | null>(momoNetwork);

  const normalised = normalisePhone(number);
  const detected = normalised ? detectMomoNetwork(normalised) : null;
  const network = override ?? detected;

  const sameAsAccount = accountPhone !== null && normalised === accountPhone;
  const showUseAccount = accountPhone !== null && !sameAsAccount;

  return (
    <form action={formAction} className="space-y-5">
      <Field
        label="Mobile money number"
        htmlFor="momoNumber"
        required
        error={state?.fieldErrors?.momoNumber}
        hint="The number that receives the money. It does not have to be the one you signed up with."
      >
        <Input
          id="momoNumber"
          name="momoNumber"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={number}
          onChange={(event) => {
            setNumber(event.target.value);
            // A new number re-opens the detection. Keeping a stale override
            // here is how somebody's Telecel choice follows an MTN number.
            setOverride(null);
          }}
          placeholder="024 123 4567"
          className="tabular font-mono"
          leading={<Smartphone className="size-4" aria-hidden />}
          aria-invalid={Boolean(state?.fieldErrors?.momoNumber)}
        />
      </Field>

      {showUseAccount && (
        <button
          type="button"
          onClick={() => {
            setNumber(accountPhone);
            setOverride(null);
          }}
          className="-mt-3 text-sm font-medium text-navy-800 underline-offset-4 transition-colors hover:text-navy-900 hover:underline"
        >
          Use the number I signed up with
        </button>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-navy-900">
          Network
          <span className="ml-0.5 text-danger-600" aria-hidden>
            *
          </span>
        </legend>
        <input type="hidden" name="momoNetwork" value={network ?? ""} />

        <div className="grid grid-cols-3 gap-2">
          {NETWORKS.map((option) => {
            const on = network === option;
            const auto = on && override === null && detected === option;

            return (
              <button
                key={option}
                type="button"
                onClick={() => setOverride(option)}
                aria-pressed={on}
                className={cn(
                  "relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-field border px-2 text-sm font-medium",
                  "transition-[border-color,background-color,color,transform] duration-[var(--duration-fast)] ease-out-strong",
                  "active:scale-[0.98]",
                  on
                    ? "border-navy-800 bg-azure-50 text-navy-900 ring-1 ring-navy-800"
                    : "border-hairline bg-white text-copy hover:border-copy-muted",
                )}
              >
                {on && (
                  <Check
                    className="absolute top-1.5 right-1.5 size-3.5 text-navy-800 animate-fade-in"
                    strokeWidth={3}
                    aria-hidden
                  />
                )}
                <span className="leading-tight">{MOMO_NETWORK_LABELS[option]}</span>
                {auto && <span className="text-[0.6875rem] text-navy-800">from your number</span>}
              </button>
            );
          })}
        </div>

        {state?.fieldErrors?.momoNetwork && (
          <p role="alert" className="animate-fade-in text-sm text-danger-600">
            {state.fieldErrors.momoNetwork}
          </p>
        )}
      </fieldset>

      <div className="flex items-start gap-2.5 rounded-card border border-hairline bg-canvas px-3.5 py-3">
        <Info className="mt-px size-4 shrink-0 text-copy-muted" aria-hidden />
        <p className="text-sm leading-relaxed text-copy-muted">
          Make sure the name registered on this mobile money account is{" "}
          <strong className="font-medium text-navy-900">your own</strong>. Payouts to a number
          registered to somebody else get held, and sorting that out takes days.
        </p>
      </div>

      {state?.error && (
        <p role="alert" className="animate-fade-in text-sm text-danger-600">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" loading={pending} disabled={!network}>
        Continue
      </Button>
    </form>
  );
}
