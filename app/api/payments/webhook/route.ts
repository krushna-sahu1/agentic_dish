import { NextResponse, type NextRequest } from "next/server";
import { handleRazorpayWebhook } from "@/lib/payments/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Razorpay → us. Signature-verified, idempotent. The source of truth for `paid`. */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const out = await handleRazorpayWebhook(raw, req.headers.get("x-razorpay-signature"));
  return NextResponse.json(out.body, { status: out.status });
}
