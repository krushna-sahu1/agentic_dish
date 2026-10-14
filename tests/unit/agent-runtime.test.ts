/**
 * Runs a real CopilotKit BuiltInAgent (AG-UI) with the scripted mock model and
 * checks that tool calls flow through guard.runTool and back into the stream.
 */
import { describe, expect, it, vi } from "vitest";
import { lastValueFrom, toArray } from "rxjs";
import { z } from "zod";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => ({ insert: async () => ({}) }), rpc: async () => ({ data: true }) }) }));

import { BuiltInAgent, defineTool } from "@copilotkit/runtime/v2";
import { createMockModel } from "@/lib/agents/mock-model";
import { runTool, type AgentContext } from "@/lib/agents/guard";

type Evt = { type: string; toolCallName?: string; toolCallId?: string; content?: string; delta?: string };

async function run(agent: BuiltInAgent, text: string, tools: unknown[] = []) {
  const events = await lastValueFrom(
    agent
      .run({ threadId: "t1", runId: `r${Date.now()}`, state: {}, messages: [{ id: "u1", role: "user", content: text }], tools: tools as never, context: [], forwardedProps: {} } as never)
      .pipe(toArray()),
  );
  return events as unknown as Evt[];
}

describe("BuiltInAgent + mock model + guarded tools", () => {
  const ctx: AgentContext = { agent: "customer", userId: "33333333-3333-4333-8333-333333333333", email: null, role: "customer" };
  const handler = vi.fn(async (a: { item_id: string; qty: number }) => ({ status: "added", item: a.item_id, qty_in_line: a.qty }));
  const schema = z.object({ item_id: z.string(), qty: z.number().int().min(1).max(20) });

  it("calls add_to_cart server-side with parsed args and streams the result", async () => {
    const agent = new BuiltInAgent({
      model: createMockModel("customer"),
      prompt: "test",
      maxSteps: 3,
      tools: [defineTool({ name: "add_to_cart", description: "add", parameters: schema, execute: (args: unknown) => runTool(ctx, "add_to_cart", schema, args, handler) })],
    });
    const events = await run(agent, "add one paneer masala dosa to my cart");
    const start = events.find((e) => e.type === "TOOL_CALL_START");
    expect(start?.toolCallName).toBe("add_to_cart");
    expect(handler).toHaveBeenCalledWith({ item_id: "paneer masala dosa", qty: 1 });
    const result = events.find((e) => e.type === "TOOL_CALL_RESULT");
    expect(JSON.parse(result!.content!)).toMatchObject({ ok: true, data: { status: "added" } });
    expect(events.some((e) => /^TEXT_MESSAGE_(CONTENT|CHUNK)$/.test(e.type) && /Added/.test(e.delta ?? ""))).toBe(true);
    expect(events.at(-1)?.type).toBe("RUN_FINISHED");
  });

  it("frontend (confirm-card) tools are NOT executed on the server — the run stops for the human", async () => {
    const agent = new BuiltInAgent({ model: createMockModel("customer"), prompt: "test", maxSteps: 3, tools: [] });
    const clientTool = { name: "create_reservation", description: "book", parameters: { type: "object", properties: { party_size: { type: "number" }, datetime: { type: "string" } } } };
    const events = await run(agent, "book a table for 4 tomorrow 8pm", [clientTool]);
    expect(events.find((e) => e.type === "TOOL_CALL_START")?.toolCallName).toBe("create_reservation");
    expect(events.some((e) => e.type === "TOOL_CALL_RESULT")).toBe(false);
  });

  it("owner mock maps analytics questions to analytics tools", async () => {
    const seen: string[] = [];
    const agent = new BuiltInAgent({
      model: createMockModel("owner"),
      prompt: "test",
      maxSteps: 2,
      tools: ["get_top_items", "get_revenue", "compare_periods", "get_peak_hours"].map((name) => defineTool({ name, description: name, parameters: z.object({}).passthrough(), execute: async () => { seen.push(name); return { ok: true, data: {} }; } })),
    });
    for (const q of ["which dish is performing best?", "how much revenue did we make?", "compare this month with last month", "when are we busiest?"]) await run(agent.clone(), q);
    expect(seen).toEqual(["get_top_items", "get_revenue", "compare_periods", "get_peak_hours"]);
  });
});
