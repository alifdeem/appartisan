import type { DayVolume } from "@/lib/admin/queries";

/**
 * Jobs posted and jobs finished, by day.
 *
 * **Hand-drawn SVG, no charting library.** Fourteen points is well inside the
 * range where SVG is the correct medium, and the alternatives all cost a
 * dependency measured in tens of kilobytes to draw two polylines. It also
 * means the chart inherits the design system's tokens directly instead of
 * being themed at arm's length through a library's own config.
 *
 * **Two series is the cap, and they are told apart by more than colour.**
 * Posted is a filled azure area; completed is a navy line with round markers.
 * Somebody who cannot separate blue from dark blue still has fill-versus-line
 * and the labelled table underneath.
 *
 * **The table is not a fallback, it is the content.** The `<figcaption>` and
 * the visually-hidden table carry every value, so the chart is a summary of
 * something readable rather than the only way to get at the numbers.
 */

const WIDTH = 640;
const HEIGHT = 160;
const PAD = { top: 12, right: 4, bottom: 4, left: 4 };

export function VolumeChart({ data }: { data: DayVolume[] }) {
  const peak = Math.max(1, ...data.map((d) => Math.max(d.posted, d.completed)));
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;

  // A single point would make `data.length - 1` a divide-by-zero.
  const step = data.length > 1 ? innerW / (data.length - 1) : 0;
  const x = (i: number) => PAD.left + i * step;
  const y = (v: number) => PAD.top + innerH - (v / peak) * innerH;

  /**
   * A smoothed path rather than straight segments.
   *
   * Daily counts are spiky, and joining them with straight lines turns a
   * couple of busy days into hard triangles that read as a sawtooth rather
   * than as a trend. The control points are horizontal only, so the curve
   * cannot overshoot above a peak or dip below zero and invent a value that
   * never happened.
   */
  const line = (key: "posted" | "completed") => {
    const pts = data.map((d, i) => [x(i), y(d[key])] as const);
    if (pts.length === 0) return "";

    let path = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const [px, py] = pts[i - 1];
      const [cx, cy] = pts[i];
      const mid = (px + cx) / 2;
      path += ` C${mid.toFixed(1)},${py.toFixed(1)} ${mid.toFixed(1)},${cy.toFixed(1)} ${cx.toFixed(1)},${cy.toFixed(1)}`;
    }
    return path;
  };

  const area = `${line("posted")} L${x(data.length - 1).toFixed(1)},${PAD.top + innerH} L${x(0).toFixed(1)},${PAD.top + innerH} Z`;

  const totalPosted = data.reduce((t, d) => t + d.posted, 0);
  const totalDone = data.reduce((t, d) => t + d.completed, 0);

  return (
    <figure className="m-0">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <Key swatch="area" label="Posted" value={totalPosted} />
        <Key swatch="line" label="Completed" value={totalDone} />
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="block h-40 w-full overflow-visible"
        preserveAspectRatio="none"
        role="presentation"
      >
        <defs>
          <linearGradient id="volume-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-azure-500)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--color-azure-500)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Three rules, not a full grid. Enough to judge height against, few
            enough that they stay behind the data. */}
        {[0, 0.5, 1].map((t) => (
          <line
            key={t}
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={PAD.top + innerH * t}
            y2={PAD.top + innerH * t}
            stroke="var(--color-hairline)"
            strokeWidth="1"
          />
        ))}

        <path d={area} fill="url(#volume-fill)" />
        <path
          d={line("posted")}
          fill="none"
          stroke="var(--color-azure-500)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={line("completed")}
          fill="none"
          stroke="var(--color-navy-800)"
          strokeWidth="2"
          strokeDasharray="5 4"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Markers only where work actually finished — a dot on every zero is
            fourteen dots saying nothing. */}
        {data.map((d, i) =>
          d.completed > 0 ? (
            <circle key={d.date} cx={x(i)} cy={y(d.completed)} r="3" fill="var(--color-navy-800)" />
          ) : null,
        )}
      </svg>

      <div className="mt-2 flex justify-between font-mono text-2xs text-copy-muted">
        <span>{formatDay(data[0]?.date)}</span>
        <span>{formatDay(data[data.length - 1]?.date)}</span>
      </div>

      <figcaption className="sr-only">
        Jobs posted and completed each day for the last {data.length} days. {totalPosted} posted,{" "}
        {totalDone} completed.
      </figcaption>

      {/* Every value, reachable without a pointer. */}
      <table className="sr-only">
        <caption>Daily job volume</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Posted</th>
            <th scope="col">Completed</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <th scope="row">{d.date}</th>
              <td>{d.posted}</td>
              <td>{d.completed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/**
 * A legend key that draws the actual mark.
 *
 * The first attempt used `ring-dashed`, which is not a Tailwind utility, so
 * the dashed series rendered as a plain empty box and the two keys were
 * indistinguishable. Drawing the swatch as a miniature of the real mark also
 * means the legend cannot drift from the chart when either changes.
 */
function Key({ swatch, label, value }: { swatch: "area" | "line"; label: string; value: number }) {
  return (
    <span className="flex items-baseline gap-2">
      <svg viewBox="0 0 20 10" className="h-2.5 w-5 shrink-0 translate-y-px" aria-hidden>
        {swatch === "area" ? (
          <>
            <rect x="0" y="3" width="20" height="7" fill="var(--color-azure-500)" opacity="0.28" />
            <line x1="0" y1="3" x2="20" y2="3" stroke="var(--color-azure-500)" strokeWidth="2" />
          </>
        ) : (
          <line
            x1="0"
            y1="6"
            x2="20"
            y2="6"
            stroke="var(--color-navy-800)"
            strokeWidth="2"
            strokeDasharray="5 4"
          />
        )}
      </svg>
      <span className="text-note text-copy-muted">{label}</span>
      <span className="tabular font-mono text-ui font-semibold text-navy-900">{value}</span>
    </span>
  );
}

function formatDay(iso: string | undefined): string {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
