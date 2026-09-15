"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

const base = [
  "w-full min-h-11 rounded-field border bg-ink-0 px-3.5 py-2.5",
  "text-ink-900 placeholder:text-ink-400",
  "border-ink-300 shadow-xs",
  "transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-out-strong",
  "hover:border-ink-400",
  "focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/12",
  "disabled:cursor-not-allowed disabled:bg-ink-100 disabled:text-ink-500",
  "aria-[invalid=true]:border-danger-500 aria-[invalid=true]:focus:ring-danger-500/12",
].join(" ");

/**
 * `leading` rather than `prefix` — `prefix` is a real (deprecated) HTML
 * attribute typed as `string`, so reusing the name fights the DOM typings.
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Rendered inside the field on the left — e.g. a country code or an icon. */
  leading?: React.ReactNode;
}

export function Input({ className, leading, ...props }: InputProps) {
  if (!leading) {
    return <input className={cn(base, className)} {...props} />;
  }

  return (
    <div
      className={cn(
        "group relative flex items-center rounded-field border border-ink-300 bg-ink-0 shadow-xs",
        "transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-out-strong",
        "hover:border-ink-400",
        "focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-600/12",
        "has-[input[aria-invalid=true]]:border-danger-500",
        className,
      )}
    >
      <span className="flex select-none items-center pl-3.5 pr-2 text-ink-500">{leading}</span>
      <input
        className={cn(
          "min-h-11 w-full rounded-r-field bg-transparent py-2.5 pr-3.5",
          "text-ink-900 placeholder:text-ink-400 focus:outline-none",
          "disabled:cursor-not-allowed disabled:text-ink-500",
        )}
        {...props}
      />
    </div>
  );
}

/**
 * `ComponentProps` rather than `TextareaHTMLAttributes` so `ref` is part of the
 * type. React 19 passes refs to function components as an ordinary prop, and a
 * caller that needs to focus this — the admin review form, after a failed
 * validation — should not have to reach around the primitive to do it.
 */
export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(base, "min-h-24 resize-y leading-relaxed", className)} {...props} />;
}

/**
 * Label + hint + error, wired up with the right aria attributes so the error is
 * announced rather than merely coloured red.
 */
export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink-800">
        {label}
        {required ? (
          <span className="ml-0.5 text-danger-600" aria-hidden>
            *
          </span>
        ) : (
          <span className="ml-1.5 text-xs font-normal text-ink-400">optional</span>
        )}
      </label>

      {children}

      {error ? (
        <p
          id={`${htmlFor}-error`}
          role="alert"
          className="animate-fade-in text-sm text-danger-600"
        >
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-sm text-ink-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
