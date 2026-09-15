import {
  Blinds,
  BrickWall,
  Bug,
  Car,
  Cctv,
  Droplets,
  Flame,
  Fuel,
  Hammer,
  House,
  KeyRound,
  LayoutPanelTop,
  PaintRoller,
  Ruler,
  SatelliteDish,
  Scissors,
  ScissorsLineDashed,
  Snowflake,
  Sofa,
  Sparkles,
  Square,
  Sun,
  Trees,
  WashingMachine,
  Waves,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * `categories.icon` holds a lucide name as a string, set by an admin from the
 * category editor rather than by a developer — so it is data, and data can be
 * wrong. This map is the only place that string becomes a component.
 *
 * Explicit rather than a dynamic `lucide-react/*` import on purpose: a dynamic
 * import of an icon named at runtime defeats tree-shaking and pulls the entire
 * icon set — well over a megabyte — into a bundle destined for a phone on a
 * metered Ghanaian connection. Twenty-six named imports cost what twenty-six
 * icons cost.
 *
 * An unknown name falls back to a wrench rather than rendering nothing, so a
 * new category added by the client's admin always shows up, even before someone
 * adds its icon here.
 */
const ICONS: Record<string, LucideIcon> = {
  zap: Zap,
  droplets: Droplets,
  snowflake: Snowflake,
  hammer: Hammer,
  "paint-roller": PaintRoller,
  sparkles: Sparkles,
  "brick-wall": BrickWall,
  flame: Flame,
  "washing-machine": WashingMachine,
  fuel: Fuel,
  home: House,
  square: Square,
  cctv: Cctv,
  bug: Bug,
  trees: Trees,
  waves: Waves,
  "layout-panel-top": LayoutPanelTop,
  sofa: Sofa,
  blinds: Blinds,
  "key-round": KeyRound,
  "satellite-dish": SatelliteDish,
  sun: Sun,
  car: Car,
  ruler: Ruler,
  scissors: Scissors,
  "scissors-line-dashed": ScissorsLineDashed,
  wrench: Wrench,
};

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Wrench;
  return <Icon className={cn("size-5", className)} aria-hidden strokeWidth={1.75} />;
}
