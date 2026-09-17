"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Save-as-PDF, via the browser's own print dialog.
 *
 * The whole PDF story in this app is one `window.print()` and a print
 * stylesheet — see the header of `src/lib/jobs/invoice.ts` for why that beats
 * shipping a PDF library to a phone on 3G.
 *
 * `print:hidden` on the wrapper keeps the button out of the document it
 * produces, which is the classic way this gets embarrassing.
 */
export function PrintButton({ label = "Save as PDF" }: { label?: string }) {
  return (
    <Button type="button" variant="secondary" onClick={() => window.print()} className="print:hidden">
      <Printer />
      {label}
    </Button>
  );
}
