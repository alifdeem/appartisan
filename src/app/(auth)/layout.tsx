import Link from "next/link";
import { Check } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Photo } from "@/components/ui/photo";
import { photos } from "@/lib/images";

/**
 * Auth shell.
 *
 * Previously a narrow form marooned in the middle of an empty viewport, which
 * on a desktop screen is three-quarters dead space — and the login screen is
 * the second page anyone evaluating this product will see.
 *
 * Now a two-column split: the form keeps its comfortable reading measure on the
 * left, and the right half carries the argument the form cannot. Someone
 * arriving at a sign-in page has usually forgotten why they are signing in;
 * this reminds them, next to a photograph of the actual work.
 *
 * The split only exists from `lg` up. Below that the right panel is dropped
 * entirely rather than stacked — on a phone it would just be something to
 * scroll past before reaching the field you came to type in.
 */

const CLAIMS = [
  "Ghana Card checked by a person, not a script",
  "Itemised price agreed before anyone travels",
  "Your money held until you sign the work off",
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  // The argument panel is a sidebar, not a second half. At a straight 50/50 it
  // competes with the form for attention on the one screen where the form must
  // win.
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_24rem] xl:grid-cols-[1fr_30rem]">
      {/* ---- Form side ---- */}
      <div className="flex min-h-dvh flex-col lg:min-h-0">
        <header className="px-5 py-5 sm:px-8">
          <Link href="/" className="inline-block rounded-field">
            <Logo />
          </Link>
        </header>

        <main className="flex flex-1 items-start justify-center px-5 pt-2 pb-16 sm:items-center sm:px-8 sm:pt-0 sm:pb-24">
          <div className="w-full max-w-[26rem]">{children}</div>
        </main>

        <footer className="px-5 pb-8 sm:px-8">
          <p className="mx-auto max-w-[26rem] text-center text-xs text-ink-400">
            By continuing you agree to our terms and privacy policy.
          </p>
        </footer>
      </div>

      {/* ---- Argument side ---- */}
      <aside className="relative hidden lg:block">
        <Photo
          src={photos.workAc}
          alt=""
          sizes="(min-width: 1280px) 30rem, 24rem"
          className="absolute inset-0 h-full w-full"
          placeholderClassName="img-slot-dark"
        />

        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-ink-975 via-ink-975/70 to-ink-975/25"
        />

        <div className="relative flex h-full flex-col justify-end p-8 xl:p-12">
          <h2 className="text-2xl leading-tight font-semibold text-balance text-white xl:text-3xl">
            Nobody accepts work here until we know who they are.
          </h2>

          <ul className="mt-7 space-y-3">
            {CLAIMS.map((claim) => (
              <li key={claim} className="flex items-start gap-3 text-[0.9375rem] text-ink-200">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-600">
                  <Check className="size-3 text-white" strokeWidth={3} aria-hidden />
                </span>
                {claim}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
