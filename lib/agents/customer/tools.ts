/**
 * Customer agent tools. Server-side only; each is Zod-validated, role-checked
 * and audited by guard.runTool. Results feed the generative-UI cards (§8).
 *
 * PAYMENT SAFETY: there is no payment tool. `prepare_checkout` only creates an
 * order awaiting payment; the human pays via the Pay button in the CheckoutCard.
 */
import { z } from "zod";
import { tool, type ToolDef } from "../tool-def";
import { ALLERGENS, DIETARY_PREFS, ITEM_TAGS } from "@/lib/types";
import { getItemDetails, getPairings, itemSummary, resolveItem, searchMenu } from "@/lib/services/menu";
import {
  addToCart,
  applyCoupon,
  listAvailableCoupons,
  removeCoupon,
  removeFromCart,
  setOrderOptions,
  updateCartItem,
  viewCart,
} from "@/lib/services/cart";
import { getOrderForUser, listMyOrders, prepareCheckout, reorder } from "@/lib/services/orders";
import {
  addAddress,
  checkReservationAvailability,
  getProfile,
  listAddresses,
  listFavorites,
  listMyReservations,
  submitReview,
  toggleFavorite,
  updatePreferences,
} from "@/lib/services/account";
import { getRecommendations, INTENTS } from "@/lib/services/recommendations";
import { getRestaurantInfo } from "@/lib/services/settings";
import { ServiceError } from "@/lib/services/errors";
import type { AgentContext } from "../guard";
import { wrapUntrustedFields } from "../guard";

const uid = (ctx: AgentContext) => {
  if (!ctx.userId) throw new ServiceError("Please log in so I can do that for you.", "login_required");
  return ctx.userId;
};

const qty = z.number().int().min(1).max(20);
const filtersSchema = z
  .object({
    veg: z.boolean().optional(),
    vegan: z.boolean().optional(),
    jain: z.boolean().optional(),
    max_spice: z.number().int().min(0).max(5).optional(),
    min_spice: z.number().int().min(0).max(5).optional(),
    exclude_allergens: z.array(z.enum(ALLERGENS)).optional(),
    max_price_paise: z.number().int().min(0).optional().describe("Max price in paise (₹1 = 100 paise)"),
    tags: z.array(z.enum(ITEM_TAGS)).optional(),
  })
  .optional();

function compactCart(cart: Awaited<ReturnType<typeof viewCart>>) {
  return wrapUntrustedFields({
    lines: cart.lines.map((l) => ({
      cart_item_id: l.id,
      item_id: l.menu_item_id,
      name: l.name,
      qty: l.qty,
      variant: l.variant?.name ?? null,
      addons: l.addons.map((a) => a.name),
      special_instructions: l.special_instructions,
      line_total_paise: l.line_total_paise,
      available: l.available,
      options: { variants: l.available_variants, addons: l.available_addons },
    })),
    order_type: cart.order_type,
    table_number: cart.table_number,
    address: cart.address ? `${cart.address.label}: ${cart.address.line1}, ${cart.address.city} ${cart.address.pincode}` : null,
    scheduled_for: cart.scheduled_for,
    coupon_code: cart.coupon_code,
    coupon_message: cart.coupon_message,
    totals: cart.totals,
    item_count: cart.item_count,
    warnings: cart.warnings,
  });
}

export const customerTools: ToolDef[] = [
  tool({
    name: "search_menu",
    description:
      "Search the menu by text and/or filters. ALWAYS use this (or get_item_details) for any menu fact. Returns dishes with id, price (paise), spice 0-5, allergens, availability.",
    schema: z.object({
      query: z.string().max(100).optional().describe('Free text, e.g. "dosa", "paneer", "spicy chicken"'),
      category: z.string().max(40).optional(),
      filters: filtersSchema,
    }),
    async handler(_ctx, a) {
      const items = await searchMenu({ query: a.query, category: a.category, filters: a.filters, limit: 12 });
      return { count: items.length, items: items.map(itemSummary) };
    },
  }),
  tool({
    name: "get_item_details",
    description: "Full details for one dish: variants, add-ons (with ids), allergens, calories, prep time, pairings, rating, recent reviews.",
    schema: z.object({ item_id: z.string().min(1).describe("Dish id, slug or exact name") }),
    async handler(_ctx, a) {
      const d = await getItemDetails(a.item_id);
      return wrapUntrustedFields({
        ...itemSummary(d.item),
        calories: d.item.calories,
        prep_time_min: d.item.prep_time_min,
        portion: d.item.portion,
        variants: d.item.variants.map((v) => ({ id: v.id, name: v.name, price_delta_paise: v.price_delta_paise })),
        addons: d.item.addons.filter((x) => x.is_available).map((x) => ({ id: x.id, name: x.name, price_paise: x.price_paise })),
        pairings: d.pairings.map((p) => ({ id: p.item.id, name: p.item.name, reason: p.reason })),
        reviews: d.reviews.map((r) => ({ rating: r.rating, comment: r.comment })),
      });
    },
  }),
  tool({
    name: "get_recommendations",
    description:
      "Recommend dishes. intent: pairing (with item_id, or without for 'what goes with spicy food'), spicy, mild, budget_meal, group_meal (use party_size + budget_paise, e.g. 'veg dinner for 4 under ₹1000' → group_meal, party_size 4, budget_paise 100000, preferences.veg true), healthy, popular, similar_to (item_id), chef_special. Respects the user's allergies/diet automatically.",
    schema: z.object({
      intent: z.enum(INTENTS),
      item_id: z.string().optional(),
      budget_paise: z.number().int().min(1000).max(5_000_000).optional(),
      party_size: z.number().int().min(1).max(12).optional(),
      preferences: z
        .object({
          veg: z.boolean().optional(),
          vegan: z.boolean().optional(),
          jain: z.boolean().optional(),
          exclude_allergens: z.array(z.enum(ALLERGENS)).optional(),
          max_spice: z.number().int().min(0).max(5).optional(),
          meal: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
        })
        .optional(),
    }),
    async handler(ctx, a) {
      const profile = ctx.userId ? await getProfile(ctx.userId) : null;
      return getRecommendations(a, { userId: ctx.userId, profile });
    },
  }),
  tool({
    name: "get_pairings",
    description: "What goes well with a specific dish (curated pairings with reasons).",
    schema: z.object({ item_id: z.string().min(1) }),
    async handler(_ctx, a) {
      const item = await resolveItem(a.item_id);
      const p = await getPairings(item.id);
      return { item: item.name, pairings: p.map((x) => ({ ...itemSummary(x.item), reason: x.reason })) };
    },
  }),
  tool({
    name: "add_to_cart",
    description:
      "Add a dish to the cart. Use ids from search results when possible. addon_ids accepts add-on ids or names (e.g. 'Extra Chutney'); variant_id accepts id or name (e.g. 'Half'). If the dish conflicts with the user's allergies/diet the result is status 'needs_confirmation' — the UI shows a warning card with Add anyway / Cancel buttons; do NOT retry, just tell the user.",
    schema: z.object({
      item_id: z.string().min(1).describe("Dish id, slug or exact name"),
      qty: qty.default(1),
      variant_id: z.string().optional(),
      addon_ids: z.array(z.string()).max(10).optional(),
      instructions: z.string().max(300).optional().describe('e.g. "less spicy"'),
    }),
    async handler(ctx, a) {
      const r = await addToCart(uid(ctx), { ...a, acknowledge_conflicts: false });
      if (r.status === "needs_confirmation") return r;
      return { status: "added", item: r.item.name, qty_in_line: r.qty, cart: compactCart(r.cart) };
    },
  }),
  tool({
    name: "update_cart_item",
    description: "Change a cart line: qty (0 removes), variant, add-ons (ids or names — replaces the list), special instructions. Get cart_item_id from view_cart.",
    schema: z.object({
      cart_item_id: z.string().min(1),
      qty: z.number().int().min(0).max(20).optional(),
      variant_id: z.string().nullable().optional(),
      addon_ids: z.array(z.string()).max(10).optional(),
      instructions: z.string().max(300).nullable().optional(),
    }),
    async handler(ctx, a) {
      return { status: "updated", cart: compactCart(await updateCartItem(uid(ctx), a)) };
    },
  }),
  tool({
    name: "remove_from_cart",
    description: "Remove one line from the cart.",
    schema: z.object({ cart_item_id: z.string().min(1) }),
    async handler(ctx, a) {
      return { status: "removed", cart: compactCart(await removeFromCart(uid(ctx), a.cart_item_id)) };
    },
  }),
  tool({
    name: "view_cart",
    description: "Current cart with server-computed totals (paise). Use before editing lines to get cart_item_id.",
    schema: z.object({}),
    async handler(ctx) {
      return compactCart(await viewCart(uid(ctx)));
    },
  }),
  tool({
    name: "set_order_options",
    description: "Set order type (delivery/pickup/dine_in), table number, delivery address id, scheduled time (ISO, IST), notes, tip in paise.",
    schema: z.object({
      order_type: z.enum(["delivery", "pickup", "dine_in"]).optional(),
      table_number: z.number().int().positive().nullable().optional(),
      address_id: z.string().nullable().optional(),
      scheduled_for: z.string().nullable().optional().describe("ISO 8601 datetime with +05:30 offset, or null for ASAP"),
      notes: z.string().max(500).nullable().optional(),
      tip_paise: z.number().int().min(0).max(100000).optional(),
    }),
    async handler(ctx, a) {
      return { status: "updated", cart: compactCart(await setOrderOptions(uid(ctx), a)) };
    },
  }),
  tool({
    name: "list_addresses",
    description: "The user's saved delivery addresses.",
    schema: z.object({}),
    async handler(ctx) {
      return { addresses: await listAddresses(uid(ctx)) };
    },
  }),
  tool({
    name: "add_address",
    description: "Save a new delivery address.",
    schema: z.object({
      label: z.string().max(40).optional(),
      line1: z.string().min(3).max(200),
      line2: z.string().max(200).optional(),
      city: z.string().min(2).max(80),
      pincode: z.string().regex(/^[0-9]{6}$/),
      is_default: z.boolean().optional(),
    }),
    async handler(ctx, a) {
      return { address: await addAddress(uid(ctx), a) };
    },
  }),
  tool({
    name: "apply_coupon",
    description: "Apply a coupon code to the cart (validated server-side).",
    schema: z.object({ code: z.string().min(2).max(20) }),
    async handler(ctx, a) {
      return { status: "applied", cart: compactCart(await applyCoupon(uid(ctx), a.code)) };
    },
  }),
  tool({
    name: "remove_coupon",
    description: "Remove the coupon from the cart.",
    schema: z.object({}),
    async handler(ctx) {
      return { status: "removed", cart: compactCart(await removeCoupon(uid(ctx))) };
    },
  }),
  tool({
    name: "list_available_coupons",
    description: "Coupons this user can use right now.",
    schema: z.object({}),
    async handler(ctx) {
      return { coupons: await listAvailableCoupons(uid(ctx)) };
    },
  }),
  tool({
    name: "prepare_checkout",
    description:
      "When the user wants to checkout/pay: validates the cart (availability, minimum order, opening hours, delivery area), creates the order awaiting payment and returns data for the Checkout card with a Pay button. This does NOT charge — only the user can pay by clicking Pay. Never say the order is paid.",
    schema: z.object({}),
    async handler(ctx) {
      return prepareCheckout(uid(ctx), ctx.email);
    },
  }),
  tool({
    name: "get_order_status",
    description: "Status timeline + ETA for an order (defaults to the latest active order).",
    schema: z.object({ order_id: z.string().max(60).optional().describe("Order id or number") }),
    async handler(ctx, a) {
      const d = await getOrderForUser(uid(ctx), a.order_id);
      return wrapUntrustedFields({
        order_id: d.order.id,
        order_number: d.order.order_number,
        status: d.order.status,
        order_type: d.order.order_type,
        total_paise: d.order.total_paise,
        eta_minutes: d.eta_minutes,
        estimated_ready_at: d.order.estimated_ready_at,
        created_at: d.order.created_at,
        items: d.items.map((i) => ({ name: i.name_snapshot, qty: i.qty })),
        timeline: d.events.map((e) => ({ status: e.status, at: e.created_at, note: e.note })),
        can_cancel: d.can_cancel,
        can_review: d.can_review,
      });
    },
  }),
  tool({
    name: "list_my_orders",
    description: "The user's recent orders.",
    schema: z.object({ limit: z.number().int().min(1).max(20).optional() }),
    async handler(ctx, a) {
      const orders = await listMyOrders(uid(ctx), a.limit ?? 5);
      return { orders: orders.map((o) => ({ ...o, items: o.order_items.map((i) => `${i.qty}× ${i.name_snapshot}`), order_items: undefined })) };
    },
  }),
  tool({
    name: "reorder",
    description: 'Add a previous order\'s items to the cart. order_id may be an order id/number or "usual" (their most frequently ordered combo).',
    schema: z.object({ order_id: z.string().min(1).max(60) }),
    async handler(ctx, a) {
      const r = await reorder(uid(ctx), a.order_id === "usual" ? "usual" : a.order_id);
      return { ...r, cart: compactCart(r.cart) };
    },
  }),
  tool({
    name: "toggle_favorite",
    description: "Add/remove a dish from favourites.",
    schema: z.object({ item_id: z.string().min(1) }),
    async handler(ctx, a) {
      const item = await resolveItem(a.item_id);
      return toggleFavorite(uid(ctx), item.id);
    },
  }),
  tool({
    name: "list_favorites",
    description: "The user's favourite dishes.",
    schema: z.object({}),
    async handler(ctx) {
      return { items: await listFavorites(uid(ctx)) };
    },
  }),
  tool({
    name: "check_reservation_availability",
    description: "Check whether a table is free for a party at a time (ISO with +05:30). Call before create_reservation; suggests alternatives if not.",
    schema: z.object({ party_size: z.number().int().min(1).max(20), datetime: z.string().min(10) }),
    async handler(_ctx, a) {
      return checkReservationAvailability(a.party_size, a.datetime);
    },
  }),
  tool({
    name: "list_my_reservations",
    description: "The user's reservations.",
    schema: z.object({}),
    async handler(ctx) {
      return wrapUntrustedFields({ reservations: await listMyReservations(uid(ctx)) });
    },
  }),
  tool({
    name: "submit_review",
    description: "Leave a 1–5 star review for a completed order (optionally for one dish in it).",
    schema: z.object({ order_id: z.string().min(1).max(60), rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional(), item_id: z.string().optional() }),
    async handler(ctx, a) {
      await submitReview(uid(ctx), a);
      return { status: "thanks" };
    },
  }),
  tool({
    name: "update_preferences",
    description: "Update dietary preferences (veg, vegan, jain, gluten_free, no_onion_garlic), spice tolerance 0–5, and allergies (dairy, gluten, nuts, peanut, soy, sesame, egg, shellfish).",
    schema: z.object({
      dietary_prefs: z.array(z.enum(DIETARY_PREFS)).optional(),
      spice_tolerance: z.number().int().min(0).max(5).optional(),
      allergies: z.array(z.string().max(20)).max(8).optional(),
    }),
    async handler(ctx, a) {
      const p = await updatePreferences(uid(ctx), a);
      return { dietary_prefs: p.dietary_prefs, spice_tolerance: p.spice_tolerance, allergies: p.allergies };
    },
  }),
  tool({
    name: "get_restaurant_info",
    description: "Opening hours, open now?, address, phone, delivery fee/radius, minimum order.",
    schema: z.object({}),
    async handler() {
      return getRestaurantInfo();
    },
  }),
];
