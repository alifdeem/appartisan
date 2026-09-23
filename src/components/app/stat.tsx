import { Card, CardContent } from "@/components/ui/card";

/**
 * A single headline figure.
 *
 * Was defined twice — once in the artisan dashboard, once in admin — with the
 * same markup and no link between them. They had already started to drift (one
 * took a `note`, the other did not), and every figure the product shows is
 * eventually going to be money someone is arguing about. One definition.
 *
 * The figure sets in the mono face with tabular figures, which is the rule the
 * rest of the system already follows: anything that is a quantity — a cedi
 * amount, a rating, a job count — is set in IBM Plex Mono so that columns of
 * them line up and so that a number never reads as prose. `tracking-tight` is
 * deliberately absent; it is a display-face correction and makes mono worse.
 */
export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card>
      <CardContent className="space-y-0.5">
        <p className="text-xs font-medium tracking-wide text-copy-muted uppercase">{label}</p>
        <p className="font-mono tabular text-2xl font-semibold text-navy-900">{value}</p>
        {note && <p className="text-xs text-copy-muted">{note}</p>}
      </CardContent>
    </Card>
  );
}
