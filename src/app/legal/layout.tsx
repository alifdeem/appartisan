import Link from "next/link";

import { Logo } from "@/components/brand/logo";

/**
 * The legal shell.
 *
 * Public, deliberately outside the `(app)` group — somebody has to be able to
 * read the terms before they have an account, and `/legal` is already in the
 * proxy's PUBLIC_PATHS. It has been in that list since Phase 0 with nothing
 * behind it, so every link to it 404'd.
 *
 * Set as a document rather than a marketing page: one column, generous
 * measure, real heading hierarchy. Nobody enjoys reading this, so the least we
 * can do is not make it hard.
 */
export default function LegalLayout({ children }: LayoutProps<"/legal">) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="border-b border-hairline bg-white print:hidden">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-4 px-5 py-4 sm:px-8">
          <Link href="/">
            <Logo />
          </Link>

          <nav className="ml-auto flex gap-x-5 text-sm text-copy-muted">
            <Link href="/legal/terms" className="tap transition-colors hover:text-navy-900">
              Terms
            </Link>
            <Link href="/legal/privacy" className="tap transition-colors hover:text-navy-900">
              Privacy
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <article className="prose-legal mx-auto w-full max-w-3xl">{children}</article>
      </main>

      <footer className="border-t border-hairline bg-white print:hidden">
        <div className="mx-auto w-full max-w-3xl px-5 py-6 text-sm text-copy-muted sm:px-8">
          <Link href="/" className="tap transition-colors hover:text-navy-900">
            Back to ArtisanGH
          </Link>
        </div>
      </footer>
    </div>
  );
}
