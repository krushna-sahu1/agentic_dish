import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const chain = () => {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq", "insert", "update", "delete", "maybeSingle", "single"]) c[m] = vi.fn(() => c);
  (c as { then: unknown }).then = (res: (v: unknown) => void) => res({ data: null, error: null });
  return c;
};
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc, from: () => chain(), auth: { admin: { getUserById: async () => ({ data: { user: null } }) } } }),
}));

import { handleRazorpayWebhook } from "@/lib/payments/webhook";
import { verifyPaymentSignature, verifyWebhookSignature } from "@/lib/razorpay";

const SECRET = "whsec_test";
const sign = (body: string, secret = SECRET) => crypto.createHmac("sha256", secret).update(body).digest("hex");
const captured = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1", order_id: "order_1", amount: 31850, method: "upi", status: "captured" } } } });

beforeEach(() => {
  process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
  rpc.mockReset();
});

describe("signatures", () => {
  it("verifies webhook HMAC and rejects tampering", () => {
    expect(verifyWebhookSignature(captured, sign(captured))).toBe(true);
    expect(verifyWebhookSignature(captured.replace("31850", "1"), sign(captured))).toBe(false);
    expect(verifyWebhookSignature(captured, null)).toBe(false);
    expect(verifyWebhookSignature(captured, sign(captured), "")).toBe(false);
  });
  it("verifies checkout callback signature (order_id|payment_id)", () => {
    const sig = crypto.createHmac("sha256", "key_secret").update("order_1|pay_1").digest("hex");
    expect(verifyPaymentSignature({ orderId: "order_1", paymentId: "pay_1", signature: sig }, "key_secret")).toBe(true);
    expect(verifyPaymentSignature({ orderId: "order_2", paymentId: "pay_1", signature: sig }, "key_secret")).toBe(false);
  });
});

describe("webhook handler", () => {
  it("401s on a bad signature and never touches the DB", async () => {
    const r = await handleRazorpayWebhook(captured, "deadbeef");
    expect(r.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("marks the order paid via the mark_order_paid RPC with Razorpay's amount", async () => {
    rpc.mockResolvedValueOnce({ data: { ok: true, order_id: "o1" }, error: null });
    const r = await handleRazorpayWebhook(captured, sign(captured));
    expect(r.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("mark_order_paid", expect.objectContaining({ p_razorpay_order_id: "order_1", p_razorpay_payment_id: "pay_1", p_amount_paise: 31850, p_method: "upi" }));
  });

  it("is idempotent: a replayed event reports duplicate and skips side effects", async () => {
    rpc.mockResolvedValueOnce({ data: { ok: true, duplicate: true, order_id: "o1" }, error: null });
    const r = await handleRazorpayWebhook(captured, sign(captured));
    expect(r.body).toMatchObject({ duplicate: true });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("handles payment.failed and refund.processed", async () => {
    const failed = JSON.stringify({ event: "payment.failed", payload: { payment: { entity: { id: "pay_2", order_id: "order_1", amount: 100, status: "failed" } } } });
    rpc.mockResolvedValueOnce({ data: { ok: true }, error: null });
    await handleRazorpayWebhook(failed, sign(failed));
    expect(rpc).toHaveBeenLastCalledWith("mark_payment_failed", expect.objectContaining({ p_razorpay_payment_id: "pay_2" }));
    const refund = JSON.stringify({ event: "refund.processed", payload: { refund: { entity: { id: "rfnd_1", payment_id: "pay_1", amount: 31850, status: "processed" } } } });
    rpc.mockResolvedValueOnce({ data: { ok: true }, error: null });
    await handleRazorpayWebhook(refund, sign(refund));
    expect(rpc).toHaveBeenLastCalledWith("mark_order_refunded", expect.objectContaining({ p_razorpay_refund_id: "rfnd_1" }));
  });

  it("ignores unknown events", async () => {
    const other = JSON.stringify({ event: "order.created", payload: {} });
    const r = await handleRazorpayWebhook(other, sign(other));
    expect(r).toMatchObject({ status: 200, body: { ignored: "order.created" } });
  });
});
