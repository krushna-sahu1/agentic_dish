import { Megaphone } from "lucide-react";
import { getSettings, openStatus } from "@/lib/services/settings";
import { getMenu } from "@/lib/services/menu";
import { LazyCustomerChat } from "@/components/chat/LazyCustomerChat";
import { BRAND } from "@/lib/brand";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { SetupNotice } from "./SetupNotice";

/** Shared chrome for public, auth and customer pages: header, announcement, footer and the AI host. */
export async function SiteShell({ children, bleed = false, showChat = true }: { children: React.ReactNode; bleed?: boolean; showChat?: boolean }) {
  let settings;
  try {
    settings = await getSettings();
  } catch (e) {
    return <SetupNotice error={(e as Error).message} />;
  }
  const status = openStatus(settings);
  const isOpen = status.isOpen && settings.accepting_orders;
  const label = !settings.accepting_orders ? "Online orders paused" : status.label;
  // Dish names help the assistant match misheard voice input; a menu failure must not break the shell.
  const menuItemNames = showChat
    ? await getMenu()
        .then((m) => m.items.map((i) => i.name))
        .catch(() => [])
    : [];
  return (
    <>
      {settings.announcement && (
        <div className="bg-foreground text-background">
          <p className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-2 text-center text-xs sm:text-sm">
            <Megaphone className="size-4 shrink-0 text-primary" aria-hidden /> {settings.announcement}
          </p>
        </div>
      )}
      <Header statusLabel={label} isOpen={isOpen} showChat={showChat} />
      {/* `bleed` pages (the landing page) manage their own full-width sections. */}
      <main id="main" className={bleed ? "w-full" : "mx-auto w-full max-w-7xl px-4 sm:px-6"}>
        {children}
      </main>
      <Footer settings={settings} />
      {showChat && <LazyCustomerChat restaurantName={BRAND.name} isOpen={isOpen} statusLabel={label} menuItemNames={menuItemNames} />}
    </>
  );
}
