import type { Metadata, Viewport } from "next";
import { Anek_Latin, Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";
import type { ClientSession } from "@/components/providers/SessionProvider";
import { getSessionUser } from "@/lib/auth";
import { BRAND, BUSINESS } from "@/lib/business";

const sans = Geist({ subsets: ["latin", "latin-ext"], variable: "--font-sans-family", display: "swap" });
const display = Anek_Latin({ subsets: ["latin", "latin-ext"], axes: ["wdth"], variable: "--font-display-family", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${BRAND.name} · ${BUSINESS.cuisine} kitchen`, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
  applicationName: BRAND.name,
  openGraph: { siteName: BRAND.name, title: BRAND.name, description: BRAND.description, type: "website" },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Let the browser shrink the layout viewport when the on-screen keyboard opens
  // (Android Chrome). iOS Safari ignores this, so the chat panel also measures
  // window.visualViewport — see components/chat/CustomerChat.tsx.
  interactiveWidget: "resizes-content",
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1512" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser().catch(() => null);
  const session: ClientSession | null = user
    ? {
        userId: user.userId,
        email: user.email,
        name: user.profile?.full_name ?? null,
        role: user.role,
        allergies: user.profile?.allergies ?? [],
        dietaryPrefs: user.profile?.dietary_prefs ?? [],
        spiceTolerance: user.profile?.spice_tolerance ?? 2,
      }
    : null;
  return (
    <html lang="en-IN" suppressHydrationWarning className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-card focus:shadow-lg focus:px-4 focus:py-2">
          Skip to content
        </a>
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
