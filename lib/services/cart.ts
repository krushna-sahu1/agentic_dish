/**
 * Cart service — the single implementation behind the cart page, server actions
 * and the customer agent's cart tools, so state is identical whichever is used.
 * Every function takes the verified userId; prices always come from the DB.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { computeCartTotals, type CartTotals, type OrderType } from "@/lib/pricing";
import { checkCouponEligibility, toPricingCoupon, type CouponRow } from "@/lib/coupons";
import type { Address, ItemAddon, ItemVariant, Profile } from "@/lib/types";
import { getMenu, isOrderable, profileConflicts, resolveItem, type MenuItemFull } from "./menu";
import { getSettings, pricingSettings } from "./settings";
import { ServiceError } from "./errors";
import { isWithinHours, type OpeningHours } from "@/lib/time";

export const MAX_QTY = 20;

interface CartRow {
  id: string;
  user_id: string;
  coupon_code: string | null;
  order_type: OrderType;
  table_number: number | null;
  address_id: string | null;
  scheduled_for: string | null;
  tip_paise: number;
  notes: string | null;
}

interface CartItemRow {
  id: string;
  cart_id: string;
  menu_item_id: string;
  variant_id: string | null;
  addon_ids: string[];
  qty: number;
  special_instructions: string | null;
  created_at: string;
}

export interface CartLineView {
  id: string;
  menu_item_id: string;
  name: string;
  slug: string;
  image_url: string | null;
  is_veg: boolean;
  spice_level: number;
  allergens: string[];
  qty: number;
  variant: Pick<ItemVariant, "id" | "name" | "price_delta_paise"> | null;
  addons: Pick<ItemAddon, "id" | "name" | "price_paise">[];
  special_instructions: string | null;
  unit_price_paise: number;
  unit_total_paise: number;
  line_total_paise: number;
  available: boolean;
  unavailable_reason: string | null;
  available_variants: Pick<ItemVariant, "id" | "name" | "price_delta_paise">[];
  available_addons: Pick<ItemAddon, "id" | "name" | "price_paise">[];
}

export interface CartView {
  cart_id: string;
  lines: CartLineView[];
  order_type: OrderType;
  table_number: number | null;
  address_id: string | null;
  address: Address | null;
  scheduled_for: string | null;
  tip_paise: number;
  notes: string | null;
  coupon_code: string | null;
  coupon_message: string | null;
  totals: CartTotals;
  item_count: number;
  warnings: string[];
}

const db = () => createAdminClient();

export async function getOrCreateCart(userId: string): Promise<CartRow> {
  const { data } = await db().from("carts").select("*").eq("user_id", userId).maybeSingle();
  if (data) return data as CartRow;
  const ins = await db()
    .from("carts")
    .upsert({ user_id: userId }, { onConflict: "user_id" })
    .select("*")
    .single();
  if (ins.error) throw new Error(ins.error.message);
  return ins.data as CartRow;
}

async function couponForCart(userId: string, code: string | null): Promise<{ coupon: CouponRow | null; message: string | null }> {
  if (!code) return { coupon: null, message: null };
  const { data: c } = await db().from("coupons").select("*").eq("code", code).maybeSingle();
  const usage = await couponUsage(userId, (c as CouponRow | null)?.id);
  const check = checkCouponEligibility((c as CouponRow) ?? null, usage);
  if (!check.ok) return { coupon: null, message: check.reason };
  return { coupon: c as CouponRow, message: null };
}

export async function couponUsage(userId: string, couponId?: string) {
  if (!couponId) return { totalRedemptions: 0, userRedemptions: 0 };
  const [total, mine] = await Promise.all([
    db().from("coupon_redemptions").select("id", { count: "exact", head: true }).eq("coupon_id", couponId),
    db().from("coupon_redemptions").select("id", { count: "exact", head: true }).eq("coupon_id", couponId).eq("user_id", userId),
  ]);
  return { totalRedemptions: total.count ?? 0, userRedemptions: mine.count ?? 0 };
}

export async function viewCart(userId: string): Promise<CartView> {
  const [cart, menu, settings] = await Promise.all([getOrCreateCart(userId), getMenu(), getSettings()]);
  const { data: rows } = await db().from("cart_items").select("*").eq("cart_id", cart.id).order("created_at");
  const warnings: string[] = [];

  const lines: CartLineView[] = [];
  for (const r of (rows ?? []) as CartItemRow[]) {
    const item = menu.byId.get(r.menu_item_id);
    if (!item) {
      warnings.push("An item in your cart is no longer on the menu and was removed.");
      await db().from("cart_items").delete().eq("id", r.id);
      continue;
    }
    const variant = item.variants.find((v) => v.id === r.variant_id) ?? null;
    const addons = item.addons.filter((a) => r.addon_ids.includes(a.id) && a.is_available);
    const o = isOrderable(item);
    const stockShort = item.stock_qty !== null && item.stock_qty < r.qty;
    if (!o.ok) warnings.push(`${item.name} is ${o.reason}.`);
    else if (stockShort) warnings.push(`Only ${item.stock_qty} × ${item.name} left.`);
    const unit = item.price_paise + (variant?.price_delta_paise ?? 0) + addons.reduce((a, x) => a + x.price_paise, 0);
    lines.push({
      id: r.id,
      menu_item_id: item.id,
      name: item.name,
      slug: item.slug,
      image_url: item.image_url,
      is_veg: item.is_veg,
      spice_level: item.spice_level,
      allergens: item.allergens,
      qty: r.qty,
      variant: variant ? { id: variant.id, name: variant.name, price_delta_paise: variant.price_delta_paise } : null,
      addons: addons.map((a) => ({ id: a.id, name: a.name, price_paise: a.price_paise })),
      special_instructions: r.special_instructions,
      unit_price_paise: item.price_paise,
      unit_total_paise: unit,
      line_total_paise: unit * r.qty,
      available: o.ok && !stockShort,
      unavailable_reason: o.reason ?? (stockShort ? `only ${item.stock_qty} left` : null),
      available_variants: item.variants.map((v) => ({ id: v.id, name: v.name, price_delta_paise: v.price_delta_paise })),
      available_addons: item.addons.filter((a) => a.is_available).map((a) => ({ id: a.id, name: a.name, price_paise: a.price_paise })),
    });
  }

  const { coupon, message } = await couponForCart(userId, cart.coupon_code);
  const priced = lines.filter((l) => l.available);
  const totals = computeCartTotals(
    {
      lines: priced.map((l) => ({
        unitPricePaise: l.unit_price_paise,
        variantDeltaPaise: l.variant?.price_delta_paise ?? 0,
        addonPricesPaise: l.addons.map((a) => a.price_paise),
        qty: l.qty,
      })),
      orderType: cart.order_type,
      tipPaise: cart.tip_paise,
    },
    pricingSettings(settings),
    coupon ? toPricingCoupon(coupon) : null,
  );

  let address: Address | null = null;
  if (cart.address_id) {
    const { data } = await db().from("addresses").select("*").eq("id", cart.address_id).eq("user_id", userId).maybeSingle();
    address = (data as Address) ?? null;
  }

  return {
    cart_id: cart.id,
    lines,
    order_type: cart.order_type,
    table_number: cart.table_number,
    address_id: cart.address_id,
    address,
    scheduled_for: cart.scheduled_for,
    tip_paise: cart.tip_paise,
    notes: cart.notes,
    coupon_code: cart.coupon_code,
    coupon_message: message ?? totals.couponMessage,
    totals,
    item_count: totals.itemCount,
    warnings,
  };
}

async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await db().from("profiles").select("*").eq("user_id", userId).maybeSingle();
  return (data as Profile) ?? null;
}

function validateOptions(item: MenuItemFull, variantId?: string | null, addonIds?: string[]) {
  if (variantId && !item.variants.some((v) => v.id === variantId)) {
    throw new ServiceError(`That size/variant isn't available for ${item.name}.`, "invalid_variant", {
      variants: item.variants.map((v) => ({ id: v.id, name: v.name, price_delta_paise: v.price_delta_paise })),
    });
  }
  for (const a of addonIds ?? []) {
    const addon = item.addons.find((x) => x.id === a);
    if (!addon) {
      throw new ServiceError(`That add-on isn't available for ${item.name}.`, "invalid_addon", {
        addons: item.addons.map((x) => ({ id: x.id, name: x.name, price_paise: x.price_paise })),
      });
    }
    if (!addon.is_available) throw new ServiceError(`${addon.name} is unavailable right now.`, "addon_unavailable");
  }
}

/** Resolve add-on names ("extra chutney") → ids for an item. */
export function resolveAddonIds(item: MenuItemFull, refs: string[] = []): string[] {
  return refs.map((ref) => {
    const byId = item.addons.find((a) => a.id === ref);
    if (byId) return byId.id;
    const r = ref.toLowerCase().replace(/^extra\s+/, "");
    const byName = item.addons.find((a) => a.name.toLowerCase() === ref.toLowerCase() || a.name.toLowerCase().replace(/^extra\s+/, "") === r);
    if (!byName) {
      throw new ServiceError(`"${ref}" isn't an add-on for ${item.name}.`, "invalid_addon", {
        addons: item.addons.map((x) => ({ id: x.id, name: x.name, price_paise: x.price_paise })),
      });
    }
    return byName.id;
  });
}

export function resolveVariantId(item: MenuItemFull, ref?: string | null): string | null {
  if (!ref) return null;
  const v = item.variants.find((x) => x.id === ref || x.name.toLowerCase() === ref.toLowerCase() || x.name.toLowerCase().startsWith(ref.toLowerCase()));
  if (!v) {
    throw new ServiceError(`"${ref}" isn't a size option for ${item.name}.`, "invalid_variant", {
      variants: item.variants.map((x) => ({ id: x.id, name: x.name, price_delta_paise: x.price_delta_paise })),
    });
  }
  return v.id;
}

export type AddToCartResult =
  | { status: "added"; line_id: string; item: { id: string; name: string }; qty: number; cart: CartView }
  | {
      status: "needs_confirmation";
      kind: "allergen" | "diet";
      item: { id: string; name: string; allergens: string[] };
      conflicts: string[];
      message: string;
      pending: AddToCartInput;
    };

export interface AddToCartInput {
  item_id: string;
  qty: number;
  variant_id?: string | null;
  addon_ids?: string[];
  instructions?: string | null;
  /** Set only after the user explicitly clicked "Add anyway" on the warning card. */
  acknowledge_conflicts?: boolean;
}

export async function addToCart(userId: string, input: AddToCartInput): Promise<AddToCartResult> {
  const qty = Math.trunc(input.qty);
  if (qty < 1 || qty > MAX_QTY) throw new ServiceError(`Quantity must be between 1 and ${MAX_QTY}.`, "invalid_qty");
  const item = await resolveItem(input.item_id);
  const o = isOrderable(item);
  if (!o.ok) throw new ServiceError(`Sorry, ${item.name} is ${o.reason} right now.`, "unavailable");
  const variantId = resolveVariantId(item, input.variant_id);
  const addonIds = resolveAddonIds(item, input.addon_ids);
  validateOptions(item, variantId, addonIds);

  if (!input.acknowledge_conflicts) {
    const conflicts = profileConflicts(item, await getProfile(userId));
    if (conflicts.allergens.length || conflicts.diet.length) {
      const kind = conflicts.allergens.length ? "allergen" : "diet";
      return {
        status: "needs_confirmation",
        kind,
        item: { id: item.id, name: item.name, allergens: item.allergens },
        conflicts: [...conflicts.allergens, ...conflicts.diet],
        message: conflicts.allergens.length
          ? `${item.name} contains ${conflicts.allergens.join(", ")}, which is in your allergy list.`
          : `${item.name} is ${conflicts.diet.join(", ")}, which doesn't match your dietary preferences.`,
        pending: { ...input, item_id: item.id, variant_id: variantId, addon_ids: addonIds },
      };
    }
  }

  const cart = await getOrCreateCart(userId);
  const { data: existing } = await db().from("cart_items").select("*").eq("cart_id", cart.id).eq("menu_item_id", item.id);
  const instructions = input.instructions?.trim() || null;
  const same = ((existing ?? []) as CartItemRow[]).find(
    (r) =>
      (r.variant_id ?? null) === variantId &&
      [...r.addon_ids].sort().join(",") === [...addonIds].sort().join(",") &&
      (r.special_instructions ?? null) === instructions,
  );
  const alreadyInCart = ((existing ?? []) as CartItemRow[]).reduce((a, r) => a + r.qty, 0);
  if (item.stock_qty !== null && alreadyInCart + qty > item.stock_qty) {
    throw new ServiceError(`Only ${item.stock_qty} × ${item.name} left today.`, "insufficient_stock");
  }

  let lineId: string;
  let newQty = qty;
  if (same) {
    newQty = same.qty + qty;
    if (newQty > MAX_QTY) throw new ServiceError(`You can have at most ${MAX_QTY} of one item per line.`, "invalid_qty");
    const r = await db().from("cart_items").update({ qty: newQty }).eq("id", same.id);
    if (r.error) throw new Error(r.error.message);
    lineId = same.id;
  } else {
    const r = await db()
      .from("cart_items")
      .insert({
        cart_id: cart.id,
        menu_item_id: item.id,
        variant_id: variantId,
        addon_ids: addonIds,
        qty,
        special_instructions: instructions,
      })
      .select("id")
      .single();
    if (r.error) throw new Error(r.error.message);
    lineId = r.data.id;
  }
  return { status: "added", line_id: lineId, item: { id: item.id, name: item.name }, qty: newQty, cart: await viewCart(userId) };
}

async function ownLine(userId: string, cartItemId: string): Promise<CartItemRow> {
  const cart = await getOrCreateCart(userId);
  const { data } = await db().from("cart_items").select("*").eq("id", cartItemId).eq("cart_id", cart.id).maybeSingle();
  if (!data) throw new ServiceError("That item isn't in your cart.", "not_found");
  return data as CartItemRow;
}

export interface UpdateCartItemInput {
  cart_item_id: string;
  qty?: number;
  variant_id?: string | null;
  addon_ids?: string[];
  instructions?: string | null;
}

export async function updateCartItem(userId: string, input: UpdateCartItemInput): Promise<CartView> {
  const line = await ownLine(userId, input.cart_item_id);
  if (input.qty === 0) {
    await db().from("cart_items").delete().eq("id", line.id);
    return viewCart(userId);
  }
  const menu = await getMenu();
  const item = menu.byId.get(line.menu_item_id);
  if (!item) throw new ServiceError("That dish is no longer on the menu.", "not_found");
  const patch: Partial<CartItemRow> = {};
  if (input.qty !== undefined) {
    const q = Math.trunc(input.qty);
    if (q < 0 || q > MAX_QTY) throw new ServiceError(`Quantity must be between 0 and ${MAX_QTY}.`, "invalid_qty");
    if (item.stock_qty !== null && q > item.stock_qty) throw new ServiceError(`Only ${item.stock_qty} × ${item.name} left.`, "insufficient_stock");
    patch.qty = q;
  }
  if (input.variant_id !== undefined) patch.variant_id = resolveVariantId(item, input.variant_id);
  if (input.addon_ids !== undefined) patch.addon_ids = resolveAddonIds(item, input.addon_ids);
  if (input.instructions !== undefined) patch.special_instructions = input.instructions?.trim().slice(0, 300) || null;
  validateOptions(item, patch.variant_id ?? line.variant_id, patch.addon_ids ?? line.addon_ids);
  const r = await db().from("cart_items").update(patch).eq("id", line.id);
  if (r.error) throw new Error(r.error.message);
  return viewCart(userId);
}

export async function removeFromCart(userId: string, cartItemId: string): Promise<CartView> {
  const line = await ownLine(userId, cartItemId);
  await db().from("cart_items").delete().eq("id", line.id);
  return viewCart(userId);
}

export async function clearCart(userId: string): Promise<CartView> {
  const cart = await getOrCreateCart(userId);
  await db().from("cart_items").delete().eq("cart_id", cart.id);
  await db().from("carts").update({ coupon_code: null, tip_paise: 0, notes: null }).eq("id", cart.id);
  return viewCart(userId);
}

export interface OrderOptionsInput {
  order_type?: OrderType;
  table_number?: number | null;
  address_id?: string | null;
  scheduled_for?: string | null;
  notes?: string | null;
  tip_paise?: number;
}

export async function setOrderOptions(userId: string, input: OrderOptionsInput): Promise<CartView> {
  const cart = await getOrCreateCart(userId);
  const patch: Partial<CartRow> = {};
  if (input.order_type) patch.order_type = input.order_type;
  if (input.table_number !== undefined) {
    if (input.table_number !== null) {
      const { data: t } = await db().from("tables").select("number").eq("number", input.table_number).eq("is_active", true).maybeSingle();
      if (!t) throw new ServiceError(`Table ${input.table_number} doesn't exist.`, "invalid_table");
    }
    patch.table_number = input.table_number;
  }
  if (input.address_id !== undefined) {
    if (input.address_id) {
      const { data: a } = await db().from("addresses").select("id").eq("id", input.address_id).eq("user_id", userId).maybeSingle();
      if (!a) throw new ServiceError("That address isn't in your address book.", "invalid_address");
    }
    patch.address_id = input.address_id;
  }
  if (input.scheduled_for !== undefined) {
    if (input.scheduled_for) {
      const when = new Date(input.scheduled_for);
      if (Number.isNaN(when.getTime())) throw new ServiceError("I couldn't understand that time.", "invalid_time");
      if (when.getTime() < Date.now() + 15 * 60_000) throw new ServiceError("Scheduled orders must be at least 15 minutes from now.", "invalid_time");
      if (when.getTime() > Date.now() + 7 * 86_400_000) throw new ServiceError("You can schedule up to 7 days ahead.", "invalid_time");
      const s = await getSettings();
      if (!isWithinHours(s.opening_hours as OpeningHours, when, s.timezone))
        throw new ServiceError("We're closed at that time — please pick a time within opening hours.", "closed");
      patch.scheduled_for = when.toISOString();
    } else patch.scheduled_for = null;
  }
  if (input.notes !== undefined) patch.notes = input.notes?.slice(0, 500) || null;
  if (input.tip_paise !== undefined) {
    if (input.tip_paise < 0 || input.tip_paise > 100000) throw new ServiceError("Tip must be between ₹0 and ₹1,000.", "invalid_tip");
    patch.tip_paise = Math.round(input.tip_paise);
  }
  if (patch.order_type && patch.order_type !== "dine_in" && input.table_number === undefined) patch.table_number = null;
  if (patch.order_type === "delivery" && !cart.address_id && input.address_id === undefined) {
    const { data: def } = await db().from("addresses").select("id").eq("user_id", userId).order("is_default", { ascending: false }).limit(1);
    if (def?.[0]) patch.address_id = def[0].id;
  }
  const r = await db().from("carts").update(patch).eq("id", cart.id);
  if (r.error) throw new Error(r.error.message);
  return viewCart(userId);
}

export async function applyCoupon(userId: string, code: string): Promise<CartView> {
  const c = code.trim().toUpperCase();
  const { data: coupon } = await db().from("coupons").select("*").eq("code", c).maybeSingle();
  const usage = await couponUsage(userId, (coupon as CouponRow | null)?.id);
  const check = checkCouponEligibility((coupon as CouponRow) ?? null, usage);
  if (!check.ok) throw new ServiceError(check.reason, "coupon_invalid");
  const cart = await viewCart(userId);
  if (cart.totals.subtotalPaise < (coupon as CouponRow).min_order_paise) {
    throw new ServiceError(
      `${c} needs a minimum order of ₹${(coupon as CouponRow).min_order_paise / 100}. Your subtotal is ₹${cart.totals.subtotalPaise / 100}.`,
      "coupon_min_order",
    );
  }
  await db().from("carts").update({ coupon_code: c }).eq("id", cart.cart_id);
  return viewCart(userId);
}

export async function removeCoupon(userId: string): Promise<CartView> {
  const cart = await getOrCreateCart(userId);
  await db().from("carts").update({ coupon_code: null }).eq("id", cart.id);
  return viewCart(userId);
}

export async function listAvailableCoupons(userId: string) {
  const now = new Date().toISOString();
  const { data } = await db()
    .from("coupons")
    .select("*")
    .eq("is_active", true)
    .or(`valid_to.is.null,valid_to.gt.${now}`)
    .order("min_order_paise");
  const out = [];
  for (const c of (data ?? []) as CouponRow[]) {
    const usage = await couponUsage(userId, c.id);
    const check = checkCouponEligibility(c, usage);
    if (check.ok) out.push({ code: c.code, description: c.description, type: c.type, value: c.value, min_order_paise: c.min_order_paise, max_discount_paise: c.max_discount_paise, valid_to: c.valid_to });
  }
  return out;
}

/** Bulk add (combo "Add all", reorder). Skips unavailable items and reports them. */
export async function addManyToCart(
  userId: string,
  lines: { item_id: string; qty: number; variant_id?: string | null; addon_ids?: string[]; instructions?: string | null }[],
  opts: { acknowledgeConflicts?: boolean } = {},
) {
  const added: { name: string; qty: number }[] = [];
  const skipped: { name: string; reason: string }[] = [];
  for (const l of lines.slice(0, 30)) {
    try {
      const r = await addToCart(userId, { ...l, acknowledge_conflicts: opts.acknowledgeConflicts });
      if (r.status === "added") added.push({ name: r.item.name, qty: l.qty });
      else skipped.push({ name: r.item.name, reason: r.message });
    } catch (e) {
      skipped.push({ name: l.item_id, reason: (e as Error).message });
    }
  }
  return { added, skipped, cart: await viewCart(userId) };
}
