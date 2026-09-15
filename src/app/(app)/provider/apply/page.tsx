import { redirect } from "next/navigation";

import { resumeStep } from "@/lib/providers/application";
import {
  getMyProvider,
  listProviderCategoryIds,
  listProviderDocuments,
} from "@/lib/providers/queries";

/**
 * `/provider/apply` has no screen of its own — it works out where you stopped
 * and sends you there.
 *
 * The alternative is a landing page that says "continue" and makes an artisan
 * tap twice to reach the thing they already knew they were coming back for.
 */
export default async function ApplyIndex() {
  const provider = await getMyProvider();
  if (!provider) redirect("/provider");

  const [categoryIds, documents] = await Promise.all([
    listProviderCategoryIds(provider.profile_id),
    listProviderDocuments(provider.profile_id),
  ]);

  const step = resumeStep({
    provider,
    tradeCount: categoryIds.length,
    docTypes: documents.map((doc) => doc.doc_type),
  });

  redirect(`/provider/apply/${step}`);
}
