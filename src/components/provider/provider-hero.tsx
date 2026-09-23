import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Bell, ChevronRight, MapPin } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/**
 * The dashboard hero — `designing-ui-ux/artisan/artisan dasboard.png`, top band.
 *
 * **Composition before components**, per the brief. The band is one editorial
 * picture, not a stack of widgets: the artisan occupies the right ~45% and
 * bleeds off the top and right edges, decorative blue shapes sit *behind* the
 * photograph, and the greeting, status card and location pill are laid over the
 * left. No borders anywhere in here — depth comes from the layering and one
 * soft shadow on the status card.
 *
 * **It reflows when there is no photograph.** The plate is optional, and the
 * first build of this screen left a dead right-hand third when the file was
 * missing — the exact complaint in the brief. With no photograph the text
 * measure widens to fill the band and the decorative shapes carry the right
 * side on their own, so the composition holds either way instead of waiting on
 * an asset.
 */
export function ProviderHero({
  greeting,
  name,
  blurb,
  city,
  radiusKm,
  activeCount,
  heroSrc,
  children,
}: {
  greeting: string;
  name: string;
  blurb: string;
  city: string | null;
  radiusKm: number;
  activeCount: number;
  heroSrc: string | null;
  /** The availability control. A client component, handed in by the page. */
  children: React.ReactNode;
}) {
  const hasPhoto = Boolean(heroSrc);

  return (
    <section className="relative -mx-5 -mt-6 overflow-hidden px-5 pt-5 pb-5">
      {/* ---- Background: layered light, no flat white ---------------------- */}
      <div aria-hidden className="pointer-events-none absolute inset-0 select-none">
        <div className="absolute inset-0 bg-linear-to-br from-azure-100/70 via-canvas to-canvas" />
        {/* The organic shapes the brief asks for. Blurred rather than filled:
            a hard-edged blob behind a headline reads as a shape, a blurred one
            reads as light. */}
        <svg
          viewBox="0 0 390 320"
          preserveAspectRatio="xMaxYMin slice"
          className="absolute -inset-10 h-[calc(100%+5rem)] w-[calc(100%+5rem)] blur-[40px]"
          fill="none"
        >
          <path
            d="M286 -70c78 6 136 72 142 148 6 76-44 152-122 170-78 18-166-26-182-98-16-72 84-226 162-220Z"
            className="fill-azure-300/55"
          />
          <path
            d="M372 6c44 30 58 106 38 164-20 58-78 102-142 98-64-4-122-58-124-120-2-62 184-172 228-142Z"
            className="fill-azure-200/70"
          />
        </svg>
        {/* Dissolves the shapes before `overflow-hidden` cuts them square. */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-canvas to-transparent" />
      </div>

      {/* ---- The artisan, 45% of the band, bleeding off two edges ---------- */}
      {heroSrc && (
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 -right-6 h-[19rem] w-[46%] select-none"
          style={{
            // A soft fade on the left edge only — the photograph is meant to
            // run off the top and right, and rounding those would turn it back
            // into a card.
            maskImage:
              "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.5) 18%, #000 42%), linear-gradient(to bottom, #000 72%, transparent 97%)",
            maskComposite: "intersect",
            WebkitMaskImage:
              "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.5) 18%, #000 42%), linear-gradient(to bottom, #000 72%, transparent 97%)",
            WebkitMaskComposite: "source-in",
          }}
        >
          <Image
            src={heroSrc}
            alt=""
            fill
            priority
            sizes="(max-width: 26rem) 46vw, 190px"
            // `0%` on the vertical: the source has transparent headroom above
            // the cap, and aligning the top of the image with the top of the
            // box drops the head far enough to clear the bell. At 12% the bell
            // sat squarely on his cap.
            className="object-cover object-[50%_0%]"
          />
        </div>
      )}

      {/* ---- UI layer ------------------------------------------------------ */}
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <Logo tagline size="md" />
          <ActivityBell count={activeCount} />
        </div>

        {/* The measure is set against the photograph: with one, the text keeps
            clear of it; without one, it spreads into the space rather than
            leaving a hole. */}
        <div className={cn("mt-7", hasPhoto ? "max-w-[54%]" : "max-w-[19rem]")}>
          <p className="text-ui font-medium text-copy-muted">{greeting},</p>
          <h1 className="mt-0.5 truncate font-space text-title-lg leading-none font-bold tracking-[-0.03em] text-navy-900">
            {name}
          </h1>
          <p className="mt-3 text-note leading-relaxed text-copy-muted">{blurb}</p>
        </div>

        {/* The status card sits in the left column too, ending where the
            photograph's fade begins. */}
        <div className={cn("mt-6", hasPhoto && "max-w-[78%]")}>{children}</div>

        <Link
          href="/provider/apply/about"
          className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full bg-azure-50 py-2 pr-2.5 pl-3 text-note font-semibold text-azure-600 transition-colors duration-[var(--duration-instant)] hover:bg-azure-100"
        >
          <MapPin className="size-4 shrink-0" aria-hidden />
          <span className="truncate">
            {city ?? "Set your base city"} · {radiusKm} km
          </span>
          <ChevronRight className="size-3.5 shrink-0" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

/**
 * The bell floats independently over the photograph, as in the reference.
 *
 * There is no notification centre in this product, so it goes where an artisan
 * checking for news actually needs to go — their jobs — and the dot appears
 * only when something is live rather than permanently, as the reference draws
 * it.
 */
function ActivityBell({ count }: { count: number }) {
  return (
    <Link
      href="/provider/jobs"
      aria-label={count > 0 ? `Your jobs, ${count} on now` : "Your jobs"}
      className={cn(
        "relative grid size-12 shrink-0 place-items-center rounded-full bg-white text-navy-800",
        "shadow-[var(--shadow-float)]",
        "transition-transform duration-[var(--duration-instant)] ease-out-strong active:scale-[0.95]",
      )}
    >
      <Bell className="size-5" aria-hidden />
      {count > 0 && (
        <span
          aria-hidden
          className="absolute top-1 right-1 size-2.5 rounded-full bg-danger-500 ring-2 ring-white"
        />
      )}
    </Link>
  );
}
