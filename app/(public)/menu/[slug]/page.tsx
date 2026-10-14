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
      <div className="grid gap-8 md:grid-cols-2">
        <div className="overflow-hidden rounded-3xl border">
          <DishImage src={item.image_url} alt={item.name} priority className={!orderable.ok ? "grayscale" : undefined} />
        </div>
        <div>
          <div className="flex items-start gap-3">
            <VegMark veg={item.is_veg} className="mt-2" />
            <h1 className="font-display text-3xl font-semibold">{item.name}</h1>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            {item.tags.map((t) => (
              <Badge key={t} variant="secondary" className="capitalize">{t.replace("_", " ")}</Badge>
            ))}
            {item.avg_rating ? (
              <span className="flex items-center gap-1"><Star className="size-4 fill-amber-400 text-amber-400" /> {item.avg_rating.toFixed(1)} ({item.review_count})</span>
            ) : null}
          </div>
          <p className="mt-4 text-muted-foreground">{item.description}</p>
          <p className="mt-4 text-2xl font-semibold">{formatINR(item.price_paise)}</p>
          {!orderable.ok && <p className="mt-1 text-sm font-medium text-destructive">Currently {orderable.reason}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <AddToCartButton item={card} size="lg" label="Add to cart" />
            <FavoriteButton itemId={item.id} />
            <AskAiButton variant="ghost" size="sm" prompt={`What goes well with ${item.name}?`} label="What goes with this?" />
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border p-3"><dt className="flex items-center gap-1.5 text-muted-foreground"><Flame className="size-4" /> Spice</dt><dd className="mt-1 flex items-center gap-2">{spiceLabel(item.spice_level)} <SpiceLevel level={item.spice_level} /></dd></div>
            <div className="rounded-xl border p-3"><dt className="flex items-center gap-1.5 text-muted-foreground"><Clock className="size-4" /> Prep time</dt><dd className="mt-1">~{item.prep_time_min} min</dd></div>
            <div className="rounded-xl border p-3"><dt className="flex items-center gap-1.5 text-muted-foreground"><Utensils className="size-4" /> Portion</dt><dd className="mt-1">{item.portion ?? "—"}</dd></div>
            <div className="rounded-xl border p-3"><dt className="text-muted-foreground">Calories</dt><dd className="mt-1">{item.calories ? `${item.calories} kcal` : "—"}</dd></div>
            <div className="col-span-2 rounded-xl border p-3">
              <dt className="text-muted-foreground">Allergens</dt>
              <dd className="mt-1 capitalize">{item.allergens.length ? item.allergens.join(", ") : "None of the 8 major allergens"}</dd>
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

      {pairings.length > 0 && (
        <section className="mt-12" aria-labelledby="pairings">
          <h2 id="pairings" className="mb-4 font-display text-2xl font-semibold">Goes well with</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {pairings.slice(0, 4).map((p) => (
              <div key={p.item.id}>
                <DishCard item={toCardItem(p.item)} compact />
                <p className="mt-1 px-1 text-xs text-muted-foreground">{p.reason}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-12" aria-labelledby="reviews">
        <h2 id="reviews" className="mb-4 font-display text-2xl font-semibold">Reviews</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reviews yet.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {reviews.map((r, i) => (
              <li key={i} className="rounded-xl border bg-card p-4 text-sm">
                <p aria-label={`${r.rating} out of 5 stars`}>{"★".repeat(r.rating)}<span className="text-muted-foreground">{"★".repeat(5 - r.rating)}</span></p>
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
