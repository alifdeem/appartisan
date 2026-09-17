"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";

import { saveCategoryAction, type AdminActionState } from "@/app/(app)/admin/actions";
import { CategoryIcon } from "@/components/marketplace/category-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import type { CategoryRow as Category } from "@/lib/supabase/types";

/**
 * One trade, editable in place.
 *
 * In place rather than on its own screen because the thing an admin almost
 * always wants is to fix a name or retire something, and a list of 26 trades
 * where each edit costs two navigations is a list nobody maintains.
 *
 * There is no delete. A category is referenced by every job booked under it,
 * so a delete either fails on the foreign key or takes the history with it —
 * `is_active` hides it from the posting flow and keeps the record.
 */
export function CategoryRow({ category }: { category: Category | null }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [state, setState] = React.useState<AdminActionState | null>(null);
  const [editing, setEditing] = React.useState(category === null);

  const isNew = category === null;
  // Ids have to be unique across the whole page — every row renders this form,
  // and a duplicated `htmlFor` sends the label to the wrong input.
  const idPrefix = category ? `cat-${category.id}` : "cat-new";

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const next = await saveCategoryAction(null, formData);
      setState(next);

      if (next.ok) {
        toast.success(isNew ? "Trade added." : "Trade updated.");
        if (isNew) form.reset();
        else setEditing(false);
        router.refresh();
      } else if (next.error) {
        toast.error(next.error);
      }
    });
  }

  if (!editing && category) {
    return (
      <div className="flex items-center gap-3 border-b border-ink-100 py-3 last:border-0">
        <span className="grid size-9 shrink-0 place-items-center rounded-field bg-brand-50 text-brand-700">
          <CategoryIcon name={category.icon ?? "wrench"} className="size-[1.125rem]" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[0.9375rem] font-medium text-ink-900">{category.name}</span>
            {!category.is_active && <Badge tone="neutral">retired</Badge>}
          </span>
          <span className="tabular block font-mono text-[0.75rem] text-ink-500">
            {category.slug}
          </span>
        </span>

        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
          <Pencil />
          Edit
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 border-b border-ink-100 py-4 last:border-0">
      {category && <input type="hidden" name="id" value={category.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor={`${idPrefix}-name`} required error={state?.fieldErrors?.name}>
          <Input
            id={`${idPrefix}-name`}
            name="name"
            defaultValue={category?.name ?? ""}
            maxLength={60}
            required
          />
        </Field>

        <Field
          label="Slug"
          htmlFor={`${idPrefix}-slug`}
          required
          error={state?.fieldErrors?.slug}
          hint="Used in URLs. Lowercase, hyphens."
        >
          <Input
            id={`${idPrefix}-slug`}
            name="slug"
            defaultValue={category?.slug ?? ""}
            maxLength={60}
            required
          />
        </Field>

        <Field
          label="Icon"
          htmlFor={`${idPrefix}-icon`}
          required
          error={state?.fieldErrors?.icon}
          hint="A lucide icon name — plug, wrench, hammer."
        >
          <Input
            id={`${idPrefix}-icon`}
            name="icon"
            defaultValue={category?.icon ?? "wrench"}
            maxLength={40}
            required
          />
        </Field>

        <Field
          label="Sort order"
          htmlFor={`${idPrefix}-sort`}
          error={state?.fieldErrors?.sortOrder}
        >
          <Input
            id={`${idPrefix}-sort`}
            name="sortOrder"
            type="number"
            defaultValue={String(category?.sort_order ?? 0)}
            min={0}
            max={999}
          />
        </Field>
      </div>

      <Field
        label="Description"
        htmlFor={`${idPrefix}-description`}
        error={state?.fieldErrors?.description}
      >
        <Input
          id={`${idPrefix}-description`}
          name="description"
          defaultValue={category?.description ?? ""}
          maxLength={300}
        />
      </Field>

      <label className="flex min-h-11 items-center gap-2.5 text-sm text-ink-800">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={category?.is_active ?? true}
          className="size-4 accent-ink-900"
        />
        Offered to clients
      </label>

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          <Check />
          {pending ? "Saving…" : isNew ? "Add trade" : "Save"}
        </Button>
        {!isNew && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
            <X />
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
