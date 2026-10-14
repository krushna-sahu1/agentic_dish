/**
 * Owner/staff WRITE operations. Each change has:
 *  - a Zod schema (validated server-side on preview AND execute),
 *  - preview(): a before → after diff computed from the DB (shown in the Confirm card),
 *  - execute(): runs only from executeOwnerChange(), i.e. after a human Confirm click.
 * The model can propose a change; it can never apply one.
 */
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatINR, STATUS_LABEL } from "@/lib/format";
import { describeCoupon } from "@/lib/coupons";
import { orderStatusEmail, sendEmail } from "@/lib/email";
import { ServiceError } from "@/lib/services/errors";
import { getMenu, resolveItem, type MenuItemFull } from "@/lib/services/menu";
import { getOrderOwner, resolveOrder, OWNER_NEXT_STATUS } from "@/lib/services/owner";
import { issueRefund, refundableAmount } from "@/lib/services/refunds";
import { resolveRange } from "@/lib/time";
import type { Order, OrderStatus } from "@/lib/types";
import { OWNER_CHANGE_SCHEMAS as S } from "./change-schemas";

const db = () => createAdminClient();

export interface ChangeRow {
  label: string;
  before: string | null;
  after: string | null;
}

export interface ChangePreview {
  title: string;
  description?: string;
  changes: ChangeRow[];
  table?: { columns: string[]; rows: (string | number | null)[][] };
  warnings?: string[];
  /** Fields the owner may edit on the card before confirming. */
  editable?: { field: string; label: string; type: "text" | "textarea" | "number"; value: string | number | null }[];
  allow_image_upload?: boolean;
  destructive?: boolean;
}

export interface OwnerChange<S extends z.ZodTypeAny = z.ZodTypeAny> {
  description: string;
  schema: S;
  preview: (args: z.infer<S>) => Promise<ChangePreview>;
  execute: (args: z.infer<S>, actorUserId: string) => Promise<{ message: string; data?: unknown }>;
}

const define = <S extends z.ZodTypeAny>(c: OwnerChange<S>) => c;
const rupees = (p: number | null | undefined) => (p == null ? null : formatINR(p));
const yesNo = (b: boolean | null | undefined) => (b == null ? null : b ? "Yes" : "No");
const list = (a: string[] | null | undefined) => (a && a.length ? a.join(", ") : "—");

async function setStatus(order: Order, status: OrderStatus, actor: string, note?: string | null, eta?: number | null, cancelReason?: string | null) {
  const { data, error } = await db().rpc("set_order_status", {
    p_order_id: order.id,
    p_status: status,
    p_actor: actor,
    p_note: note ?? null,
    p_eta_minutes: eta ?? null,
    p_cancel_reason: cancelReason ?? null,
  });
  if (error) throw new ServiceError(error.message, "status_failed");
  return data as Order;
}

async function notifyCustomer(order: Order) {
  if (!["ready", "out_for_delivery", "accepted"].includes(order.status)) return;
  const { data } = await db().auth.admin.getUserById(order.user_id);
  void sendEmail(data?.user?.email, `Order ${order.order_number}: ${STATUS_LABEL[order.status]}`, orderStatusEmail(order));
}

function itemDiff(item: MenuItemFull, patch: Record<string, unknown>): ChangeRow[] {
  const rows: ChangeRow[] = [];
  const fmt = (k: string, v: unknown): string | null => {
    if (v == null) return null;
    if (k.endsWith("_paise")) return rupees(v as number);
    if (Array.isArray(v)) return list(v as string[]);
    if (typeof v === "boolean") return yesNo(v);
    return String(v);
  };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    const before = (item as unknown as Record<string, unknown>)[k];
    if (JSON.stringify(before) === JSON.stringify(v)) continue;
    rows.push({ label: k.replace(/_paise$/, "").replace(/_/g, " "), before: fmt(k, before), after: fmt(k, v) });
  }
  return rows;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

async function resolveCategory(ref: string) {
  const { data } = await db().from("categories").select("*");
  const c = (data ?? []).find((x) => x.id === ref || x.slug === ref || (x.name as string).toLowerCase() === ref.toLowerCase()) ??
    (data ?? []).find((x) => (x.name as string).toLowerCase().includes(ref.toLowerCase()));
  if (!c) throw new ServiceError(`No category "${ref}". Categories: ${(data ?? []).map((x) => x.name).join(", ")}`, "not_found");
  return c as { id: string; name: string; slug: string; sort_order: number; is_active: boolean };
}

async function itemsForBulk(args: { category?: string; item_refs?: string[] }) {
  const menu = await getMenu();
  if (args.item_refs?.length) return Promise.all(args.item_refs.map((r) => resolveItem(r)));
  if (args.category) {
    const c = await resolveCategory(args.category);
    return menu.items.filter((i) => i.category_id === c.id);
  }
  throw new ServiceError("Tell me which category or items to update.", "invalid");
}

function bulkNewPrice(price: number, args: { percent?: number; flat_paise?: number; round_to_paise?: number }) {
  let p = price;
  if (args.percent != null) p = price * (1 + args.percent / 100);
  if (args.flat_paise != null) p = p + args.flat_paise;
  const step = args.round_to_paise ?? 500;
  p = Math.round(p / step) * step;
  return Math.max(0, p);
}

// ============================================================================
export const OWNER_CHANGES = {
  // ------------------------------------------------------------- orders
  update_order_status: define({
    ...S.update_order_status,
    async preview(a) {
      const o = await resolveOrder(a.order_ref);
      const allowed = OWNER_NEXT_STATUS[o.status] ?? [];
      const warnings: string[] = [];
      if (!allowed.includes(a.status)) warnings.push(`${o.order_number} is "${STATUS_LABEL[o.status]}" — it can move to: ${allowed.map((s) => STATUS_LABEL[s]).join(", ") || "nothing (closed)"}.`);
      if (a.status === "out_for_delivery" && o.order_type !== "delivery") warnings.push("This isn't a delivery order.");
      return {
        title: `Update ${o.order_number}`,
        changes: [
          { label: "Status", before: STATUS_LABEL[o.status], after: STATUS_LABEL[a.status] },
          ...(a.eta_minutes ? [{ label: "Ready in", before: null, after: `${a.eta_minutes} min` }] : []),
        ],
        warnings,
      };
    },
    async execute(a, actor) {
      const o = await resolveOrder(a.order_ref);
      if (!(OWNER_NEXT_STATUS[o.status] ?? []).includes(a.status)) throw new ServiceError(`Can't move ${o.order_number} from ${STATUS_LABEL[o.status]} to ${STATUS_LABEL[a.status]}.`, "invalid_transition");
      const updated = await setStatus(o, a.status, actor, a.note ?? (a.eta_minutes ? `ETA ${a.eta_minutes} min` : null), a.eta_minutes);
      void notifyCustomer(updated);
      return { message: `${o.order_number} is now ${STATUS_LABEL[a.status]}${a.eta_minutes ? ` (ready in ~${a.eta_minutes} min)` : ""}.`, data: { order_number: o.order_number, status: a.status } };
    },
  }),

  cancel_order: define({
    ...S.cancel_order,
    async preview(a) {
      const o = await resolveOrder(a.order_ref);
      const warnings = [];
      if (["completed", "cancelled", "refunded"].includes(o.status)) warnings.push(`${o.order_number} is already ${STATUS_LABEL[o.status]}.`);
      if (o.paid_at) warnings.push(`This order was paid (${formatINR(o.total_paise)}). Cancelling does NOT refund — use "issue refund" after.`);
      return { title: `Cancel ${o.order_number}`, destructive: true, changes: [{ label: "Status", before: STATUS_LABEL[o.status], after: "Cancelled" }, { label: "Reason", before: null, after: a.reason }], warnings };
    },
    async execute(a, actor) {
      const o = await resolveOrder(a.order_ref);
      await setStatus(o, "cancelled", actor, `Cancelled by restaurant: ${a.reason}`, null, a.reason);
      return { message: `${o.order_number} cancelled.${o.paid_at ? " It was paid — issue a refund next." : ""}` };
    },
  }),

  issue_refund: define({
    ...S.issue_refund,
    async preview(a) {
      const o = await resolveOrder(a.order_ref);
      const r = await refundableAmount(o);
      const amount = a.amount_paise ?? r.refundable_paise;
      const warnings = [];
      if (!o.paid_at) warnings.push("This order was never paid — nothing to refund.");
      if (amount > r.refundable_paise) warnings.push(`Only ${formatINR(r.refundable_paise)} is refundable.`);
      return {
        title: `Refund ${o.order_number}`,
        destructive: true,
        description: "Money goes back to the customer's original payment method (usually 5–7 working days).",
        changes: [
          { label: "Order total", before: formatINR(o.total_paise), after: null },
          { label: "Already refunded", before: formatINR(r.already_refunded_paise), after: null },
          { label: "Refund now", before: null, after: formatINR(amount) },
          { label: "Reason", before: null, after: a.reason },
        ],
        editable: [{ field: "amount_paise", label: "Amount (paise)", type: "number", value: amount }],
        warnings,
      };
    },
    async execute(a, actor) {
      const o = await resolveOrder(a.order_ref);
      const r = await issueRefund(o, a.amount_paise, a.reason, actor);
      return { message: `Refund of ${formatINR(r.amount_paise)} initiated for ${o.order_number} (Razorpay ${r.refund_id}). The order flips to Refunded once Razorpay confirms.`, data: r };
    },
  }),

  // ------------------------------------------------------------- menu
  set_item_availability: define({
    ...S.set_item_availability,
    async preview(a) {
      const i = await resolveItem(a.item_ref);
      return { title: `${a.is_available ? "Make available" : "Mark sold out"}: ${i.name}`, changes: [{ label: "Available", before: yesNo(i.is_available), after: yesNo(a.is_available) }] };
    },
    async execute(a) {
      const i = await resolveItem(a.item_ref);
      const patch: Record<string, unknown> = { is_available: a.is_available };
      if (a.is_available && i.stock_qty === 0) patch.stock_qty = null;
      await db().from("menu_items").update(patch).eq("id", i.id);
      return { message: `${i.name} is now ${a.is_available ? "available" : "sold out"} — the menu updates live.` };
    },
  }),

  update_stock: define({
    ...S.update_stock,
    async preview(a) {
      const i = await resolveItem(a.item_ref);
      return {
        title: `Stock: ${i.name}`,
        changes: [
          { label: "Portions left", before: i.stock_qty == null ? "Unlimited" : String(i.stock_qty), after: a.stock_qty == null ? "Unlimited" : String(a.stock_qty) },
          ...(a.stock_qty === 0 ? [{ label: "Available", before: yesNo(i.is_available), after: "No" }] : []),
        ],
      };
    },
    async execute(a) {
      const i = await resolveItem(a.item_ref);
      await db().from("menu_items").update({ stock_qty: a.stock_qty, is_available: a.stock_qty === 0 ? false : a.stock_qty != null && !i.is_available && i.stock_qty === 0 ? true : i.is_available }).eq("id", i.id);
      return { message: `${i.name} stock set to ${a.stock_qty ?? "unlimited"}.` };
    },
  }),

  update_menu_item: define({
    ...S.update_menu_item,
    async preview(a) {
      const i = await resolveItem(a.item_ref);
      const { item_ref, ...patch } = a;
      void item_ref;
      const changes = itemDiff(i, patch);
      return {
        title: `Edit ${i.name}`,
        changes: changes.length ? changes : [{ label: "No changes", before: null, after: null }],
        editable: a.price_paise != null ? [{ field: "price_paise", label: "Price (paise)", type: "number", value: a.price_paise }] : a.description != null ? [{ field: "description", label: "Description", type: "textarea", value: a.description }] : undefined,
        allow_image_upload: true,
      };
    },
    async execute(a) {
      const i = await resolveItem(a.item_ref);
      const { item_ref, ...patch } = a;
      void item_ref;
      const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
      if (!Object.keys(clean).length) throw new ServiceError("Nothing to change.", "invalid");
      if (clean.name) clean.slug = `${slugify(String(clean.name))}`;
      const { error } = await db().from("menu_items").update(clean).eq("id", i.id);
      if (error) throw new ServiceError(error.message, "update_failed");
      return { message: `${i.name} updated.` };
    },
  }),

  create_menu_item: define({
    ...S.create_menu_item,
    async preview(a) {
      const c = await resolveCategory(a.category);
      const menu = await getMenu();
      const warnings = menu.items.some((i) => i.name.toLowerCase() === a.name.toLowerCase()) ? [`A dish called "${a.name}" already exists.`] : [];
      return {
        title: `Add "${a.name}" to ${c.name}`,
        changes: [
          { label: "Price", before: null, after: formatINR(a.price_paise) },
          { label: "Veg", before: null, after: yesNo(a.is_veg) },
          { label: "Spice", before: null, after: `${a.spice_level}/5` },
          { label: "Allergens", before: null, after: list(a.allergens) },
          { label: "Tags", before: null, after: list(a.tags) },
          { label: "Description", before: null, after: a.description || "—" },
        ],
        editable: [
          { field: "description", label: "Description", type: "textarea", value: a.description },
          { field: "price_paise", label: "Price (paise)", type: "number", value: a.price_paise },
        ],
        allow_image_upload: true,
        warnings,
      };
    },
    async execute(a) {
      const c = await resolveCategory(a.category);
      const { category, ...rest } = a;
      void category;
      let slug = slugify(a.name);
      const { data: exists } = await db().from("menu_items").select("id").eq("slug", slug).maybeSingle();
      if (exists) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
      const { data, error } = await db()
        .from("menu_items")
        .insert({ ...rest, category_id: c.id, slug, image_url: a.image_url ?? "/dishes/placeholder.svg", sort_order: 99 })
        .select("id, name")
        .single();
      if (error) throw new ServiceError(error.message, "create_failed");
      return { message: `${data.name} added to ${c.name}.`, data };
    },
  }),

  delete_menu_item: define({
    ...S.delete_menu_item,
    async preview(a) {
      const i = await resolveItem(a.item_ref);
      return { title: `Remove ${i.name} from the menu`, destructive: true, changes: [{ label: "On menu", before: "Yes", after: "No (hidden; past sales kept)" }] };
    },
    async execute(a) {
      const i = await resolveItem(a.item_ref);
      await db().from("menu_items").update({ is_deleted: true, is_available: false }).eq("id", i.id);
      return { message: `${i.name} removed from the menu.` };
    },
  }),

  create_category: define({
    ...S.create_category,
    async preview(a) {
      return { title: `New category "${a.name}"`, changes: [{ label: "Category", before: null, after: a.name }] };
    },
    async execute(a) {
      const { data, error } = await db().from("categories").insert({ name: a.name, slug: slugify(a.name), sort_order: a.sort_order ?? 50 }).select("id, name").single();
      if (error) throw new ServiceError(error.message, "create_failed");
      return { message: `Category ${data.name} created.`, data };
    },
  }),

  update_category: define({
    ...S.update_category,
    async preview(a) {
      const c = await resolveCategory(a.category_ref);
      const changes: ChangeRow[] = [];
      if (a.name && a.name !== c.name) changes.push({ label: "Name", before: c.name, after: a.name });
      if (a.sort_order != null && a.sort_order !== c.sort_order) changes.push({ label: "Position", before: String(c.sort_order), after: String(a.sort_order) });
      if (a.is_active != null && a.is_active !== c.is_active) changes.push({ label: "Visible", before: yesNo(c.is_active), after: yesNo(a.is_active) });
      return { title: `Edit category ${c.name}`, changes };
    },
    async execute(a) {
      const c = await resolveCategory(a.category_ref);
      const patch = Object.fromEntries(Object.entries({ name: a.name, sort_order: a.sort_order, is_active: a.is_active }).filter(([, v]) => v !== undefined));
      await db().from("categories").update(patch).eq("id", c.id);
      return { message: `Category ${c.name} updated.` };
    },
  }),

  set_pairings: define({
    ...S.set_pairings,
    async preview(a) {
      const i = await resolveItem(a.item_ref);
      const { data: current } = await db().from("pairings").select("paired_item_id, reason").eq("item_id", i.id);
      const menu = await getMenu();
      const next = await Promise.all(a.pairings.map(async (p) => ({ item: await resolveItem(p.item_ref), reason: p.reason })));
      return {
        title: `Pairings for ${i.name}`,
        changes: [
          { label: "Goes well with", before: list((current ?? []).map((c) => menu.byId.get(c.paired_item_id as string)?.name ?? "?")), after: list(next.map((n) => n.item.name)) },
        ],
        table: { columns: ["Dish", "Reason"], rows: next.map((n) => [n.item.name, n.reason]) },
      };
    },
    async execute(a) {
      const i = await resolveItem(a.item_ref);
      const next = await Promise.all(a.pairings.map(async (p, idx) => ({ item_id: i.id, paired_item_id: (await resolveItem(p.item_ref)).id, reason: p.reason, weight: Math.max(1, 9 - idx) })));
      await db().from("pairings").delete().eq("item_id", i.id);
      if (next.length) {
        const { error } = await db().from("pairings").insert(next.filter((n) => n.paired_item_id !== i.id));
        if (error) throw new ServiceError(error.message, "update_failed");
      }
      return { message: `Pairings for ${i.name} updated (${next.length}).` };
    },
  }),

  bulk_price_update: define({
    ...S.bulk_price_update,
    async preview(a) {
      if (a.percent == null && a.flat_paise == null) throw new ServiceError("Give a percent or a flat amount.", "invalid");
      const items = await itemsForBulk(a);
      const rows = items.map((i) => [i.name, formatINR(i.price_paise), formatINR(bulkNewPrice(i.price_paise, a))] as (string | number | null)[]);
      return {
        title: `Update prices for ${items.length} dish${items.length === 1 ? "" : "es"}`,
        description: [a.percent != null ? `${a.percent > 0 ? "+" : ""}${a.percent}%` : null, a.flat_paise != null ? `${a.flat_paise > 0 ? "+" : ""}${formatINR(a.flat_paise)}` : null, `rounded to ${formatINR(a.round_to_paise ?? 500)}`].filter(Boolean).join(", "),
        changes: [],
        table: { columns: ["Dish", "Before", "After"], rows },
      };
    },
    async execute(a) {
      const items = await itemsForBulk(a);
      for (const i of items) await db().from("menu_items").update({ price_paise: bulkNewPrice(i.price_paise, a) }).eq("id", i.id);
      return { message: `Updated prices for ${items.length} dishes.` };
    },
  }),

  // ------------------------------------------------------------- inventory
  update_inventory: define({
    ...S.update_inventory,
    async preview(a) {
      const { data } = await db().from("inventory_items").select("*");
      const inv = (data ?? []).find((x) => x.id === a.inventory_ref || (x.name as string).toLowerCase() === a.inventory_ref.toLowerCase()) ?? (data ?? []).find((x) => (x.name as string).toLowerCase().includes(a.inventory_ref.toLowerCase()));
      if (!inv) throw new ServiceError(`No ingredient "${a.inventory_ref}".`, "not_found");
      return { title: `Inventory: ${inv.name}`, changes: [{ label: `Quantity (${inv.unit})`, before: String(Number(inv.qty)), after: String(a.qty) }] };
    },
    async execute(a) {
      const { data } = await db().from("inventory_items").select("*");
      const inv = (data ?? []).find((x) => x.id === a.inventory_ref || (x.name as string).toLowerCase() === a.inventory_ref.toLowerCase()) ?? (data ?? []).find((x) => (x.name as string).toLowerCase().includes(a.inventory_ref.toLowerCase()));
      if (!inv) throw new ServiceError(`No ingredient "${a.inventory_ref}".`, "not_found");
      await db().from("inventory_items").update({ qty: a.qty }).eq("id", inv.id);
      return { message: `${inv.name} set to ${a.qty} ${inv.unit}.` };
    },
  }),

  // ------------------------------------------------------------- coupons
  create_coupon: define({
    ...S.create_coupon,
    async preview(a) {
      const code = a.code.toUpperCase();
      const { data: exists } = await db().from("coupons").select("id").eq("code", code).maybeSingle();
      const warnings = [];
      if (exists) warnings.push(`${code} already exists — use update instead.`);
      if (a.type === "percent" && a.value > 100) warnings.push("Percent can't exceed 100.");
      if (a.type === "percent" && !a.max_discount_paise) warnings.push("No maximum discount cap set.");
      return {
        title: `Create coupon ${code}`,
        changes: [
          { label: "Offer", before: null, after: describeCoupon({ type: a.type, value: a.value, min_order_paise: a.min_order_paise, max_discount_paise: a.max_discount_paise ?? null }) },
          { label: "Valid", before: null, after: `${a.valid_from ? new Date(a.valid_from).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "now"} → ${a.valid_to ? new Date(a.valid_to).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "no end"}` },
          { label: "Per customer", before: null, after: `${a.per_user_limit} use(s)` },
          ...(a.usage_limit ? [{ label: "Total uses", before: null, after: String(a.usage_limit) }] : []),
        ],
        warnings,
      };
    },
    async execute(a) {
      const code = a.code.toUpperCase();
      const { error } = await db().from("coupons").insert({
        ...a,
        code,
        description: a.description ?? describeCoupon({ type: a.type, value: a.value, min_order_paise: a.min_order_paise, max_discount_paise: a.max_discount_paise ?? null }),
        valid_from: a.valid_from ?? new Date().toISOString(),
      });
      if (error) throw new ServiceError(error.code === "23505" ? `${code} already exists.` : error.message, "create_failed");
      return { message: `Coupon ${code} created.` };
    },
  }),

  update_coupon: define({
    ...S.update_coupon,
    async preview(a) {
      const { data: c } = await db().from("coupons").select("*").eq("code", a.code.toUpperCase()).maybeSingle();
      if (!c) throw new ServiceError(`No coupon ${a.code.toUpperCase()}.`, "not_found");
      const { code, ...patch } = a;
      void code;
      const changes: ChangeRow[] = [];
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || JSON.stringify(c[k]) === JSON.stringify(v)) continue;
        const f = (x: unknown) => (x == null ? "—" : k.endsWith("_paise") ? formatINR(x as number) : String(x));
        changes.push({ label: k.replace(/_paise$/, "").replace(/_/g, " "), before: f(c[k]), after: f(v) });
      }
      return { title: `Edit coupon ${c.code}`, changes };
    },
    async execute(a) {
      const { code, ...patch } = a;
      const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
      const { error, count } = await db().from("coupons").update(clean, { count: "exact" }).eq("code", code.toUpperCase());
      if (error) throw new ServiceError(error.message, "update_failed");
      if (!count) throw new ServiceError(`No coupon ${code.toUpperCase()}.`, "not_found");
      return { message: `Coupon ${code.toUpperCase()} updated.` };
    },
  }),

  deactivate_coupon: define({
    ...S.deactivate_coupon,
    async preview(a) {
      const { data: c } = await db().from("coupons").select("*").eq("code", a.code.toUpperCase()).maybeSingle();
      if (!c) throw new ServiceError(`No coupon ${a.code.toUpperCase()}.`, "not_found");
      return { title: `Deactivate ${c.code}`, destructive: true, changes: [{ label: "Active", before: yesNo(c.is_active), after: "No" }] };
    },
    async execute(a) {
      await db().from("coupons").update({ is_active: false }).eq("code", a.code.toUpperCase());
      return { message: `Coupon ${a.code.toUpperCase()} deactivated.` };
    },
  }),

  // ------------------------------------------------------------- reservations
  update_reservation: define({
    ...S.update_reservation,
    async preview(a) {
      const { data: r } = await db().from("reservations").select("*").eq("id", a.id).maybeSingle();
      if (!r) throw new ServiceError("Reservation not found.", "not_found");
      return {
        title: `Reservation for ${r.party_size} at ${new Date(r.reserved_for).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}`,
        changes: [
          { label: "Status", before: r.status, after: a.status },
          ...(a.table_number ? [{ label: "Table", before: r.table_number ? String(r.table_number) : "—", after: String(a.table_number) }] : []),
        ],
      };
    },
    async execute(a) {
      const patch: Record<string, unknown> = { status: a.status };
      if (a.table_number) patch.table_number = a.table_number;
      const { error } = await db().from("reservations").update(patch).eq("id", a.id);
      if (error) throw new ServiceError(error.message, "update_failed");
      return { message: `Reservation updated to ${a.status}.` };
    },
  }),

  // ------------------------------------------------------------- reviews
  reply_to_review: define({
    ...S.reply_to_review,
    async preview(a) {
      const { data: r } = await db().from("reviews").select("rating, comment, owner_reply").eq("id", a.review_id).maybeSingle();
      if (!r) throw new ServiceError("Review not found.", "not_found");
      return {
        title: `Reply to ${r.rating}★ review`,
        description: r.comment ? `“${String(r.comment).slice(0, 200)}”` : undefined,
        changes: [{ label: "Reply", before: r.owner_reply ?? "—", after: a.reply }],
        editable: [{ field: "reply", label: "Your reply", type: "textarea", value: a.reply }],
      };
    },
    async execute(a) {
      const { error } = await db().from("reviews").update({ owner_reply: a.reply }).eq("id", a.review_id);
      if (error) throw new ServiceError(error.message, "update_failed");
      return { message: "Reply posted." };
    },
  }),

  // ------------------------------------------------------------- settings
  update_settings: define({
    ...S.update_settings,
    async preview(a) {
      const { data: s } = await db().from("restaurant_settings").select("*").single();
      const changes: ChangeRow[] = [];
      const label: Record<string, string> = { is_open_override: "Open/closed", accepting_orders: "Accepting online orders" };
      const fmtOverride = (v: string) => ({ auto: "Follow opening hours", force_open: "Forced open", force_closed: "Closed today" })[v] ?? v;
      for (const [k, v] of Object.entries(a)) {
        if (v === undefined || JSON.stringify(s?.[k]) === JSON.stringify(v)) continue;
        const f = (x: unknown) =>
          x == null ? "—" : k === "is_open_override" ? fmtOverride(String(x)) : k.endsWith("_paise") ? formatINR(x as number) : typeof x === "boolean" ? (yesNo(x) as string) : typeof x === "object" ? JSON.stringify(x) : String(x);
        changes.push({ label: label[k] ?? k.replace(/_paise$/, "").replace(/_/g, " "), before: f(s?.[k]), after: f(v) });
      }
      const warnings = a.is_open_override === "force_closed" ? ["Customers won't be able to check out until you reopen (set back to auto)."] : [];
      return { title: "Update restaurant settings", changes, warnings, destructive: a.is_open_override === "force_closed" || a.accepting_orders === false };
    },
    async execute(a) {
      const clean = Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined));
      const { error } = await db().from("restaurant_settings").update(clean).eq("singleton", true);
      if (error) throw new ServiceError(error.message, "update_failed");
      return { message: a.is_open_override === "force_closed" ? "Restaurant marked closed for today. Checkout is blocked." : "Settings updated." };
    },
  }),
} satisfies Record<string, OwnerChange>;

export type OwnerChangeName = keyof typeof OWNER_CHANGES;
export const OWNER_CHANGE_NAMES = Object.keys(OWNER_CHANGES) as OwnerChangeName[];

/** Today's range helper re-exported for the report route. */
export const todayLabel = () => resolveRange("today").label;
export { getOrderOwner };
