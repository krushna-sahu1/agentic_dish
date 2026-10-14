/**
 * Recommendations: curated pairings + tags + ratings + 30-day popularity + the
 * user's own history. Combos are priced through lib/pricing (never by the LLM).
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { computeCartTotals } from "@/lib/pricing";
import type { Allergen, Profile } from "@/lib/types";
import { applyFilters, getMenu, getPairings, itemSummary, resolveItem, type MenuItemFull, type MenuFilters } from "./menu";
import { getSettings, pricingSettings } from "./settings";
import { ServiceError } from "./errors";

export const INTENTS = ["pairing", "spicy", "mild", "budget_meal", "group_meal", "healthy", "popular", "similar_to", "chef_special"] as const;
export type Intent = (typeof INTENTS)[number];

export interface RecommendationInput {
  intent: Intent;
  item_id?: string;
  budget_paise?: number;
  party_size?: number;
  preferences?: { veg?: boolean; vegan?: boolean; jain?: boolean; exclude_allergens?: Allergen[]; max_spice?: number; meal?: "breakfast" | "lunch" | "dinner" | "snack" };
}

const MAIN_CATS = ["dosa", "uttapam", "rice", "odia-specials", "idli-vada"];
const popularity = (i: MenuItemFull) => i.sold_30d * 1 + i.avg_rating * 10 + (i.tags.includes("bestseller") ? 30 : 0) + (i.tags.includes("chef_special") ? 10 : 0);

function profileFilters(profile: Profile | null, prefs: RecommendationInput["preferences"] = {}): MenuFilters {
  const p = profile?.dietary_prefs ?? [];
  return {
    veg: prefs.veg ?? (p.includes("veg") || p.includes("vegan") || p.includes("jain") ? true : undefined),
    vegan: prefs.vegan ?? (p.includes("vegan") ? true : undefined),
    jain: prefs.jain ?? (p.includes("jain") ? true : undefined),
    exclude_allergens: [...new Set([...(prefs.exclude_allergens ?? []), ...((profile?.allergies ?? []) as Allergen[])])],
    max_spice: prefs.max_spice,
  };
}

async function userTopItems(userId: string | null): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  if (!userId) return m;
  const { data } = await createAdminClient()
    .from("order_items")
    .select("menu_item_id, qty, orders!inner(user_id, status)")
    .eq("orders.user_id", userId)
    .in("orders.status", ["paid", "accepted", "preparing", "ready", "out_for_delivery", "completed"])
    .limit(500);
  for (const r of data ?? []) if (r.menu_item_id) m.set(r.menu_item_id as string, (m.get(r.menu_item_id as string) ?? 0) + (r.qty as number));
  return m;
}

export async function getRecommendations(input: RecommendationInput, ctx: { userId: string | null; profile: Profile | null }) {
  const menu = await getMenu();
  const filters = profileFilters(ctx.profile, input.preferences);
  const pool = applyFilters(menu.items, filters);
  const history = await userTopItems(ctx.userId);
  const rank = (items: MenuItemFull[]) => [...items].sort((a, b) => popularity(b) + (history.get(b.id) ?? 0) * 5 - (popularity(a) + (history.get(a.id) ?? 0) * 5));
  const pack = (items: MenuItemFull[], reason: (i: MenuItemFull) => string, n = 6) =>
    items.slice(0, n).map((i) => ({ ...itemSummary(i), reason: reason(i) }));
  const notes: string[] = [];
  if (filters.exclude_allergens?.length) notes.push(`Excluding dishes with ${filters.exclude_allergens.join(", ")}.`);
  if (filters.veg) notes.push("Vegetarian only.");

  switch (input.intent) {
    case "pairing": {
      if (!input.item_id) {
        // "What goes well with spicy food?" → cooling sides
        const cooling = rank(pool.filter((i) => i.spice_level <= 1 && (["beverages", "desserts"].includes(i.category_slug) || i.slug === "curd-rice" || i.allergens.includes("dairy"))));
        const preferred = ["neer-mor", "curd-rice", "sweet-lassi", "mango-lassi", "tender-coconut-water", "dahi-vada"];
        const sorted = [...cooling].sort((a, b) => (preferred.indexOf(a.slug) + 1 || 99) - (preferred.indexOf(b.slug) + 1 || 99));
        return {
          kind: "items" as const,
          title: "Cooling picks for spicy food",
          items: pack(sorted, (i) =>
            i.slug === "neer-mor" ? "Spiced buttermilk cools the palate instantly" :
            i.slug === "curd-rice" ? "Curd rice is the classic South Indian cool-down" :
            i.allergens.includes("dairy") ? "Dairy calms chilli heat" : "Refreshing and mild"),
          notes,
        };
      }
      const base = await resolveItem(input.item_id);
      const curated = (await getPairings(base.id)).filter((p) => pool.some((x) => x.id === p.item.id));
      const extra = base.spice_level >= 3 ? [] : rank(pool.filter((i) => i.category_slug === "beverages" && !curated.some((c) => c.item.id === i.id))).slice(0, 2);
      return {
        kind: "items" as const,
        title: `Goes well with ${base.name}`,
        items: [
          ...curated.map((p) => ({ ...itemSummary(p.item), reason: p.reason })),
          ...extra.map((i) => ({ ...itemSummary(i), reason: "A popular drink to go alongside" })),
        ].slice(0, 6),
        notes,
      };
    }
    case "spicy":
      return { kind: "items" as const, title: "Our spiciest dishes", items: pack(rank(pool.filter((i) => i.spice_level >= 3)).sort((a, b) => b.spice_level - a.spice_level), (i) => `Spice ${i.spice_level}/5`, 8), notes };
    case "mild":
      return { kind: "items" as const, title: "Mild & gentle", items: pack(rank(pool.filter((i) => i.spice_level <= 1)), () => "Low on spice", 8), notes };
    case "healthy":
      return {
        kind: "items" as const,
        title: "Light & healthy",
        items: pack(rank(pool.filter((i) => i.tags.includes("healthy") || (i.calories ?? 999) < 300)), (i) => (i.calories ? `${i.calories} kcal` : "Light choice")),
        notes,
      };
    case "chef_special":
      return { kind: "items" as const, title: "Chef's specials", items: pack(rank(pool.filter((i) => i.tags.includes("chef_special"))), () => "Chef's special"), notes };
    case "popular": {
      const mine = [...history.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => menu.byId.get(id)).filter((i): i is MenuItemFull => !!i && pool.includes(i));
      const items = pack(rank(pool), (i) => (history.get(i.id) ? "One of your favourites" : i.tags.includes("bestseller") ? "Bestseller" : `${i.sold_30d} ordered this month`), 8);
      return { kind: "items" as const, title: "Most popular right now", items, your_favourites: mine.slice(0, 3).map(itemSummary), notes };
    }
    case "similar_to": {
      if (!input.item_id) throw new ServiceError("Which dish should I find similar ones to?", "missing_item");
      const base = await resolveItem(input.item_id);
      const sim = pool
        .filter((i) => i.id !== base.id)
        .map((i) => ({ i, d: (i.category_id === base.category_id ? 0 : 3) + Math.abs(i.spice_level - base.spice_level) + Math.abs(i.price_paise - base.price_paise) / 5000 + (i.is_veg === base.is_veg ? 0 : 2) }))
        .sort((a, b) => a.d - b.d)
        .map((x) => x.i);
      return { kind: "items" as const, title: `Similar to ${base.name}`, items: pack(sim, (i) => (i.category_id === base.category_id ? `Also a ${i.category_name.toLowerCase()} favourite` : "Similar flavour profile")), notes };
    }
    case "budget_meal":
    case "group_meal":
      return buildCombo(pool, rank, input, notes);
  }
}

async function buildCombo(
  pool: MenuItemFull[],
  rank: (items: MenuItemFull[]) => MenuItemFull[],
  input: RecommendationInput,
  notes: string[],
) {
  const party = Math.max(1, Math.min(input.party_size ?? 1, 12));
  const budget = input.budget_paise ?? null;
  const settings = await getSettings();
  const meal = input.preferences?.meal;
  const mainsAll = rank(pool.filter((i) => MAIN_CATS.includes(i.category_slug) && (meal !== "breakfast" || ["dosa", "idli-vada", "uttapam"].includes(i.category_slug))));
  const snacks = rank(pool.filter((i) => i.category_slug === "snacks"));
  const drinks = rank(pool.filter((i) => i.category_slug === "beverages"));
  const desserts = rank(pool.filter((i) => i.category_slug === "desserts"));
  const gst = 1 + settings.gst_percent / 100;
  const cost = (subtotal: number) => Math.round(subtotal * gst); // budget compares against food + GST

  const chosen: { item: MenuItemFull; qty: number }[] = [];
  let subtotal = 0;
  const fits = (extra: number) => budget == null || cost(subtotal + extra) <= budget;
  const add = (item: MenuItemFull, qty = 1) => {
    const ex = chosen.find((c) => c.item.id === item.id);
    if (ex) ex.qty += qty;
    else chosen.push({ item, qty });
    subtotal += item.price_paise * qty;
  };

  // Mains: one per person, most popular first, keeping enough budget for the remaining mains.
  const cheapestMain = Math.min(...mainsAll.map((m) => m.price_paise));
  if (!mainsAll.length) throw new ServiceError("No dishes match those preferences right now.", "no_match");
  if (budget != null && cost(cheapestMain * party) > budget) {
    throw new ServiceError(`Even our most affordable mains come to about ₹${Math.ceil(cost(cheapestMain * party) / 100)} for ${party}. Try a higher budget?`, "budget_too_low");
  }
  for (let slot = 0; slot < party; slot++) {
    const remaining = party - slot - 1;
    const distinct = mainsAll.filter((m) => !chosen.some((c) => c.item.id === m.id));
    const pick = (distinct.length ? distinct : mainsAll).find((m) => fits(m.price_paise + remaining * cheapestMain)) ?? mainsAll[mainsAll.length - 1];
    add(pick);
  }
  // Extras in priority order while the budget allows.
  const extras: [MenuItemFull[], number][] = [
    [snacks, Math.ceil(party / 2)],
    [drinks, party],
    [desserts, Math.ceil(party / 2)],
  ];
  for (const [list, n] of extras) {
    for (let k = 0; k < n; k++) {
      const pick = list.find((x) => fits(x.price_paise) && !chosen.some((c) => c.item.id === x.id)) ?? list.find((x) => fits(x.price_paise));
      if (!pick) break;
      add(pick);
    }
  }
  const totals = computeCartTotals(
    { lines: chosen.map((c) => ({ unitPricePaise: c.item.price_paise, qty: c.qty })), orderType: "dine_in" },
    pricingSettings(settings),
  );
  return {
    kind: "combo" as const,
    title: `${input.preferences?.veg ? "Veg " : ""}${meal ? meal[0].toUpperCase() + meal.slice(1) : "Meal"} for ${party}${budget ? ` under ₹${budget / 100}` : ""}`,
    party_size: party,
    budget_paise: budget,
    items: chosen.map((c) => ({ ...itemSummary(c.item), qty: c.qty, line_total_paise: c.item.price_paise * c.qty })),
    subtotal_paise: totals.subtotalPaise,
    tax_paise: totals.taxPaise,
    estimated_total_paise: totals.subtotalPaise + totals.taxPaise,
    notes: [...notes, "Estimate includes GST; delivery/packaging fees (if any) are added at checkout."],
  };
}
