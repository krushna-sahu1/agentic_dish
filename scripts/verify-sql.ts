/**
 * Offline sanity check for the migrations + seed using PGlite (Postgres in WASM).
 * Stubs the small part of Supabase's `auth` schema the SQL relies on, then runs
 * every migration, the seed and a few analytics / payment-safety assertions.
 *
 *   npx tsx scripts/verify-sql.ts
 */
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..", "supabase");

const AUTH_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema extensions;
create table auth.users (
  instance_id uuid, id uuid primary key, aud text, role text, email text unique,
  encrypted_password text, email_confirmed_at timestamptz, phone text,
  raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
  confirmation_token text, email_change text, email_change_token_new text, recovery_token text
);
create table auth.identities (
  id uuid primary key, user_id uuid references auth.users(id), provider_id text, identity_data jsonb,
  provider text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz
);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
`;

async function main() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(AUTH_STUB);

  const migrations = readdirSync(join(root, "migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const file of migrations) {
    process.stdout.write(`migration ${file} ... `);
    await db.exec(readFileSync(join(root, "migrations", file), "utf8"));
    console.log("ok");
  }
  process.stdout.write("seed.sql ... ");
  const t0 = Date.now();
  await db.exec(readFileSync(join(root, "seed.sql"), "utf8"));
  console.log(`ok (${Date.now() - t0} ms)`);

  await db.exec(`set request.jwt.claim.role = 'service_role'`);
  const one = async <T = Record<string, unknown>>(sql: string) => (await db.query<T>(sql)).rows;

  console.log("counts:", (await one(`select
      (select count(*) from menu_items) items,
      (select count(*) from categories) categories,
      (select count(*) from profiles) profiles,
      (select count(*) from orders) orders,
      (select count(*) from order_items) order_items,
      (select count(*) from reviews) reviews,
      (select count(*) from payments) payments`))[0]);

  console.log("revenue last 7d:", await one(
    `select bucket::date, revenue_paise, orders from analytics_revenue(now() - interval '7 days', now(), 'day')`,
  ));
  console.log("top items:", await one(`select name, qty, revenue_paise from analytics_top_items(now() - interval '7 days', now(), 5, 'revenue')`));
  console.log("customer stats:", JSON.stringify((await one(`select analytics_customer_stats(now() - interval '30 days', now()) s`))[0]).slice(0, 300));
  console.log("compare:", JSON.stringify((await one(`select analytics_compare_periods(now() - interval '14 days', now() - interval '7 days', now() - interval '7 days', now()) s`))[0]));
  for (const fn of ["analytics_bottom_items(now() - interval '7 days', now(), 3)", "analytics_category_breakdown(now() - interval '30 days', now())",
    "analytics_peak_hours(now() - interval '30 days', now())", "analytics_order_type_split(now() - interval '30 days', now())",
    "analytics_coupon_performance(now() - interval '30 days', now())", "analytics_ratings(now() - interval '30 days', now())",
    "analytics_cancellations(now() - interval '90 days', now())", "analytics_payment_methods(now() - interval '30 days', now())",
    "analytics_item_daily(now() - interval '3 days', now())"]) {
    const rows = await one(`select * from ${fn}`);
    console.log(`${fn.split("(")[0]}: ${rows.length} rows`, rows[0] ?? "");
  }

  // ---- payment-safety assertions ----
  const expectFail = async (label: string, sql: string) => {
    try {
      await db.exec(sql);
      throw new Error(`EXPECTED FAILURE but succeeded: ${label}`);
    } catch (e) {
      if ((e as Error).message.startsWith("EXPECTED")) throw e;
      console.log(`blocked as expected: ${label} -> ${(e as Error).message}`);
    }
  };
  const cust = "33333333-3333-4333-8333-333333333333";
  await db.exec(`insert into orders (order_number, user_id, order_type, subtotal_paise, total_paise, razorpay_order_id)
                 values (next_order_number(), '${cust}', 'pickup', 10000, 12000, 'order_test_1')`);
  await expectFail("direct update to paid", `update orders set status = 'paid' where razorpay_order_id = 'order_test_1'`);
  await expectFail("set_order_status to paid", `select set_order_status((select id from orders where razorpay_order_id='order_test_1'), 'paid', null)`);
  await expectFail("accept unpaid order", `select set_order_status((select id from orders where razorpay_order_id='order_test_1'), 'accepted', null)`);
  await expectFail("insert already-paid order", `insert into orders (order_number, user_id, order_type, subtotal_paise, total_paise, status)
                 values ('X-1', '${cust}', 'pickup', 1, 1, 'paid')`);
  const paid = await one(`select mark_order_paid('order_test_1', 'pay_test_1', 12000, 'upi', '{}'::jsonb) r`);
  console.log("webhook mark_order_paid:", paid[0]);
  const dup = await one(`select mark_order_paid('order_test_1', 'pay_test_1', 12000, 'upi', '{}'::jsonb) r`);
  console.log("webhook replay (idempotent):", dup[0]);
  console.log("timeline:", await one(`select status, note from order_status_events where order_id = (select id from orders where razorpay_order_id='order_test_1') order by created_at`));
  await db.exec(`select set_order_status((select id from orders where razorpay_order_id='order_test_1'), 'accepted', null, 'Accepted', 20)`);
  console.log("accepted ok; order number:", (await one(`select order_number, status from orders where razorpay_order_id='order_test_1'`))[0]);

  // analytics guard
  await db.exec(`set request.jwt.claim.sub = '${cust}'; set request.jwt.claim.role = 'authenticated';`);
  await db.exec(`set role authenticated`).catch(() => undefined);
  await expectFail("customer calling analytics", `select * from analytics_revenue(now() - interval '1 day', now())`);
  console.log("\nAll SQL checks passed.");
}

main().catch((e) => {
  console.error("\nSQL verification FAILED:", e);
  process.exit(1);
});
