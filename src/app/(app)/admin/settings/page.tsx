import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";

import { SettingField } from "./_components/setting-field";
import { Card, CardContent } from "@/components/ui/card";
import { listSettings } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Platform settings" };

/**
 * The knobs.
 *
 * PLAN.md §8 promises the client can tune the reliability thresholds "without a
 * deploy", and §4 leaves the commission open pending their own arithmetic.
 * This is where that promise is kept.
 *
 * `update_setting` refuses an absurd commission or deposit percentage — the
 * validation lives there rather than here, because these values are also
 * reachable from the SQL editor and a rule that only exists in a React form is
 * not a rule.
 */
export default async function SettingsPage() {
  const settings = await listSettings();

  return (
    <div className="space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-800"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Admin
      </Link>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-ink-900">Platform settings</h1>
        <p className="max-w-2xl text-[0.9375rem] text-ink-600">
          Commission, deposit split, matching behaviour and the reliability thresholds. Changes
          apply to the next job — quotes already agreed keep the numbers they were agreed at.
        </p>
      </div>

      {settings.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <SlidersHorizontal className="mx-auto size-6 text-ink-300" aria-hidden />
            <p className="mt-2 text-sm font-medium text-ink-800">No settings found</p>
            <p className="mt-1 text-sm text-ink-500">
              Migration 0004 seeds these. Run <span className="font-mono">npm run db:push</span>.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-0">
            {settings.map((setting) => (
              <SettingField
                key={setting.key}
                settingKey={setting.key}
                label={setting.key}
                description={setting.description}
                value={setting.value}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
