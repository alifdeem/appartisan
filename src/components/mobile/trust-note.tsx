import { Check, ShieldCheck } from "lucide-react";

import { FieldLabel } from "@/components/mobile/field-label";
import { cn } from "@/lib/utils";

/**
 * The tinted panel that states, once, why handing this app a phone number is
 * safe.
 *
 * It sits on the signup screen between the choice and the commitment, which is
 * the only place it does any work: before the choice it is noise, after the
 * button it is too late. The eyebrow / headline / body stack is the reference's
 * own, and the shield is the single icon on the screen allowed to be navy-filled
 * rather than outlined — one bold moment, and this is it.
 *
 * No border. The azure-50 fill is enough separation on a white ground, and a
 * border around a tinted panel is the commonest way a card stops reading as a
 * surface and starts reading as a box.
 */
export function TrustNote({
  eyebrow = "Safe & secure",
  title,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex gap-4 rounded-[1.25rem] bg-azure-50 p-5", className)}>
      <span
        aria-hidden
        className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white text-navy-800 shadow-[var(--shadow-float)] [&_svg]:size-6"
      >
        <ShieldCheck strokeWidth={2} />
      </span>

      <div className="min-w-0">
        <FieldLabel className="text-azure-600">{eyebrow}</FieldLabel>
        <h2 className="mt-1.5 font-space text-[1.0625rem] font-bold text-navy-900">{title}</h2>
        <p className="mt-1 text-note leading-relaxed text-copy-muted">{children}</p>
      </div>
    </section>
  );
}

/**
 * The three promises, as a list of circular azure checks.
 *
 * These are the claims the whole product rests on, so they are set as running
 * text at body size rather than as a feature grid — a promise in a card with an
 * icon reads as marketing, the same promise as a line of text reads as terms.
 *
 * The check discs are `aria-hidden` and the list is a real `<ul>`: a screen
 * reader should hear three items, not "image, Ghana Card checked by a person".
 */
export function PromiseList({
  label,
  items,
  className,
}: {
  label: string;
  items: readonly string[];
  className?: string;
}) {
  return (
    <section className={className}>
      <FieldLabel>{label}</FieldLabel>

      <ul className="mt-3.5 space-y-3.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5">
            <span
              aria-hidden
              className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-azure-500 text-white"
            >
              <Check className="size-3" strokeWidth={3.5} />
            </span>
            {/* 14px, off the named scale on purpose. The scale steps 13 → 15
                and the longest of these claims needs 325px at 15px against the
                308px this column has at 390 — so at `text-ui` every one of the
                three wraps to two lines, and at `text-note` they are caption-
                sized, which is the wrong register for the three promises the
                whole product rests on. 14px is the size that fits the claim on
                one line, which is what makes it read as a claim. */}
            <span className="text-[0.875rem] leading-snug text-copy">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
