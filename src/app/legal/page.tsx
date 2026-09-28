import type { Metadata } from "next";
import Link from "next/link";
import { FileText, ShieldCheck } from "lucide-react";

export const metadata: Metadata = { title: "Legal" };

export default function LegalIndex() {
  return (
    <>
      <h1>Legal</h1>
      <p>
        The terms you agree to when you book or accept work, and what we do with your
        information.
      </p>

      <div className="not-prose mt-8 space-y-3">
        <Link
          href="/legal/terms"
          className="flex items-center gap-4 rounded-card border border-hairline bg-white px-5 py-4 shadow-sm transition-colors hover:border-hairline"
        >
          <FileText className="size-5 shrink-0 text-copy-muted" aria-hidden />
          <span>
            <span className="block font-semibold text-navy-900">Terms of service</span>
            <span className="block text-sm text-copy-muted">
              Booking, prices, cancellations, and who is responsible for the work.
            </span>
          </span>
        </Link>

        <Link
          href="/legal/privacy"
          className="flex items-center gap-4 rounded-card border border-hairline bg-white px-5 py-4 shadow-sm transition-colors hover:border-hairline"
        >
          <ShieldCheck className="size-5 shrink-0 text-copy-muted" aria-hidden />
          <span>
            <span className="block font-semibold text-navy-900">Privacy notice</span>
            <span className="block text-sm text-copy-muted">
              What we collect, why, how long we keep it, and your rights under the Data
              Protection Act.
            </span>
          </span>
        </Link>
      </div>
    </>
  );
}
