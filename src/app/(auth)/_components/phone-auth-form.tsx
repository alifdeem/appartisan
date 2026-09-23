"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Phone, TriangleAlert, User, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { IconField, IconFieldInput } from "@/components/mobile/icon-field";
import { OtpField } from "@/components/ui/otp-input";
import { SimulatedBadge } from "@/components/ui/badge";
import { formatPhoneForDisplay } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { requestCodeAction, verifyCodeAction, type ActionState } from "../actions";

/**
 * The phone + code form, restyled for the 2026 reference.
 *
 * **What did not change: the wire.** Every `name`, every hidden input and every
 * submitted value is byte-identical to what `requestCodeAction` and
 * `verifyCodeAction` parsed before this file was touched — `mode`, `phone`,
 * `fullName`, `role`, `spokenLanguages`, `code`. So is the two-step derivation
 * and the token dance that drives it. Only the chrome is new.
 *
 * **There is no password field, and there cannot be one.** The mockup draws
 * one, under a "Remember me / Forgot password?" row. ArtisanGH has no passwords
 * at all: `verifyCodeAction` takes a six-digit OTP and there is no credential to
 * forget or to remember. Drawing the field anyway would have been a control
 * wired to nothing.
 *
 * The honest translation keeps the mockup's *shape* — two credentials, one
 * card, one primary action — and splits it across the two steps the backend
 * actually has. Step one asks for the number; step two puts the code where the
 * password box was drawn. Same card, same rhythm, same single CTA.
 */

type Mode = "login" | "signup";

const LANGUAGES = ["English", "Twi", "Ga", "Ewe", "Hausa", "Dagbani", "Fante"] as const;

export function PhoneAuthForm({
  mode,
  initialRole,
  title,
  subtitle,
  titleAs: Heading = "h1",
}: {
  mode: Mode;
  /**
   * The card's heading, rendered here rather than by the page.
   *
   * The page cannot own it: which step we are on is client state derived inside
   * this component, and the verify step needs a heading of its own. Left in the
   * page, "Create your account" sat above "Check your phone number" — two
   * competing headings and an h2-then-h1 outline.
   */
  title?: string;
  subtitle?: string;
  /**
   * The card title's heading level.
   *
   * It is `h1` by default because on `/signup?role=…` the card *is* the screen
   * — there is nothing above it but a logo, so its title is the document
   * heading. The login screen is the other case: it leads with a hero headline
   * that is already the page's `h1`, and a second one inside the card makes the
   * screen announce as two documents. That is the same two-`h1` fault the
   * provider signup had before Phase 1 demoted `ScreenHeader`'s title, and it
   * is invisible to both `tsc` and eslint — only reading the rendered outline
   * catches it.
   *
   * It is a prop rather than something this component works out for itself
   * because only the page knows what else is on the screen.
   */
  titleAs?: "h1" | "h2";
  /**
   * Set when the role was already chosen on the preceding screen
   * (`/signup?role=…`). When present the in-form role picker is hidden — asking
   * the same question twice makes the first answer look like it was ignored.
   * The value still posts as a hidden input, so `requestCodeAction` receives
   * exactly the same `FormData` either way.
   */
  initialRole?: "client" | "provider";
}) {
  const [phone, setPhone] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [role] = React.useState<"client" | "provider">(initialRole ?? "client");
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
        titleAs={Heading}
        onBack={() => setDismissedToken(sentToken)}
      />
    );
  }

  return (
    <form action={requestAction} className="animate-fade-up">
      {title && (
        <div className="mb-6">
          <Heading className="font-space text-title-sm font-bold text-navy-900">{title}</Heading>
          {subtitle && <p className="mt-1.5 text-ui text-copy-muted">{subtitle}</p>}
        </div>
      )}

      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="role" value={role} />

      <div className="space-y-3.5">
        {mode === "signup" && (
          <Field error={requestState?.fieldErrors?.fullName}>
            <IconField icon={<User />} error={Boolean(requestState?.fieldErrors?.fullName)}>
              <IconFieldInput
                id="fullName"
                name="fullName"
                aria-label="Full name"
                autoComplete="name"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                aria-invalid={Boolean(requestState?.fieldErrors?.fullName)}
                required
              />
            </IconField>
          </Field>
        )}

        <Field
          error={requestState?.fieldErrors?.phone}
          hint="We'll text you a 6-digit code. Standard rates apply."
        >
          <IconField
            icon={<Phone />}
            error={Boolean(requestState?.fieldErrors?.phone)}
            /* The flag is an indicator, not a picker. The mockup pairs it with a
               chevron; every number on this platform is Ghanaian, so a control
               offering one option would be offering a choice that has an
               answer. It reads as read-only because it is. */
            trailing={
              <span className="tabular flex items-center gap-1.5 rounded-lg bg-azure-50 px-2.5 py-1.5 text-note font-medium text-navy-800">
                <span aria-hidden>🇬🇭</span>
                +233
              </span>
            }
          >
            <IconFieldInput
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              aria-label="Phone number"
              autoFocus={mode === "login"}
              placeholder="024 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-invalid={Boolean(requestState?.fieldErrors?.phone)}
              required
            />
          </IconField>
        </Field>
      </div>

      {mode === "signup" && role === "provider" && (
        <fieldset className="mt-5">
          <legend className="mb-2.5 text-note font-medium text-copy">
            Languages you speak
            <span className="ml-1.5 font-normal text-copy-muted">
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
                    "min-h-10 rounded-full px-3.5 text-note font-medium",
                    "transition-[background-color,color,border-color,transform] duration-[var(--duration-instant)] ease-out-strong",
                    "active:scale-[0.97]",
                    active
                      ? "border border-azure-500 bg-azure-50 text-navy-800"
                      : "border border-hairline bg-white text-copy-muted hover:border-azure-300 hover:text-copy",
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

      {requestState?.error && <FormError>{requestState.error}</FormError>}

      <Button
        type="submit"
        variant="navy"
        size="lg"
        shape="pill"
        block
        loading={requesting}
        className="mt-6"
      >
        {mode === "login" ? "Log in" : "Create account"}
        <ArrowRight />
      </Button>

      {mode === "login" && (
        <>
          <Divider>or</Divider>
          <Link
            href="/signup"
            className={cn(
              "inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full",
              "border border-hairline bg-white px-6 text-base font-semibold text-navy-800",
              "transition-[background-color,border-color,transform] duration-[var(--duration-instant)] ease-out-strong",
              "hover:border-azure-500 hover:bg-azure-50 active:scale-[0.98]",
              "[&_svg]:size-5",
            )}
          >
            <UserPlus />
            Create an account
          </Link>
        </>
      )}
    </form>
  );
}

/* ------------------------------------------------------------------------- */

/**
 * Wraps a field with its error or hint line.
 *
 * The message sits *under* the box rather than above it, where the answer is
 * and where the thumb is not covering it. There is no red asterisk anywhere on
 * these screens: every field here is required, so marking them all marks none
 * of them.
 */
function Field({
  error,
  hint,
  children,
}: {
  error?: string | null;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {children}
      {error ? (
        <p role="alert" className="animate-fade-in mt-2 px-1 text-note text-danger-600">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-2 px-1 text-note text-copy-muted">{hint}</p>
      ) : null}
    </div>
  );
}

function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="animate-fade-in mt-5 flex items-start gap-2 rounded-xl bg-danger-50 p-3 text-note text-danger-700"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      {children}
    </p>
  );
}

/** The reference's "OR" rule. A hairline either side, the word in the gap. */
function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-5 flex items-center gap-4">
      <span className="h-px flex-1 bg-hairline" />
      <span className="text-2xs font-medium tracking-[0.08em] text-copy-muted uppercase">
        {children}
      </span>
      <span className="h-px flex-1 bg-hairline" />
    </div>
  );
}

/* ------------------------------------------------------------------------- */

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
  titleAs: Heading,
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
  /** Matches the phone step's level — the step changes, the outline must not. */
  titleAs: "h1" | "h2";
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
    <form ref={formRef} action={action} className="animate-fade-up">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="phone" value={phone} />
      <input type="hidden" name="fullName" value={fullName} />
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="spokenLanguages" value={languages.join(",")} />
      <input type="hidden" name="code" value={shownCode} />

      {/* Centred: on a screen with exactly one question the title belongs over
          the answer, not up in the corner. */}
      <div className="text-center">
        <Heading className="font-space text-title-sm font-bold text-navy-900">
          Check your phone
        </Heading>
        <p className="mt-1.5 text-ui text-copy-muted">
          We sent a 6-digit code to{" "}
          <span className="tabular font-semibold whitespace-nowrap text-navy-800">
            {formatPhoneForDisplay(phone)}
          </span>
        </p>
      </div>

      <div className="mt-6 flex justify-center">
        <OtpField
          value={shownCode}
          onChange={handleCodeChange}
          onComplete={handleComplete}
          disabled={pending}
        />
      </div>

      {/* The reference pairs "Didn't get the code?" with a resend. Ours changes
          the number instead: `issueOtp` enforces a 60-second cooldown and six
          sends an hour per number, so a resend control that is refused most of
          the times it is pressed teaches people it is broken. Going back and
          sending again costs one tap and goes through the same limits honestly. */}
      <p className="mt-5 text-center text-ui text-copy-muted">
        Wrong number?{" "}
        <button
          type="button"
          onClick={onBack}
          className="tap font-semibold text-azure-600 underline-offset-4 hover:underline"
        >
          Change it
        </button>
      </p>

      {simulated && devCode && (
        <div className="animate-fade-in mt-5 rounded-xl border border-dashed border-warning-500/50 bg-warning-50 p-3.5">
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

      {state?.error && <FormError>{state.error}</FormError>}

      <Button
        type="submit"
        variant="navy"
        size="lg"
        shape="pill"
        block
        loading={pending}
        disabled={shownCode.length !== 6}
        className="mt-6"
      >
        {mode === "signup" ? "Create account" : "Log in"}
        <ArrowRight />
      </Button>
    </form>
  );
}
