import { isOrderable, type MenuItemFull } from "@/lib/services/menu";
import type { MenuBrowserItem } from "./MenuBrowser";

/** Server → client props for dish cards (only what the card needs). */
export function toCardItem(i: MenuItemFull): MenuBrowserItem {
  return {
    id: i.id,
    name: i.name,
    slug: i.slug,
    description: i.description,
    price_paise: i.price_paise,
    image_url: i.image_url,
    is_veg: i.is_veg,
    is_vegan: i.is_vegan,
    is_jain: i.is_jain,
    spice_level: i.spice_level,
    tags: i.tags,
    allergens: i.allergens,
    available: isOrderable(i).ok,
    has_options: i.variants.length > 0 || i.addons.some((a) => a.is_available),
    rating: i.avg_rating || null,
    category: i.category_name,
    category_slug: i.category_slug,
  };
}
