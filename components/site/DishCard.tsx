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
    <article
      data-testid="dish-card"
      data-dish={item.slug}
      className={cn(
        "group flex flex-col overflow-hidden rounded-[18px] border bg-card transition-[border-color,box-shadow] duration-300 hover:border-foreground/20 hover:shadow-[0_24px_48px_-28px_rgb(20_19_15/0.35)]",
        !item.available && "opacity-80",
      )}
    >
      <Link href={`/menu/${item.slug}`} className="relative block overflow-hidden bg-muted" tabIndex={-1} aria-hidden>
        <DishImage
          src={item.image_url}
          fallbackHint={`${item.name} ${item.category ?? ""}`}
          alt=""
          priority={priority}
          className={cn("aspect-[4/3] transition-transform duration-500 ease-out group-hover:scale-[1.04]", !item.available && "grayscale")}
        />
        {!item.available && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/50 font-mono text-xs uppercase tracking-[0.16em] text-white">Sold out</span>
        )}
        {item.tags[0] && item.available && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-card/95 px-2.5 py-1 text-[11px] font-medium shadow-sm backdrop-blur">
            {TAG_LABEL[item.tags[0]] ?? item.tags[0]}
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 p-3.5 sm:p-4">
        <div className="flex items-start gap-2">
          <VegMark veg={item.is_veg} className="mt-[3px]" />
          <h3 className="flex-1 text-[15px] font-semibold leading-snug tracking-[-0.01em]">
            <Link href={`/menu/${item.slug}`} className="underline-offset-4 hover:underline">
              {item.name}
            </Link>
          </h3>
        </div>
        {!compact && <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{item.description}</p>}
        {(item.spice_level > 0 || item.rating) && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <SpiceLevel level={item.spice_level} />
            {item.rating ? (
              <span className="flex items-center gap-1" aria-label={`Rated ${item.rating} out of 5`}>
                <Star className="size-3 fill-saffron text-saffron" aria-hidden /> {item.rating.toFixed(1)}
              </span>
            ) : null}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2.5">
          <span className="text-[17px] font-semibold tabular-nums">{formatINR(item.price_paise)}</span>
          <AddToCartButton item={item} size="sm" className="h-9 px-4" />
        </div>
      </div>
    </article>
  );
}
