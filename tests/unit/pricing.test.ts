import { describe, expect, it } from "vitest";
import { computeCartTotals, couponDiscount, unitTotal, type PricingSettings } from "@/lib/pricing";

const S: PricingSettings = { gstPercent: 5, packagingFeePaise: 1500, deliveryFeePaise: 3000, freeDeliveryAbovePaise: 49900 };

describe("unitTotal", () => {
  it("adds variant delta and add-ons", () => {
    expect(unitTotal({ unitPricePaise: 12000, variantDeltaPaise: 2000, addonPricesPaise: [2000, 3000], qty: 1 })).toBe(19000);
  });
  it("never goes negative", () => {
    expect(unitTotal({ unitPricePaise: 5000, variantDeltaPaise: -9000, qty: 1 })).toBe(0);
  });
});

describe("computeCartTotals", () => {
  it("delivery under the free threshold pays delivery + packaging + 5% GST", () => {
    const t = computeCartTotals({ lines: [{ unitPricePaise: 17000, qty: 1 }, { unitPricePaise: 5000, qty: 2 }], orderType: "delivery" }, S);
    expect(t.subtotalPaise).toBe(27000);
    expect(t.packagingFeePaise).toBe(1500);
    expect(t.deliveryFeePaise).toBe(3000);
    expect(t.taxPaise).toBe(1350);
    expect(t.totalPaise).toBe(27000 + 1500 + 3000 + 1350);
    expect(t.itemCount).toBe(3);
  });

  it("free delivery at/above threshold (after discount)", () => {
    const t = computeCartTotals({ lines: [{ unitPricePaise: 50000, qty: 1 }], orderType: "delivery" }, S);
    expect(t.deliveryFeePaise).toBe(0);
    const withCoupon = computeCartTotals({ lines: [{ unitPricePaise: 50000, qty: 1 }], orderType: "delivery" }, S, { code: "X", type: "flat", value: 1000, minOrderPaise: 0, maxDiscountPaise: null });
    expect(withCoupon.deliveryFeePaise).toBe(3000); // 49,000 < 49,900
  });

  it("pickup has packaging but no delivery; dine-in has neither", () => {
    const pickup = computeCartTotals({ lines: [{ unitPricePaise: 10000, qty: 1 }], orderType: "pickup" }, S);
    expect([pickup.packagingFeePaise, pickup.deliveryFeePaise]).toEqual([1500, 0]);
    const dine = computeCartTotals({ lines: [{ unitPricePaise: 10000, qty: 1 }], orderType: "dine_in" }, S);
    expect([dine.packagingFeePaise, dine.deliveryFeePaise]).toEqual([0, 0]);
    expect(dine.totalPaise).toBe(10500);
  });

  it("GST applies to subtotal minus discount; tip is added untaxed", () => {
    const t = computeCartTotals({ lines: [{ unitPricePaise: 40000, qty: 1 }], orderType: "dine_in", tipPaise: 2000 }, S, { code: "DOSA10", type: "percent", value: 10, minOrderPaise: 20000, maxDiscountPaise: 6000 });
    expect(t.discountPaise).toBe(4000);
    expect(t.taxPaise).toBe(1800);
    expect(t.tipPaise).toBe(2000);
    expect(t.totalPaise).toBe(40000 - 4000 + 1800 + 2000);
    expect(t.couponCode).toBe("DOSA10");
  });

  it("caps percent discounts and reports min-order failures", () => {
    expect(couponDiscount(200000, { code: "F", type: "percent", value: 20, minOrderPaise: 80000, maxDiscountPaise: 15000 }).discountPaise).toBe(15000);
    const r = couponDiscount(30000, { code: "F", type: "percent", value: 20, minOrderPaise: 80000, maxDiscountPaise: 15000 });
    expect(r.discountPaise).toBe(0);
    expect(r.message).toMatch(/minimum order/);
  });

  it("flat discount never exceeds subtotal", () => {
    expect(couponDiscount(3000, { code: "W", type: "flat", value: 5000, minOrderPaise: 0, maxDiscountPaise: null }).discountPaise).toBe(3000);
  });

  it("rounds to whole paise (half-up)", () => {
    const t = computeCartTotals({ lines: [{ unitPricePaise: 1010, qty: 1 }], orderType: "dine_in" }, S);
    expect(t.taxPaise).toBe(51); // 50.5 → 51
    expect(Number.isInteger(t.totalPaise)).toBe(true);
  });

  it("empty cart has no fees", () => {
    const t = computeCartTotals({ lines: [], orderType: "delivery", tipPaise: 2000 }, S);
    expect(t.totalPaise).toBe(0);
  });

  it("rejects invalid quantities", () => {
    expect(() => computeCartTotals({ lines: [{ unitPricePaise: 100, qty: 0 }], orderType: "pickup" }, S)).toThrow();
    expect(() => computeCartTotals({ lines: [{ unitPricePaise: 100, qty: 1.5 }], orderType: "pickup" }, S)).toThrow();
  });

  it("matches the seed SQL formula exactly (cross-check)", () => {
    // seed.sql: pack 1500 for delivery/pickup, delivery 3000 if (sub-disc) < 49900, tax round(5%)
    for (const sub of [6000, 25000, 49899, 49900, 123456]) {
      const t = computeCartTotals({ lines: [{ unitPricePaise: sub, qty: 1 }], orderType: "delivery" }, S);
      const expected = sub + 1500 + (sub < 49900 ? 3000 : 0) + Math.round((sub * 5) / 100);
      expect(t.totalPaise).toBe(expected);
    }
  });
});
