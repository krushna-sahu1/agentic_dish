/**
 * CopilotKit (AG-UI) runtime for both agents. A fresh BuiltInAgent is built per
 * request, bound to the verified user (role read from `profiles`, never from the
 * client), so every tool runs with the right identity through guard.runTool.
 */
import { BuiltInAgent, CopilotRuntime, createCopilotRuntimeHandler, defineTool } from "@copilotkit/runtime/v2";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/services/settings";
import type { Role } from "@/lib/types";
import { checkRateLimit, MAX_MESSAGE_CHARS, runTool, type AgentContext, type AgentKind } from "./guard";
import { getModel, llmConfigured } from "./llm";
import type { ToolDef } from "./tool-def";
import { customerTools } from "./customer/tools";
import { customerSystemPrompt } from "./customer/prompt";
import { ownerReadTools } from "./owner/tools";
import { ownerEmailTools } from "./owner/email-tool";
import { ownerSystemPrompt } from "./owner/prompt";

/** Resolve the caller from the request's Supabase auth cookies. */
export async function contextFromRequest(request: Request, agent: AgentKind): Promise<AgentContext> {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null;
  const base: AgentContext = { agent, userId: null, email: null, role: null, ip };
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return base;
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookies = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const i = c.indexOf("=");
      return { name: decodeURIComponent(c.slice(0, i)), value: decodeURIComponent(c.slice(i + 1)) };
    });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: { getAll: () => cookies, setAll: () => {} },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return base;
  const { data: profile } = await createAdminClient().from("profiles").select("role, full_name").eq("user_id", user.id).maybeSingle();
  return { ...base, userId: user.id, email: user.email ?? null, role: (profile?.role as Role) ?? "customer" };
}

function toAgentTools(ctx: AgentContext, defs: ToolDef[]) {
  return defs.map((t) =>
    defineTool({
      name: t.name,
      description: t.description,
      parameters: t.schema,
      execute: (args: unknown) => runTool(ctx, t.name, t.schema, args, (a) => t.handler(ctx, a)),
    }),
  );
}

async function buildAgent(ctx: AgentContext): Promise<BuiltInAgent> {
  const settings = await getSettings();
  if (ctx.agent === "customer") {
    return new BuiltInAgent({
      model: getModel("customer"),
      prompt: customerSystemPrompt({ restaurantName: settings.name, loggedIn: !!ctx.userId }),
      tools: toAgentTools(ctx, customerTools),
      maxSteps: 6,
      temperature: 0.3,
      maxRetries: 1,
    });
  }
  const { data: profile } = await createAdminClient().from("profiles").select("full_name").eq("user_id", ctx.userId!).maybeSingle();
  return new BuiltInAgent({
    model: getModel("owner"),
    prompt: ownerSystemPrompt({ restaurantName: settings.name, role: ctx.role === "staff" ? "staff" : "owner", name: profile?.full_name ?? null }),
    tools: toAgentTools(ctx, [...ownerReadTools, ...ownerEmailTools]),
    maxSteps: 6,
    temperature: 0.2,
    maxRetries: 1,
  });
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** Extract the newest user message text from an AG-UI run body. */
function lastUserMessage(body: unknown): string {
  const messages = (body as { messages?: { role: string; content: unknown }[] })?.messages ?? [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    if (typeof m.content === "string") return m.content;
    if (Array.isArray(m.content)) return m.content.map((p) => (p as { text?: string }).text ?? "").join(" ");
  }
  return "";
}

/**
 * Next.js route handler for /api/copilot/{customer|owner}/[[...path]].
 * Guards: owner agent requires owner/staff; message length cap; rate limits.
 */
export function createAgentRouteHandler(agent: AgentKind, basePath: string) {
  const runtime = new CopilotRuntime({
    agents: async ({ request }) => ({ default: await buildAgent(await contextFromRequest(request, agent)) }),
  });
  const handler = createCopilotRuntimeHandler({ runtime, basePath });

  return async function route(request: Request): Promise<Response> {
    const ctx = await contextFromRequest(request, agent);
    if (agent === "customer" && !ctx.userId) {
      return json(401, { error: "Please log in to chat with our AI host." });
    }
    if (agent === "owner" && !(ctx.role === "owner" || ctx.role === "staff")) {
      return json(ctx.userId ? 403 : 401, { error: "This assistant is only available to restaurant staff." });
    }
    const isRun = request.method === "POST" && /\/run\/?$/.test(new URL(request.url).pathname);
    if (isRun) {
      if (!llmConfigured()) return json(503, { error: "The AI assistant isn't configured yet (DEEPSEEK_API_KEY)." });
      const body = await request.clone().json().catch(() => null);
      const text = lastUserMessage(body);
      if (text.length > MAX_MESSAGE_CHARS) return json(413, { error: `Messages are limited to ${MAX_MESSAGE_CHARS} characters.` });
      if (!(await checkRateLimit(ctx))) return json(429, { error: "You're sending messages too quickly. Please wait a moment." });
    }
    try {
      return await handler(request);
    } catch (e) {
      console.error(`[copilot ${agent}]`, e);
      return json(502, { error: "Our assistant is having a moment. You can keep using the site normally." });
    }
  };
}
