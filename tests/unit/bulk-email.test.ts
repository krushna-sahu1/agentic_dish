import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ----------------------------------------------------------------------------
// Tiny in-memory stand-in for the Supabase admin client (only what the service uses).
type Row = Record<string, unknown>;
const mem = vi.hoisted(() => ({ tables: {} as Record<string, Row[]>, audience: [] as Row[], rpcCalls: [] as unknown[] }));

vi.mock("@/lib/supabase/admin", () => {
  class Q {
    private filters: [string, unknown][] = [];
    private op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
    private payload: Row | Row[] | null = null;
    constructor(private t: string) {}
    select() {
      return this;
    }
    insert(p: Row | Row[]) {
      this.op = "insert";
      this.payload = p;
      return this;
    }
    update(p: Row) {
      this.op = "update";
      this.payload = p;
      return this;
    }
    upsert(p: Row | Row[]) {
      this.op = "upsert";
      this.payload = p;
      return this;
    }
    delete() {
      this.op = "delete";
      return this;
    }
    eq(k: string, v: unknown) {
      this.filters.push([k, v]);
      return this;
    }
    maybeSingle() {
      return this.run().then((r) => ({ data: r.data[0] ?? null, error: null }));
    }
    single() {
      return this.run().then((r) => (r.data[0] ? { data: r.data[0], error: null } : { data: null, error: { message: "no rows", code: "PGRST116" } }));
    }
    then<A>(res: (v: { data: Row[]; error: null }) => A) {
      return this.run().then(res);
    }
    private async run() {
      const table = (mem.tables[this.t] ??= []);
      const match = (r: Row) => this.filters.every(([k, v]) => r[k] === v);
      if (this.op === "insert" || this.op === "upsert") {
        const list = (Array.isArray(this.payload) ? this.payload : [this.payload!]).map((p) => ({
          id: crypto.randomUUID(),
          ...(this.t === "email_drafts" ? { status: "draft", version: 1 } : {}),
          ...p,
        }));
        table.push(...list);
        return { data: list, error: null };
      }
      const hit = table.filter(match);
      if (this.op === "update") hit.forEach((r) => Object.assign(r, this.payload));
      if (this.op === "delete") mem.tables[this.t] = table.filter((r) => !match(r));
      return { data: hit, error: null };
    }
  }
  return {
    createAdminClient: () => ({
      from: (t: string) => new Q(t),
      rpc: async (fn: string, args: unknown) => {
        mem.rpcCalls.push({ fn, args });
        return fn === "email_audience" ? { data: mem.audience, error: null } : { data: true, error: null };
      },
    }),
  };
});
vi.mock("@/lib/services/settings", async (orig) => ({
  ...(await orig<object>()),
  getSettings: async () => ({ name: "Agentic Dish", address: "12 Janpath, Bhubaneswar", phone: null, email: "hello@agenticdish.example" }),
}));
vi.mock("@/lib/services/menu", async (orig) => ({ ...(await orig<object>()), resolveItem: async () => ({ id: "dish-1", name: "Masala Dosa" }) }));

import { audienceLabel, draftEmail, offerToCoupon, sendDraft } from "@/lib/services/bulk-email";
import { couponBox, firstName, renderBulkEmail } from "@/lib/bulk-email/template";
import { unsubscribeHeaders, unsubscribePageUrl, verifyUnsubscribe } from "@/lib/bulk-email/unsubscribe";
import { draftEmailSchema } from "@/lib/bulk-email/schema";
import { checkCouponEligibility, type CouponRow } from "@/lib/coupons";
import { canUseTool } from "@/lib/agents/guard";
import { jarvisFunctions } from "@/lib/jarvis/functions";

const people = (n: number) => Array.from({ length: n }, (_, i) => ({ user_id: `u${i}`, email: `c${i}@example.com`, full_name: i % 2 ? `asha ${i}` : null }));

beforeEach(() => {
  mem.tables = {};
  mem.audience = people(3);
  mem.rpcCalls = [];
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-secret";
  process.env.NEXT_PUBLIC_SITE_URL = "https://agenticdish.example";
  process.env.RESEND_API_KEY = "re_test";
});
afterEach(() => vi.restoreAllMocks());

describe("template", () => {
  const coupon = { code: "THANKS10AB", type: "percent" as const, value: 10, min_order_paise: 0, max_discount_paise: 15000, valid_from: "2026-10-16T18:30:00.000Z", valid_to: "2026-10-18T18:30:00.000Z" };

  it("builds the offer box from the coupon row (IST dates, inclusive end)", () => {
    expect(couponBox(coupon, new Date("2026-10-15T06:00:00Z"))).toEqual({
      code: "THANKS10AB",
      headline: "10% OFF",
      detail: "10% off up to ₹150. One use per customer.",
      validity: "Valid Sat 17 Oct – Sun 18 Oct",
    });
  });

  it("personalises, escapes AI text, links the coupon and the unsubscribe page", () => {
    const { html, text } = renderBulkEmail({
      restaurantName: "Agentic Dish",
      firstName: firstName("asha rao"),
      message: "Thank you!\n\n<script>alert(1)</script>",
      coupon: couponBox(coupon),
      orderUrl: "https://agenticdish.example/menu?coupon=THANKS10AB",
      unsubscribeUrl: "https://agenticdish.example/unsubscribe?e=x&t=y",
    });
    expect(html).toContain("Hi Asha,");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("THANKS10AB");
    expect(html).toContain('href="https://agenticdish.example/menu?coupon=THANKS10AB"');
    expect(html).toContain("Unsubscribe</a>");
    expect(text).toContain("Unsubscribe: https://agenticdish.example/unsubscribe?e=x&t=y");
    expect(firstName(null)).toBeNull();
  });
});

describe("unsubscribe links", () => {
  it("verifies genuine links and rejects forged ones", () => {
    const url = new URL(unsubscribePageUrl("Asha@Example.com"));
    expect(verifyUnsubscribe(url.searchParams.get("e"), url.searchParams.get("t"))).toBe("asha@example.com");
    expect(verifyUnsubscribe(url.searchParams.get("e"), "x".repeat(32))).toBeNull();
    expect(verifyUnsubscribe(Buffer.from("other@example.com").toString("base64url"), url.searchParams.get("t"))).toBeNull();
  });
  it("sets RFC 8058 one-click headers", () => {
    const h = unsubscribeHeaders("a@b.com");
    expect(h["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(h["List-Unsubscribe"]).toMatch(/^<https:\/\/agenticdish\.example\/api\/unsubscribe\?e=.+&t=.+>$/);
  });
});

describe("offers → draft coupons", () => {
  it("creates an inactive draft coupon with IST day boundaries", () => {
    const c = offerToCoupon({ percent_off: 10, starts_on: "2026-10-17", ends_on: "2026-10-18" }, "A little thank-you", new Date("2026-10-15T06:00:00Z"));
    expect(c).toMatchObject({ type: "percent", value: 10, is_active: false, is_draft: true, per_user_limit: 1, valid_from: "2026-10-16T18:30:00.000Z", valid_to: "2026-10-18T18:30:00.000Z" });
    expect(c.code).toMatch(/^[A-Z0-9]+$/);
  });
  it("rejects nonsense offers", () => {
    expect(() => offerToCoupon({ ends_on: "2026-10-18" }, "x")).toThrow(/percent off or a flat/);
    expect(() => offerToCoupon({ percent_off: 10, flat_off_rupees: 50, ends_on: "2026-10-18" }, "x")).toThrow();
    expect(() => offerToCoupon({ percent_off: 10, ends_on: "2020-01-01" }, "x")).toThrow(/end/);
  });
  it("draft coupons can't be redeemed", () => {
    const c = { code: "X", is_active: false, is_draft: true } as CouponRow;
    expect(checkCouponEligibility(c, { totalRedemptions: 0, userRedemptions: 0 })).toEqual({ ok: false, reason: "X isn't available yet." });
  });
});

describe("audience labels", () => {
  it("describes each group", () => {
    expect(audienceLabel({ group: "inactive", days: 45 })).toBe("Customers with no order in the last 45 days");
    expect(audienceLabel({ group: "loyal" })).toBe("Loyal customers (3+ orders)");
    expect(audienceLabel({ group: "big_spenders", min_spend_rupees: 5000 })).toBe("Big spenders (₹5,000+ spent)");
    expect(audienceLabel({ group: "ordered_dish", dish: "dosa", dish_name: "Masala Dosa" })).toBe("Customers who ordered Masala Dosa");
    expect(audienceLabel({ emails: ["a@x.com"] })).toBe("a@x.com");
  });
});

describe("draft_email (the AI tool) never sends", () => {
  const input = draftEmailSchema.parse({
    to: { group: "loyal" },
    goal: "thank-you with 10% off this weekend",
    subject: "A little thank-you from us",
    message: "You've been with us through many dosas. Here's a small treat for the weekend.",
    offer: { percent_off: 10, ends_on: "2099-01-04", starts_on: "2099-01-03" },
  });

  it("drafts, creates a draft coupon, and makes no email request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const v = await draftEmail("owner-1", input);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(v).toMatchObject({ status: "draft", version: 1, audience_label: "Loyal customers (3+ orders)", recipient_count: 3 });
    expect(v.coupon?.headline).toBe("10% OFF");
    expect(v.next_step).toMatch(/NOTHING HAS BEEN SENT.*Ready to email 3 people\. Tap Send to confirm\./);
    expect(mem.tables.coupons[0]).toMatchObject({ is_draft: true, is_active: false });
  });

  it("revisions bump the version; replacing the offer drops the old draft coupon", async () => {
    const v1 = await draftEmail("owner-1", input);
    const v2 = await draftEmail("owner-1", { draft_id: v1.draft_id, to: { group: "loyal", min_orders: 5 }, offer: { flat_off_rupees: 100, ends_on: "2099-01-04" } });
    expect(v2.version).toBe(2);
    expect(v2.audience_label).toBe("Loyal customers (5+ orders)");
    expect(v2.coupon?.headline).toBe("₹100 OFF");
    expect(mem.tables.coupons).toHaveLength(1);
    const v3 = await draftEmail("owner-1", { draft_id: v1.draft_id, remove_offer: true, message: "Shorter: thanks for being a regular!" });
    expect(v3.coupon).toBeNull();
    expect(mem.tables.coupons).toHaveLength(0);
  });

  it("is owner-only for the AI (staff are refused) and exposed to Jarvis", () => {
    expect(canUseTool({ agent: "owner", role: "owner", userId: "o" }, "draft_email").ok).toBe(true);
    expect(canUseTool({ agent: "owner", role: "staff", userId: "s" }, "draft_email").ok).toBe(false);
    expect(jarvisFunctions().find((f) => f.name === "draft_email")?.description).toMatch(/NOTHING is sent/);
  });
});

describe("sendDraft (owner's Send tap)", () => {
  const ok = (n: number) => new Response(JSON.stringify({ data: Array.from({ length: n }, (_, i) => ({ id: `re_${i}` })) }), { status: 200 });

  async function draft(n: number, offer = true) {
    mem.audience = people(n);
    return draftEmail("owner-1", {
      to: { group: "all" },
      subject: "Weekend treat",
      message: "Come hungry this weekend — we've got something for you.",
      ...(offer ? { offer: { percent_off: 10, ends_on: "2099-01-04" } } : {}),
    });
  }

  it("activates the coupon and sends in batches of 100 with one-click unsubscribe headers", async () => {
    const v = await draft(250);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_u, init) => ok(JSON.parse(String((init as RequestInit).body)).length));
    const r = await sendDraft(v.draft_id, v.version, "owner-1", { pauseMs: 0 });

    expect(r).toMatchObject({ status: "sent", sent: 250, failed: 0, recipient_count: 250 });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    const calls = fetchSpy.mock.calls.map(([url, init]) => ({ url, init: init as RequestInit, body: JSON.parse(String((init as RequestInit).body)) }));
    expect(calls.map((c) => c.body.length)).toEqual([100, 100, 50]);
    expect(calls[0].url).toBe("https://api.resend.com/emails/batch");
    expect((calls[0].init.headers as Record<string, string>)["Idempotency-Key"]).toBe(`email-${v.draft_id}-v1-b0`);
    const first = calls[0].body[0];
    expect(first.to).toEqual(["c0@example.com"]);
    expect(first.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(first.html).toContain(v.coupon!.code);
    expect(first.html).toContain(`/menu?coupon=${v.coupon!.code}`);
    expect(first.reply_to).toBe("hello@agenticdish.example");
    expect(mem.tables.coupons[0]).toMatchObject({ is_draft: false, is_active: true });
    expect(mem.tables.email_drafts[0]).toMatchObject({ status: "sent", sent_count: 250 });
    expect(mem.tables.email_sends).toHaveLength(250);
  });

  it("a stale card (old version) can't send, and nothing sends twice", async () => {
    const v = await draft(2, false);
    await draftEmail("owner-1", { draft_id: v.draft_id, subject: "Changed subject" });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok(2));
    await expect(sendDraft(v.draft_id, 1, "owner-1")).rejects.toThrow(/changed/);
    expect(fetchSpy).not.toHaveBeenCalled();
    await sendDraft(v.draft_id, 2, "owner-1", { pauseMs: 0 });
    await expect(sendDraft(v.draft_id, 2, "owner-1")).rejects.toThrow(/already sent/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("refuses without RESEND_API_KEY, before touching anything", async () => {
    const v = await draft(2);
    delete process.env.RESEND_API_KEY;
    await expect(sendDraft(v.draft_id, 1, "owner-1")).rejects.toThrow(/RESEND_API_KEY/);
    expect(mem.tables.email_drafts[0].status).toBe("draft");
    expect(mem.tables.coupons[0].is_draft).toBe(true);
  });

  it("records failed batches without stopping the rest", async () => {
    const v = await draft(150, false);
    let n = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_u, init) => (n++ === 0 ? new Response(JSON.stringify({ message: "invalid from" }), { status: 422 }) : ok(JSON.parse(String((init as RequestInit).body)).length)));
    const r = await sendDraft(v.draft_id, 1, "owner-1", { pauseMs: 0 });
    expect(r).toMatchObject({ status: "sent", sent: 50, failed: 100 });
    expect(mem.tables.email_sends.filter((s) => s.status === "failed")).toHaveLength(100);
  });
});
