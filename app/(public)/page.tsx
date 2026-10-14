import Link from "next/link";
import { ArrowRight, Clock, MapPin, Phone, Star } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DishCard } from "@/components/site/DishCard";
import { DishImage } from "@/components/site/DishImage";
import { HoursList } from "@/components/site/Footer";
import { AskAiButton } from "@/components/site/AskAiButton";
import { toCardItem } from "@/components/site/to-card";
import { getMenu } from "@/lib/services/menu";
import { getSettings, openStatus } from "@/lib/services/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [settings, menu] = await Promise.all([getSettings(), getMenu()]);
  const status = openStatus(settings);
  const open = status.isOpen && settings.accepting_orders;
  const bestsellers = menu.items.filter((i) => i.tags.includes("bestseller")).sort((a, b) => b.sold_30d - a.sold_30d).slice(0, 8);
  const specials = menu.items.filter((i) => i.tags.includes("chef_special")).slice(0, 4);
  const { data: reviews } = await createAdminClient()
    .from("public_reviews")
    .select("id, rating, comment, reviewer_name, created_at, menu_item_id")
    .gte("rating", 5)
    .not("comment", "is", null)
    .order("created_at", { ascending: false })
    .limit(6);
  const hero = menu.items.find((i) => i.slug === "masala-dosa") ?? menu.items[0];

  return (
    <div className="space-y-16 py-8">
      {/* Hero */}
      <section className="grid items-center gap-8 md:grid-cols-2">
        <div>
          <Badge variant={open ? "success" : "destructive"} className="mb-4">
            <span className={cn("size-1.5 rounded-full", open ? "bg-success" : "bg-destructive")} aria-hidden />
            {settings.accepting_orders ? status.label : "Online orders paused"}
          </Badge>
          <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">{settings.name}</h1>
          <p className="mt-3 max-w-prose text-lg text-muted-foreground">{settings.tagline}</p>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            Order the way you talk: just tell our AI host <em>&ldquo;add one paneer masala dosa to my cart&rdquo;</em> — or browse the menu yourself.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/menu" className={buttonVariants({ size: "lg" })}>
              Order now <ArrowRight />
            </Link>
            <AskAiButton size="lg" variant="outline" />
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-md">
          <div className="overflow-hidden rounded-3xl border shadow-xl">
            <DishImage src={hero?.image_url ?? null} alt={hero?.name ?? "Dosa"} priority className="aspect-square" />
          </div>
          <div className="absolute -bottom-4 -left-4 rounded-2xl border bg-card px-4 py-3 shadow-lg">
            <p className="text-xs text-muted-foreground">Most loved</p>
            <p className="font-semibold">{hero?.name}</p>
          </div>
        </div>
      </section>

      {/* Bestsellers */}
      <section aria-labelledby="bestsellers">
        <div className="mb-4 flex items-end justify-between">
          <h2 id="bestsellers" className="font-display text-2xl font-semibold">Bestsellers</h2>
          <Link href="/menu" className="text-sm font-medium text-primary hover:underline">Full menu →</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {bestsellers.map((i, idx) => (
            <DishCard key={i.id} item={toCardItem(i)} priority={idx < 2} />
          ))}
        </div>
      </section>

      {/* Chef specials */}
      <section aria-labelledby="specials" className="rounded-3xl bg-accent/40 p-5 sm:p-8">
        <h2 id="specials" className="mb-1 font-display text-2xl font-semibold">Chef&apos;s specials</h2>
        <p className="mb-4 text-sm text-muted-foreground">Odia classics and South Indian favourites our kitchen is proudest of.</p>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {specials.map((i) => (
            <DishCard key={i.id} item={toCardItem(i)} compact />
          ))}
        </div>
      </section>

      {/* Categories */}
      <section aria-labelledby="categories">
        <h2 id="categories" className="mb-4 font-display text-2xl font-semibold">Explore the menu</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {menu.categories.map((c) => {
            const sample = menu.items.find((i) => i.category_id === c.id);
            return (
              <Link key={c.id} href={`/menu#cat-${c.slug}`} className="group relative overflow-hidden rounded-2xl border">
                <DishImage src={sample?.image_url ?? null} alt="" className="aspect-[4/3] transition group-hover:scale-105" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 font-semibold text-white">{c.name}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Reviews */}
      {reviews?.length ? (
        <section aria-labelledby="reviews">
          <h2 id="reviews" className="mb-4 font-display text-2xl font-semibold">What guests say</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r) => (
              <figure key={r.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                <div className="flex gap-0.5" aria-label={`${r.rating} out of 5 stars`}>
                  {Array.from({ length: r.rating }).map((_, i) => (
                    <Star key={i} className="size-4 fill-amber-400 text-amber-400" aria-hidden />
                  ))}
                </div>
                <blockquote className="mt-2 text-sm">{r.comment}</blockquote>
                <figcaption className="mt-2 text-xs text-muted-foreground">— {r.reviewer_name}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {/* Visit */}
      <section aria-labelledby="visit" className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 id="visit" className="mb-3 font-display text-2xl font-semibold">Visit us</h2>
          <p className="flex items-start gap-2 text-sm"><MapPin className="mt-0.5 size-4 text-primary" /> {settings.address}</p>
          <p className="mt-2 flex items-center gap-2 text-sm"><Phone className="size-4 text-primary" /> <a className="hover:underline" href={`tel:${settings.phone?.replace(/\s/g, "")}`}>{settings.phone}</a></p>
          <p className="mb-2 mt-4 flex items-center gap-2 text-sm font-semibold"><Clock className="size-4 text-primary" /> Opening hours</p>
          <HoursList settings={settings} />
          <Link href="/reservations" className={cn(buttonVariants({ variant: "outline" }), "mt-5")}>Book a table</Link>
        </div>
        {settings.lat && settings.lng ? (
          <iframe
            title="Map showing the restaurant location"
            className="h-72 w-full rounded-2xl border"
            loading="lazy"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${settings.lng - 0.01}%2C${settings.lat - 0.006}%2C${settings.lng + 0.01}%2C${settings.lat + 0.006}&layer=mapnik&marker=${settings.lat}%2C${settings.lng}`}
          />
        ) : null}
      </section>
    </div>
  );
}
