import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Allergen, Category, ItemAddon, ItemTag, ItemVariant, MenuItem, Profile } from "@/lib/types";
import { ServiceError } from "./errors";

export interface MenuItemFull extends MenuItem {
  category_name: string;
  category_slug: string;
  variants: ItemVariant[];
  addons: ItemAddon[];
  avg_rating: number;
  review_count: number;
  sold_30d: number;
}

export interface Menu {
  categories: Category[];
  items: MenuItemFull[];
  byId: Map<string, MenuItemFull>;
}

/** Whole menu (≈60 items) loaded once per request; filtering happens in memory. */
export const getMenu = cache(async (opts: { includeDeleted?: boolean } = {}): Promise<Menu> => {
  const db = createAdminClient();
  const [cats, items, variants, addons, stats] = await Promise.all([
    db.from("categories").select("*").order("sort_order"),
    db.from("menu_items").select("*").order("sort_order"),
    db.from("item_variants").select("*").order("sort_order"),
    db.from("item_addons").select("*").order("price_paise"),
    db.from("menu_item_stats").select("*"),
  ]);
  for (const r of [cats, items, variants, addons, stats]) if (r.error) throw new Error(r.error.message);

  const categories = (cats.data as Category[]).filter((c) => opts.includeDeleted || c.is_active);
  const catById = new Map((cats.data as Category[]).map((c) => [c.id, c]));
  const statById = new Map(
    (stats.data as { menu_item_id: string; avg_rating: number; review_count: number; sold_30d: number }[]).map((s) => [
      s.menu_item_id,
      s,
    ]),
  );
  const full: MenuItemFull[] = (items.data as MenuItem[])
    .filter((m) => opts.includeDeleted || (!m.is_deleted && catById.get(m.category_id)?.is_active))
    .map((m) => {
      const c = catById.get(m.category_id)!;
      const s = statById.get(m.id);
      return {
        ...m,
        category_name: c?.name ?? "",
        category_slug: c?.slug ?? "",
        variants: (variants.data as ItemVariant[]).filter((v) => v.menu_item_id === m.id),
        addons: (addons.data as ItemAddon[]).filter((a) => a.menu_item_id === m.id),
        avg_rating: Number(s?.avg_rating ?? 0),
        review_count: Number(s?.review_count ?? 0),
        sold_30d: Number(s?.sold_30d ?? 0),
      };
    })
    .sort((a, b) => {
      const ca = catById.get(a.category_id)?.sort_order ?? 0;
      const cb = catById.get(b.category_id)?.sort_order ?? 0;
      return ca - cb || a.sort_order - b.sort_order;
    });
  return { categories, items: full, byId: new Map(full.map((i) => [i.id, i])) };
});

export function isOrderable(i: MenuItem): { ok: boolean; reason?: string } {
  if (i.is_deleted) return { ok: false, reason: "no longer on the menu" };
  if (!i.is_available) return { ok: false, reason: "sold out" };
  if (i.stock_qty !== null && i.stock_qty <= 0) return { ok: false, reason: "sold out" };
  return { ok: true };
}

export interface MenuFilters {
  veg?: boolean;
  vegan?: boolean;
  jain?: boolean;
  max_spice?: number;
  min_spice?: number;
  exclude_allergens?: Allergen[];
  max_price_paise?: number;
  min_price_paise?: number;
  tags?: ItemTag[];
  include_unavailable?: boolean;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Synonyms so "spicy chicken", "coffee", "kheer" etc. find the right dishes. */
const SYNONYMS: Record<string, string[]> = {
  coffee: ["filter coffee"],
  tea: ["masala chai", "chai"],
  kheer: ["payasam"],
  prawn: ["chingudi"],
  prawns: ["chingudi"],
  shrimp: ["chingudi"],
  fish: ["machha"],
  pani: ["gupchup"],
  puri: ["gupchup"],
  buttermilk: ["neer mor"],
  chaas: ["neer mor"],
  rasgulla: ["rasagola"],
  dal: ["dalma"],
  sweet: ["desserts"],
  drink: ["beverages"],
  drinks: ["beverages"],
};

function scoreItem(item: MenuItemFull, q: string): number {
  if (!q) return 1;
  const name = norm(item.name);
  const hay = `${name} ${norm(item.slug.replace(/-/g, " "))} ${norm(item.category_name)} ${norm(item.description)} ${item.tags.join(" ")}`;
  if (name === q) return 100;
  let score = 0;
  if (name.includes(q)) score += 50;
  const tokens = q.split(" ").filter((t) => t.length > 1);
  for (const t of tokens) {
    const alts = [t, ...(SYNONYMS[t] ?? [])];
    let best = 0;
    for (const a of alts) {
      if (name.split(" ").includes(a) || name.includes(a)) best = Math.max(best, 10);
      else if (hay.includes(a)) best = Math.max(best, 4);
      else if (a.length > 3 && hay.includes(a.slice(0, -1))) best = Math.max(best, 2); // crude plural
    }
    if (best === 0) return 0; // every token must match somewhere
    score += best;
  }
  return score;
}

export function applyFilters(items: MenuItemFull[], f: MenuFilters = {}): MenuItemFull[] {
  return items.filter((i) => {
    if (!f.include_unavailable && !isOrderable(i).ok) return false;
    if (f.veg && !i.is_veg) return false;
    if (f.vegan && !i.is_vegan) return false;
    if (f.jain && !i.is_jain) return false;
    if (f.max_spice != null && i.spice_level > f.max_spice) return false;
    if (f.min_spice != null && i.spice_level < f.min_spice) return false;
    if (f.max_price_paise != null && i.price_paise > f.max_price_paise) return false;
    if (f.min_price_paise != null && i.price_paise < f.min_price_paise) return false;
    if (f.exclude_allergens?.length && i.allergens.some((a) => f.exclude_allergens!.includes(a))) return false;
    if (f.tags?.length && !f.tags.every((t) => i.tags.includes(t))) return false;
    return true;
  });
}

export async function searchMenu(params: { query?: string; category?: string; filters?: MenuFilters; limit?: number }) {
  const menu = await getMenu();
  const q = norm(params.query ?? "");
  let items = applyFilters(menu.items, { include_unavailable: true, ...params.filters });
  if (params.category) {
    const c = norm(params.category);
    items = items.filter((i) => norm(i.category_name).includes(c) || i.category_slug.includes(c.replace(/ /g, "-")));
  }
  const scored = items
    .map((i) => ({ i, s: scoreItem(i, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || Number(isOrderable(b.i).ok) - Number(isOrderable(a.i).ok) || b.i.sold_30d - a.i.sold_30d);
  return scored.slice(0, params.limit ?? 12).map((x) => x.i);
}

/** Resolve an item by id, slug or exact-ish name. Throws with options when ambiguous. */
export async function resolveItem(ref: string): Promise<MenuItemFull> {
  const menu = await getMenu();
  const byId = menu.byId.get(ref);
  if (byId) return byId;
  const bySlug = menu.items.find((i) => i.slug === ref);
  if (bySlug) return bySlug;
  const matches = await searchMenu({ query: ref, limit: 6, filters: { include_unavailable: true } });
  const exact = matches.find((m) => norm(m.name) === norm(ref));
  if (exact) return exact;
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) throw new ServiceError(`No dish called "${ref}" on our menu.`, "not_found");
  throw new ServiceError(`"${ref}" matches several dishes — please pick one.`, "ambiguous", {
    options: matches.map((m) => ({ id: m.id, name: m.name, price_paise: m.price_paise })),
  });
}

export async function getItemDetails(ref: string) {
  const item = await resolveItem(ref);
  const pairings = await getPairings(item.id);
  const db = createAdminClient();
  const { data: reviews } = await db
    .from("public_reviews")
    .select("rating, comment, owner_reply, reviewer_name, created_at")
    .eq("menu_item_id", item.id)
    .order("created_at", { ascending: false })
    .limit(5);
  return { item, pairings, reviews: reviews ?? [], orderable: isOrderable(item) };
}

export async function getPairings(itemId: string) {
  const menu = await getMenu();
  const item = menu.byId.get(itemId);
  if (!item) throw new ServiceError("Dish not found.", "not_found");
  const { data } = await createAdminClient()
    .from("pairings")
    .select("paired_item_id, reason, weight")
    .eq("item_id", itemId)
    .order("weight", { ascending: false });
  const curated = (data ?? [])
    .map((p) => ({ item: menu.byId.get(p.paired_item_id as string), reason: p.reason as string, weight: p.weight as number }))
    .filter((p): p is { item: MenuItemFull; reason: string; weight: number } => !!p.item && isOrderable(p.item).ok);
  return curated;
}

/** Checks a dish against the user's profile (allergies + dietary prefs). */
export function profileConflicts(item: MenuItem, profile: Pick<Profile, "allergies" | "dietary_prefs"> | null) {
  if (!profile) return { allergens: [] as string[], diet: [] as string[] };
  const allergens = item.allergens.filter((a) => profile.allergies.map((x) => x.toLowerCase()).includes(a));
  const diet: string[] = [];
  const prefs = profile.dietary_prefs ?? [];
  if ((prefs.includes("veg") || prefs.includes("vegan") || prefs.includes("jain")) && !item.is_veg) diet.push("non-vegetarian");
  if (prefs.includes("vegan") && !item.is_vegan) diet.push("not vegan");
  if (prefs.includes("jain") && !item.is_jain) diet.push("not Jain");
  if (prefs.includes("gluten_free") && item.allergens.includes("gluten")) diet.push("contains gluten");
  return { allergens, diet };
}

/** Compact JSON for agent tool results / chat cards. */
export function itemSummary(i: MenuItemFull) {
  const o = isOrderable(i);
  return {
    id: i.id,
    name: i.name,
    slug: i.slug,
    category: i.category_name,
    price_paise: i.price_paise,
    image_url: i.image_url,
    is_veg: i.is_veg,
    is_vegan: i.is_vegan,
    is_jain: i.is_jain,
    spice_level: i.spice_level,
    allergens: i.allergens,
    tags: i.tags,
    rating: i.avg_rating || null,
    available: o.ok,
    unavailable_reason: o.reason ?? null,
    description: i.description,
    has_options: i.variants.length > 0 || i.addons.length > 0,
  };
}
export type ItemSummary = ReturnType<typeof itemSummary>;
