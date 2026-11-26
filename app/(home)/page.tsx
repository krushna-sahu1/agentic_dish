import Link from "next/link";
import { ArrowRight, Clock, MapPin, Phone } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AskAiButton } from "@/components/site/AskAiButton";
import { hoursText } from "@/components/site/Footer";
import { VegMark } from "@/components/site/Markers";
import { getMenu, isOrderable } from "@/lib/services/menu";
import { getSettings, openStatus } from "@/lib/services/settings";
import { formatINR } from "@/lib/format";
import { zonedDateString } from "@/lib/time";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STEPS = [
  { title: "Say what you want", body: "Type it or speak it: “two masala dosas, less spicy”. The host knows every dish, price and allergen on the menu." },
  { title: "Check the order", body: "You see each item and the total before anything happens. If a dish clashes with your allergies, it stops and asks." },
  { title: "Pay it yourself", body: "Checkout is Razorpay, and only you can press Pay. Then follow the order from the kitchen to your door or table." },
];

const PROMPTS = ["Something light, no onion, under ₹250", "Veg dinner for 4 under ₹1000", "What's spicy today?"];

export default async function HomePage() {
  const [settings, menu] = await Promise.all([getSettings(), getMenu()]);
  const status = openStatus(settings);
  const open = status.isOpen && settings.accepting_orders;
  const statusLabel = settings.accepting_orders ? status.label : "Online orders paused";
  const todayKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date(`${zonedDateString(new Date())}T12:00:00`).getDay()];
  const board = menu.items
    .filter((i) => isOrderable(i).ok)
    .sort((a, b) => b.sold_30d - a.sold_30d)
    .slice(0, 8);

  return (
    <>
      <section className="mx-auto grid max-w-7xl gap-12 px-4 pb-20 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:pb-28">
        <div>
          <p className="flex items-center gap-2 text-sm">
            <span className={cn("size-2 rounded-full", open ? "bg-success" : "bg-destructive")} aria-hidden />
            {statusLabel}
          </p>
          <h1 className="mt-5 text-balance font-display text-[3.4rem] sm:text-7xl lg:text-[5.5rem]">Just say what you&apos;re craving.</h1>
          <p className="mt-6 max-w-lg text-pretty text-lg leading-relaxed text-muted-foreground">
            Our AI host takes your order, checks it against your allergies and books your table. You confirm, you pay, we cook.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <AskAiButton size="lg" label="Order by chat" />
            <Link href="/menu" className={buttonVariants({ variant: "outline", size: "lg" })}>
              See the menu <ArrowRight aria-hidden />
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-2" aria-label="Try asking">
            {PROMPTS.map((p) => (
              <li key={p}>
                <AskAiButton variant="secondary" size="sm" prompt={p} label={p} plain />
              </li>
            ))}
          </ul>
        </div>

        {/* The menu board: what people actually ordered this month. */}
        <div className="rounded-3xl bg-leaf p-6 text-leaf-foreground sm:p-9">
          <h2 className="font-display text-3xl text-turmeric">Most ordered this month</h2>
          <ul className="mt-6 space-y-3.5">
            {board.map((i) => (
              <li key={i.id}>
                <Link href={`/menu/${i.slug}`} className="group flex items-baseline gap-2.5">
                  <VegMark veg={i.is_veg} className="translate-y-0.5 self-center" />
                  <span className="font-display text-xl group-hover:text-turmeric sm:text-2xl">{i.name}</span>
                  <span aria-hidden className="flex-1 translate-y-[-4px] border-b border-dotted border-current opacity-35" />
                  <span className="font-display text-xl tabular-nums sm:text-2xl">{formatINR(i.price_paise)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/menu" className="mt-7 inline-flex items-center gap-1.5 text-sm font-medium text-turmeric underline-offset-4 hover:underline">
            All {menu.items.length} dishes <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>

      <section aria-labelledby="how" className="border-y bg-card">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_2.2fr] lg:py-20">
          <h2 id="how" className="font-display text-4xl sm:text-5xl">How ordering works</h2>
          <ol className="grid gap-8 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="font-display text-2xl text-primary">{i + 1}</span>
                <h3 className="mt-1 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="visit" className="mx-auto grid max-w-7xl gap-10 px-4 pt-16 sm:px-6 lg:grid-cols-[1fr_2.2fr] lg:pt-20">
        <h2 id="visit" className="font-display text-4xl sm:text-5xl">Or come and sit down</h2>
        <div className="grid gap-8 sm:grid-cols-[1.4fr_auto] sm:items-start">
          <ul className="space-y-3 text-[15px]">
            {settings.address && (
              <li className="flex gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                {settings.lat && settings.lng ? (
                  <a className="underline-offset-4 hover:underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${settings.lat}&mlon=${settings.lng}#map=17/${settings.lat}/${settings.lng}`}>
                    {settings.address}
                  </a>
                ) : (
                  settings.address
                )}
              </li>
            )}
            <li className="flex gap-3">
              <Clock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> Today {hoursText(settings.opening_hours[todayKey])}
            </li>
            {settings.phone && (
              <li className="flex gap-3">
                <Phone className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <a className="underline-offset-4 hover:underline" href={`tel:${settings.phone.replace(/\s/g, "")}`}>
                  {settings.phone}
                </a>
              </li>
            )}
          </ul>
          <Link href="/reservations" className={buttonVariants({ size: "lg" })}>
            Book a table
          </Link>
        </div>
      </section>
    </>
  );
}
