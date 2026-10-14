/** Read-side operations for the owner/staff area (orders board, menu, inventory, customers, …). */
import { createAdminClient } from "@/lib/supabase/admin";
import { maskEmail, maskPhone } from "@/lib/format";
import { resolveRange, zonedDateString, startOfZonedDay, addDays, DEFAULT_TZ } from "@/lib/time";
import type { Order, OrderItem, OrderStatus, OrderStatusEvent, Reservation } from "@/lib/types";
import { getMenu, type MenuItemFull } from "./menu";
import { ServiceError } from "./errors";
import { range, type RangeInput } from "@/lib/agents/owner/analytics";

const db = () => createAdminClient();

export const OWNER_NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  paid: ["accepted", "preparing", "cancelled"],
  accepted: ["preparing", "ready", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["out_for_delivery", "completed"],
  out_for_delivery: ["completed"],
};

/** "42", "0042", "ORD-20261015-0042" or a uuid → order (prefers today's). */
export async function resolveOrder(ref: string): Promise<Order> {
  const r = ref.trim().replace(/^#/, "");
  if (/^[0-9a-f-]{36}$/i.test(r)) {
    const { data } = await db().from("orders").select("*").eq("id", r).maybeSingle();
    if (data) return data as Order;
  }
  if (/^ORD-\d{8}-\d{1,4}$/i.test(r)) {
    const { data } = await db().from("orders").select("*").eq("order_number", r.toUpperCase()).maybeSingle();
    if (data) return data as Order;
  }
  const digits = r.replace(/\D/g, "");
  if (digits) {
    const suffix = `-${digits.slice(-4).padStart(4, "0")}`;
    const todayNum = `ORD-${zonedDateString(new Date()).replace(/-/g, "")}${suffix}`;
    const { data: today } = await db().from("orders").select("*").eq("order_number", todayNum).maybeSingle();
    if (today) return today as Order;
    const { data: recent } = await db().from("orders").select("*").like("order_number", `%${suffix}`).order("created_at", { ascending: false }).limit(1);
    if (recent?.[0]) return recent[0] as Order;
  }
  throw new ServiceError(`I couldn't find order "${ref}".`, "not_found");
}

export interface OwnerOrderView extends Order {
  customer_name: string | null;
  customer_phone_masked: string | null;
  items: Pick<OrderItem, "name_snapshot" | "qty" | "line_total_paise" | "special_instructions" | "variant_snapshot" | "addons_snapshot">[];
  events?: OrderStatusEvent[];
  next_statuses: OrderStatus[];
  minutes_in_status: number;
}

async function decorate(orders: Order[], withEvents = false): Promise<OwnerOrderView[]> {
  if (!orders.length) return [];
  const ids = orders.map((o) => o.id);
  const userIds = [...new Set(orders.map((o) => o.user_id))];
  const [items, profiles, events] = await Promise.all([
    db().from("order_items").select("order_id, name_snapshot, qty, line_total_paise, special_instructions, variant_snapshot, addons_snapshot").in("order_id", ids),
    db().from("profiles").select("user_id, full_name, phone").in("user_id", userIds),
    db().from("order_status_events").select("*").in("order_id", ids).order("created_at"),
  ]);
  const prof = new Map((profiles.data ?? []).map((p) => [p.user_id as string, p]));
  return orders.map((o) => {
    const ev = ((events.data ?? []) as OrderStatusEvent[]).filter((e) => e.order_id === o.id);
    const last = ev.filter((e) => e.status === o.status).at(-1);
    return {
      ...o,
      customer_name: (prof.get(o.user_id)?.full_name as string) ?? null,
      customer_phone_masked: maskPhone(prof.get(o.user_id)?.phone as string),
      items: ((items.data ?? []) as (OrderItem & { order_id: string })[]).filter((i) => i.order_id === o.id),
      events: withEvents ? ev : undefined,
      next_statuses: OWNER_NEXT_STATUS[o.status] ?? [],
      minutes_in_status: Math.round((Date.now() - new Date(last?.created_at ?? o.updated_at ?? o.created_at).getTime()) / 60_000),
    };
  });
}

export async function listOrders(input: { status?: OrderStatus[] | OrderStatus; range?: RangeInput; limit?: number; active_only?: boolean }) {
  let q = db().from("orders").select("*").order("created_at", { ascending: false }).limit(Math.min(input.limit ?? 50, 200));
  const statuses = input.active_only
    ? (["paid", "accepted", "preparing", "ready", "out_for_delivery"] as OrderStatus[])
    : input.status
      ? Array.isArray(input.status)
        ? input.status
        : [input.status]
      : null;
  if (statuses) q = q.in("status", statuses);
  let label: string | null = null;
  if (input.range) {
    const r = range(input.range, "today");
    q = q.gte("created_at", r.from).lt("created_at", r.to);
    label = r.label;
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return { range_label: label, orders: await decorate((data ?? []) as Order[]) };
}

export async function getOrderOwner(ref: string) {
  const o = await resolveOrder(ref);
  const [view] = await decorate([o], true);
  const { data: payments } = await db().from("payments").select("razorpay_payment_id, amount_paise, status, method, created_at").eq("order_id", o.id);
  const { data: refunds } = await db().from("refunds").select("razorpay_refund_id, amount_paise, status, reason, created_at").eq("order_id", o.id);
  return { ...view, payments: payments ?? [], refunds: refunds ?? [] };
}

export async function findMenuItems(input: { query?: string; category?: string; include_unavailable?: boolean }) {
  const menu = await getMenu();
  const q = (input.query ?? "").toLowerCase().trim();
  return menu.items
    .filter((i) => (input.include_unavailable ?? true) || i.is_available)
    .filter((i) => !input.category || i.category_name.toLowerCase().includes(input.category.toLowerCase()) || i.category_slug === input.category)
    .filter((i) => !q || i.name.toLowerCase().includes(q) || i.slug.includes(q.replace(/\s+/g, "-")) || i.category_name.toLowerCase().includes(q))
    .slice(0, 60)
    .map(ownerItemRow);
}

export function ownerItemRow(i: MenuItemFull) {
  return {
    id: i.id,
    name: i.name,
    category: i.category_name,
    price_paise: i.price_paise,
    is_available: i.is_available,
    stock_qty: i.stock_qty,
    low_stock_threshold: i.low_stock_threshold,
    spice_level: i.spice_level,
    is_veg: i.is_veg,
    tags: i.tags,
    allergens: i.allergens,
    sold_30d: i.sold_30d,
    avg_rating: i.avg_rating || null,
  };
}

export async function listInventory() {
  const { data } = await db().from("inventory_items").select("*").order("name");
  return (data ?? []).map((x) => ({ ...x, qty: Number(x.qty), low_threshold: Number(x.low_threshold), is_low: Number(x.qty) <= Number(x.low_threshold) }));
}

export async function getLowStock() {
  const [inv, menu] = await Promise.all([listInventory(), getMenu({ includeDeleted: false })]);
  return {
    inventory: inv.filter((i) => i.is_low),
    menu_items: menu.items
      .filter((i) => i.stock_qty !== null && i.stock_qty <= i.low_stock_threshold)
      .map((i) => ({ id: i.id, name: i.name, stock_qty: i.stock_qty, low_stock_threshold: i.low_stock_threshold, is_available: i.is_available })),
    unavailable_items: menu.items.filter((i) => !i.is_available).map((i) => ({ id: i.id, name: i.name })),
  };
}

export async function listCoupons() {
  const { data } = await db().from("coupons").select("*").order("created_at", { ascending: false });
  const { data: red } = await db().from("coupon_redemptions").select("coupon_id");
  const counts = new Map<string, number>();
  for (const r of red ?? []) counts.set(r.coupon_id as string, (counts.get(r.coupon_id as string) ?? 0) + 1);
  const now = Date.now();
  return (data ?? []).map((c) => ({
    ...c,
    redemptions: counts.get(c.id as string) ?? 0,
    state: !c.is_active ? "inactive" : c.valid_to && new Date(c.valid_to as string).getTime() < now ? "expired" : c.valid_from && new Date(c.valid_from as string).getTime() > now ? "scheduled" : "active",
  }));
}

export async function listReservations(input: { date?: string; status?: string }) {
  let q = db().from("reservations").select("*").order("reserved_for");
  if (input.date) {
    const from = startOfZonedDay(input.date, DEFAULT_TZ);
    const to = startOfZonedDay(addDays(input.date, 1), DEFAULT_TZ);
    q = q.gte("reserved_for", from.toISOString()).lt("reserved_for", to.toISOString());
  } else {
    q = q.gte("reserved_for", new Date(Date.now() - 3 * 3600_000).toISOString()).limit(50);
  }
  if (input.status) q = q.eq("status", input.status);
  const { data } = await q;
  const rows = (data ?? []) as Reservation[];
  const { data: profiles } = await db().from("profiles").select("user_id, full_name").in("user_id", [...new Set(rows.map((r) => r.user_id))]);
  const names = new Map((profiles ?? []).map((p) => [p.user_id as string, p.full_name as string]));
  return rows.map((r) => ({ ...r, phone: maskPhone(r.phone), guest_name: names.get(r.user_id) ?? null }));
}

export async function listReviews(input: { rating?: number; max_rating?: number; sentiment?: string; range?: RangeInput; unreplied_only?: boolean; limit?: number }) {
  let q = db().from("reviews").select("id, rating, comment, sentiment, owner_reply, created_at, order_id, menu_items(name), orders(order_number)").order("created_at", { ascending: false }).limit(Math.min(input.limit ?? 20, 100));
  if (input.rating) q = q.eq("rating", input.rating);
  if (input.max_rating) q = q.lte("rating", input.max_rating);
  if (input.sentiment) q = q.eq("sentiment", input.sentiment);
  if (input.unreplied_only) q = q.is("owner_reply", null);
  if (input.range) {
    const r = range(input.range, "last_30_days");
    q = q.gte("created_at", r.from).lt("created_at", r.to);
  }
  const { data } = await q;
  return (data ?? []).map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    sentiment: r.sentiment,
    owner_reply: r.owner_reply,
    created_at: r.created_at,
    item: (r.menu_items as unknown as { name: string } | null)?.name ?? null,
    order_number: (r.orders as unknown as { order_number: string } | null)?.order_number ?? null,
  }));
}

export async function getCustomer(query: string) {
  const q = query.trim();
  const admin = db();
  let userIds: string[] = [];
  if (q.includes("@")) {
    // Exact email lookup only — never list emails.
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userIds = (data?.users ?? []).filter((u) => u.email?.toLowerCase() === q.toLowerCase()).map((u) => u.id);
  } else if (/^ORD-/i.test(q) || /^\d{1,4}$/.test(q)) {
    const o = await resolveOrder(q);
    userIds = [o.user_id];
  } else {
    const digits = q.replace(/\D/g, "");
    const { data } = digits.length >= 6
      ? await admin.from("profiles").select("user_id").ilike("phone", `%${digits.slice(-10)}%`).limit(5)
      : await admin.from("profiles").select("user_id").ilike("full_name", `%${q}%`).limit(5);
    userIds = (data ?? []).map((p) => p.user_id as string);
  }
  if (!userIds.length) throw new ServiceError("No customer matched that search.", "not_found");
  const out = [];
  for (const uid of userIds.slice(0, 5)) {
    const [{ data: p }, { data: orders }, { data: user }] = await Promise.all([
      admin.from("profiles").select("full_name, phone, role, dietary_prefs, allergies, created_at").eq("user_id", uid).single(),
      admin.from("orders").select("order_number, total_paise, status, created_at").eq("user_id", uid).order("created_at", { ascending: false }),
      admin.auth.admin.getUserById(uid),
    ]);
    const paid = (orders ?? []).filter((o) => ["paid", "accepted", "preparing", "ready", "out_for_delivery", "completed"].includes(o.status as string));
    out.push({
      name: p?.full_name ?? null,
      phone: maskPhone(p?.phone as string),
      email: maskEmail(user?.user?.email),
      customer_since: p?.created_at ?? null,
      orders: paid.length,
      lifetime_value_paise: paid.reduce((a, o) => a + (o.total_paise as number), 0),
      last_order: orders?.[0] ? { order_number: orders[0].order_number, status: orders[0].status, created_at: orders[0].created_at } : null,
      dietary_prefs: p?.dietary_prefs ?? [],
      allergies: p?.allergies ?? [],
    });
  }
  return out;
}

export async function getAuditLog(input: { range?: RangeInput; limit?: number; writes_only?: boolean }) {
  const r = range(input.range, "today");
  let q = db().from("agent_audit_log").select("created_at, agent, tool_name, params, result_summary, status, confirmed_by_user, user_id").gte("created_at", r.from).lt("created_at", r.to).order("created_at", { ascending: false }).limit(Math.min(input.limit ?? 50, 200));
  if (input.writes_only ?? true) q = q.eq("confirmed_by_user", true);
  const { data } = await q;
  const { data: profiles } = await db().from("profiles").select("user_id, full_name").in("user_id", [...new Set((data ?? []).map((x) => x.user_id as string).filter(Boolean))]);
  const names = new Map((profiles ?? []).map((p) => [p.user_id as string, p.full_name as string]));
  return { range: r, entries: (data ?? []).map((x) => ({ ...x, actor: names.get(x.user_id as string) ?? null, user_id: undefined })) };
}

export async function listAlerts(input: { unread_only?: boolean; limit?: number } = {}) {
  let q = db().from("owner_alerts").select("*").order("created_at", { ascending: false }).limit(input.limit ?? 20);
  if (input.unread_only) q = q.eq("is_read", false);
  const { data } = await q;
  return data ?? [];
}

export async function markAlertsRead(ids?: string[]) {
  let q = db().from("owner_alerts").update({ is_read: true }).eq("is_read", false);
  if (ids?.length) q = q.in("id", ids);
  await q;
}

export async function getSettingsForOwner() {
  const { data } = await db().from("restaurant_settings").select("*").single();
  return data;
}

export function todayRange() {
  return resolveRange("today");
}
