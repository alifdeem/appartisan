import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, Inter, Space_Grotesk } from "next/font/google";

import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

/**
 * Three faces, three jobs — see the type note in globals.css.
 *
 * All three are self-hosted by `next/font`, so there is no request to Google at
 * runtime. That matters more here than on most projects: a good share of this
 * audience is on a metered connection, and a webfont that arrives late is a
 * page that reflows in front of them. `display: "swap"` makes the fallback
 * visible immediately rather than holding the text hostage.
 */
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
  // Headlines only — no need to ship the light end of the range.
  weight: ["500", "600", "700", "800"],
});

/**
 * Space Grotesk — the heading face of the 2026 auth reference. Loaded here
 * beside the other three because `next/font` must be called at module scope in
 * a layout to be self-hosted; it is *applied* only on redesigned screens, via
 * the `font-space` utility. See the type note in globals.css.
 */
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "ArtisanGH — Verified artisans, booked in minutes",
    template: "%s · ArtisanGH",
  },
  description:
    "Book vetted electricians, plumbers, carpenters and more across Accra and Tema. Every artisan ID-verified, every price agreed before work starts.",
  applicationName: "ArtisanGH",
  openGraph: {
    type: "website",
    locale: "en_GH",
    siteName: "ArtisanGH",
    title: "ArtisanGH — Verified artisans, booked in minutes",
    description:
      "Book vetted electricians, plumbers, carpenters and more across Accra and Tema. Every artisan ID-verified, every price agreed before work starts.",
  },
  robots: { index: false, follow: false }, // Pre-launch. Flip at go-live.
};

export const viewport: Viewport = {
  // Navy, matching the 2026 brand. This paints the browser and OS chrome
  // around the page on Android and iOS, and the auth screens are the first
  // thing anyone sees — green chrome above a navy screen is the one place the
  // in-progress migration would be visible to a user rather than to us.
  themeColor: "#0A2E73",
  // No maximum-scale: pinch-zoom is an accessibility feature, not a nuisance.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-GH"
      className={`${bricolage.variable} ${spaceGrotesk.variable} ${inter.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
