import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Flame, Star, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DishCard } from "@/components/site/DishCard";
import { DishImage } from "@/components/site/DishImage";
import { SpiceLevel, VegMark } from "@/components/site/Markers";
import { AddToCartButton } from "@/components/site/AddToCartButton";
import { AskAiButton } from "@/components/site/AskAiButton";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { toCardItem } from "@/components/site/to-card";
import { getItemDetails, getMenu, isOrderable } from "@/lib/services/menu";
import { ServiceError } from "@/lib/services/errors";
import { formatINR, spiceLabel } from "@/lib/format";
import { formatDateTime } from "@/lib/time";
import { TAG_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const menu = await getMenu();
  const item = menu.items.find((i) => i.slug === slug);
  return item ? { title: item.name, description: item.description } : { title: "Dish not found" };
}

export default async function DishPage({ params }: Props) {
  const { slug } = await params;
  const menu = await getMenu();
  if (!menu.items.some((i) => i.slug === slug)) notFound();
  let details;
  try {
    details = await getItemDetails(slug);
  } catch (e) {
    if (e instanceof ServiceError) notFound();
    throw e;
  }
  const { item, pairings, reviews } = details;
  const orderable = isOrderable(item);
  const card = toCardItem(item);

  return (
    <article className="py-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
        <Link href="/menu" className="hover:underline">Menu</Link> / <Link href={`/menu#cat-${item.category_slug}`} className="hover:underline">{item.category_name}</Link>
      </nav>
      <div className={cn("grid gap-10", item.image_url ? "md:grid-cols-2" : "lg:grid-cols-[1.2fr_0.8fr]")}>
        {item.image_url && (
          <div className="overflow-hidden rounded-3xl border">
            <DishImage src={item.image_url} alt={item.name} priority className={cn("w-full", !orderable.ok && "grayscale")} />
          </div>
        )}
        <div className={cn(!item.image_url && "contents")}>
          <div>
          <div className="flex items-start gap-3">
            <VegMark veg={item.is_veg} className="mt-4" />
            <h1 className="font-display text-5xl sm:text-6xl">{item.name}</h1>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            {item.tags.map((t) => (
              <Badge key={t} variant="secondary" >{TAG_LABEL[t] ?? t}</Badge>
            ))}
            {item.avg_rating ? (
              <span className="flex items-center gap-1"><Star className="size-4 fill-turmeric text-turmeric" /> {item.avg_rating.toFixed(1)} ({item.review_count})</span>
            ) : null}
          </div>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">{item.description}</p>
          <p className="mt-4 text-2xl font-semibold">{formatINR(item.price_paise)}</p>
          {!orderable.ok && <p className="mt-1 text-sm font-medium text-destructive">Currently {orderable.reason}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <AddToCartButton item={card} size="lg" label="Add to cart" />
            <FavoriteButton itemId={item.id} />
            <AskAiButton variant="ghost" size="sm" prompt={`What goes well with ${item.name}?`} label="What goes with this?" />
          </div>

          </div>
          <div>
          <dl className={cn("grid grid-cols-2 gap-x-6 gap-y-4 rounded-2xl border bg-card p-6 text-sm", item.image_url && "mt-8")}>
            <div><dt className="flex items-center gap-1.5 text-muted-foreground"><Flame className="size-4" /> Spice</dt><dd className="mt-1 flex items-center gap-2">{spiceLabel(item.spice_level)} <SpiceLevel level={item.spice_level} /></dd></div>
            <div><dt className="flex items-center gap-1.5 text-muted-foreground"><Clock className="size-4" /> Prep time</dt><dd className="mt-1">~{item.prep_time_min} min</dd></div>
            <div><dt className="flex items-center gap-1.5 text-muted-foreground"><Utensils className="size-4" /> Portion</dt><dd className="mt-1">{item.portion ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground">Calories</dt><dd className="mt-1">{item.calories ? `${item.calories} kcal` : "—"}</dd></div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">Allergens</dt>
              <dd className="mt-1">{item.allergens.length ? <span className="capitalize">{item.allergens.join(", ")}</span> : "None of the 8 major allergens"}</dd>
              <dd className="mt-1 text-xs text-muted-foreground">{[item.is_vegan && "Vegan", item.is_jain && "Jain-friendly"].filter(Boolean).join(" · ")}</dd>
            </div>
          </dl>

          {(item.variants.length > 0 || item.addons.length > 0) && (
            <div className="mt-6 space-y-2 text-sm">
              {item.variants.length > 0 && <p><span className="font-medium">Sizes:</span> {item.variants.map((v) => `${v.name}${v.price_delta_paise ? ` (${v.price_delta_paise > 0 ? "+" : "−"}${formatINR(Math.abs(v.price_delta_paise))})` : ""}`).join(" · ")}</p>}
              {item.addons.length > 0 && <p><span className="font-medium">Add-ons:</span> {item.addons.map((a) => `${a.name} +${formatINR(a.price_paise)}`).join(" · ")}</p>}
            </div>
          )}
          </div>
        </div>
      </div>

      {pairings.length > 0 && (
        <section className="mt-12" aria-labelledby="pairings">
          <h2 id="pairings" className="mb-2 font-display text-3xl">Goes well with</h2>
          <div className="grid gap-x-14 lg:grid-cols-2">
            {pairings.slice(0, 4).map((p) => (
              <DishCard key={p.item.id} item={toCardItem(p.item)} compact note={p.reason} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-12" aria-labelledby="reviews">
        <h2 id="reviews" className="mb-4 font-display text-3xl">Reviews</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reviews yet.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {reviews.map((r, i) => (
              <li key={i} className="rounded-xl border bg-card p-4 text-sm">
                <p aria-label={`${r.rating} out of 5 stars`}><span className="text-turmeric">{"★".repeat(r.rating)}</span><span className="text-muted-foreground/50">{"★".repeat(5 - r.rating)}</span></p>
                {r.comment && <p className="mt-1">{r.comment}</p>}
                <p className="mt-1 text-xs text-muted-foreground">— {r.reviewer_name}, {formatDateTime(r.created_at)}</p>
                {r.owner_reply && <p className="mt-2 rounded-lg bg-muted p-2 text-xs"><b>Reply from the restaurant:</b> {r.owner_reply}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
