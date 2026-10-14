import { describe, expect, it } from "vitest";
import { checkCouponEligibility, describeCoupon, type CouponRow } from "@/lib/coupons";
import { computeOpenStatus, previousPeriod, resolveRange, zonedTimeToUtc, type OpeningHours } from "@/lib/time";

const base: CouponRow = {
  id: "c1",
  code: "WEEKEND20",
  description: null,
  type: "percent",
  value: 20,
  min_order_paise: 40000,
  max_discount_paise: 10000,
  valid_from: "2026-10-01T00:00:00Z",
  valid_to: "2026-10-31T00:00:00Z",
  usage_limit: 100,
  per_user_limit: 1,
  is_active: true,
};
const now = new Date("2026-10-15T10:00:00Z");

describe("coupon rules", () => {
  it("accepts a valid coupon", () => {
    expect(checkCouponEligibility(base, { totalRedemptions: 0, userRedemptions: 0 }, now)).toEqual({ ok: true });
  });
  it.each([
    [null, "doesn't exist"],
    [{ ...base, is_active: false }, "no longer active"],
    [{ ...base, valid_from: "2026-11-01T00:00:00Z" }, "isn't valid yet"],
    [{ ...base, valid_to: "2026-10-01T00:00:00Z" }, "expired"],
  ])("rejects %#", (c, msg) => {
    const r = checkCouponEligibility(c as CouponRow | null, { totalRedemptions: 0, userRedemptions: 0 }, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain(msg);
  });
  it("enforces total and per-user limits", () => {
    expect(checkCouponEligibility(base, { totalRedemptions: 100, userRedemptions: 0 }, now).ok).toBe(false);
    expect(checkCouponEligibility(base, { totalRedemptions: 1, userRedemptions: 1 }, now).ok).toBe(false);
  });
  it("describes offers", () => {
    expect(describeCoupon(base)).toBe("20% off up to ₹100 on orders above ₹400");
  });
});

const HOURS: OpeningHours = {
  mon: [{ open: "07:00", close: "15:30" }, { open: "17:30", close: "23:00" }],
  tue: [{ open: "07:00", close: "15:30" }, { open: "17:30", close: "23:00" }],
  sat: [{ open: "18:00", close: "02:00" }],
};
const ist = (y: number, m: number, d: number, h: number, mi = 0) => zonedTimeToUtc(y, m, d, h, mi, "Asia/Kolkata");

describe("open hours", () => {
  // 2026-10-12 is a Monday
  it("open inside a slot, closed in the gap", () => {
    expect(computeOpenStatus({ openingHours: HOURS, override: "auto" }, ist(2026, 10, 12, 9)).isOpen).toBe(true);
    const gap = computeOpenStatus({ openingHours: HOURS, override: "auto" }, ist(2026, 10, 12, 16));
    expect(gap.isOpen).toBe(false);
    expect(gap.nextOpen).toBe("today 17:30");
  });
  it("closing time is exclusive", () => {
    expect(computeOpenStatus({ openingHours: HOURS, override: "auto" }, ist(2026, 10, 12, 23)).isOpen).toBe(false);
  });
  it("overnight slots spill into the next day", () => {
    expect(computeOpenStatus({ openingHours: HOURS, override: "auto" }, ist(2026, 10, 17, 23)).isOpen).toBe(true); // Sat 23:00
    expect(computeOpenStatus({ openingHours: HOURS, override: "auto" }, ist(2026, 10, 18, 1)).isOpen).toBe(true); // Sun 01:00
    expect(computeOpenStatus({ openingHours: HOURS, override: "auto" }, ist(2026, 10, 18, 3)).isOpen).toBe(false);
  });
  it("owner overrides win", () => {
    expect(computeOpenStatus({ openingHours: HOURS, override: "force_closed" }, ist(2026, 10, 12, 9)).isOpen).toBe(false);
    expect(computeOpenStatus({ openingHours: HOURS, override: "force_open" }, ist(2026, 10, 12, 4)).isOpen).toBe(true);
  });
});

describe("date ranges (IST)", () => {
  const at = ist(2026, 10, 15, 14); // Thursday afternoon IST
  it("today starts at IST midnight", () => {
    const r = resolveRange("today", undefined, "Asia/Kolkata", at);
    expect(r.from).toBe("2026-10-14T18:30:00.000Z");
    expect(r.fromDate).toBe("2026-10-15");
  });
  it("this_week starts Monday; last_week is Mon–Sun", () => {
    expect(resolveRange("this_week", undefined, "Asia/Kolkata", at).fromDate).toBe("2026-10-12");
    const lw = resolveRange("last_week", undefined, "Asia/Kolkata", at);
    expect([lw.fromDate, lw.toDate]).toEqual(["2026-10-05", "2026-10-11"]);
    expect(lw.days).toBe(7);
  });
  it("last_month and previous period", () => {
    const lm = resolveRange("last_month", undefined, "Asia/Kolkata", at);
    expect([lm.fromDate, lm.toDate]).toEqual(["2026-09-01", "2026-09-30"]);
    const p = previousPeriod(resolveRange("last_7_days", undefined, "Asia/Kolkata", at));
    expect([p.fromDate, p.toDate]).toEqual(["2026-10-02", "2026-10-08"]);
  });
  it("labels state the range", () => {
    expect(resolveRange("yesterday", undefined, "Asia/Kolkata", at).label).toContain("IST");
  });
});
