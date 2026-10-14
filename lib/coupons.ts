/** Coupon eligibility rules (pure). Discount math itself lives in lib/pricing.ts. */

export interface CouponRow {
  id: string;
  code: string;
  description: string | null;
  type: "percent" | "flat";
  value: number;
  min_order_paise: number;
  max_discount_paise: number | null;
  valid_from: string | null;
  valid_to: string | null;
  usage_limit: number | null;
  per_user_limit: number | null;
  is_active: boolean;
}

export interface CouponUsage {
  totalRedemptions: number;
  userRedemptions: number;
}

export type CouponCheck = { ok: true } | { ok: false; reason: string };

export function checkCouponEligibility(c: CouponRow | null, usage: CouponUsage, now = new Date()): CouponCheck {
  if (!c) return { ok: false, reason: "That coupon code doesn't exist." };
  if (!c.is_active) return { ok: false, reason: `${c.code} is no longer active.` };
  if (c.valid_from && new Date(c.valid_from) > now) return { ok: false, reason: `${c.code} isn't valid yet.` };
  if (c.valid_to && new Date(c.valid_to) < now) return { ok: false, reason: `${c.code} has expired.` };
  if (c.usage_limit != null && usage.totalRedemptions >= c.usage_limit)
    return { ok: false, reason: `${c.code} has reached its usage limit.` };
  if (c.per_user_limit != null && usage.userRedemptions >= c.per_user_limit)
    return { ok: false, reason: `You've already used ${c.code} the maximum number of times.` };
  return { ok: true };
}

export function toPricingCoupon(c: CouponRow) {
  return {
    code: c.code,
    type: c.type,
    value: c.value,
    minOrderPaise: c.min_order_paise,
    maxDiscountPaise: c.max_discount_paise,
  };
}

export function describeCoupon(c: Pick<CouponRow, "type" | "value" | "min_order_paise" | "max_discount_paise">): string {
  const off = c.type === "percent" ? `${c.value}% off` : `₹${c.value / 100} off`;
  const cap = c.type === "percent" && c.max_discount_paise ? ` up to ₹${c.max_discount_paise / 100}` : "";
  const min = c.min_order_paise ? ` on orders above ₹${c.min_order_paise / 100}` : "";
  return `${off}${cap}${min}`;
}
