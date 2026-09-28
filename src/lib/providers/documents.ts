import type { ProviderDocType } from "@/lib/supabase/types";

/**
 * The identity documents an artisan files, and what to say about each one.
 *
 * The copy lives here rather than in the component because it is read in three
 * places that must agree: the capture tile the artisan uses, the checklist that
 * tells them what is left, and the admin's review screen. An admin looking at a
 * photograph labelled "Selfie" and an artisan who was asked for "a photo of
 * yourself" are looking at the same thing, and the label should say so.
 *
 * Limits mirror the `provider-docs` bucket in migration 0001. Storage rejects an
 * oversized file regardless of what this says; duplicating the number here means
 * the artisan finds out before a 9MB upload over mobile data, not after.
 */

export const PROVIDER_DOC_BUCKET = "provider-docs";

export const MAX_DOC_BYTES = 10 * 1024 * 1024;

export const ACCEPTED_DOC_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
] as const;

export const DOC_ACCEPT_ATTR = ACCEPTED_DOC_TYPES.join(",");

export interface DocSpec {
  type: ProviderDocType;
  label: string;
  /** Shown on the empty tile. An instruction, not a description. */
  hint: string;
  /**
   * Which camera to offer. The Ghana Card is photographed with the rear camera;
   * a selfie is not, and offering the wrong one is a small, constant friction
   * for someone standing in a corridor holding their card.
   */
  capture: "environment" | "user";
}

/** The three the application cannot be submitted without. Order is the order shown. */
export const REQUIRED_DOCS: DocSpec[] = [
  {
    type: "ghana_card_front",
    label: "Ghana Card, front",
    hint: "The side with your photo. Lay it flat, fill the frame.",
    capture: "environment",
  },
  {
    type: "ghana_card_back",
    label: "Ghana Card, back",
    hint: "The side with the barcode.",
    capture: "environment",
  },
  {
    type: "selfie",
    label: "You, holding the card",
    hint: "Your face and the card in the same photo, both readable.",
    capture: "user",
  },
];

/**
 * Optional, and genuinely optional — nothing gates on these.
 *
 * Work photos are the most persuasive thing an artisan can file and the thing
 * they are least likely to bother with, so they are offered after the required
 * three rather than mixed in among them, where they would read as more homework.
 */
export const OPTIONAL_DOCS: DocSpec[] = [
  {
    type: "work_photo",
    label: "Photos of your work",
    hint: "Jobs you have finished. This is what wins you work later.",
    capture: "environment",
  },
  {
    type: "certificate",
    label: "Certificates",
    hint: "Trade certificates or training documents, if you have any.",
    capture: "environment",
  },
];

export const ALL_DOCS: DocSpec[] = [...REQUIRED_DOCS, ...OPTIONAL_DOCS];

/** Doc types the artisan may only file one of. Mirrors the unique index in 0008. */
export const SINGLETON_DOC_TYPES: ProviderDocType[] = [
  "ghana_card_front",
  "ghana_card_back",
  "selfie",
];

export function isSingletonDoc(type: ProviderDocType): boolean {
  return SINGLETON_DOC_TYPES.includes(type);
}

export function docSpec(type: ProviderDocType): DocSpec | undefined {
  return ALL_DOCS.find((doc) => doc.type === type);
}

export function docLabel(type: ProviderDocType): string {
  return docSpec(type)?.label ?? type;
}

export function isAcceptedDoc(file: File): boolean {
  return (ACCEPTED_DOC_TYPES as readonly string[]).includes(file.type);
}

/**
 * Storage keys are `<provider id>/<name>` — every policy on this bucket reads
 * `storage.foldername(name)[1]` and compares it to `auth.uid()`. Getting the
 * shape wrong fails as a permission denied on upload, which looks like a broken
 * app rather than a broken path.
 */
export function providerDocPath(providerId: string, objectName: string): string {
  return `${providerId}/${objectName}`;
}
