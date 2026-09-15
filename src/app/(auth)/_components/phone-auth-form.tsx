"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Hammer, House, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { OtpField } from "@/components/ui/otp-input";
import { SimulatedBadge } from "@/components/ui/badge";
import { formatPhoneForDisplay } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { requestCodeAction, verifyCodeAction, type ActionState } from "../actions";

type Mode = "login" | "signup";

const LANGUAGES = ["English", "Twi", "Ga", "Ewe", "Hausa", "Dagbani", "Fante"] as const;

export function PhoneAuthForm({ mode }: { mode: Mode }) {
  const [phone, setPhone] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [role, setRole] = React.useState<"client" | "provider">("client");
  const [languages, setLanguages] = React.useState<string[]>(["English"]);

  const [requestState, requestAction, requesting] = React.useActionState<ActionState | null, FormData>(
    requestCodeAction,
    null,
  );
  const [verifyState, verifyAction, verifying] = React.useActionState<ActionState | null, FormData>(
    verifyCodeAction,
    null,
  );

  // The canonical E.164 the server settled on — not whatever the user typed.
  const canonicalPhone = requestState?.phone ?? phone;

  /**
   * Which step we are on is a *derivation*, not a second copy of the truth.
   *
   * The obvious version — an effect that calls `setStep("code")` when the
   * action succeeds — makes React render the phone step, commit it, then
   * immediately re-render the code step. React 19 flags that as a cascading
   * render, and rightly so: the answer was already available during the first
   * render. Instead the action result carries a `token` that changes on every
   * result, and "go back" simply records the token the user dismissed.
   */
  const sentToken = requestState?.ok ? requestState.token : null;
  const [dismissedToken, setDismissedToken] = React.useState<string | null>(null);
  const step: "phone" | "code" = sentToken && sentToken !== dismissedToken ? "code" : "phone";

  // Toasts are genuine side effects — announcing a result, not deriving state —
  // so an effect is the right home for them.
  React.useEffect(() => {
    if (!requestState) return;
    if (requestState.ok) {
      toast.success("Code sent", {
        description: requestState.simulated
          ? "Simulated — no SMS was actually sent."
          : `Sent to ${formatPhoneForDisplay(requestState.phone ?? "")}.`,
      });
    } else if (requestState.error) {
      toast.error(requestState.error);
    }
  }, [requestState]);

  React.useEffect(() => {
    if (verifyState?.error) toast.error(verifyState.error);
  }, [verifyState]);

  if (step === "code") {
    return (
      <CodeStep
        mode={mode}
        phone={canonicalPhone}
        fullName={fullName}
        role={role}
        languages={languages}
        action={verifyAction}
        pending={verifying}
        state={verifyState}
        devCode={requestState?.devCode}
        simulated={requestState?.simulated ?? false}
        onBack={() => setDismissedToken(sentToken)}
      />
    );
  }

  return (
    <form action={requestAction} className="space-y-5">
      <input type="hidden" name="mode" value={mode} />

      {mode === "signup" && (
        <>
          <fieldset className="space-y-2">
            <legend className="mb-2 block text-sm font-medium text-ink-800">
              I want to
              <span className="ml-0.5 text-danger-600" aria-hidden>
                *
              </span>
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <RoleCard
                selected={role === "client"}
                onSelect={() => setRole("client")}
                icon={<House />}
                title="Book a service"
                subtitle="I need work done"
              />
              <RoleCard
                selected={role === "provider"}
                onSelect={() => setRole("provider")}
                icon={<Hammer />}
                title="Work as an artisan"
                subtitle="I offer a service"
              />
            </div>
            <input type="hidden" name="role" value={role} />
          </fieldset>

          <Field label="Full name" htmlFor="fullName" required error={requestState?.fieldErrors?.fullName}>
            <Input
              id="fullName"
              name="fullName"
              autoComplete="name"
              placeholder="Kwame Mensah"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              aria-invalid={Boolean(requestState?.fieldErrors?.fullName)}
              required
            />
          </Field>
        </>
      )}

      <Field
        label="Mobile number"
        htmlFor="phone"
        required
        error={requestState?.fieldErrors?.phone}
        hint="We'll text you a 6-digit code. Standard rates apply."
      >
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          autoFocus={mode === "login"}
          placeholder="024 123 4567"
          leading={<span className="tabular text-sm font-medium">🇬🇭 +233</span>}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          aria-invalid={Boolean(requestState?.fieldErrors?.phone)}
          required
        />
      </Field>

      {mode === "signup" && role === "provider" && (
        <fieldset className="space-y-2">
          <legend className="mb-2 block text-sm font-medium text-ink-800">
            Languages you speak
            <span className="ml-1.5 text-xs font-normal text-ink-400">
              clients see these before booking
            </span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((language) => {
              const active = languages.includes(language);
              return (
                <button
                  key={language}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setLanguages((current) =>
                      current.includes(language)
                        ? current.filter((l) => l !== language)
                        : [...current, language],
                    )
                  }
                  className={cn(
                    "min-h-9 rounded-full px-3.5 text-sm font-medium",
                    "transition-[background-color,color,border-color,transform] duration-[var(--duration-instant)] ease-out-strong",
                    "active:scale-[0.97]",
                    active
                      ? "border border-brand-600 bg-brand-50 text-brand-800"
                      : "border border-ink-300 bg-ink-0 text-ink-600 hover:border-ink-400 hover:text-ink-800",
                  )}
                >
                  {language}
                </button>
              );
            })}
          </div>
          <input type="hidden" name="spokenLanguages" value={languages.join(",")} />
        </fieldset>
      )}

      {requestState?.error && (
        <p role="alert" className="animate-fade-in flex items-start gap-2 text-sm text-danger-600">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {requestState.error}
        </p>
      )}

      <Button type="submit" size="lg" block loading={requesting}>
        Send code
        <ArrowRight />
      </Button>

      <p className="text-center text-sm text-ink-500">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link href="/signup" className="font-medium text-brand-700 hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-brand-700 hover:underline">
              Log in
            </Link>
          </>
        )}
      </p>

      {mode === "signup" && (
        <p className="text-center text-xs leading-relaxed text-ink-400">
          By continuing you agree to the ArtisanGH Terms of Service and Privacy Policy.
        </p>
      )}
    </form>
  );
}

function RoleCard({
  selected,
  onSelect,
  icon,
  title,
  subtitle,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex flex-col items-start gap-1.5 rounded-card border p-3.5 text-left",
        "transition-[border-color,background-color,box-shadow,transform] duration-[var(--duration-fast)] ease-out-strong",
        "active:scale-[0.98]",
        selected
          ? "border-brand-600 bg-brand-50 shadow-sm ring-1 ring-brand-600"
          : "border-ink-200 bg-ink-0 hover:border-ink-300 hover:shadow-xs",
      )}
    >
      <span
        className={cn(
          "grid size-9 place-items-center rounded-field [&_svg]:size-[1.125rem]",
          selected ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-600",
        )}
      >
        {icon}
      </span>
      <span className="text-sm font-semibold text-ink-900">{title}</span>
      <span className="text-xs text-ink-500">{subtitle}</span>
    </button>
  );
}

function CodeStep({
  mode,
  phone,
  fullName,
  role,
  languages,
  action,
  pending,
  state,
  devCode,
  simulated,
  onBack,
}: {
  mode: Mode;
  phone: string;
  fullName: string;
  role: "client" | "provider";
  languages: string[];
  action: (formData: FormData) => void;
  pending: boolean;
  state: ActionState | null;
  devCode?: string;
  simulated: boolean;
  onBack: () => void;
}) {
  const [code, setCode] = React.useState("");
  const formRef = React.useRef<HTMLFormElement>(null);

  // Submit the moment the sixth digit lands. Making someone tap "Verify" after
  // they have already typed the whole code is pure friction.
  const handleComplete = React.useCallback(() => {
    formRef.current?.requestSubmit();
  }, []);

  /**
   * A rejected code should clear the boxes so the next attempt starts from
   * empty. Doing that in an effect would render the stale digits once, then
   * blank them — a visible flash and a cascading render. Resetting during
   * render instead means the wrong code is never painted. `errorToken` changes
   * on every failed attempt, so re-entering the *same* wrong code still clears.
   */
  const errorToken = state?.error ? state.token : null;
  const [clearedToken, setClearedToken] = React.useState<string | null>(null);
  const shownCode = errorToken && errorToken !== clearedToken ? "" : code;

  function handleCodeChange(next: string) {
    if (errorToken && errorToken !== clearedToken) setClearedToken(errorToken);
    setCode(next);
  }

  return (
    <form ref={formRef} action={action} className="animate-fade-up space-y-6">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="phone" value={phone} />
      <input type="hidden" name="fullName" value={fullName} />
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="spokenLanguages" value={languages.join(",")} />
      <input type="hidden" name="code" value={shownCode} />

      <div className="space-y-1.5">
        <button
          type="button"
          onClick={onBack}
          className="-ml-1 inline-flex items-center gap-1 rounded-field px-1 py-0.5 text-sm text-ink-500 transition-colors hover:text-ink-800"
        >
          <ArrowLeft className="size-4" />
          Change number
        </button>
        <p className="text-sm text-ink-600">
          Enter the 6-digit code sent to{" "}
          <span className="font-medium tabular text-ink-900">{formatPhoneForDisplay(phone)}</span>
        </p>
      </div>

      <div className="flex justify-center py-1">
        <OtpField
          value={shownCode}
          onChange={handleCodeChange}
          onComplete={handleComplete}
          disabled={pending}
        />
      </div>

      {simulated && devCode && (
        <div className="animate-fade-in rounded-card border border-dashed border-warning-500/50 bg-warning-50 p-3.5">
          <div className="flex items-center justify-between gap-3">
            <SimulatedBadge label="No SMS sent" />
            <code className="tabular text-lg font-semibold tracking-[0.2em] text-warning-700">
              {devCode}
            </code>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-warning-700">
            SMS is running against the mock adapter, so the code is shown here instead of being
            texted. Swap <code className="font-mono">SMS_PROVIDER=live</code> to send for real.
          </p>
        </div>
      )}

      {state?.error && (
        <p role="alert" className="animate-fade-in flex items-start gap-2 text-sm text-danger-600">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" block loading={pending} disabled={shownCode.length !== 6}>
        {mode === "signup" ? "Create account" : "Log in"}
      </Button>
    </form>
  );
}
