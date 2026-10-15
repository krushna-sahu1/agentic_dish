import Link from "next/link";
import { Star } from "lucide-react";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DishImage } from "./DishImage";
import { SpiceLevel, VegMark } from "./Markers";
import { AddToCartButton } from "./AddToCartButton";

export interface DishCardItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_paise: number;
  image_url: string | null;
  is_veg: boolean;
  spice_level: number;
  tags: string[];
  allergens: string[];
  available: boolean;
  has_options: boolean;
  rating: number | null;
  category?: string;
}

const TAG_LABEL: Record<string, string> = { bestseller: "Bestseller", chef_special: "Chef's special", new: "New", healthy: "Healthy", kids: "Kids" };

export function DishCard({ item, compact = false, priority = false }: { item: DishCardItem; compact?: boolean; priority?: boolean }) {
  return (
    <article data-testid="dish-card" data-dish={item.slug} className={cn("group flex flex-col", !item.available && "opacity-80")}>
      <Link href={`/menu/${item.slug}`} className="relative block overflow-hidden rounded-2xl bg-muted" tabIndex={-1} aria-hidden>
        <DishImage
          src={item.image_url}
          alt=""
          priority={priority}
          className={cn("aspect-[4/3] transition-transform duration-500 ease-out group-hover:scale-[1.04]", !item.available && "grayscale")}
        />
        {!item.available && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-sm font-semibold uppercase tracking-[0.18em] text-white">Sold out</span>
        )}
        {item.tags[0] && item.available && (
          <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium shadow-sm backdrop-blur">
            {TAG_LABEL[item.tags[0]] ?? item.tags[0]}
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-1 px-0.5 pt-3">
        <div className="flex items-start gap-2">
          <VegMark veg={item.is_veg} className="mt-0.5" />
          <h3 className="flex-1 text-[15px] font-medium leading-snug">
            <Link href={`/menu/${item.slug}`} className="underline-offset-4 hover:underline">
              {item.name}
            </Link>
          </h3>
          <SpiceLevel level={item.spice_level} />
        </div>
        {!compact && <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{item.description}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <div className="flex items-center gap-2.5">
            <span className="font-semibold tabular-nums">{formatINR(item.price_paise)}</span>
            {item.rating ? (
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground" aria-label={`Rated ${item.rating} out of 5`}>
                <Star className="size-3 fill-primary text-primary" aria-hidden /> {item.rating.toFixed(1)}
              </span>
            ) : null}
          </div>
          <AddToCartButton item={item} size="sm" variant="outline" className="h-8" />
        </div>
      </div>
    </article>
  );
}
