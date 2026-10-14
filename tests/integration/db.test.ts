/**
 * Database integration (PGlite = real Postgres in WASM): migrations + seed,
 * payment-safety triggers, webhook idempotency, stock decrement, analytics.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asRole, createTestDb } from "../helpers/pglite";

const CUSTOMER = "33333333-3333-4333-8333-333333333333";
const OWNER = "11111111-1111-4111-8111-111111111111";
let db: PGlite;

const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];

async function newOrder(rzp: string, total = 23100) {
  await asRole(db, "service_role");
  const r = await one<{ id: string }>(
    `insert into orders (order_number, user_id, order_type, subtotal_paise, total_paise, razorpay_order_id)
     values (next_order_number(), $1, 'pickup', 20000, $2, $3) returning id`,
    [CUSTOMER, total, rzp],
  );
  const item = await one<{ id: string; stock_qty: number }>(`select id, stock_qty from menu_items where slug = 'chhena-poda'`);
  await db.query(`insert into order_items (order_id, menu_item_id, name_snapshot, unit_price_paise, qty, line_total_paise) values ($1, $2, 'Chhena Poda', 12000, 2, 24000)`, [r!.id, item!.id]);
  return r!.id;
}

beforeAll(async () => {
  db = await createTestDb();
}, 180_000);

describe("seed", () => {
  it("has the spec'd data volume", async () => {
    const c = await one<Record<string, number>>(`select (select count(*)::int from menu_items) items, (select count(*)::int from categories) cats,
      (select count(*)::int from coupons) coupons, (select count(*)::int from tables) tables,
      (select count(*)::int from profiles where role='owner') owners, (select count(*)::int from profiles where role='staff') staff,
      (select (max(created_at)::date - min(created_at)::date)::int from orders) span_days, (select count(*)::int from reviews) reviews`);
    expect(c!.items).toBeGreaterThanOrEqual(40);
    expect(c!.cats).toBe(8);
    expect(c!.coupons).toBe(5);
    expect(c!.tables).toBe(6);
    expect([c!.owners, c!.staff]).toEqual([1, 1]);
    expect(c!.span_days).toBeGreaterThanOrEqual(85);
    expect(c!.reviews).toBeGreaterThan(100);
  });
});

describe("payment safety (database)", () => {
  it("orders must be created awaiting payment", async () => {
    await asRole(db, "service_role");
    await expect(db.query(`insert into orders (order_number, user_id, order_type, subtotal_paise, total_paise, status) values ('X-1', $1, 'pickup', 1, 1, 'paid')`, [CUSTOMER])).rejects.toThrow(/awaiting_payment/);
  });

  it("no non-webhook path can move an order to paid — not even the service role used by agent tools", async () => {
    const id = await newOrder("order_it_1");
    await expect(db.query(`update orders set status='paid' where id=$1`, [id])).rejects.toThrow(/webhook/);
    await expect(db.query(`select set_order_status($1, 'paid', $2)`, [id, OWNER])).rejects.toThrow(/webhook/);
    await expect(db.query(`update orders set paid_at = now() where id=$1`, [id])).rejects.toThrow(/webhook/);
    await expect(db.query(`select set_order_status($1, 'accepted', $2)`, [id, OWNER])).rejects.toThrow(/unpaid orders can only be cancelled/);
  });

  it("the webhook RPC marks paid exactly once, decrements stock, logs the timeline", async () => {
    const before = await one<{ stock_qty: number }>(`select stock_qty from menu_items where slug='chhena-poda'`);
    const id = await newOrder("order_it_2");
    const r1 = await one<{ r: { ok: boolean; duplicate?: boolean } }>(`select mark_order_paid('order_it_2', 'pay_it_2', 23100, 'upi', '{}'::jsonb) r`);
    const r2 = await one<{ r: { ok: boolean; duplicate?: boolean } }>(`select mark_order_paid('order_it_2', 'pay_it_2', 23100, 'upi', '{}'::jsonb) r`);
    expect(r1!.r).toMatchObject({ ok: true });
    expect(r1!.r.duplicate).toBeUndefined();
    expect(r2!.r).toMatchObject({ ok: true, duplicate: true });
    const o = await one<{ status: string; paid_at: string }>(`select status, paid_at from orders where id=$1`, [id]);
    expect(o!.status).toBe("paid");
    const after = await one<{ stock_qty: number }>(`select stock_qty from menu_items where slug='chhena-poda'`);
    expect(after!.stock_qty).toBe(before!.stock_qty - 2);
    const pays = await one<{ n: number }>(`select count(*)::int n from payments where razorpay_payment_id='pay_it_2'`);
    expect(pays!.n).toBe(1);
    const tl = (await db.query<{ status: string }>(`select status from order_status_events where order_id=$1 order by created_at`, [id])).rows.map((r) => r.status);
    expect(tl).toEqual(["awaiting_payment", "paid"]);
  });

  it("refunded status only via refund webhook; partial refunds keep the order open", async () => {
    const id = await newOrder("order_it_3", 10000);
    await db.query(`select mark_order_paid('order_it_3', 'pay_it_3', 10000, 'card', '{}'::jsonb)`);
    await expect(db.query(`update orders set status='refunded' where id=$1`, [id])).rejects.toThrow(/webhook/);
    await db.query(`select mark_order_refunded('rfnd_a', 'pay_it_3', 4000, '{}'::jsonb)`);
    expect((await one<{ status: string }>(`select status from orders where id=$1`, [id]))!.status).toBe("paid");
    await db.query(`select mark_order_refunded('rfnd_b', 'pay_it_3', 6000, '{}'::jsonb)`);
    expect((await one<{ status: string }>(`select status from orders where id=$1`, [id]))!.status).toBe("refunded");
  });

  it("customers can't call analytics; owners and the service role can", async () => {
    await asRole(db, "authenticated", CUSTOMER);
    await expect(db.query(`select * from analytics_revenue(now() - interval '1 day', now())`)).rejects.toThrow(/denied/);
    await asRole(db, "authenticated", OWNER);
    await expect(db.query(`select * from analytics_revenue(now() - interval '1 day', now())`)).resolves.toBeTruthy();
    await asRole(db, "service_role");
  });
});

describe("analytics RPCs", () => {
  const R = `now() - interval '30 days', now()`;
  it.each([
    `analytics_revenue(${R}, 'day')`,
    `analytics_top_items(${R}, 5, 'revenue')`,
    `analytics_bottom_items(${R}, 5)`,
    `analytics_category_breakdown(${R})`,
    `analytics_peak_hours(${R})`,
    `analytics_order_type_split(${R})`,
    `analytics_coupon_performance(${R})`,
    `analytics_ratings(${R})`,
    `analytics_cancellations(now() - interval '90 days', now())`,
    `analytics_payment_methods(${R})`,
    `analytics_item_daily(${R})`,
  ])("%s returns rows", async (fn) => {
    const rows = (await db.query(`select * from ${fn}`)).rows;
    expect(rows.length).toBeGreaterThan(0);
  });

  it("revenue buckets fill gaps and exclude non-revenue statuses", async () => {
    const rows = (await db.query<{ revenue_paise: string }>(`select * from analytics_revenue(now() - interval '7 days', now(), 'day')`)).rows;
    expect(rows.length).toBeGreaterThanOrEqual(7);
    const direct = await one<{ s: string }>(`select coalesce(sum(total_paise),0) s from orders where status in ('cancelled','refunded','payment_failed','awaiting_payment') and created_at > now() - interval '7 days'`);
    const total = rows.reduce((a, r) => a + Number(r.revenue_paise), 0);
    const all = await one<{ s: string }>(`select coalesce(sum(total_paise),0) s from orders where coalesce(paid_at, created_at) >= now() - interval '7 days'`);
    expect(total).toBeLessThanOrEqual(Number(all!.s) - Number(direct!.s) + 1);
  });

  it("customer stats mask contact details", async () => {
    const s = await one<{ s: { top_customers: { phone: string | null; email: string | null }[] } }>(`select analytics_customer_stats(now() - interval '90 days', now()) s`);
    for (const c of s!.s.top_customers) {
      if (c.phone) expect(c.phone).toMatch(/^\d{2}x+\d{2}$/);
      if (c.email) expect(c.email).toMatch(/^.\*+@/);
    }
  });

  it("compare_periods returns both sides", async () => {
    const r = await one<{ r: { a: { orders: number }; b: { orders: number } } }>(`select analytics_compare_periods(now() - interval '7 days', now(), now() - interval '14 days', now() - interval '7 days') r`);
    expect(r!.r.a.orders).toBeGreaterThan(0);
    expect(r!.r.b.orders).toBeGreaterThan(0);
  });
});

describe("profiles & RLS helpers", () => {
  it("customers cannot escalate their own role", async () => {
    await asRole(db, "authenticated", CUSTOMER);
    await expect(db.query(`update profiles set role='owner' where user_id=$1`, [CUSTOMER])).rejects.toThrow(/role changes/);
    await asRole(db, "service_role");
    const priv = await one<{ p: boolean }>(`select has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE') p`);
    expect(priv!.p).toBe(false);
  });
  it("order numbers are human-friendly and sequential per day", async () => {
    const a = await one<{ n: string }>(`select next_order_number() n`);
    const b = await one<{ n: string }>(`select next_order_number() n`);
    expect(a!.n).toMatch(/^ORD-\d{8}-\d{4}$/);
    expect(Number(b!.n.slice(-4))).toBe(Number(a!.n.slice(-4)) + 1);
  });
});
