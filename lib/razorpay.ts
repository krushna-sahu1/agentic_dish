/**
 * Razorpay server integration.
 *
 * PAYMENT SAFETY: this module only (a) creates Razorpay *orders* (an amount the
 * customer may choose to pay), (b) verifies signatures, (c) reads payment state
 * and (d) issues refunds. There is deliberately NO capture/charge function —
 * payments are made by the human in Razorpay Checkout and confirmed by the
 * webhook (app/api/payments/webhook). Agent code must never import the webhook
 * processing in lib/payments/ — enforced by tests/unit/payment-safety.test.ts.
 */
import crypto from "node:crypto";

const API = "https://api.razorpay.com/v1";

export function razorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function authHeader() {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) throw new Error("Razorpay is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).");
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: authHeader(), ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as { error?: { description?: string } })?.error?.description ?? res.statusText;
    throw new Error(`Razorpay ${path} failed: ${msg}`);
  }
  return body as T;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

/** Creates a Razorpay order the customer can pay. Does not charge anything. */
export function createRazorpayOrder(input: { amountPaise: number; receipt: string; notes?: Record<string, string> }) {
  return call<RazorpayOrder>("/orders", {
    method: "POST",
    body: JSON.stringify({ amount: input.amountPaise, currency: "INR", receipt: input.receipt, notes: input.notes ?? {} }),
  });
}

export interface RazorpayPayment {
  id: string;
  order_id: string;
  amount: number;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method: string;
}

/** Read-only: payments made against an order (used for reconciliation of missed webhooks). */
export function fetchOrderPayments(razorpayOrderId: string) {
  return call<{ items: RazorpayPayment[] }>(`/orders/${razorpayOrderId}/payments`);
}

/** Refund (full when amount omitted). Only reachable from the owner's confirmed issue_refund flow. */
export function refundPayment(paymentId: string, amountPaise?: number, notes?: Record<string, string>) {
  return call<{ id: string; amount: number; status: string }>(`/payments/${paymentId}/refund`, {
    method: "POST",
    body: JSON.stringify({ ...(amountPaise ? { amount: amountPaise } : {}), notes: notes ?? {} }),
  });
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export function hmacSha256(body: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

/** Checkout success callback signature: HMAC(order_id|payment_id, key_secret). */
export function verifyPaymentSignature(input: { orderId: string; paymentId: string; signature: string }, secret = process.env.RAZORPAY_KEY_SECRET ?? "") {
  if (!secret) return false;
  return safeEqual(hmacSha256(`${input.orderId}|${input.paymentId}`, secret), input.signature);
}

/** Webhook signature: HMAC(raw body, webhook secret). */
export function verifyWebhookSignature(rawBody: string, signature: string | null, secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "") {
  if (!secret || !signature) return false;
  return safeEqual(hmacSha256(rawBody, secret), signature);
}
