import Link from "next/link";
import { ArrowRight, ArrowUp, Clock, Mic, Phone, MapPin, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { hoursText } from "@/components/site/Footer";
import { BeforeAfter } from "@/components/landing/BeforeAfter";
import { CapabilityGrid } from "@/components/landing/CapabilityGrid";
import { HeroChatDemo } from "@/components/landing/HeroChatDemo";
import { DishCard } from "@/components/site/DishCard";
import { toCardItem } from "@/components/site/to-card";
import { dishArt } from "@/components/site/dish-art";
import { getSettings, openStatus } from "@/lib/services/settings";
import { getMenu } from "@/lib/services/menu";
import { getSessionUser } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { zonedDateString } from "@/lib/time";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Tell us what you’re craving",
    body: "Browse the menu, or just say “two masala dosas, less spicy” to our AI host. It knows every dish, allergen and combo.",
  },
  {
    title: "Review and pay securely",
    body: "You see every item and price before checkout. Payments go through Razorpay — the AI never touches your money.",
  },
  {
    title: "Fresh from our kitchen",
    body: "We cook to order and you track it live — delivery, pickup or a table waiting for you.",
  },
];

const PROMISES = [
  ["Talk or tap", "Type, speak, or browse the menu like normal."],
  ["Allergen-aware", "Your saved allergies are checked on every add."],
  ["You hold the wallet", "Razorpay checkout. Only a human can press Pay."],
  ["Live tracking", "Watch it go from pan to doorstep."],
] as const;

const EXAMPLES = ["Something mild for kids", "Best dosa under ₹150", "Table for 4 tonight", "Reorder my usual"];

export default async function HomePage() {
  const [settings, user, menu] = await Promise.all([getSettings(), getSessionUser().catch(() => null), getMenu().catch(() => null)]);
  const status = openStatus(settings);
  const open = status.isOpen && settings.accepting_orders;
  const statusLabel = settings.accepting_orders ? status.label : "Online orders paused";
  const startHref = user ? "/menu" : "/signup";

  const todayKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date(`${zonedDateString(new Date())}T12:00:00`).getDay()];

  // Category tiles use the first dish photo in each category; "popular" prefers bestsellers.
  const items = menu?.items.map(toCardItem) ?? [];
  const categories = (menu?.categories ?? [])
    .map((c) => {
      const inCat = items.filter((i) => i.category_slug === c.slug);
      return { slug: c.slug, name: c.name, count: inCat.length, image: inCat.find((i) => i.image_url)?.image_url ?? dishArt(c.name) };
    })
    .filter((c) => c.count > 0);
  const popular = [...items.filter((i) => i.available && i.tags.includes("bestseller")), ...items.filter((i) => i.available && !i.tags.includes("bestseller"))].slice(0, 4);

  return (
    <>
      {/* ───────────── Hero ───────────── */}
      <section className="relative isolate overflow-hidden">
        <div aria-hidden className="ai-aurora pointer-events-none absolute inset-0 -z-10 opacity-70" />

        <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 pb-20 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pb-28 lg:pt-20">
          <div className="min-w-0">
            <p className="eyebrow flex flex-wrap items-center gap-2.5">
              <span className={cn("size-2 rounded-full", open ? "bg-success" : "bg-destructive")} aria-hidden />
              <span className="text-foreground">{statusLabel}</span>
              <span aria-hidden>·</span> South Indian &amp; Odia kitchen · Bhubaneswar
            </p>

            <h1 className="mt-6 text-balance font-display text-[3.25rem] leading-[0.94] sm:text-7xl lg:text-[5.5rem]">
              Just say what you&apos;re <span className="text-saffron">craving.</span>
            </h1>

            <p className="mt-6 max-w-lg text-pretty text-lg leading-relaxed text-muted-foreground">
              Our AI host takes the order, checks allergens and books your table — in one line. You review every rupee and press Pay yourself.
            </p>

            {/* The signature AI command bar. On the home page it starts the ordering flow. */}
            <Link
              href={startHref}
              className="group mt-9 flex h-[68px] max-w-xl items-center gap-3 rounded-[22px] border bg-card pl-5 pr-2.5 shadow-[0_1px_0_rgb(20_19_15/0.04),0_18px_40px_-16px_rgb(91_71_245/0.32)] transition-[border-color,box-shadow] hover:border-iris/40"
            >
              <Sparkles className="size-5 shrink-0 text-iris" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[17px] text-muted-foreground">Two masala dosas, less spicy…</span>
              <span className="hidden size-11 items-center justify-center rounded-[14px] border text-muted-foreground sm:flex" aria-hidden>
                <Mic className="size-[18px]" />
              </span>
              <span className="flex size-11 items-center justify-center rounded-[14px] bg-primary text-primary-foreground transition-transform group-hover:-translate-y-0.5" aria-hidden>
                <ArrowUp className="size-[18px]" />
              </span>
              <span className="sr-only">{user ? "Start ordering" : "Sign up to order with the AI host"}</span>
            </Link>
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Things you can ask">
              {EXAMPLES.map((e) => (
                <li key={e} className="rounded-full border bg-card/80 px-3.5 py-1.5 text-[13px] text-muted-foreground">
                  {e}
                </li>
              ))}
            </ul>

            <div className="mt-9 flex flex-wrap items-center gap-3">
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
              <Link href="/menu" className="ml-1 text-sm font-medium underline decoration-foreground/25 underline-offset-4 hover:decoration-foreground">
                Browse the full menu
              </Link>
            </div>
          </div>

          <HeroChatDemo open={open} statusLabel={statusLabel} />
        </div>
      </section>

      {/* ───────────── Promises strip ───────────── */}
      <section aria-label="How ordering works here" className="border-y bg-card">
        <ul className="mx-auto grid max-w-7xl px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {PROMISES.map(([title, body], i) => (
            <li key={title} className={cn("flex gap-4 py-7 sm:px-6", i > 0 && "border-t sm:border-t-0", i % 2 === 1 && "sm:border-l", i > 1 && "lg:border-l", i === 0 && "sm:pl-0")}>
              <span className="font-mono text-xs leading-6 text-saffron-ink">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <p className="text-[15px] font-semibold">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ───────────── Categories ───────────── */}
      {categories.length > 0 && (
        <section aria-labelledby="categories" className="mx-auto max-w-7xl px-4 pt-20 sm:px-6 lg:pt-28">
          <div className="reveal flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">The menu</p>
              <h2 id="categories" className="mt-3 font-display text-4xl leading-[1.02] sm:text-[3.25rem]">
                {categories.length} kitchens in one.
              </h2>
            </div>
            <Link href="/menu" className={buttonVariants({ variant: "outline" })}>
              See the full menu <ArrowRight aria-hidden />
            </Link>
          </div>
          <ul className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/menu#cat-${c.slug}`} className="group flex h-full flex-col gap-2.5 rounded-[18px] border bg-card p-2.5 transition-colors hover:border-foreground/30">
                  <span className="block overflow-hidden rounded-xl bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.image} alt="" width={200} height={200} loading="lazy" className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
                  </span>
                  <span className="px-1 text-sm font-semibold leading-tight">{c.name}</span>
                  <span className="px-1 pb-1 font-mono text-[11px] text-muted-foreground">{c.count} dishes</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ───────────── Popular ───────────── */}
      {popular.length > 0 && (
        <section aria-labelledby="popular" className="mx-auto max-w-7xl px-4 pt-20 sm:px-6 lg:pt-28">
          <div className="reveal">
            <p className="eyebrow">Popular right now</p>
            <h2 id="popular" className="mt-3 font-display text-4xl leading-[1.02] sm:text-[3.25rem]">
              What Bhubaneswar is ordering.
            </h2>
          </div>
          <div className="mt-9 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {popular.map((i, idx) => (
              <DishCard key={i.id} item={i} priority={idx < 2} />
            ))}
          </div>
        </section>
      )}

      {/* ───────────── Before / after ───────────── */}
      <BeforeAfter />

      {/* ───────────── AI capabilities ───────────── */}
      <section aria-labelledby="capabilities" className="border-t bg-card/50">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="reveal max-w-2xl">
            <p className="eyebrow text-iris-ink">Built in, not bolted on</p>
            <h2 id="capabilities" className="mt-3 text-balance font-display text-4xl leading-[1.02] sm:text-[3.25rem]">
              An AI host that actually knows the kitchen.
            </h2>
            <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">Every capability below is live in the ordering flow today — nothing here is a demo.</p>
          </div>
          <CapabilityGrid />
        </div>
      </section>

      {/* ───────────── How it works ───────────── */}
      <section aria-labelledby="how" className="border-t">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="reveal max-w-2xl">
            <p className="eyebrow">How it works</p>
            <h2 id="how" className="mt-3 text-balance font-display text-4xl leading-[1.02] sm:text-[3.25rem]">
              From craving to doorstep in three steps.
            </h2>
          </div>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="reveal rounded-[24px] border bg-card p-7 sm:p-8">
                <span className="font-display text-6xl leading-none text-saffron">{i + 1}</span>
                <h3 className="mt-6 text-xl font-semibold tracking-[-0.01em]">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───────────── Visit / CTA ───────────── */}
      <section aria-labelledby="visit" className="mx-auto max-w-7xl px-4 pb-8 sm:px-6">
        <div className="reveal grid overflow-hidden rounded-[32px] bg-[#14130f] text-[#f4f3ef] lg:grid-cols-[1.3fr_1fr] dark:border dark:bg-card">
          <div className="p-8 sm:p-12 lg:p-14">
            <p className="eyebrow !text-[#a8a59d]">Visit us</p>
            <h2 id="visit" className="mt-3 text-balance font-display text-5xl leading-[0.98] sm:text-6xl">
              Your table is waiting.
            </h2>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-[#b3b0a8]">
              Come in for a slow lunch, or let us bring {BRAND.name} to you. Either way, it&apos;s cooked the moment you order.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/reservations" className={cn(buttonVariants({ size: "lg" }), "bg-[#f4f3ef] text-[#14130f] hover:bg-white")}>
                Book a table
              </Link>
              <Link href="/menu" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "border-white/20 bg-transparent text-[#f4f3ef] hover:bg-white/10 hover:text-white")}>
                Browse menu
              </Link>
            </div>
          </div>
          <ul className="flex flex-col justify-end gap-6 border-t border-white/10 p-8 text-[15px] sm:p-12 lg:border-l lg:border-t-0 lg:p-14">
            {settings.address && (
              <li className="flex gap-4">
                <MapPin className="mt-0.5 size-4 shrink-0 text-[#a8a59d]" aria-hidden />
                {settings.lat && settings.lng ? (
                  <a className="underline-offset-4 hover:underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${settings.lat}&mlon=${settings.lng}#map=17/${settings.lat}/${settings.lng}`}>
                    {settings.address}
                  </a>
                ) : (
                  settings.address
                )}
              </li>
            )}
            <li className="flex gap-4">
              <Clock className="mt-0.5 size-4 shrink-0 text-[#a8a59d]" aria-hidden />
              <span>
                Today · <span className="font-mono text-sm">{hoursText(settings.opening_hours[todayKey])}</span>
              </span>
            </li>
            {settings.phone && (
              <li className="flex gap-4">
                <Phone className="mt-0.5 size-4 shrink-0 text-[#a8a59d]" aria-hidden />
                <a className="font-mono text-sm underline-offset-4 hover:underline" href={`tel:${settings.phone.replace(/\s/g, "")}`}>
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
