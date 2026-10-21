"use client";

import { useEffect, useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatINRExact } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (ev: string, cb: (r: unknown) => void) => void };
  }
}

function loadCheckout(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export interface PayButtonProps {
  orderId: string;
  orderNumber: string;
  razorpayOrderId: string;
  keyId: string;
  amountPaise: number;
  restaurantName: string;
  prefill: { name: string | null; email: string | null; contact: string | null };
  onPaid?: () => void;
  onFailed?: (reason: string) => void;
}

export type PayState = "idle" | "opening" | "verifying" | "paid" | "failed";

/**
 * The ONLY path to payment: a human click opens Razorpay Checkout. The AI can
 * render this button but can never press it. Success is confirmed by the
 * webhook (we wait for the order to flip to `paid` via Realtime).
 */
export function PayButton(p: PayButtonProps) {
  const [state, setState] = useState<PayState>("idle");
  const [error, setError] = useState<string | null>(null);

  // Source of truth: the order row changes to paid when the webhook lands.
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const supabase = createClient();
    const ch = supabase
      .channel(`order-pay-${p.orderId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${p.orderId}` }, (payload) => {
        const status = (payload.new as { status: string }).status;
        if (["paid", "accepted", "preparing", "ready", "out_for_delivery", "completed"].includes(status)) {
          setState("paid");
          p.onPaid?.();
        } else if (status === "payment_failed") {
          setState("failed");
          setError("Payment failed. You can try again.");
        } else if (status === "cancelled") {
          setState("failed");
          setError("This checkout expired. Ask me to checkout again.");
        }
      })
      .subscribe();
    return () => void supabase.removeChannel(ch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.orderId]);

  const pay = async () => {
    setError(null);
    setState("opening");
    const ok = await loadCheckout();
    if (!ok || !window.Razorpay) {
      setState("failed");
      setError("Couldn't load the payment window. Check your connection and try again.");
      return;
    }
    const rzp = new window.Razorpay({
      key: p.keyId,
      amount: p.amountPaise,
      currency: "INR",
      name: p.restaurantName,
      description: `Order ${p.orderNumber}`,
      order_id: p.razorpayOrderId,
      prefill: { name: p.prefill.name ?? undefined, email: p.prefill.email ?? undefined, contact: p.prefill.contact ?? undefined },
      theme: { color: "#c2410c" },
      handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        setState("verifying");
        await fetch("/api/payments/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(resp) }).catch(() => null);
        // Wait for the webhook → Realtime update (handled above).
      },
      modal: { ondismiss: () => setState((s) => (s === "opening" ? "idle" : s)) },
    });
    rzp.on("payment.failed", (r) => {
      const reason = (r as { error?: { description?: string } })?.error?.description ?? "Payment failed";
      setState("failed");
      setError(reason);
      p.onFailed?.(reason);
    });
    rzp.open();
  };

  if (state === "paid") return <p className="text-sm font-medium text-success" role="status">✓ Payment received — your order is with the kitchen.</p>;

  return (
    <div className="w-full space-y-1">
      <Button size="lg" className="w-full" onClick={pay} disabled={state === "opening" || state === "verifying"} data-testid="pay-button">
        {state === "verifying" ? <Loader2 className="animate-spin" /> : <CreditCard />}
        {state === "verifying" ? "Confirming payment…" : `Pay ${formatINRExact(p.amountPaise)}`}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-center text-[11px] text-muted-foreground">Secure payment by Razorpay · UPI, cards, netbanking, wallets</p>
    </div>
  );
}
