/**
 * Deterministic scripted LLM for CI / e2e (LLM_MOCK=1). Implements the AI SDK
 * LanguageModelV3 interface directly: maps the latest user message to tool
 * calls with regex rules, then replies with a short text after tool results.
 * It exercises the exact same tools, guards and cards as the real model.
 */
import type { LanguageModel } from "ai";
import { addDays, zonedDateString } from "@/lib/time";

type Part = { type: string; text?: string; toolName?: string; toolCallId?: string; output?: { type: string; value: unknown } };
type PromptMessage = { role: string; content: string | Part[] };
interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

const textOf = (m: PromptMessage) => (typeof m.content === "string" ? m.content : m.content.filter((p) => p.type === "text").map((p) => p.text).join(" "));

function lastUserText(prompt: PromptMessage[]): string {
  for (let i = prompt.length - 1; i >= 0; i--) if (prompt[i].role === "user") return textOf(prompt[i]).toLowerCase();
  return "";
}

function toolResultsSinceUser(prompt: PromptMessage[]) {
  const out: { name: string; value: unknown }[] = [];
  for (let i = prompt.length - 1; i >= 0; i--) {
    const m = prompt[i];
    if (m.role === "user") break;
    if (m.role === "tool" && Array.isArray(m.content)) {
      for (const p of m.content) {
        if (p.type !== "tool-result") continue;
        let v: unknown = p.output?.value;
        if (typeof v === "string") {
          try {
            v = JSON.parse(v);
          } catch {
            /* keep string */
          }
        }
        out.unshift({ name: p.toolName ?? "", value: v });
      }
    }
  }
  return out;
}

const NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5 };

function customerRules(text: string): ToolCall[] | string {
  let m: RegExpMatchArray | null;
  if (/my usual|order my usual|add my usual/.test(text)) return [{ name: "reorder", args: { order_id: "usual" } }];
  if ((m = text.match(/add (?:(\d+|a|an|one|two|three|four|five) )?(.+?) to (?:my |the )?cart/))) {
    const qty = m[1] ? (NUM[m[1]] ?? Number(m[1])) : 1;
    return [{ name: "add_to_cart", args: { item_id: m[2].trim(), qty } }];
  }
  if (/goes well with spicy|cool(?:ing)? (?:me )?down/.test(text)) return [{ name: "get_recommendations", args: { intent: "pairing" } }];
  if ((m = text.match(/(veg )?(dinner|lunch|meal) for (\d+) under ₹?\s?(\d+)/))) {
    return [{ name: "get_recommendations", args: { intent: "group_meal", party_size: Number(m[3]), budget_paise: Number(m[4]) * 100, preferences: { veg: !!m[1], meal: m[2] === "meal" ? undefined : m[2] } } }];
  }
  if (/less spicy|extra chutney/.test(text)) return [{ name: "view_cart", args: {} }];
  if (/which dish(es)? (is|are) spicy|what'?s spicy|spicy dishes/.test(text)) return [{ name: "search_menu", args: { filters: { min_spice: 3 } } }];
  if (/checkout|check out|pay now/.test(text)) return [{ name: "prepare_checkout", args: {} }];
  if (/where'?s my food|track my order|order status/.test(text)) return [{ name: "get_order_status", args: {} }];
  if ((m = text.match(/book a table for (\d+) tomorrow (?:at )?(\d{1,2})\s*(am|pm)?/))) {
    let h = Number(m[2]);
    if (m[3] === "pm" && h < 12) h += 12;
    const day = addDays(zonedDateString(new Date()), 1);
    return [{ name: "create_reservation", args: { party_size: Number(m[1]), datetime: `${day}T${String(h).padStart(2, "0")}:00:00+05:30` } }];
  }
  if (/clear (my )?cart/.test(text)) return [{ name: "clear_cart", args: {} }];
  if (/veg meal under ₹?\s?(\d+)/.test(text)) {
    const b = Number(text.match(/under ₹?\s?(\d+)/)![1]);
    return [{ name: "get_recommendations", args: { intent: "budget_meal", party_size: 1, budget_paise: b * 100, preferences: { veg: true } } }];
  }
  if (/hours|open/.test(text)) return [{ name: "get_restaurant_info", args: {} }];
  if ((m = text.match(/(?:show|search|find|do you have) (.+)/))) return [{ name: "search_menu", args: { query: m[1].replace(/[?.!]$/, "") } }];
  return "I can help with the menu, your cart, orders and table bookings. What would you like?";
}

function customerFollowUp(text: string, results: { name: string; value: unknown }[]): ToolCall[] | string {
  const last = results.at(-1);
  if (!last) return "Done.";
  const v = last.value as { ok?: boolean; error?: string; data?: Record<string, unknown> };
  if (v && v.ok === false) return `Sorry — ${v.error}`;
  if (last.name === "view_cart" && /less spicy|extra chutney/.test(text)) {
    const lines = ((v?.data as { lines?: { cart_item_id: string; name: string }[] })?.lines ?? []);
    const dosa = lines.find((l) => /dosa/i.test(l.name)) ?? lines[0];
    if (!dosa) return "Your cart is empty — add a dosa first.";
    return [{ name: "update_cart_item", args: { cart_item_id: dosa.cart_item_id, instructions: /less spicy/.test(text) ? "less spicy" : undefined, addon_ids: /extra chutney/.test(text) ? ["Extra Chutney"] : undefined } }];
  }
  const data = v?.data ?? (v as Record<string, unknown>);
  switch (last.name) {
    case "add_to_cart":
      return (data as { status?: string }).status === "needs_confirmation" ? "Heads up — this dish conflicts with your allergy/diet settings. Tap Add anyway if you're sure." : "Added to your cart!";
    case "update_cart_item":
      return "Updated — less spicy with extra chutney.";
    case "search_menu":
      return "Here are our spicier dishes.";
    case "get_recommendations":
      return "Here are my picks.";
    case "prepare_checkout":
      return "Here's your order summary — tap Pay when you're ready. I can't make payments for you.";
    case "get_order_status":
      return "Here's where your order is.";
    case "reorder":
      return "Added your usual to the cart.";
    case "create_reservation":
    case "clear_cart":
      return typeof (v as { status?: string })?.status === "string" ? "Okay." : "All set.";
    default:
      return "Done.";
  }
}

function ownerRules(text: string): ToolCall[] | string {
  let m: RegExpMatchArray | null;
  if (/performing best|best dish|top dish/.test(text)) return [{ name: "get_top_items", args: { range: { preset: "this_week" } } }];
  if (/how much revenue|revenue/.test(text) && !/compare/.test(text)) return [{ name: "get_revenue", args: { range: { preset: "last_7_days" } } }];
  if (/compare this month/.test(text)) return [{ name: "compare_periods", args: { a: { preset: "this_month" }, b: { preset: "last_month" } } }];
  if (/compare this week/.test(text)) return [{ name: "compare_periods", args: { a: { preset: "this_week" }, b: { preset: "last_week" } } }];
  if (/busiest|peak hours/.test(text)) return [{ name: "get_peak_hours", args: { range: { preset: "last_30_days" } } }];
  if ((m = text.match(/mark (.+?) (?:as )?(?:out of stock|sold out)/))) return [{ name: "set_item_availability", args: { item_ref: m[1], is_available: false } }];
  if ((m = text.match(/increase all (\w+) prices by (\d+)%/))) return [{ name: "bulk_price_update", args: { category: m[1], percent: Number(m[2]) } }];
  if (/complain/.test(text)) return [{ name: "get_feedback_summary", args: { rating_max: 3 } }];
  if ((m = text.match(/create a coupon (\w+)/))) {
    return [{ name: "create_coupon", args: { code: m[1].toUpperCase(), type: "percent", value: 20, max_discount_paise: 10000, min_order_paise: 40000, valid_to: new Date(Date.now() + 3 * 86_400_000).toISOString(), per_user_limit: 1 } }];
  }
  if ((m = text.match(/accept order (\d+)(?:.*?(\d+) minutes)?/))) return [{ name: "update_order_status", args: { order_ref: m[1], status: "accepted", eta_minutes: m[2] ? Number(m[2]) : undefined } }];
  if (/close the restaurant/.test(text)) return [{ name: "update_settings", args: { is_open_override: "force_closed" } }];
  if (/low in stock|low stock/.test(text)) return [{ name: "get_low_stock", args: {} }];
  if (/live orders/.test(text)) return [{ name: "list_orders", args: { active_only: true } }];
  if (/how did we do today/.test(text)) return [{ name: "get_live_kpis", args: {} }];
  return "Ask me about sales, dishes, orders, stock or settings.";
}

function ownerFollowUp(results: { name: string; value: unknown }[]): string {
  const last = results.at(-1);
  const v = last?.value as { ok?: boolean; error?: string; data?: { range?: { label?: string } } } | undefined;
  if (v?.ok === false) return `I couldn't do that: ${v.error}`;
  if (v?.data?.range?.label) return `Range: ${v.data.range.label}.`;
  return "Done.";
}

export function createMockModel(agent: "customer" | "owner"): LanguageModel {
  let n = 0;
  const model = {
    specificationVersion: "v3" as const,
    provider: "mock",
    modelId: `mock-${agent}`,
    supportedUrls: {},
    async doGenerate() {
      throw new Error("mock model only supports streaming");
    },
    async doStream(options: { prompt: PromptMessage[] }) {
      const prompt = options.prompt;
      const text = lastUserText(prompt);
      const results = toolResultsSinceUser(prompt);
      const decision =
        results.length > 0
          ? agent === "customer"
            ? customerFollowUp(text, results)
            : ownerFollowUp(results)
          : agent === "customer"
            ? customerRules(text)
            : ownerRules(text);
      const parts: unknown[] = [{ type: "stream-start", warnings: [] }];
      if (typeof decision === "string") {
        const id = `t${++n}`;
        parts.push({ type: "text-start", id }, { type: "text-delta", id, delta: decision }, { type: "text-end", id });
        parts.push({ type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage: usage() });
      } else {
        for (const c of decision) {
          parts.push({ type: "tool-call", toolCallId: `call_${Date.now()}_${++n}`, toolName: c.name, input: JSON.stringify(c.args) });
        }
        parts.push({ type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage: usage() });
      }
      const stream = new ReadableStream({
        start(controller) {
          for (const p of parts) controller.enqueue(p);
          controller.close();
        },
      });
      return { stream };
    },
  };
  return model as unknown as LanguageModel;
}

function usage() {
  return {
    inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 0, text: 0, reasoning: 0 },
  };
}
