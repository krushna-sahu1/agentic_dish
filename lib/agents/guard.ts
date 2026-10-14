/**
 * Agent guardrails: role checks per tool (never trusting the client), rate
 * limits, input caps, audit logging and untrusted-text wrapping.
 */
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { ServiceError } from "@/lib/services/errors";
import type { Role } from "@/lib/types";

export type AgentKind = "customer" | "owner";

export const MAX_MESSAGE_CHARS = 2000;
export const RATE_LIMIT_PER_MIN = 30;
export const ANON_RATE_LIMIT_PER_MIN = 20;

/**
 * Tools staff may use on the owner agent (§7.4). Everything else on the owner
 * agent is owner-only. Enforced server-side for every call.
 */
export const STAFF_ALLOWED_TOOLS = new Set<string>([
  // orders
  "list_orders",
  "get_order",
  "update_order_status",
  "cancel_order",
  // menu availability / stock (read + the two allowed writes)
  "find_menu_items",
  "set_item_availability",
  "update_stock",
  // inventory
  "list_inventory",
  "get_low_stock",
  "update_inventory",
  // reservations
  "list_reservations",
  "update_reservation",
  // kpis + alerts
  "get_live_kpis",
  "list_alerts",
]);

/** Customer-agent tools that work without logging in (read-only menu/info). */
export const ANONYMOUS_CUSTOMER_TOOLS = new Set<string>([
  "search_menu",
  "get_item_details",
  "get_recommendations",
  "get_pairings",
  "get_restaurant_info",
]);

export interface AgentContext {
  agent: AgentKind;
  userId: string | null;
  email: string | null;
  role: Role | null;
  ip?: string | null;
}

export class ToolAccessError extends Error {
  constructor(
    message: string,
    public code: "login_required" | "forbidden",
  ) {
    super(message);
  }
}

export function canUseTool(ctx: Pick<AgentContext, "agent" | "role" | "userId">, tool: string): { ok: true } | { ok: false; code: "login_required" | "forbidden"; message: string } {
  if (ctx.agent === "customer") {
    if (ANONYMOUS_CUSTOMER_TOOLS.has(tool)) return { ok: true };
    if (!ctx.userId) return { ok: false, code: "login_required", message: "Please log in so I can do that for you." };
    return { ok: true };
  }
  // owner agent
  if (!ctx.userId) return { ok: false, code: "login_required", message: "Please log in." };
  if (ctx.role === "owner") return { ok: true };
  if (ctx.role === "staff" && STAFF_ALLOWED_TOOLS.has(tool)) return { ok: true };
  return {
    ok: false,
    code: "forbidden",
    message: ctx.role === "staff" ? "Staff accounts can't use this. Please ask the owner." : "This assistant is only for restaurant staff.",
  };
}

export function assertCanUseTool(ctx: AgentContext, tool: string) {
  const r = canUseTool(ctx, tool);
  if (!r.ok) throw new ToolAccessError(r.message, r.code);
}

// ---------------------------------------------------------------- rate limiting
export async function checkRateLimit(ctx: Pick<AgentContext, "userId" | "ip" | "agent">): Promise<boolean> {
  const bucket = ctx.userId ? `agent:${ctx.agent}:user:${ctx.userId}` : `agent:${ctx.agent}:ip:${ctx.ip ?? "unknown"}`;
  const limit = ctx.userId ? RATE_LIMIT_PER_MIN : ANON_RATE_LIMIT_PER_MIN;
  try {
    const { data, error } = await createAdminClient().rpc("hit_rate_limit", { p_bucket: bucket, p_limit: limit, p_window_seconds: 60 });
    if (error) return true; // fail open on infra error; auth/role checks still apply
    return data === true;
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------- audit
export interface AuditEntry {
  ctx: Pick<AgentContext, "userId" | "agent">;
  tool: string;
  params: unknown;
  status: "success" | "error" | "rejected_by_user" | "blocked";
  summary?: string;
  confirmed?: boolean;
}

export async function audit(e: AuditEntry) {
  try {
    await createAdminClient()
      .from("agent_audit_log")
      .insert({
        user_id: e.ctx.userId,
        agent: e.ctx.agent,
        tool_name: e.tool,
        params: redact(e.params),
        result_summary: e.summary?.slice(0, 500) ?? null,
        status: e.status,
        confirmed_by_user: e.confirmed ?? false,
      });
  } catch (err) {
    console.error("audit log failed", err);
  }
}

function redact(v: unknown): unknown {
  if (v == null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(redact);
  return Object.fromEntries(
    Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, /secret|token|password|key_secret/i.test(k) ? "[redacted]" : redact(x)]),
  );
}

// ---------------------------------------------------------------- untrusted text
/**
 * User-generated text (reviews, notes, special instructions, customer names)
 * is wrapped so the model treats it strictly as data, never as instructions.
 */
export function untrusted(text: string | null | undefined): string | null {
  if (text == null || text === "") return text ?? null;
  const cleaned = String(text).replace(/<\/?user_text>/gi, "").slice(0, 1000);
  return `<user_text>${cleaned}</user_text>`;
}

export const UNTRUSTED_FIELDS = new Set(["comment", "notes", "special_instructions", "owner_reply", "cancelled_reason", "body", "reason_text"]);

/** Deep-wraps known user-text fields in a tool result. */
export function wrapUntrustedFields<T>(value: T): T {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => wrapUntrustedFields(v)) as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = UNTRUSTED_FIELDS.has(k) && typeof v === "string" ? untrusted(v) : wrapUntrustedFields(v);
  }
  return out as T;
}

// ---------------------------------------------------------------- tool runner
export type ToolResult<T> = { ok: true; data: T } | { ok: false; error: string; code: string; data?: Record<string, unknown> };

/**
 * Runs one tool call: role check → Zod validation → handler → audit.
 * Errors are returned as data (so the model can explain them), never thrown.
 */
export async function runTool<S extends z.ZodTypeAny, T>(
  ctx: AgentContext,
  tool: string,
  schema: S,
  rawArgs: unknown,
  handler: (args: z.infer<S>) => Promise<T>,
  opts: { write?: boolean; confirmed?: boolean } = {},
): Promise<ToolResult<T>> {
  const access = canUseTool(ctx, tool);
  if (!access.ok) {
    await audit({ ctx, tool, params: rawArgs, status: "blocked", summary: access.message });
    return { ok: false, error: access.message, code: access.code };
  }
  const parsed = schema.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
    await audit({ ctx, tool, params: rawArgs, status: "error", summary: `validation: ${msg}` });
    return { ok: false, error: `Invalid input — ${msg}`, code: "invalid_input" };
  }
  try {
    const data = await handler(parsed.data);
    await audit({ ctx, tool, params: parsed.data, status: "success", summary: summarize(data), confirmed: opts.confirmed });
    return { ok: true, data };
  } catch (e) {
    const err = e as Error;
    const isUserFacing = err instanceof ServiceError || err instanceof ToolAccessError;
    await audit({ ctx, tool, params: parsed.data, status: "error", summary: err.message });
    if (!isUserFacing) console.error(`[tool ${tool}]`, err);
    return {
      ok: false,
      error: isUserFacing ? err.message : "Something went wrong on our side. Please try again.",
      code: err instanceof ServiceError ? err.code : err instanceof ToolAccessError ? err.code : "internal",
      data: err instanceof ServiceError ? err.data : undefined,
    };
  }
}

function summarize(data: unknown): string {
  try {
    const s = JSON.stringify(data);
    return s.length > 300 ? `${s.slice(0, 300)}…` : s;
  } catch {
    return "ok";
  }
}
