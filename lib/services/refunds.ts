/**
 * Refunds — the ONLY money-moving action any agent can reach, and only through
 * the owner's `issue_refund` change after an explicit Confirm click. Money goes
 * back to the customer; nothing is ever charged. The order flips to `refunded`
 * when Razorpay's refund.processed webhook arrives.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { refundPayment } from "@/lib/razorpay";
import { formatINR } from "@/lib/format";
import type { Order } from "@/lib/types";
import { ServiceError } from "./errors";

export async function refundableAmount(order: Order) {
  const { data } = await createAdminClient().from("refunds").select("amount_paise, status").eq("order_id", order.id).neq("status", "failed");
  const already = (data ?? []).reduce((a, r) => a + (r.amount_paise as number), 0);
  return { already_refunded_paise: already, refundable_paise: Math.max(0, order.total_paise - already) };
}

export function assertRefundable(order: Order, amountPaise: number, refundable: number) {
  if (!order.razorpay_payment_id || !order.paid_at) throw new ServiceError(`${order.order_number} was never paid, so there's nothing to refund.`, "not_paid");
  if (order.status === "refunded") throw new ServiceError(`${order.order_number} is already fully refunded.`, "already_refunded");
  if (amountPaise <= 0) throw new ServiceError("Refund amount must be positive.", "invalid");
  if (amountPaise > refundable) throw new ServiceError(`At most ${formatINR(refundable)} can be refunded on ${order.order_number}.`, "too_much");
}

export async function issueRefund(order: Order, amountPaise: number | undefined, reason: string, actorUserId: string) {
  const { refundable_paise } = await refundableAmount(order);
  const amount = amountPaise ?? refundable_paise;
  assertRefundable(order, amount, refundable_paise);
  const rf = await refundPayment(order.razorpay_payment_id!, amount, { order_number: order.order_number, reason: reason.slice(0, 200) });
  const { error } = await createAdminClient().from("refunds").insert({
    order_id: order.id,
    razorpay_payment_id: order.razorpay_payment_id,
    razorpay_refund_id: rf.id,
    amount_paise: amount,
    status: rf.status === "processed" ? "processed" : "initiated",
    reason: reason.slice(0, 300),
    initiated_by: actorUserId,
  });
  if (error) console.error("refund row insert failed", error);
  return { order_number: order.order_number, refund_id: rf.id, amount_paise: amount, status: rf.status };
}
