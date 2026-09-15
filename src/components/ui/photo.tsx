import Image from "next/image";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A photograph, or the honest absence of one.
 *
 * Wraps `next/image` in a fixed-ratio box that falls back to a hatched warm
 * paper placeholder when the file has not been shot yet (see src/lib/images.ts).
 * The ratio is set by the caller through `className`, never by the image, so the
 * layout is identical whether or not the photograph exists.
 *
 * The placeholder is visibly deliberate rather than a grey rectangle: a
 * half-dressed demo should read as "not shot yet", not as "broken".
 */
export function Photo({
  src,
  alt,
  sizes,
  priority = false,
  className,
  imageClassName,
  placeholderClassName,
  children,
}: {
  src: string | null;
  /** Empty string is correct for decorative photographs beside real text. */
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  imageClassName?: string;
  /** `img-slot-dark` on dark sections, where the default would glare. */
  placeholderClassName?: string;
  /** Overlays — gradient scrims, captions. Drawn above the image. */
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className={cn("object-cover", imageClassName)}
        />
      ) : (
        <div className={cn("img-slot absolute inset-0", placeholderClassName)} aria-hidden />
      )}
      {children}
    </div>
  );
}
