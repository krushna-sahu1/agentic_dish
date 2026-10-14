import { Megaphone } from "lucide-react";
import { getSettings, openStatus } from "@/lib/services/settings";
import { LazyCustomerChat } from "@/components/chat/LazyCustomerChat";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { SetupNotice } from "./SetupNotice";

/** Shared chrome for public, auth and customer pages: header, announcement, footer and the AI host. */
export async function SiteShell({ children }: { children: React.ReactNode }) {
  let settings;
  try {
    settings = await getSettings();
  } catch (e) {
    return <SetupNotice error={(e as Error).message} />;
  }
  const status = openStatus(settings);
  const isOpen = status.isOpen && settings.accepting_orders;
  const label = !settings.accepting_orders ? "Online orders paused" : status.label;
  return (
    <>
      <Header name={settings.name} statusLabel={label} isOpen={isOpen} />
      {settings.announcement && (
        <div className="border-b bg-accent/60 text-accent-foreground">
          <p className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 text-sm">
            <Megaphone className="size-4 shrink-0" aria-hidden /> {settings.announcement}
          </p>
        </div>
      )}
      <main id="main" className="mx-auto w-full max-w-6xl px-4">
        {children}
      </main>
      <Footer settings={settings} />
      <LazyCustomerChat restaurantName={settings.name} isOpen={isOpen} statusLabel={label} />
    </>
  );
}
