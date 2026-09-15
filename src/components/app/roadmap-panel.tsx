import { Circle } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { devToolsEnabled } from "@/lib/env";

/**
 * Build-progress panel. Internal.
 *
 * Phase 0 proves the foundations — auth, roles, routing, adapters — and these
 * dashboards are deliberately empty until the phases that fill them. Showing
 * fake job cards here would make the demo look further along than it is, and
 * that is the kind of thing that sets a client's expectations wrong.
 *
 * But the opposite error is just as expensive: a screen that lists what has not
 * been built yet makes a finished product look unfinished, and this is exactly
 * the screen a prospective client lands on. So the panel is now gated on
 * `ENABLE_DEV_TOOLS` — visible while we are working, absent from any demo or
 * deployed build. The empty state beside it does the honest work instead.
 *
 * Returning null rather than making each page ask keeps the three dashboards
 * from drifting apart on this.
 */
export function RoadmapPanel({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: { label: string; phase: string }[];
}) {
  if (!devToolsEnabled) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-ink-100">
          {items.map((item) => (
            <li key={item.label} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <Circle className="size-3.5 shrink-0 text-ink-300" />
              <span className="text-sm text-ink-700">{item.label}</span>
              <Badge tone="neutral" className="ml-auto shrink-0">
                {item.phase}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
