/**
 * ALL price / discount / tax math lives here. Used by the cart page, checkout,
 * order creation and every agent tool. Inputs come from the DB — never from the LLM.
 *
 * subtotal = Σ (unit + variant delta + addons) × qty
 * discount = coupon (min order, capped, never above subtotal)
 * packaging = settings fee for delivery / pickup (not dine-in)
 * delivery  = fee for delivery unless (subtotal − discount) ≥ free threshold
 * tax       = gst% × (subtotal − discount)
 * total     = subtotal − discount + packaging + delivery + tax + tip
 * Everything is integer paise, rounded half-up.
 */

export type OrderType = "delivery" | "pickup" | "dine_in";

export interface PricingLine {
  unitPricePaise: number;
  variantDeltaPaise?: number;
  addonPricesPaise?: number[];
  qty: number;
}

export interface PricingSettings {
  gstPercent: number;
  packagingFeePaise: number;
  deliveryFeePaise: number;
  freeDeliveryAbovePaise: number;
}

export interface PricingCoupon {
  code: string;
  type: "percent" | "flat";
  value: number; // percent (1–100) or flat paise
  minOrderPaise: number;
  maxDiscountPaise: number | null;
}

export interface PricingCart {
  lines: PricingLine[];
  orderType: OrderType;
  tipPaise?: number;
}

export interface LineTotals {
  unitTotalPaise: number;
  lineTotalPaise: number;
}

export interface CartTotals {
  lines: LineTotals[];
  subtotalPaise: number;
  discountPaise: number;
  packagingFeePaise: number;
  deliveryFeePaise: number;
  taxPaise: number;
  tipPaise: number;
  totalPaise: number;
  couponCode: string | null;
  couponMessage: string | null;
  itemCount: number;
}

const roundPaise = (n: number) => Math.round(n + Number.EPSILON);

export function unitTotal(line: PricingLine): number {
  const addons = (line.addonPricesPaise ?? []).reduce((a, b) => a + b, 0);
  return Math.max(0, line.unitPricePaise + (line.variantDeltaPaise ?? 0) + addons);
}

export function couponDiscount(subtotalPaise: number, coupon: PricingCoupon): { discountPaise: number; message: string | null } {
  if (subtotalPaise < coupon.minOrderPaise) {
    return {
      discountPaise: 0,
      message: `${coupon.code} needs a minimum order of ₹${(coupon.minOrderPaise / 100).toFixed(0)}`,
    };
  }
  let d = coupon.type === "percent" ? roundPaise((subtotalPaise * coupon.value) / 100) : coupon.value;
  if (coupon.maxDiscountPaise != null) d = Math.min(d, coupon.maxDiscountPaise);
  d = Math.max(0, Math.min(d, subtotalPaise));
  return { discountPaise: d, message: null };
}

export function computeCartTotals(cart: PricingCart, settings: PricingSettings, coupon?: PricingCoupon | null): CartTotals {
  for (const l of cart.lines) {
    if (!Number.isInteger(l.qty) || l.qty < 1) throw new Error("Invalid quantity");
  }
  const lines = cart.lines.map((l) => {
    const u = unitTotal(l);
    return { unitTotalPaise: u, lineTotalPaise: u * l.qty };
  });
  const subtotalPaise = lines.reduce((a, l) => a + l.lineTotalPaise, 0);
  const itemCount = cart.lines.reduce((a, l) => a + l.qty, 0);

  let discountPaise = 0;
  let couponCode: string | null = null;
  let couponMessage: string | null = null;
  if (coupon && subtotalPaise > 0) {
    const r = couponDiscount(subtotalPaise, coupon);
    discountPaise = r.discountPaise;
    couponMessage = r.message;
    if (r.discountPaise > 0) couponCode = coupon.code;
  }

  const empty = subtotalPaise === 0;
  const net = subtotalPaise - discountPaise;
  const packagingFeePaise = !empty && cart.orderType !== "dine_in" ? settings.packagingFeePaise : 0;
  const deliveryFeePaise =
    !empty && cart.orderType === "delivery" && net < settings.freeDeliveryAbovePaise ? settings.deliveryFeePaise : 0;
  const taxPaise = roundPaise((net * settings.gstPercent) / 100);
  const tipPaise = empty ? 0 : Math.max(0, Math.round(cart.tipPaise ?? 0));
  const totalPaise = net + packagingFeePaise + deliveryFeePaise + taxPaise + tipPaise;

  return {
    lines,
    subtotalPaise,
    discountPaise,
    packagingFeePaise,
    deliveryFeePaise,
    taxPaise,
    tipPaise,
    totalPaise,
    couponCode,
    couponMessage,
    itemCount,
  };
}
