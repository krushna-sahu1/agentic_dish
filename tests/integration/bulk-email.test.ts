/** Bulk email SQL (PGlite = real Postgres): who each group reaches, unsubscribes, access. */
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asRole, createTestDb } from "../helpers/pglite";

const OWNER = "11111111-1111-4111-8111-111111111111";
let db: PGlite;

const rows = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const audience = (group: string, extra = "") => rows<{ email: string; full_name: string | null }>(`select * from email_audience('${group}'${extra})`);

beforeAll(async () => {
  db = await createTestDb();
  await asRole(db, "service_role");
}, 180_000);

describe("email_audience", () => {
  it("all = every customer with an email, never owner/staff", async () => {
    const all = await audience("all");
    const customers = await rows<{ n: number }>(`select count(*)::int n from profiles p join auth.users u on u.id = p.user_id where p.role = 'customer' and u.email <> ''`);
    expect(all.length).toBe(customers[0].n);
    expect(all.map((r) => r.email)).not.toContain("owner@example.com");
    expect(all.map((r) => r.email)).not.toContain("staff@example.com");
  });

  it("loyal / big spenders / inactive / new match the order history", async () => {
    const expected = async (having: string) =>
      (
        await rows<{ n: number }>(`select count(*)::int n from (
          select o.user_id from orders o join profiles p on p.user_id = o.user_id
           where p.role = 'customer' and is_revenue_status(o.status) group by o.user_id having ${having}) x`)
      )[0].n;
    expect((await audience("loyal", ", p_min_orders => 3")).length).toBe(await expected("count(*) >= 3"));
    expect((await audience("big_spenders", ", p_min_spend_paise => 300000")).length).toBe(await expected("sum(o.total_paise) >= 300000"));
    expect((await audience("inactive", ", p_days => 14")).length).toBe(await expected("max(o.created_at) < now() - interval '14 days'"));
    expect((await audience("new", ", p_days => 30")).length).toBe(await expected("min(o.created_at) >= now() - interval '30 days'"));
    expect((await audience("loyal", ", p_min_orders => 3")).length).toBeGreaterThan(0);
  });

  it("ordered_dish finds customers who bought that dish", async () => {
    const dish = (await rows<{ id: string; n: number }>(`select oi.menu_item_id id, count(distinct o.user_id)::int n from order_items oi join orders o on o.id = oi.order_id
       join profiles p on p.user_id = o.user_id where p.role = 'customer' and is_revenue_status(o.status) and oi.menu_item_id is not null group by 1 order by 2 desc limit 1`))[0];
    expect((await audience("ordered_dish", `, p_dish_id => '${dish.id}'`)).length).toBe(dish.n);
  });

  it("specific addresses: lower-cased, de-duplicated, names filled in for customers", async () => {
    const r = await audience("emails", `, p_emails => array['Customer@Example.com', 'customer@example.com', 'friend@elsewhere.in']`);
    expect(r).toEqual([
      { user_id: "33333333-3333-4333-8333-333333333333", email: "customer@example.com", full_name: "Ananya Das" },
      { user_id: null, email: "friend@elsewhere.in", full_name: null },
    ]);
  });

  it("unsubscribed addresses are never included", async () => {
    await db.query(`insert into email_unsubscribes (email) values ('customer@example.com'), ('friend@elsewhere.in')`);
    expect((await audience("all")).map((r) => r.email)).not.toContain("customer@example.com");
    expect(await audience("emails", `, p_emails => array['customer@example.com', 'friend@elsewhere.in']`)).toEqual([]);
    await db.query(`delete from email_unsubscribes`);
  });

  it("only the service role can list emails (not even the owner's own JWT)", async () => {
    await asRole(db, "authenticated", OWNER);
    await expect(audience("all")).rejects.toThrow(/denied/);
    await asRole(db, "service_role");
  });
});

describe("draft coupons", () => {
  it("coupons default to not-draft; drafts are a separate, inactive state", async () => {
    expect((await rows<{ n: number }>(`select count(*)::int n from coupons where is_draft`))[0].n).toBe(0);
    await db.query(`insert into coupons (code, type, value, is_active, is_draft) values ('THANKS10AB', 'percent', 10, false, true)`);
    expect((await rows(`select is_active, is_draft from coupons where code = 'THANKS10AB'`))[0]).toEqual({ is_active: false, is_draft: true });
  });
});
