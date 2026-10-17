import Link from "next/link";
import { ArrowRight, Clock, CreditCard, MapPin, MessageCircle, Phone, Truck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { hoursText } from "@/components/site/Footer";
import { BeforeAfter } from "@/components/landing/BeforeAfter";
import { CapabilityGrid } from "@/components/landing/CapabilityGrid";
import { HeroChatDemo } from "@/components/landing/HeroChatDemo";
import { getSettings, openStatus } from "@/lib/services/settings";
import { getSessionUser } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { zonedDateString } from "@/lib/time";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    icon: MessageCircle,
    title: "Tell us what you’re craving",
    body: "Browse the menu, or just say “two masala dosas, less spicy” to our AI host. It knows every dish, allergen and combo.",
  },
  {
    icon: CreditCard,
    title: "Confirm and pay securely",
    body: "You review every item and price before checkout. Payments go through Razorpay — the AI never touches your money.",
  },
  {
    icon: Truck,
    title: "Fresh from our kitchen",
    body: "We cook to order and you track it live — delivery, pickup or a table waiting for you.",
  },
];

export default async function HomePage() {
  const [settings, user] = await Promise.all([getSettings(), getSessionUser().catch(() => null)]);
  const status = openStatus(settings);
  const open = status.isOpen && settings.accepting_orders;
  const statusLabel = settings.accepting_orders ? status.label : "Online orders paused";

  const todayKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date(`${zonedDateString(new Date())}T12:00:00`).getDay()];

  return (
    <>
      {/* ───────────── Hero ───────────── */}
      <section className="relative isolate overflow-hidden">
        {/* Aurora glow — hero background only */}
        <div aria-hidden className="ai-aurora pointer-events-none absolute inset-x-0 -top-40 -z-10 h-[34rem] sm:h-[42rem]" />

        <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 pb-16 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pb-24 lg:pt-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-medium backdrop-blur">
              <span className={cn("size-2 rounded-full", open ? "bg-success" : "bg-destructive")} aria-hidden />
              {statusLabel}
              <span className="text-muted-foreground">· Bhubaneswar</span>
            </p>

            <h1 className="mt-6 text-balance text-[3rem] leading-[0.98] tracking-tight sm:text-6xl lg:text-[4.75rem]">
              Just say what you&apos;re <em className="ai-gradient-text not-italic">craving.</em>
            </h1>

            <p className="mt-6 max-w-md text-pretty text-lg leading-relaxed text-muted-foreground">
              Our AI host takes your order, checks allergens and books your table — all in a single line.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              {user ? (
                <Link href="/menu" className={buttonVariants({ size: "lg" })}>
                  Order now <ArrowRight aria-hidden />
                </Link>
              ) : (
                <>
                  <Link href="/signup" className={buttonVariants({ size: "lg" })}>
                    Sign up
                  </Link>
                  <Link href="/login" className={buttonVariants({ variant: "outline", size: "lg" })}>
                    Log in
                  </Link>
                </>
              )}
            </div>
          </div>

          <HeroChatDemo open={open} statusLabel={statusLabel} />
        </div>
      </section>

      {/* ───────────── Before / after ───────────── */}
      <BeforeAfter />

      {/* ───────────── AI capabilities ───────────── */}
      <section aria-labelledby="capabilities" className="border-t border-border bg-card/30">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="reveal max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Built-in, not bolt-on</p>
            <h2 id="capabilities" className="mt-4 text-balance text-4xl leading-[1.02] tracking-tight sm:text-5xl">
              An AI host that actually knows the kitchen.
            </h2>
            <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
              Every capability below is live in the ordering flow today — nothing here is a demo.
            </p>
          </div>
          <CapabilityGrid />
        </div>
      </section>

      {/* ───────────── How it works ───────────── */}
      <section aria-labelledby="how" className="border-t border-border bg-card/50">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="reveal max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">How it works</p>
            <h2 id="how" className="mt-4 text-balance text-4xl leading-[1.02] tracking-tight sm:text-5xl">
              From craving to doorstep in three steps.
            </h2>
          </div>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="reveal rounded-3xl border border-border bg-background p-6 transition-colors hover:border-primary/40 sm:p-8">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <s.icon className="size-5" aria-hidden />
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Step {i + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───────────── Visit / CTA ───────────── */}
      <section aria-labelledby="visit" className="mx-auto max-w-7xl px-4 pb-24 pt-20 sm:px-6 lg:pt-28">
        <div className="reveal grid gap-10 overflow-hidden rounded-[2rem] border border-border bg-gradient-to-br from-primary/[0.07] via-card to-card p-8 sm:p-12 lg:grid-cols-[1.4fr_1fr] lg:p-16">
          <div>
            <h2 id="visit" className="text-balance text-4xl leading-[1.02] tracking-tight sm:text-5xl">
              Your table is waiting.
            </h2>
            <p className="mt-4 max-w-md text-muted-foreground">
              Come in for a slow lunch, or let us bring {BRAND.name} to you. Either way, it&apos;s cooked the moment you order.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/reservations" className={buttonVariants({ size: "lg" })}>
                Book a table
              </Link>
              <Link href="/menu" className={buttonVariants({ variant: "outline", size: "lg" })}>
                Browse menu
              </Link>
            </div>
          </div>
          <ul className="space-y-4 self-end text-sm text-muted-foreground">
            {settings.address && (
              <li className="flex gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                {settings.lat && settings.lng ? (
                  <a className="text-foreground underline-offset-4 hover:underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${settings.lat}&mlon=${settings.lng}#map=17/${settings.lat}/${settings.lng}`}>
                    {settings.address}
                  </a>
                ) : (
                  settings.address
                )}
              </li>
            )}
            <li className="flex gap-3">
              <Clock className="mt-0.5 size-4 shrink-0" aria-hidden /> Today: {hoursText(settings.opening_hours[todayKey])}
            </li>
            {settings.phone && (
              <li className="flex gap-3">
                <Phone className="mt-0.5 size-4 shrink-0" aria-hidden />
                <a className="text-foreground underline-offset-4 hover:underline" href={`tel:${settings.phone.replace(/\s/g, "")}`}>
                  {settings.phone}
                </a>
              </li>
            )}
          </ul>
        </div>
      </section>
    </>
  );
}
