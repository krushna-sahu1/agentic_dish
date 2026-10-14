import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { verifyPaymentSignature } from "@/lib/razorpay";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const body = z.object({ razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string() });

/**
 * Checkout success callback → signature check for an optimistic "payment
 * received" UI. Does NOT mark the order paid; only the webhook does.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { data: order } = await createAdminClient()
    .from("orders")
    .select("id, order_number, status")
    .eq("razorpay_order_id", parsed.data.razorpay_order_id)
    .eq("user_id", user.userId)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "not found" }, { status: 404 });
  const valid = verifyPaymentSignature({
    orderId: parsed.data.razorpay_order_id,
    paymentId: parsed.data.razorpay_payment_id,
    signature: parsed.data.razorpay_signature,
  });
  return NextResponse.json({ valid, order_id: order.id, order_number: order.order_number, status: order.status });
}
