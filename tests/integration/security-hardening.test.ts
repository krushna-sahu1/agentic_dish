/** Security hardening migration (PGlite = real Postgres): views, RPC grants, search_path, triggers. */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "../helpers/pglite";

let db: PGlite;
const rows = async <T = Record<string, unknown>>(sql: string) => (await db.query<T>(sql)).rows;

beforeAll(async () => {
  db = await createTestDb();
}, 180_000);
afterEach(async () => {
  await db.exec("reset role");
});

describe("views", () => {
  it("run with the caller's permissions and aren't exposed to anon/authenticated", async () => {
    const opts = await rows<{ relname: string; reloptions: string[] | null }>(`select relname, reloptions from pg_class where relname in ('menu_item_stats', 'public_reviews') order by relname`);
    for (const v of opts) expect(v.reloptions, v.relname).toContain("security_invoker=true");
    const priv = await rows<Record<string, boolean>>(`select
      has_table_privilege('anon', 'public.menu_item_stats', 'select') anon_stats,
      has_table_privilege('authenticated', 'public.public_reviews', 'select') authed_reviews,
      has_table_privilege('service_role', 'public.menu_item_stats', 'select') service_stats,
      has_table_privilege('service_role', 'public.public_reviews', 'select') service_reviews`);
    expect(priv[0]).toEqual({ anon_stats: false, authed_reviews: false, service_stats: true, service_reviews: true });
  });

  it("the service role still reads them in full (menu stats + reviewer names)", async () => {
    await db.exec("set role service_role");
    const s = await rows<{ n: number; sold: number }>(`select count(*)::int n, sum(sold_30d)::int sold from menu_item_stats`);
    expect(s[0].n).toBeGreaterThanOrEqual(40);
    expect(s[0].sold).toBeGreaterThan(0);
    const r = await rows<{ n: number }>(`select count(*)::int n from public_reviews where reviewer_name is not null`);
    expect(r[0].n).toBeGreaterThan(100);
  });

  it("a direct anon query is refused", async () => {
    await db.exec("set role anon");
    await expect(db.query(`select * from public_reviews limit 1`)).rejects.toThrow(/permission denied/);
  });
});

describe("SECURITY DEFINER functions", () => {
  it("only the RLS role helpers are callable by anon/authenticated", async () => {
    const exposed = await rows<{ fn: string }>(`select p.proname fn from pg_proc p
      where p.pronamespace = 'public'::regnamespace and p.prosecdef
        and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
      order by 1`);
    expect(exposed.map((r) => r.fn)).toEqual(["current_app_role", "is_owner", "is_staff_or_owner"]);
  });

  it("the service role can call everything the app uses", async () => {
    const missing = await rows<{ fn: string }>(`select p.proname fn from pg_proc p
      where p.pronamespace = 'public'::regnamespace and p.prosecdef and not has_function_privilege('service_role', p.oid, 'execute')`);
    expect(missing).toEqual([]);
  });

  it("anon can't bump order numbers or read the timezone helper over RPC", async () => {
    await db.exec("set role anon");
    await expect(db.query(`select next_order_number()`)).rejects.toThrow(/permission denied/);
    await expect(db.query(`select restaurant_tz()`)).rejects.toThrow(/permission denied/);
    await expect(db.query(`select analytics_revenue(now() - interval '1 day', now())`)).rejects.toThrow(/permission denied/);
  });

  it("RLS helpers still work for anon (public menu policies use them)", async () => {
    await db.exec("set role anon");
    expect((await rows<{ v: boolean }>(`select is_staff_or_owner() v`))[0].v).toBe(false);
  });

  it("trigger functions still fire for non-superuser roles (new user → profile)", async () => {
    await db.exec(`create role auth_admin_test nologin; grant usage on schema auth to auth_admin_test; grant insert on auth.users to auth_admin_test;`);
    await db.exec("set role auth_admin_test");
    await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ('99999999-9999-4999-8999-999999999999', 'newbie@example.com', '{"full_name":"New Bie"}')`);
    await db.exec("reset role");
    expect((await rows(`select full_name, role from profiles where user_id = '99999999-9999-4999-8999-999999999999'`))[0]).toEqual({ full_name: "New Bie", role: "customer" });
  });
});

describe("search_path", () => {
  it("is pinned on every function the advisor flagged", async () => {
    const r = await rows<{ fn: string; cfg: string[] | null }>(`select proname fn, proconfig cfg from pg_proc
      where pronamespace = 'public'::regnamespace and proname in ('mask_phone', 'mask_email', 'guard_profile_role', 'guard_order_status', 'set_updated_at', 'is_revenue_status')`);
    expect(r).toHaveLength(6);
    for (const f of r) expect(f.cfg, f.fn).toContain("search_path=public");
  });

  it("no public function is left without a search_path", async () => {
    const r = await rows<{ fn: string }>(`select proname fn from pg_proc p
      where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
        and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`);
    expect(r).toEqual([]);
  });
});
