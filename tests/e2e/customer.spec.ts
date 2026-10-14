/** §6.4 customer agent flows (mock LLM → real tools, guards, DB and cards). */
import { expect, test } from "@playwright/test";
import { admin, askCustomer, clearCustomerCart, login, requireDb, simulateCapturedWebhook } from "./helpers";

test.describe("customer agent", () => {
  test.beforeEach(async ({ page }) => {
    requireDb();
    await clearCustomerCart();
    await login(page, "customer", "/menu");
  });

  test("1. add one paneer masala dosa → item added, badge updates", async ({ page }) => {
    const panel = await askCustomer(page, "add one paneer masala dosa to my cart");
    await expect(panel.getByTestId("cart-summary")).toContainText("Paneer Masala Dosa");
    await expect(page.getByTestId("cart-count")).toHaveText("1");
  });

  test("2. which dish is spicy? → cards with spice ≥ 3", async ({ page }) => {
    const panel = await askCustomer(page, "which dish is spicy?");
    const cards = panel.getByTestId("mini-dish");
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(2);
    await expect(panel.getByTestId("dish-carousel").first()).toContainText(/Mysore Masala Dosa|Gobi 65|Mirchi Bajji|Chettinad/);
  });

  test("3. what goes well with spicy food? → cooling pairings with Add buttons", async ({ page }) => {
    const panel = await askCustomer(page, "what goes well with spicy food?");
    await expect(panel.getByTestId("dish-carousel")).toContainText(/Neer Mor|Curd Rice|Lassi/);
    await expect(panel.getByRole("button", { name: /^Add / }).first()).toBeVisible();
  });

  test("4. veg dinner for 4 under ₹1000 → combo card with Add all", async ({ page }) => {
    const panel = await askCustomer(page, "veg dinner for 4 under ₹1000");
    await expect(panel.getByText(/within budget/)).toBeVisible();
    await panel.getByTestId("add-all").click();
    await expect(page.getByTestId("cart-count")).not.toHaveText("0");
  });

  test("5. make the dosa less spicy and add extra chutney", async ({ page }) => {
    await askCustomer(page, "add one masala dosa to my cart");
    await expect(page.getByTestId("cart-count")).toHaveText("1");
    const panel = await askCustomer(page, "make the dosa less spicy and add extra chutney");
    await expect(panel.getByTestId("cart-summary").last()).toContainText(/Extra Chutney/);
    await expect(panel.getByTestId("cart-summary").last()).toContainText(/less spicy/);
  });

  test("6. checkout → Pay button → (human pays) → webhook → paid confirmation", async ({ page, baseURL }) => {
    test.skip(!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_WEBHOOK_SECRET, "Needs Razorpay test keys");
    await admin().from("restaurant_settings").update({ is_open_override: "force_open", accepting_orders: true }).eq("singleton", true);
    await askCustomer(page, "add two masala dosa to my cart");
    await expect(page.getByTestId("cart-count")).toHaveText("2");
    await askCustomer(page, "checkout please");
    const pay = page.getByTestId("pay-button");
    await expect(pay).toContainText("Pay ₹");
    // The AI cannot press Pay. Simulate what happens after the human pays in Razorpay: the signed webhook.
    const { data: order } = await admin().from("orders").select("razorpay_order_id, total_paise, status").eq("user_id", "33333333-3333-4333-8333-333333333333").eq("status", "awaiting_payment").order("created_at", { ascending: false }).limit(1).single();
    expect(order!.status).toBe("awaiting_payment");
    await simulateCapturedWebhook(baseURL!, order!.razorpay_order_id, order!.total_paise);
    await expect(page.getByText(/Payment received/).first()).toBeVisible();
    await admin().from("restaurant_settings").update({ is_open_override: "auto" }).eq("singleton", true);
  });

  test("7. where's my food? → status timeline card", async ({ page }) => {
    const panel = await askCustomer(page, "where's my food?");
    await expect(panel.getByTestId("order-status")).toBeVisible();
  });

  test("8. order my usual → previous combo added", async ({ page }) => {
    const panel = await askCustomer(page, "order my usual");
    await expect(panel.getByTestId("cart-summary")).toContainText("Masala Dosa");
    await expect(panel.getByTestId("cart-summary")).toContainText("Filter Coffee");
  });

  test("9. book a table for 4 tomorrow 8pm → confirm card → reservation", async ({ page }) => {
    const panel = await askCustomer(page, "book a table for 4 tomorrow 8pm");
    const confirm = panel.getByTestId("confirm-button");
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(panel.getByText(/Booked! Table/)).toBeVisible();
  });

  test("10. peanut allergy → warning before adding", async ({ page }) => {
    const panel = await askCustomer(page, "add one lemon rice to my cart");
    await expect(panel.getByTestId("allergen-warning")).toContainText(/peanut/i);
    await expect(page.getByTestId("cart-count")).toHaveCount(0);
  });

  test("manual UI and agent share the same cart", async ({ page }) => {
    await askCustomer(page, "add one paneer masala dosa to my cart");
    await expect(page.getByTestId("cart-count")).toHaveText("1");
    await page.goto("/cart");
    await expect(page.getByTestId("cart-line")).toContainText("Paneer Masala Dosa");
  });
});

test("logged-out visitors can ask menu questions but get a login card for cart actions @mobile", async ({ page }) => {
  requireDb();
  await page.goto("/");
  const panel = await askCustomer(page, "add one idli to my cart");
  await expect(panel.getByRole("link", { name: /Log in/ })).toBeVisible();
});
