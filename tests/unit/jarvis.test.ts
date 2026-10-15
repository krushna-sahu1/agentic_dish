import { beforeEach, describe, expect, it, vi } from "vitest";

// Tool modules import the admin client transitively; nothing here touches the DB.
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => ({ insert: async () => ({}) }), rpc: async () => ({ data: true }) }) }));

const session = vi.hoisted(() => ({ user: null as null | { userId: string; email: string; role: string; profile: null } }));
vi.mock("@/lib/auth", () => ({ getSessionUser: async () => session.user }));

const actions = vi.hoisted(() => ({
  previewOwnerChange: vi.fn(async () => ({ ok: true, data: { title: "Mark sold out: Idli", changes: [{ label: "Available", before: "Yes", after: "No" }] } })),
  executeOwnerChange: vi.fn(async () => ({ ok: true, data: { message: "Idli is now sold out — the menu updates live." } })),
  rejectOwnerChange: vi.fn(async () => ({ ok: true, data: null })),
}));
vi.mock("@/app/actions/owner", () => actions);
vi.mock("@/lib/services/settings", async (orig) => ({ ...(await orig<object>()), getSettings: async () => ({ name: "Agentic Dish" }) }));
vi.mock("@/lib/services/menu", async (orig) => ({ ...(await orig<object>()), getMenu: async () => ({ items: [{ name: "Idli" }] }) }));

import { numberToIndianWords, spokenINR, voiceContent, voiceSafe } from "@/lib/jarvis/spoken";
import { jarvisFunctions, JARVIS_WRITE_TOOLS } from "@/lib/jarvis/functions";
import { jarvisGreeting, jarvisSettings } from "@/lib/jarvis/prompt";
import { toolToPanel } from "@/lib/jarvis/panels";
import { ownerReadTools } from "@/lib/agents/owner/tools";
import { OWNER_CHANGE_SCHEMAS } from "@/lib/agents/owner/change-schemas";
import { POST as toolsRoute } from "@/app/api/jarvis/tools/route";
import { POST as tokenRoute } from "@/app/api/jarvis/token/route";

describe("spoken numbers", () => {
  it("speaks Indian numbering", () => {
    expect(numberToIndianWords(123456)).toBe("one lakh twenty-three thousand four hundred fifty-six");
    expect(numberToIndianWords(21500000)).toBe("two crore fifteen lakh");
    expect(numberToIndianWords(0)).toBe("zero");
  });
  it("rounds rupee amounts naturally", () => {
    expect(spokenINR(12345600)).toBe("about one lakh twenty-three thousand rupees");
    expect(spokenINR(45000)).toBe("four hundred fifty rupees");
    expect(spokenINR(1234500)).toBe("about twelve thousand three hundred rupees");
    expect(spokenINR(100)).toBe("one rupee");
  });
  it("rewrites tool results for the voice model", () => {
    const out = voiceSafe({
      range: { label: "Today (IST)", from: "x", to: "y", fromDate: "2026-10-15", toDate: "2026-10-15", days: 1 },
      totals: { revenue_paise: 12345600, orders: 42 },
      previous: { change_percent: 12.46 },
      cells: [{ weekday: 1 }],
    }) as { range: string; totals: unknown; previous: { change_percent: number }; cells?: unknown };
    expect(out.range).toBe("Today (IST)");
    expect(out.totals).toEqual({ revenue_rupees: 123456, revenue_spoken: "about one lakh twenty-three thousand rupees", orders: 42 });
    expect(out.previous.change_percent).toBe(12);
    expect(out.cells).toBeUndefined();
    expect(voiceContent({ big: "x".repeat(10_000) }).length).toBeLessThan(6100);
  });
});

describe("Deepgram function definitions (generated from Zod)", () => {
  const fns = jarvisFunctions();
  it("covers every owner read tool and every confirm-gated change, once", () => {
    const names = fns.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
    for (const t of ownerReadTools) expect(names).toContain(t.name);
    for (const t of Object.keys(OWNER_CHANGE_SCHEMAS)) expect(names).toContain(t);
  });
  it("emits plain JSON Schema objects", () => {
    for (const f of fns) {
      expect(f.parameters.type, f.name).toBe("object");
      expect(f.parameters.$schema, f.name).toBeUndefined();
    }
    const avail = fns.find((f) => f.name === "set_item_availability")!;
    expect(avail.parameters.required).toEqual(["item_ref", "is_available"]);
    expect(avail.description).toMatch(/Confirm/);
  });
});

describe("voice agent settings", () => {
  const s = jarvisSettings({ restaurantName: "Agentic Dish", ownerName: "Asha", keyterms: ["Idli"], now: new Date("2026-10-15T14:00:00Z") });
  it("uses Deepgram's stack end to end (no DeepSeek)", () => {
    expect(s.agent.listen.provider).toMatchObject({ type: "deepgram", model: "nova-3" });
    expect(s.agent.speak.provider).toMatchObject({ type: "deepgram", model: expect.stringMatching(/^aura-2-/) });
    expect(JSON.stringify(s.agent.think.provider)).not.toMatch(/deepseek/i);
    expect(s.agent.think.provider).toMatchObject({ type: "open_ai", model: "gpt-5.6-luna" }); // Deepgram-managed default
    expect(s.agent.listen.provider.keyterms).toContain("Idli");
    expect(s.audio.input).toEqual({ encoding: "linear16", sample_rate: 16000 });
  });
  it("greets by time of day (IST)", () => {
    expect(jarvisGreeting(new Date("2026-10-15T14:00:00Z"))).toBe("Good evening, boss. What do you need?"); // 19:30 IST
    expect(jarvisGreeting(new Date("2026-10-15T03:00:00Z"))).toBe("Good morning, boss. What do you need?"); // 08:30 IST
    expect(s.agent.greeting).toMatch(/^Good evening, boss/);
  });
});

describe("panels", () => {
  it("maps the must-work questions to the right visual", () => {
    expect(toolToPanel("get_live_kpis", { revenue_today_paise: 500000, orders_today: 12, active_orders: 3, new_orders_waiting: 1, avg_rating_30d: 4.5 })?.kind).toBe("kpis");
    expect(toolToPanel("get_top_items", { range: { label: "This week" }, items: [{ name: "Idli", qty: 5, revenue_paise: 50000 }] })?.kind).toBe("bars");
    expect(toolToPanel("compare_periods", { a: { label: "A" }, b: { label: "B" }, metrics: [{ metric: "revenue_paise", a: 2, b: 1, change_percent: 100 }] })?.kind).toBe("compare");
    expect(toolToPanel("get_peak_hours", { cells: [{ weekday: 5, hour: 20, orders: 9 }], busiest_slot: { day: "Fri", hour: 20, orders: 9 } })).toMatchObject({ kind: "heatmap", headline: "Peak: Fri 8pm" });
    expect(toolToPanel("list_orders", { count: 1, orders: [{ order_number: "ORD-20261015-0042", status: "paid", total_paise: 100, items: "1× Idli" }] })?.kind).toBe("orders");
  });
});

describe("/api/jarvis/tools", () => {
  const call = (body: unknown) => toolsRoute(new Request("http://x/api/jarvis/tools", { method: "POST", body: JSON.stringify(body) }));
  beforeEach(() => {
    Object.values(actions).forEach((f) => f.mockClear());
    session.user = { userId: "u1", email: "o@x.com", role: "owner", profile: null };
  });

  it("is owner-only (staff and customers are refused)", async () => {
    for (const role of ["staff", "customer"]) {
      session.user = { userId: "u2", email: null as never, role, profile: null };
      expect((await call({ name: "get_live_kpis" })).status).toBe(403);
    }
    session.user = null;
    expect((await call({ name: "get_live_kpis" })).status).toBe(401);
  });

  it("a write from Deepgram only previews — it runs after the owner's Confirm", async () => {
    const res = await (await call({ name: "set_item_availability", args: '{"item_ref":"idli","is_available":false}' })).json();
    expect(res.kind).toBe("confirm");
    expect(JSON.parse(res.content).status).toBe("awaiting_confirmation");
    expect(actions.previewOwnerChange).toHaveBeenCalledWith("set_item_availability", { item_ref: "idli", is_available: false });
    expect(actions.executeOwnerChange).not.toHaveBeenCalled();

    const done = await (await call({ name: "set_item_availability", args: res.args, mode: "execute" })).json();
    expect(done).toEqual({ ok: true, message: "Idli is now sold out — the menu updates live." });
    expect(actions.executeOwnerChange).toHaveBeenCalledTimes(1);
  });

  it("execute is only for write tools", async () => {
    expect((await call({ name: "get_revenue", mode: "execute" })).status).toBe(404);
    expect(JARVIS_WRITE_TOOLS.has("get_revenue")).toBe(false);
  });
});

describe("/api/jarvis/token", () => {
  it("refuses non-owners and never returns the API key", async () => {
    session.user = { userId: "u2", email: "s@x.com", role: "staff", profile: null };
    expect((await tokenRoute()).status).toBe(403);
    session.user = { userId: "u1", email: "o@x.com", role: "owner", profile: null };
    const prev = process.env.DEEPGRAM_API_KEY;
    delete process.env.DEEPGRAM_API_KEY;
    expect((await tokenRoute()).status).toBe(503);

    process.env.DEEPGRAM_API_KEY = "dg-secret-key-123";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ access_token: "short-jwt", expires_in: 30 })));
    const res = await tokenRoute();
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(JSON.parse(text)).toMatchObject({ url: "wss://agent.deepgram.com/v1/agent/converse", token: "short-jwt", settings: { type: "Settings" } });
    expect(text).not.toContain("dg-secret-key-123");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.deepgram.com/v1/auth/grant");
    expect(JSON.parse(String(init.body))).toEqual({ ttl_seconds: 30 });
    fetchMock.mockRestore();
    if (prev === undefined) delete process.env.DEEPGRAM_API_KEY;
    else process.env.DEEPGRAM_API_KEY = prev;
  });
});
