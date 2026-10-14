/**
 * Customer order flows: checkout preparation, tracking, cancellation, reorder.
 *
 * PAYMENT SAFETY: prepareCheckout only creates an `awaiting_payment` order and a
 * Razorpay order. It never charges. The order becomes `paid` exclusively via the
 * verified webhook (lib/payments/webhook.ts → mark_order_paid RPC).
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { createRazorpayOrder, razorpayConfigured } from "@/lib/razorpay";
import { isDeliverable } from "@/lib/geo";
import { formatINR } from "@/lib/format";
import { isWithinHours, type OpeningHours } from "@/lib/time";
import type { Order, OrderItem, OrderStatus, OrderStatusEvent } from "@/lib/types";
import { addManyToCart, viewCart, type CartView } from "./cart";
import { getSettings, openStatus } from "./settings";
import { ServiceError } from "./errors";

const db = () => createAdminClient();

export const ACTIVE_STATUSES: OrderStatus[] = ["awaiting_payment", "paid", "accepted", "preparing", "ready", "out_for_delivery"];
export const REVENUE_STATUSES: OrderStatus[] = ["paid", "accepted", "preparing", "ready", "out_for_delivery", "completed"];

export interface CheckoutValidation {
  ok: boolean;
  errors: string[];
  cart: CartView;
}

/** Everything that must be true before an order can be created. */
export async function validateCheckout(userId: string): Promise<CheckoutValidation> {
  const [cart, s] = await Promise.all([viewCart(userId), getSettings()]);
  const errors: string[] = [];
  if (cart.lines.length === 0) errors.push("Your cart is empty.");
  for (const l of cart.lines) if (!l.available) errors.push(`${l.name} is ${l.unavailable_reason}. Please remove it.`);
  if (!s.accepting_orders) errors.push("We're not accepting online orders right now.");
  const status = openStatus(s);
  if (s.is_open_override === "force_closed") {
    errors.push("The restaurant is closed today. Please check back tomorrow.");
  } else if (cart.scheduled_for) {
    if (!isWithinHours(s.opening_hours as OpeningHours, new Date(cart.scheduled_for), s.timezone))
      errors.push("Your scheduled time is outside opening hours.");
  } else if (!status.isOpen) {
    errors.push(`We're closed right now${status.nextOpen ? ` — we open ${status.nextOpen}` : ""}. You can schedule the order for later.`);
  }
  const net = cart.totals.subtotalPaise - cart.totals.discountPaise;
  if (cart.lines.length && net < s.min_order_paise) errors.push(`Minimum order is ${formatINR(s.min_order_paise)}.`);
  if (cart.order_type === "delivery") {
    if (!cart.address) errors.push("Please choose a delivery address.");
    else {
      const d = isDeliverable(cart.address, s);
      if (!d.ok) errors.push(d.reason!);
    }
  }
  if (cart.order_type === "dine_in" && !cart.table_number) errors.push("Please tell us your table number for dine-in.");
  if (cart.coupon_code && cart.coupon_message) errors.push(cart.coupon_message);
  return { ok: errors.length === 0, errors, cart };
}

export interface CheckoutData {
  order_id: string;
  order_number: string;
  razorpay_order_id: string;
  razorpay_key_id: string;
  amount_paise: number;
  currency: "INR";
  breakdown: {
    subtotal_paise: number;
    discount_paise: number;
    packaging_fee_paise: number;
    delivery_fee_paise: number;
    tax_paise: number;
    tip_paise: number;
    total_paise: number;
    coupon_code: string | null;
  };
  lines: { name: string; qty: number; line_total_paise: number; details: string | null }[];
  order_type: string;
  prefill: { name: string | null; email: string | null; contact: string | null };
  expires_at: string;
}

/**
 * Validates the cart, recomputes every price server-side, creates the order in
 * `awaiting_payment` and a matching Razorpay order. Returns data for the Pay
 * button. DOES NOT CHARGE.
 */
export async function prepareCheckout(userId: string, email: string | null): Promise<CheckoutData> {
  const v = await validateCheckout(userId);
  if (!v.ok) throw new ServiceError(v.errors.join(" "), "checkout_invalid", { errors: v.errors });
  if (!razorpayConfigured()) throw new ServiceError("Online payments aren't configured yet. Please contact the restaurant.", "payments_unconfigured");
  const cart = v.cart;
  const s = await getSettings();
  const { data: profile } = await db().from("profiles").select("full_name, phone").eq("user_id", userId).single();

  // Supersede any earlier unpaid checkout for this user so only one Pay button is live.
  const { data: stale } = await db().from("orders").select("id").eq("user_id", userId).eq("status", "awaiting_payment");
  for (const o of stale ?? []) {
    await db().rpc("set_order_status", { p_order_id: o.id, p_status: "cancelled", p_actor: userId, p_note: "Replaced by a newer checkout", p_cancel_reason: "superseded" });
  }

  const { data: orderNumber, error: numErr } = await db().rpc("next_order_number");
  if (numErr) throw new Error(numErr.message);
  const t = cart.totals;
  const { data: order, error } = await db()
    .from("orders")
    .insert({
      order_number: orderNumber,
      user_id: userId,
      status: "awaiting_payment",
      order_type: cart.order_type,
      address_snapshot: cart.order_type === "delivery" && cart.address ? cart.address : null,
      table_number: cart.order_type === "dine_in" ? cart.table_number : null,
      scheduled_for: cart.scheduled_for,
      subtotal_paise: t.subtotalPaise,
      discount_paise: t.discountPaise,
      tax_paise: t.taxPaise,
      delivery_fee_paise: t.deliveryFeePaise,
      packaging_fee_paise: t.packagingFeePaise,
      tip_paise: t.tipPaise,
      total_paise: t.totalPaise,
      coupon_code: t.couponCode,
      notes: cart.notes,
      estimated_ready_at: new Date(Date.now() + s.avg_prep_minutes * 60_000).toISOString(),
    })
    .select("*")
    .single();
  if (error || !order) throw new Error(error?.message ?? "order insert failed");

  const items = cart.lines.map((l) => ({
    order_id: order.id,
    menu_item_id: l.menu_item_id,
    name_snapshot: l.name,
    unit_price_paise: l.unit_total_paise,
    variant_snapshot: l.variant,
    addons_snapshot: l.addons,
    qty: l.qty,
    line_total_paise: l.line_total_paise,
    special_instructions: l.special_instructions,
  }));
  const ins = await db().from("order_items").insert(items);
  if (ins.error) throw new Error(ins.error.message);

  let rzp;
  try {
    rzp = await createRazorpayOrder({ amountPaise: t.totalPaise, receipt: order.order_number, notes: { order_id: order.id, order_number: order.order_number } });
  } catch (e) {
    await db().rpc("set_order_status", { p_order_id: order.id, p_status: "cancelled", p_actor: null, p_note: "Payment gateway error", p_cancel_reason: "gateway_error" });
    throw new ServiceError("Our payment gateway is having trouble. Please try again in a minute.", "gateway_error", { detail: (e as Error).message });
  }
  await db().from("orders").update({ razorpay_order_id: rzp.id }).eq("id", order.id);

  return {
    order_id: order.id,
    order_number: order.order_number,
    razorpay_order_id: rzp.id,
    razorpay_key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? process.env.RAZORPAY_KEY_ID ?? "",
    amount_paise: t.totalPaise,
    currency: "INR",
    breakdown: {
      subtotal_paise: t.subtotalPaise,
      discount_paise: t.discountPaise,
      packaging_fee_paise: t.packagingFeePaise,
      delivery_fee_paise: t.deliveryFeePaise,
      tax_paise: t.taxPaise,
      tip_paise: t.tipPaise,
      total_paise: t.totalPaise,
      coupon_code: t.couponCode,
    },
    lines: cart.lines.map((l) => ({
      name: l.name,
      qty: l.qty,
      line_total_paise: l.line_total_paise,
      details: [l.variant?.name, ...l.addons.map((a) => `+ ${a.name}`), l.special_instructions].filter(Boolean).join(", ") || null,
    })),
    order_type: cart.order_type,
    prefill: { name: profile?.full_name ?? null, email, contact: profile?.phone ?? null },
    expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
  };
}

export interface OrderDetail {
  order: Order;
  items: OrderItem[];
  events: OrderStatusEvent[];
  eta_minutes: number | null;
  can_cancel: boolean;
  can_review: boolean;
}

async function orderDetail(order: Order): Promise<OrderDetail> {
  const [items, events, reviews] = await Promise.all([
    db().from("order_items").select("*").eq("order_id", order.id).order("created_at"),
    db().from("order_status_events").select("*").eq("order_id", order.id).order("created_at"),
    db().from("reviews").select("id").eq("order_id", order.id),
  ]);
  const eta =
    order.estimated_ready_at && ACTIVE_STATUSES.includes(order.status) && order.status !== "awaiting_payment"
      ? Math.max(0, Math.round((new Date(order.estimated_ready_at).getTime() - Date.now()) / 60_000))
      : null;
  return {
    order,
    items: (items.data ?? []) as OrderItem[],
    events: (events.data ?? []) as OrderStatusEvent[],
    eta_minutes: eta,
    can_cancel: order.status === "awaiting_payment" || order.status === "paid",
    can_review: order.status === "completed" && (reviews.data ?? []).length === 0,
  };
}

export async function getOrderForUser(userId: string, orderRef?: string | null): Promise<OrderDetail> {
  let q = db().from("orders").select("*").eq("user_id", userId);
  if (orderRef) {
    const isUuid = /^[0-9a-f-]{36}$/i.test(orderRef);
    q = isUuid ? q.eq("id", orderRef) : q.ilike("order_number", `%${orderRef.replace(/[^A-Za-z0-9-]/g, "")}`);
    const { data } = await q.order("created_at", { ascending: false }).limit(1);
    if (!data?.[0]) throw new ServiceError("I couldn't find that order on your account.", "not_found");
    return orderDetail(data[0] as Order);
  }
  const { data: active } = await db()
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .in("status", ACTIVE_STATUSES.filter((s) => s !== "awaiting_payment"))
    .order("created_at", { ascending: false })
    .limit(1);
  if (active?.[0]) return orderDetail(active[0] as Order);
  const { data: latest } = await db().from("orders").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1);
  if (!latest?.[0]) throw new ServiceError("You haven't placed any orders yet.", "not_found");
  return orderDetail(latest[0] as Order);
}

export async function listMyOrders(userId: string, limit = 10) {
  const { data } = await db()
    .from("orders")
    .select("id, order_number, status, order_type, total_paise, created_at, order_items(name_snapshot, qty)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 50));
  return (data ?? []) as (Pick<Order, "id" | "order_number" | "status" | "order_type" | "total_paise" | "created_at"> & {
    order_items: { name_snapshot: string; qty: number }[];
  })[];
}

/** Customer cancellation: only before the kitchen accepts. Paid orders are flagged for the owner's refund flow. */
export async function cancelOrderAsCustomer(userId: string, orderRef: string, reason: string) {
  const { order } = await getOrderForUser(userId, orderRef);
  if (order.status !== "awaiting_payment" && order.status !== "paid") {
    throw new ServiceError(
      order.status === "cancelled" ? "That order is already cancelled." : "The kitchen has already accepted this order, so it can't be cancelled online. Please call us.",
      "not_cancellable",
    );
  }
  const { error } = await db().rpc("set_order_status", {
    p_order_id: order.id,
    p_status: "cancelled",
    p_actor: userId,
    p_note: `Cancelled by customer: ${reason.slice(0, 200)}`,
    p_cancel_reason: `Customer: ${reason.slice(0, 200)}`,
  });
  if (error) throw new ServiceError(error.message, "cancel_failed");
  if (order.status === "paid") {
    await db().from("owner_alerts").insert({
      type: "refund_needed",
      title: `Refund needed: ${order.order_number}`,
      body: `Customer cancelled a paid order (${formatINR(order.total_paise)}). Reason: ${reason.slice(0, 200)}`,
      severity: "warning",
      data: { order_id: order.id },
    });
  }
  return {
    order_number: order.order_number,
    status: "cancelled",
    refund: order.status === "paid" ? "The restaurant will process your refund shortly." : null,
  };
}

/** "usual" = the user's most frequently ordered exact combo (ties → most recent). */
export async function findUsualCombo(userId: string) {
  const { data } = await db()
    .from("orders")
    .select("id, created_at, order_items(menu_item_id, qty, variant_snapshot, addons_snapshot)")
    .eq("user_id", userId)
    .in("status", [...REVENUE_STATUSES])
    .order("created_at", { ascending: false })
    .limit(50);
  const counts = new Map<string, { n: number; last: string; orderId: string }>();
  for (const o of data ?? []) {
    const sig = (o.order_items as { menu_item_id: string; qty: number }[])
      .map((i) => `${i.menu_item_id}:${i.qty}`)
      .sort()
      .join("|");
    if (!sig) continue;
    const c = counts.get(sig);
    if (c) c.n += 1;
    else counts.set(sig, { n: 1, last: o.created_at as string, orderId: o.id as string });
  }
  const best = [...counts.values()].sort((a, b) => b.n - a.n || b.last.localeCompare(a.last))[0];
  return best ? { order_id: best.orderId, times_ordered: best.n } : null;
}

export async function reorder(userId: string, orderRef: string | "usual") {
  let orderId = orderRef;
  let timesOrdered: number | null = null;
  if (orderRef === "usual") {
    const usual = await findUsualCombo(userId);
    if (!usual) throw new ServiceError("You don't have a usual order yet — order a few times and I'll remember!", "no_history");
    orderId = usual.order_id;
    timesOrdered = usual.times_ordered;
  }
  const { order, items } = await getOrderForUser(userId, orderId);
  const lines = items
    .filter((i) => i.menu_item_id)
    .map((i) => ({
      item_id: i.menu_item_id!,
      qty: i.qty,
      variant_id: i.variant_snapshot?.id ?? null,
      addon_ids: (i.addons_snapshot ?? []).map((a) => a.id),
      instructions: i.special_instructions,
    }));
  const r = await addManyToCart(userId, lines);
  return { from_order: order.order_number, times_ordered: timesOrdered, ...r };
}
