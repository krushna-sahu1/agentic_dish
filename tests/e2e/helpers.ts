import crypto from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

export const HAS_DB = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
export const requireDb = () => test.skip(!HAS_DB, "Needs a seeded Supabase project (.env.local) — see README → Testing");

export const USERS = {
  owner: { email: "owner@example.com", password: "Owner@12345" },
  staff: { email: "staff@example.com", password: "Staff@12345" },
  customer: { email: "customer@example.com", password: "Customer@12345" },
};

export const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

export async function login(page: Page, who: keyof typeof USERS, next = "/") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(USERS[who].email);
  await page.getByLabel("Password").fill(USERS[who].password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

/** Customer chat: open the panel and send a message through the real input. */
export async function askCustomer(page: Page, text: string) {
  const panel = page.getByTestId("chat-panel");
  if (!(await panel.isVisible())) await page.getByTestId("chat-launcher").click();
  const input = panel.locator("textarea").first();
  await input.fill(text);
  await input.press("Enter");
  return panel;
}

export async function askOwner(page: Page, text: string) {
  const input = page.locator("main textarea").first();
  await input.fill(text);
  await input.press("Enter");
  return page.locator("main");
}

export async function clearCustomerCart() {
  const db = admin();
  const { data: u } = await db.from("profiles").select("user_id").eq("role", "customer").limit(50);
  const { data: cart } = await db.from("carts").select("id").eq("user_id", "33333333-3333-4333-8333-333333333333").maybeSingle();
  if (cart) await db.from("cart_items").delete().eq("cart_id", cart.id);
  return u;
}

/** Simulates Razorpay's signed payment.captured webhook (what happens after the human pays). */
export async function simulateCapturedWebhook(baseURL: string, razorpayOrderId: string, amount: number) {
  const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: `pay_e2e_${Date.now()}`, order_id: razorpayOrderId, amount, method: "upi", status: "captured" } } } });
  const sig = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!).update(body).digest("hex");
  const res = await fetch(`${baseURL}/api/payments/webhook`, { method: "POST", headers: { "content-type": "application/json", "x-razorpay-signature": sig }, body });
  expect(res.status).toBe(200);
}
