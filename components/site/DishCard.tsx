import Link from "next/link";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
    <article
      data-testid="dish-card"
      data-dish={item.slug}
      className={cn("group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md", !item.available && "opacity-75")}
    >
      <Link href={`/menu/${item.slug}`} className="relative block" tabIndex={-1} aria-hidden>
        <DishImage src={item.image_url} alt="" priority={priority} className={cn(compact ? "aspect-[4/3]" : "aspect-[4/3]", !item.available && "grayscale")} />
        {!item.available && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-semibold uppercase tracking-wide text-white">Sold out</span>
        )}
        {item.tags[0] && item.available && (
          <Badge className="absolute left-2 top-2 bg-card/95 text-foreground shadow-sm">{TAG_LABEL[item.tags[0]] ?? item.tags[0]}</Badge>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-start gap-2">
          <VegMark veg={item.is_veg} className="mt-0.5" />
          <h3 className="flex-1 text-sm font-semibold leading-snug">
            <Link href={`/menu/${item.slug}`} className="hover:underline">
              {item.name}
            </Link>
          </h3>
          <SpiceLevel level={item.spice_level} />
        </div>
        {!compact && <p className="line-clamp-2 text-xs text-muted-foreground">{item.description}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{formatINR(item.price_paise)}</span>
            {item.rating ? (
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground" aria-label={`Rated ${item.rating} out of 5`}>
                <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden /> {item.rating.toFixed(1)}
              </span>
            ) : null}
          </div>
          <AddToCartButton item={item} />
        </div>
      </div>
    </article>
  );
}
