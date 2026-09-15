import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";

import { GhanaCardField } from "@/app/(app)/provider/apply/documents/_components/ghana-card-field";
import { DocumentCapture } from "@/components/provider/document-capture";
import { buttonVariants } from "@/components/ui/button-variants";
import { OPTIONAL_DOCS, REQUIRED_DOCS } from "@/lib/providers/documents";
import {
  getMyProvider,
  listProviderDocuments,
  signProviderDocuments,
} from "@/lib/providers/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Proof of identity" };

export default async function DocumentsStepPage() {
  const provider = await getMyProvider();
  if (!provider) redirect("/provider");

  const docs = await signProviderDocuments(await listProviderDocuments(provider.profile_id));

  const byType = (type: string) => docs.filter((doc) => doc.doc_type === type);

  const haveAllRequired = REQUIRED_DOCS.every((spec) => byType(spec.type).length > 0);
  const ready = haveAllRequired && Boolean(provider.ghana_card_number);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-ink-900">Prove it&rsquo;s you</h2>
        <p className="max-w-prose text-[0.9375rem] leading-relaxed text-ink-600">
          This is the part that makes you a verified artisan, and it is the reason clients let a
          stranger into their home. Take the photos in good light — a card you cannot read is the
          most common reason an application comes back.
        </p>
      </div>

      {/* Stated once, prominently, at the top of the only screen that collects
          anything sensitive — rather than as fine print under each field, where
          it reads as a disclaimer instead of a promise. */}
      <div className="flex items-start gap-3 rounded-card border border-brand-200 bg-brand-50 px-4 py-3.5">
        <Lock className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden />
        <div className="space-y-1">
          <p className="text-sm font-medium text-brand-900">Stored privately, shown to nobody</p>
          <p className="text-sm leading-relaxed text-brand-800/85">
            Your Ghana Card is held in a private store that clients and other artisans cannot
            reach. Only our verification team can open it, and only while reviewing you. Clients
            see that you passed — never the document.
          </p>
        </div>
      </div>

      <GhanaCardField value={provider.ghana_card_number} />

      <div className="space-y-6">
        {REQUIRED_DOCS.map((spec) => (
          <DocumentCapture
            key={spec.type}
            spec={spec}
            providerId={provider.profile_id}
            documents={byType(spec.type)}
          />
        ))}
      </div>

      <div className="space-y-6 border-t border-ink-200 pt-6">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-ink-900">
            Optional, and worth doing
            <span className="ml-2 text-sm font-normal text-ink-500">not required to apply</span>
          </h3>
          <p className="max-w-prose text-sm leading-relaxed text-ink-600">
            Photos of finished jobs are the most persuasive thing on your profile. Clients decide
            between artisans on these.
          </p>
        </div>

        {OPTIONAL_DOCS.map((spec) => (
          <DocumentCapture
            key={spec.type}
            spec={spec}
            providerId={provider.profile_id}
            documents={byType(spec.type)}
          />
        ))}
      </div>

      <div className="flex items-center gap-4">
        <Link
          href="/provider/apply/review"
          aria-disabled={!ready}
          tabIndex={ready ? undefined : -1}
          className={cn(
            buttonVariants({ size: "lg" }),
            !ready && "pointer-events-none opacity-50",
          )}
        >
          Continue
        </Link>

        {!ready && (
          <p className="text-sm text-ink-500">
            {provider.ghana_card_number
              ? "Add all three photos to continue."
              : "Add your card number and all three photos to continue."}
          </p>
        )}
      </div>
    </div>
  );
}
