/**
 * Razorpay webhook processing — the ONLY code path that can mark an order paid.
 * Never import this from lib/agents/** (enforced by tests/unit/payment-safety.test.ts).
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { orderConfirmationEmail, sendEmail } from "@/lib/email";
import { verifyWebhookSignature } from "@/lib/razorpay";

interface RzpPaymentEntity {
  id: string;
  order_id: string;
  amount: number;
  method?: string;
  status: string;
}
interface RzpRefundEntity {
  id: string;
  payment_id: string;
  amount: number;
  status: string;
}
export interface RazorpayEvent {
  event: string;
  payload: {
    payment?: { entity: RzpPaymentEntity };
    refund?: { entity: RzpRefundEntity };
  };
}

export type WebhookOutcome = { status: number; body: Record<string, unknown> };

export async function handleRazorpayWebhook(rawBody: string, signature: string | null): Promise<WebhookOutcome> {
  if (!verifyWebhookSignature(rawBody, signature)) return { status: 401, body: { error: "invalid signature" } };
  let evt: RazorpayEvent;
  try {
    evt = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: "invalid json" } };
  }
  return processEvent(evt);
}

/** Exported for reconciliation of missed webhooks (data fetched server-side from Razorpay). */
export async function processEvent(evt: RazorpayEvent): Promise<WebhookOutcome> {
  const db = createAdminClient();
  switch (evt.event) {
    case "payment.captured":
    case "order.paid": {
      const p = evt.payload.payment?.entity;
      if (!p) return { status: 200, body: { ignored: "no payment entity" } };
      const { data, error } = await db.rpc("mark_order_paid", {
        p_razorpay_order_id: p.order_id,
        p_razorpay_payment_id: p.id,
        p_amount_paise: p.amount,
        p_method: p.method ?? null,
        p_raw: evt as unknown as Record<string, unknown>,
      });
      if (error) return { status: 500, body: { error: error.message } };
      const r = data as { ok: boolean; duplicate?: boolean; order_id?: string };
      if (r.ok && !r.duplicate && r.order_id) await afterPaid(r.order_id);
      return { status: 200, body: r };
    }
    case "payment.failed": {
      const p = evt.payload.payment?.entity;
      if (!p) return { status: 200, body: { ignored: "no payment entity" } };
      const { data, error } = await db.rpc("mark_payment_failed", {
        p_razorpay_order_id: p.order_id,
        p_razorpay_payment_id: p.id,
        p_amount_paise: p.amount,
        p_method: p.method ?? null,
        p_raw: evt as unknown as Record<string, unknown>,
      });
      if (error) return { status: 500, body: { error: error.message } };
      return { status: 200, body: data as Record<string, unknown> };
    }
    case "refund.processed": {
      const rf = evt.payload.refund?.entity;
      if (!rf) return { status: 200, body: { ignored: "no refund entity" } };
      const { data, error } = await db.rpc("mark_order_refunded", {
        p_razorpay_refund_id: rf.id,
        p_razorpay_payment_id: rf.payment_id,
        p_amount_paise: rf.amount,
        p_raw: evt as unknown as Record<string, unknown>,
      });
      if (error) return { status: 500, body: { error: error.message } };
      return { status: 200, body: data as Record<string, unknown> };
    }
    default:
      return { status: 200, body: { ignored: evt.event } };
  }
}

/** Side effects after the first successful capture: clear cart, alert owner, email customer. */
async function afterPaid(orderId: string) {
  const db = createAdminClient();
  const { data: order } = await db.from("orders").select("*, order_items(name_snapshot, qty, line_total_paise)").eq("id", orderId).single();
  if (!order) return;
  const { data: cart } = await db.from("carts").select("id").eq("user_id", order.user_id).maybeSingle();
  if (cart) {
    await db.from("cart_items").delete().eq("cart_id", cart.id);
    await db.from("carts").update({ coupon_code: null, tip_paise: 0, notes: null, scheduled_for: null }).eq("id", cart.id);
  }
  await db.from("owner_alerts").insert({
    type: "new_order",
    title: `New order ${order.order_number}`,
    body: `${order.order_items.length} item(s) · ₹${(order.total_paise / 100).toFixed(0)} · ${order.order_type}`,
    severity: "info",
    data: { order_id: order.id },
  });
  const { data: user } = await db.auth.admin.getUserById(order.user_id);
  await sendEmail(user?.user?.email, `Order ${order.order_number} confirmed`, orderConfirmationEmail({ ...order, items: order.order_items }));
}
