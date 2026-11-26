/** Integrity fixes migration on real Postgres (PGlite): wrong amounts, double bookings, private coupons, read-only clients. */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asRole, createTestDb } from "../helpers/pglite";

const CUSTOMER = "33333333-3333-4333-8333-333333333333";
const OWNER = "11111111-1111-4111-8111-111111111111";

let db: PGlite;
const rows = async <T = Record<string, unknown>>(sql: string) => (await db.query<T>(sql)).rows;

beforeAll(async () => {
  db = await createTestDb();
}, 180_000);
afterEach(async () => {
  await db.exec("reset role");
  await asRole(db, "service_role");
});

describe("payment amount mismatch", () => {
  it("records the capture and alerts the owner, but never marks the order paid or touches stock", async () => {
    const [{ id }] = await rows<{ id: string }>(`insert into orders (order_number, user_id, order_type, subtotal_paise, total_paise, razorpay_order_id)
      values ('ORD-MISMATCH-1', '${CUSTOMER}', 'pickup', 12000, 12000, 'order_mm') returning id`);
    await db.exec(`insert into order_items (order_id, menu_item_id, name_snapshot, unit_price_paise, qty, line_total_paise)
      select '${id}', id, name, 12000, 1, 12000 from menu_items where slug = 'chhena-poda'`);
    const before = (await rows<{ stock_qty: number }>(`select stock_qty from menu_items where slug = 'chhena-poda'`))[0].stock_qty;

    const r = await rows<{ r: { ok: boolean; reason: string } }>(`select mark_order_paid('order_mm', 'pay_mm', 100, 'upi', '{}'::jsonb) r`);
    expect(r[0].r).toMatchObject({ ok: false, reason: "amount_mismatch" });
    expect((await rows(`select status, paid_at from orders where id = '${id}'`))[0]).toEqual({ status: "awaiting_payment", paid_at: null });
    expect((await rows<{ stock_qty: number }>(`select stock_qty from menu_items where slug = 'chhena-poda'`))[0].stock_qty).toBe(before);
    expect((await rows<{ n: number }>(`select count(*)::int n from payments where razorpay_payment_id = 'pay_mm' and status = 'captured'`))[0].n).toBe(1);
    expect((await rows<{ n: number }>(`select count(*)::int n from owner_alerts where type = 'payment_mismatch' and data ->> 'order_id' = '${id}'`))[0].n).toBe(1);

    // The right payment for the same order still goes through.
    await db.query(`select mark_order_paid('order_mm', 'pay_mm2', 12000, 'upi', '{}'::jsonb)`);
    expect((await rows(`select status from orders where id = '${id}'`))[0]).toEqual({ status: "paid" });
  });
});

describe("table bookings", () => {
  const book = (table: number, at: string, status = "confirmed") =>
    db.query(`insert into reservations (user_id, party_size, reserved_for, status, table_number) values ('${CUSTOMER}', 2, '${at}', '${status}', ${table}) returning id`);

  it("refuse an overlapping slot on the same table, allow other tables and times", async () => {
    await book(4, "2027-01-10T19:00:00+05:30");
    await expect(book(4, "2027-01-10T20:00:00+05:30")).rejects.toThrow(/already booked/);
    await expect(book(5, "2027-01-10T20:00:00+05:30")).resolves.toBeTruthy();
    await expect(book(4, "2027-01-10T20:30:00+05:30")).resolves.toBeTruthy();
  });

  it("free the slot when a booking is cancelled, and block un-cancelling into a taken one", async () => {
    const first = (await book(6, "2027-01-11T19:00:00+05:30")).rows[0] as { id: string };
    await db.query(`update reservations set status = 'cancelled' where id = '${first.id}'`);
    await expect(book(6, "2027-01-11T19:30:00+05:30")).resolves.toBeTruthy();
    await expect(db.query(`update reservations set status = 'confirmed' where id = '${first.id}'`)).rejects.toThrow(/already booked/);
  });
});

describe("browser access", () => {
  it("anon and signed-in browsers have no write privilege on any public table", async () => {
    const writable = await rows(`select c.relname, r.rolname from pg_class c cross join pg_roles r
      where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and r.rolname in ('anon', 'authenticated')
        and (has_table_privilege(r.rolname, c.oid, 'insert') or has_table_privilege(r.rolname, c.oid, 'update') or has_table_privilege(r.rolname, c.oid, 'delete')
          or has_any_column_privilege(r.rolname, c.oid, 'update'))`);
    expect(writable).toEqual([]);
  });

  it("campaign coupons are hidden from customers but visible to the owner", async () => {
    await db.exec(`insert into coupons (code, type, value, is_private) values ('LOYALONLY', 'percent', 10, true) on conflict do nothing;
      grant usage on schema public, auth to authenticated; grant select on coupons, profiles to authenticated;`);
    await asRole(db, "authenticated", CUSTOMER);
    await db.exec("set role authenticated");
    expect(await rows(`select code from coupons where code = 'LOYALONLY'`)).toEqual([]);
    expect(await rows(`select code from coupons where code = 'DOSA10'`)).toHaveLength(1);
    await asRole(db, "authenticated", OWNER);
    expect(await rows(`select code from coupons where code = 'LOYALONLY'`)).toHaveLength(1);
  });
});

it("no dish keeps the placeholder art", async () => {
  expect(await rows(`select 1 from menu_items where image_url like '%.svg'`)).toEqual([]);
});
