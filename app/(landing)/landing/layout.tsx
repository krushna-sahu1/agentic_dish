import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import "./landing.css";
import { SITE } from "@/lib/landing/config";

/**
 * Agentic Eats marketing site.
 *
 * Self-contained route group: it renders its own nav and footer, so it does
 * not use the restaurant `SiteShell`. Everything is static — no database, no
 * session — so the page can be prerendered and stays fast.
 *
 * To promote this to the site root later: move `page.tsx` up one level
 * (app/(landing)/page.tsx) and delete the restaurant's app/(home)/page.tsx.
 */

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono-family",
  display: "swap",
});

export const metadata: Metadata = {
  // `absolute` so the app-wide "%s · Agentic Dish" title template is not applied.
  title: { absolute: `${SITE.name} — ${SITE.tagline}` },
  description: SITE.description,
  applicationName: SITE.name,
  alternates: { canonical: `${SITE.url}/landing` },
  openGraph: {
    type: "website",
    url: `${SITE.url}/landing`,
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    locale: SITE.locale,
    images: [{ url: SITE.ogImage, width: 1200, height: 630, alt: `${SITE.name} — ${SITE.tagline}` }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    images: [SITE.ogImage],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#07080c",
  colorScheme: "dark",
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="agentic-eats" className={`${mono.variable} min-h-dvh w-full bg-[var(--ae-bg)] text-[var(--ae-fg)] antialiased`}>
      <main id="main" className="relative">
        {children}
      </main>
    </div>
  );
}
