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

/**
 * Replaces the browser's SpeechRecognition with a fake that "hears" `text`
 * (an interim chunk, then the final result) and then ends, like a real utterance.
 * Must run before the page loads.
 */
export async function fakeSpeechRecognition(page: Page, text: string) {
  await page.addInitScript((spoken: string) => {
    const result = (transcript: string, isFinal: boolean) => Object.assign([{ transcript, confidence: 0.9 }], { isFinal });
    class FakeRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onstart: ((e: Event) => void) | null = null;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: ((e: Event) => void) | null = null;
      private timers: number[] = [];
      start() {
        const half = spoken.split(" ").slice(0, 3).join(" ");
        this.timers.push(
          window.setTimeout(() => this.onresult?.({ resultIndex: 0, results: [result(half, false)] }), 150),
          window.setTimeout(() => this.onresult?.({ resultIndex: 0, results: [result(spoken, true)] }), 500),
          window.setTimeout(() => this.onend?.(new Event("end")), 700),
        );
      }
      stop() {}
      abort() {
        this.timers.forEach(clearTimeout);
      }
    }
    Object.assign(window, { SpeechRecognition: FakeRecognition, webkitSpeechRecognition: FakeRecognition });
  }, text);
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
