import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, Clock, CreditCard, MapPin, MessageCircle, Phone, Sparkles, Star, Truck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { DishCard } from "@/components/site/DishCard";
import { DishImage } from "@/components/site/DishImage";
import { hoursText } from "@/components/site/Footer";
import { AskAiButton } from "@/components/site/AskAiButton";
import { toCardItem } from "@/components/site/to-card";
import { getMenu } from "@/lib/services/menu";
import { getSettings, openStatus } from "@/lib/services/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { BRAND, PHOTOS } from "@/lib/brand";
import { zonedDateString } from "@/lib/time";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Review = { id: string; rating: number; comment: string | null; reviewer_name: string | null };

/** Shown only until the restaurant has real 5★ reviews with comments. */
const SAMPLE_REVIEWS: Review[] = [
  { id: "s1", rating: 5, comment: "I typed “something light, no onion, under ₹250” and it built me the perfect tiffin. The dosa arrived crisp — not soggy — which never happens with delivery.", reviewer_name: "Ananya" },
  { id: "s2", rating: 5, comment: "Dalma like my grandmother made. Ordering through the chat took about ten seconds.", reviewer_name: "Rohit" },
  { id: "s3", rating: 5, comment: "Booked a table for six by just asking. Lovely staff and the filter coffee is the best in town.", reviewer_name: "Meera" },
];

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
  const [settings, menu] = await Promise.all([getSettings(), getMenu()]);
  const status = openStatus(settings);
  const open = status.isOpen && settings.accepting_orders;
  const statusLabel = settings.accepting_orders ? status.label : "Online orders paused";

  const bestsellers = menu.items
    .filter((i) => i.tags.includes("bestseller"))
    .sort((a, b) => b.sold_30d - a.sold_30d)
    .slice(0, 8);
  const featured = bestsellers.length >= 4 ? bestsellers : [...menu.items].sort((a, b) => b.sold_30d - a.sold_30d).slice(0, 8);

  const { data: reviewRows } = await createAdminClient()
    .from("public_reviews")
    .select("id, rating, comment, reviewer_name")
    .gte("rating", 5)
    .not("comment", "is", null)
    .order("created_at", { ascending: false })
    .limit(5);
  const reviews: Review[] = reviewRows?.length ? (reviewRows as Review[]) : SAMPLE_REVIEWS;

  const rated = menu.items.filter((i) => i.review_count > 0);
  const reviewCount = rated.reduce((s, i) => s + i.review_count, 0);
  const avgRating = reviewCount ? rated.reduce((s, i) => s + i.avg_rating * i.review_count, 0) / reviewCount : null;

  const todayKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date(`${zonedDateString(new Date())}T12:00:00`).getDay()];
  const [feature, ...rest] = reviews;

  return (
    <>
      {/* ───────────── Hero ───────────── */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-8 sm:px-6 sm:pt-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-24 lg:pt-16">
          <div>
            <p className="inline-flex animate-rise items-center gap-2 rounded-full border bg-card/70 px-3 py-1.5 text-xs font-medium backdrop-blur">
              <span className={cn("size-2 rounded-full", open ? "bg-success" : "bg-destructive")} aria-hidden />
              {statusLabel}
              <span className="text-muted-foreground">· Bhubaneswar</span>
            </p>
            <h1 className="mt-6 animate-rise font-display text-[3.4rem] leading-[0.95] [animation-delay:60ms] sm:text-7xl lg:text-[5.5rem]">
              Real food,
              <br />
              ordered the way
              <br />
              you <em className="text-primary">talk.</em>
            </h1>
            <p className="mt-6 max-w-md animate-rise text-lg leading-relaxed text-muted-foreground [animation-delay:120ms]">
              Crisp dosas, slow-cooked Odia classics and filter coffee — with an AI host that takes your order, answers allergy questions and books your table.
            </p>
            <div className="mt-9 flex animate-rise flex-wrap gap-3 [animation-delay:180ms]">
              <Link href="/menu" className={buttonVariants({ size: "lg" })}>
                Order now <ArrowRight />
              </Link>
              <AskAiButton size="lg" variant="outline" label="Chat with our AI host" />
            </div>
            <dl className="mt-12 grid max-w-md animate-rise grid-cols-3 gap-6 border-t pt-6 [animation-delay:240ms]">
              {avgRating ? (
                <div>
                  <dt className="text-xs text-muted-foreground">Guests rate us</dt>
                  <dd className="mt-1 flex items-center gap-1 font-display text-3xl">
                    {avgRating.toFixed(1)} <Star className="size-4 fill-primary text-primary" aria-hidden />
                  </dd>
                </div>
              ) : (
                <div>
                  <dt className="text-xs text-muted-foreground">Menu sections</dt>
                  <dd className="mt-1 font-display text-3xl">{menu.categories.length}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-muted-foreground">Ready in</dt>
                <dd className="mt-1 font-display text-3xl">~{settings.avg_prep_minutes}m</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Dishes</dt>
                <dd className="mt-1 font-display text-3xl">{menu.items.length}</dd>
              </div>
            </dl>
          </div>

          <div className="relative mx-auto w-full max-w-xl animate-fade [animation-delay:120ms] lg:max-w-none">
            <div className="overflow-hidden rounded-[2rem] bg-muted shadow-[0_40px_80px_-40px_rgb(60_30_10/0.45)]">
              <DishImage src={PHOTOS.hero} alt="A crisp masala dosa served with chutneys and sambar" priority className="aspect-[4/5] sm:aspect-[5/5] lg:aspect-[4/5]" />
            </div>
            {/* Floating chat preview */}
            <div className="absolute -left-2 bottom-6 w-[min(18rem,80%)] animate-rise rounded-2xl border bg-card/95 p-3 shadow-xl backdrop-blur [animation-delay:450ms] sm:-left-8 sm:bottom-10">
              <p className="ml-auto w-fit rounded-2xl rounded-br-md bg-foreground px-3 py-2 text-[13px] text-background">Two masala dosas, less spicy please</p>
              <div className="mt-2 flex items-start gap-2">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                  <Sparkles className="size-3.5" aria-hidden />
                </span>
                <p className="rounded-2xl rounded-tl-md bg-muted px-3 py-2 text-[13px]">
                  <span className="flex items-center gap-1 font-medium">
                    <Check className="size-3.5 text-success" aria-hidden /> Added to your cart
                  </span>
                  <span className="text-muted-foreground">I&apos;ve noted “less spicy” for the kitchen.</span>
                </p>
              </div>
            </div>
            <div className="absolute -right-2 top-6 animate-rise rounded-full border bg-card/95 px-4 py-2 text-xs font-medium shadow-lg backdrop-blur [animation-delay:600ms] sm:-right-5">
              <span className="text-primary">●</span> Delivery · Pickup · Dine-in
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── How it works ───────────── */}
      <section aria-labelledby="how" className="border-y bg-card/60">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
            <div className="reveal">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">How it works</p>
              <h2 id="how" className="mt-4 font-display text-5xl leading-[1] sm:text-6xl">
                From craving to
                <br />
                <em>doorstep</em> in three steps.
              </h2>
              <div className="mt-10 hidden grid-cols-2 gap-3 lg:grid">
                <DishImage src={PHOTOS.idli} alt="Soft idlis on a banana leaf" className="aspect-[3/4] rounded-2xl" />
                <DishImage src={PHOTOS.tiffin} alt="Idli, vada and sambar" className="mt-10 aspect-[3/4] rounded-2xl" />
              </div>
            </div>
            <ol className="grid content-start gap-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="reveal group grid grid-cols-[auto_1fr] gap-6 rounded-3xl border bg-background p-6 transition-colors hover:border-foreground/20 sm:p-8">
                  <span className="font-display text-5xl leading-none text-primary/80">0{i + 1}</span>
                  <div>
                    <h3 className="flex items-center gap-2 text-xl font-medium tracking-tight">
                      <s.icon className="size-5 text-muted-foreground" aria-hidden /> {s.title}
                    </h3>
                    <p className="mt-2 leading-relaxed text-muted-foreground">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ───────────── Featured menu ───────────── */}
      <section aria-labelledby="featured" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
        <div className="reveal flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">Featured menu</p>
            <h2 id="featured" className="mt-4 font-display text-5xl leading-[1] sm:text-6xl">
              What everyone&apos;s <em>ordering.</em>
            </h2>
          </div>
          <Link href="/menu" className={buttonVariants({ variant: "outline" })}>
            See the full menu <ArrowUpRight />
          </Link>
        </div>
        {menu.categories.length > 0 && (
          <div className="scrollbar-none -mx-4 mt-8 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {menu.categories.map((c) => (
              <Link key={c.id} href={`/menu#cat-${c.slug}`} className="shrink-0 rounded-full border px-4 py-2 text-sm transition-colors hover:border-foreground hover:bg-foreground hover:text-background">
                {c.name}
              </Link>
            ))}
          </div>
        )}
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
          {featured.map((i, idx) => (
            <div key={i.id} className="reveal">
              <DishCard item={toCardItem(i)} priority={idx < 2} />
            </div>
          ))}
        </div>
      </section>

      {/* ───────────── Testimonials ───────────── */}
      <section aria-labelledby="reviews" className="bg-foreground text-background">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">Guest notes</p>
          <h2 id="reviews" className="sr-only">
            What guests say
          </h2>
          <div className="mt-8 grid gap-12 lg:grid-cols-[1.5fr_1fr] lg:gap-20">
            {feature && (
              <figure className="reveal">
                <blockquote className="font-display text-4xl leading-[1.1] sm:text-5xl">&ldquo;{feature.comment}&rdquo;</blockquote>
                <figcaption className="mt-8 flex items-center gap-3 text-sm">
                  <Stars n={feature.rating} />
                  <span className="opacity-70">— {feature.reviewer_name ?? "A happy guest"}</span>
                </figcaption>
              </figure>
            )}
            <div className="grid content-start gap-4">
              {rest.slice(0, 3).map((r) => (
                <figure key={r.id} className="reveal rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                  <Stars n={r.rating} />
                  <blockquote className="mt-3 leading-relaxed opacity-90">{r.comment}</blockquote>
                  <figcaption className="mt-3 text-sm opacity-60">— {r.reviewer_name ?? "A happy guest"}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── Visit / CTA ───────────── */}
      <section aria-labelledby="visit" className="mx-auto max-w-7xl px-4 pt-20 sm:px-6 lg:pt-28">
        <div className="reveal relative overflow-hidden rounded-[2rem] bg-muted">
          <DishImage src={PHOTOS.dining} alt="" className="absolute inset-0 h-full w-full" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/10" aria-hidden />
          <div className="relative grid gap-10 p-8 text-white sm:p-12 lg:grid-cols-[1.4fr_1fr] lg:p-16">
            <div>
              <h2 id="visit" className="font-display text-5xl leading-[1] sm:text-6xl">
                Your table is <em>waiting.</em>
              </h2>
              <p className="mt-4 max-w-md text-white/80">Come in for a slow lunch, or let us bring {BRAND.name} to you. Either way, it&apos;s cooked the moment you order.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/reservations" className={cn(buttonVariants({ size: "lg" }))}>
                  Book a table
                </Link>
                <Link href="/menu" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "border-white/40 bg-white/10 text-white backdrop-blur hover:bg-white/20 hover:text-white")}>
                  Order online
                </Link>
              </div>
            </div>
            <ul className="space-y-4 self-end text-sm text-white/85">
              {settings.address && (
                <li className="flex gap-3">
                  <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
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
                <Clock className="mt-0.5 size-4 shrink-0" aria-hidden /> Today: {hoursText(settings.opening_hours[todayKey])}
              </li>
              {settings.phone && (
                <li className="flex gap-3">
                  <Phone className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <a className="underline-offset-4 hover:underline" href={`tel:${settings.phone.replace(/\s/g, "")}`}>
                    {settings.phone}
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span className="flex gap-0.5" role="img" aria-label={`${n} out of 5 stars`}>
      {Array.from({ length: n }).map((_, i) => (
        <Star key={i} className="size-4 fill-primary text-primary" aria-hidden />
      ))}
    </span>
  );
}
