"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { SessionProvider, type ClientSession } from "./SessionProvider";
import { CartProvider } from "./CartProvider";

export function Providers({ session, children }: { session: ClientSession | null; children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <SessionProvider session={session}>
        <CartProvider>
          {children}
          <Toaster richColors position="top-center" closeButton />
        </CartProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
