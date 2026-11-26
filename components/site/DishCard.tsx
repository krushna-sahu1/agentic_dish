import Link from "next/link";
import { Star } from "lucide-react";
import { formatINR } from "@/lib/format";
import { TAG_LABEL } from "@/lib/types";
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

/** One line of the menu: name, leader, price, then what it is and an Add button. The photo appears only when there is one. */
export function DishCard({ item, compact = false, note }: { item: DishCardItem; compact?: boolean; note?: string }) {
  return (
    <article data-testid="dish-card" data-dish={item.slug} className="flex gap-4 border-b py-4">
      <div className={cn("min-w-0 flex-1", !item.available && "opacity-60")}>
        <h3 className="flex items-baseline gap-2 text-[15px] font-semibold leading-snug">
          <VegMark veg={item.is_veg} className="translate-y-0.5 self-center" />
          <Link href={`/menu/${item.slug}`} className="min-w-0 underline-offset-4 hover:underline">
            {item.name}
          </Link>
          <span aria-hidden className="min-w-4 flex-1 translate-y-[-3px] border-b border-dotted border-foreground/30" />
          <span className="tabular-nums">{formatINR(item.price_paise)}</span>
        </h3>
        {!compact && <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>}
        {note && <p className="mt-1 text-sm text-muted-foreground">{note}</p>}
        <div className="mt-2 flex min-h-8 items-center gap-3 text-xs text-muted-foreground">
          {item.tags[0] && <span className="font-medium text-primary">{TAG_LABEL[item.tags[0]] ?? item.tags[0]}</span>}
          <SpiceLevel level={item.spice_level} />
          {item.rating ? (
            <span className="flex items-center gap-1" aria-label={`Rated ${item.rating} out of 5`}>
              <Star className="size-3 fill-turmeric text-turmeric" aria-hidden /> {item.rating.toFixed(1)}
            </span>
          ) : null}
          <AddToCartButton item={item} size="sm" variant="outline" className="ml-auto" />
        </div>
      </div>
      <Link href={`/menu/${item.slug}`} tabIndex={-1} aria-hidden className="shrink-0 empty:hidden">
        <DishImage src={item.image_url} alt="" className={cn("size-24 rounded-xl sm:size-28", !item.available && "grayscale")} />
      </Link>
    </article>
  );
}
