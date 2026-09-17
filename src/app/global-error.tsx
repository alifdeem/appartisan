"use client";

/**
 * The last resort.
 *
 * `error.tsx` catches everything below the root layout. When the root layout
 * itself throws, React has no layout to render a fallback inside — so this one
 * must supply its own `<html>` and `<body>`, and cannot rely on the fonts,
 * the design tokens or anything else `layout.tsx` sets up.
 *
 * Hence the inline styles. They look out of place next to the rest of this
 * codebase and they are correct here: a global error boundary that depends on
 * the stylesheet loading is a blank white page on the one occasion it matters.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en-GH">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: "2rem 1.25rem",
          background: "#FBF7F1",
          color: "#2A2520",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        <div style={{ maxWidth: "26rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: "0 0 0.5rem" }}>
            ArtisanGH is temporarily unavailable
          </h1>
          <p style={{ margin: "0 0 1.25rem", lineHeight: 1.6, color: "#5C544B" }}>
            Something failed badly enough that we could not load the page. Nothing you have booked
            or paid for is affected.
          </p>

          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: "2.75rem",
              padding: "0 1.25rem",
              borderRadius: "0.625rem",
              border: "none",
              background: "#1C1916",
              color: "#FEFCFA",
              fontSize: "0.9375rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload
          </button>

          {error.digest && (
            <p
              style={{
                margin: "1.25rem 0 0",
                fontSize: "0.6875rem",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "#9C948A",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              }}
            >
              Reference {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
