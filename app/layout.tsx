import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";
import type { ClientSession } from "@/components/providers/SessionProvider";
import { getSessionUser } from "@/lib/auth";

const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans-family", display: "swap" });
const display = Fraunces({ subsets: ["latin"], variable: "--font-display-family", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Kalinga Dosa House — South Indian & Odia kitchen", template: "%s · Kalinga Dosa House" },
  description: "Crisp dosas, Odia comfort food and an AI host that takes your order. Order online for delivery, pickup or dine-in in Bhubaneswar.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1714" },
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
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2">
          Skip to content
        </a>
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
