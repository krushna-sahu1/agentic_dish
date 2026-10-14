/** §7.5 owner agent flows (mock LLM → real tools, confirm cards, DB). */
import { expect, test } from "@playwright/test";
import { admin, askOwner, login, requireDb } from "./helpers";

test.describe("owner agent", () => {
  test.beforeEach(async ({ page }) => {
    requireDb();
    await login(page, "owner", "/owner");
    await page.waitForURL(/\/owner/);
  });

  test("1. which dish is performing best? → bar chart with range", async ({ page }) => {
    const main = await askOwner(page, "which dish is performing best?");
    await expect(main.getByTestId("owner-card").first()).toContainText(/Top dishes/);
    await expect(main.getByTestId("owner-card").first()).toContainText(/IST/);
  });

  test("2. how much revenue did we make? → KPI + line chart", async ({ page }) => {
    const main = await askOwner(page, "how much revenue did we make?");
    await expect(main.getByTestId("kpi-cards").first()).toContainText("Revenue");
    await expect(main.getByText(/Revenue by day/)).toBeVisible();
  });

  test("3. compare this month with last month → comparison card", async ({ page }) => {
    const main = await askOwner(page, "compare this month with last month");
    await expect(main.getByTestId("comparison-card")).toContainText("%");
  });

  test("4. when are we busiest? → heatmap", async ({ page }) => {
    const main = await askOwner(page, "when are we busiest?");
    await expect(main.getByRole("img", { name: /heatmap/ })).toBeVisible();
  });

  test("5. mark idli out of stock → confirm → customer menu shows Sold out", async ({ page, browser }) => {
    const main = await askOwner(page, "mark idli out of stock");
    await main.getByTestId("confirm-button").click();
    await expect(main.getByText(/sold out/i).last()).toBeVisible();
    const ctx = await browser.newContext();
    const shopper = await ctx.newPage();
    await shopper.goto("/menu");
    await expect(shopper.locator('[data-dish="idli"]')).toContainText(/Sold out/i);
    await ctx.close();
    await admin().from("menu_items").update({ is_available: true }).eq("slug", "idli");
  });

  test("6. increase all dosa prices by 10% → before/after table → applied", async ({ page }) => {
    const { data: before } = await admin().from("menu_items").select("id, price_paise").eq("slug", "plain-dosa").single();
    const main = await askOwner(page, "increase all dosa prices by 10%");
    await expect(main.locator("table").last()).toContainText("Before");
    await main.getByTestId("confirm-button").click();
    await expect(main.getByText(/Updated prices/)).toBeVisible();
    const { data: after } = await admin().from("menu_items").select("price_paise").eq("id", before!.id).single();
    expect(after!.price_paise).toBe(Math.round((before!.price_paise * 1.1) / 500) * 500);
    await admin().from("menu_items").update({ price_paise: before!.price_paise }).eq("id", before!.id);
  });

  test("7. what are customers complaining about? → themes", async ({ page }) => {
    const main = await askOwner(page, "what are customers complaining about?");
    await expect(main.getByText(/Read \d+ reviews/)).toBeVisible();
  });

  test("8. create coupon WEEKEND20 → confirm → created", async ({ page }) => {
    await admin().from("coupons").delete().eq("code", "WEEKEND20");
    const main = await askOwner(page, "create a coupon WEEKEND20, 20% off up to ₹100 on orders over ₹400, valid this weekend");
    await main.getByTestId("confirm-button").click();
    await expect(main.getByText(/Coupon WEEKEND20 created/)).toBeVisible();
    const { data } = await admin().from("coupons").select("value, max_discount_paise, min_order_paise").eq("code", "WEEKEND20").single();
    expect(data).toMatchObject({ value: 20, max_discount_paise: 10000, min_order_paise: 40000 });
  });

  test("9. accept order 42 and say 20 minutes → status + ETA", async ({ page }) => {
    // Make sure a paid order #42 exists today (created via the webhook RPC path only).
    const db = admin();
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).replace(/-/g, "");
    const { data: o } = await db.from("orders").select("id, status").eq("order_number", `ORD-${today}-0042`).maybeSingle();
    test.skip(!o || o.status !== "paid", "Needs a paid order #42 today (run after a few test checkouts or reseed during opening hours).");
    const main = await askOwner(page, "accept order 42 and say 20 minutes");
    await main.getByTestId("confirm-button").click();
    await expect(main.getByText(/is now Accepted/)).toBeVisible();
  });

  test("10. close the restaurant for today → checkout blocked", async ({ page }) => {
    const main = await askOwner(page, "close the restaurant for today");
    await main.getByTestId("confirm-button").click();
    await expect(main.getByText(/Checkout is blocked/)).toBeVisible();
    const { data } = await admin().from("restaurant_settings").select("is_open_override").single();
    expect(data!.is_open_override).toBe("force_closed");
    await admin().from("restaurant_settings").update({ is_open_override: "auto" }).eq("singleton", true);
  });

  test("cancel on a confirm card changes nothing", async ({ page }) => {
    const main = await askOwner(page, "mark idli out of stock");
    await main.getByTestId("cancel-button").click();
    await expect(main.getByText(/nothing was changed/)).toBeVisible();
    const { data } = await admin().from("menu_items").select("is_available").eq("slug", "idli").single();
    expect(data!.is_available).toBe(true);
  });
});

test("staff cannot use owner-only tools", async ({ page }) => {
  requireDb();
  await login(page, "staff", "/owner");
  const main = await askOwner(page, "how much revenue did we make?");
  await expect(main.getByText(/Staff accounts can't use this/)).toBeVisible();
});

test("customers are kept out of the owner area and agent", async ({ page, request }) => {
  requireDb();
  await login(page, "customer", "/owner");
  await expect(page).not.toHaveURL(/\/owner/);
  const res = await request.post("/api/copilot/owner/agent/default/run", { data: {} });
  expect([401, 403]).toContain(res.status());
});
