"use client";

import { useEffect, useState } from "react";
import { Ticket, X } from "lucide-react";

export const PENDING_COUPON_KEY = "pending_coupon";
const CODE = /^[A-Z0-9]{3,24}$/;

export function readPendingCoupon(): string | null {
  try {
    const c = localStorage.getItem(PENDING_COUPON_KEY);
    return c && CODE.test(c) ? c : null;
  } catch {
    return null;
  }
}

export function clearPendingCoupon() {
  try {
    localStorage.removeItem(PENDING_COUPON_KEY);
  } catch {
    /* storage blocked */
  }
}

/** /menu?coupon=CODE (from an email's "Order now"): remember the code; the cart applies it. */
export function CouponFromLink({ code }: { code?: string }) {
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    const c = code?.trim().toUpperCase();
    if (!c || !CODE.test(c)) return;
    try {
      localStorage.setItem(PENDING_COUPON_KEY, c);
    } catch {
      /* storage blocked — the code is still shown so they can type it */
    }
    setShown(c);
  }, [code]);
  if (!shown) return null;
  return (
    <div role="status" className="mb-4 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/8 px-4 py-3 text-sm">
      <Ticket className="size-4 shrink-0 text-primary" aria-hidden />
      <p className="flex-1">
        Offer <b className="font-mono tracking-wider">{shown}</b> will be applied in your cart.
      </p>
      <button onClick={() => setShown(null)} aria-label="Hide offer notice" className="rounded-full p-1 text-muted-foreground hover:bg-accent">
        <X className="size-4" />
      </button>
    </div>
  );
}
