import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { audit, runTool, type AgentContext } from "@/lib/agents/guard";
import { JARVIS_DIRECT_TOOLS, JARVIS_WRITE_TOOLS } from "@/lib/jarvis/functions";
import { voiceContent } from "@/lib/jarvis/spoken";
import { executeOwnerChange, previewOwnerChange, rejectOwnerChange } from "@/app/actions/owner";
import type { OwnerChangeName } from "@/lib/agents/owner/changes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({
  name: z.string().min(1).max(60),
  args: z.union([z.string().max(20_000), z.record(z.string(), z.unknown())]).optional(),
  /** call = what Deepgram asked for (reads run, writes only preview); execute/reject = the owner's Confirm/Cancel tap. */
  mode: z.enum(["call", "execute", "reject"]).default("call"),
});

const AWAITING = "Shown on screen as a Confirm card. NOTHING has changed yet. Ask the owner in one short question to confirm on screen; never say it's done.";

/**
 * Jarvis function calls (browser → here). Re-checks the owner role on every
 * call, runs the existing tool through guard.runTool / the owner change
 * actions (which log to agent_audit_log) and returns `content` for Deepgram.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (user.role !== "owner") return NextResponse.json({ error: "Jarvis is only available to the owner." }, { status: 403 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const { name, mode } = parsed.data;
  let args: unknown = parsed.data.args ?? {};
  if (typeof args === "string") {
    try {
      args = args.trim() ? JSON.parse(args) : {};
    } catch {
      return NextResponse.json({ kind: "error", ok: false, error: "Arguments weren't valid JSON.", content: voiceContent({ error: "Arguments weren't valid JSON." }) });
    }
  }
  const ctx: AgentContext = { agent: "owner", userId: user.userId, email: user.email, role: user.role };

  if (mode !== "call") {
    if (!JARVIS_WRITE_TOOLS.has(name)) return NextResponse.json({ error: "Unknown action." }, { status: 404 });
    if (mode === "reject") {
      await rejectOwnerChange(name as OwnerChangeName, args);
      return NextResponse.json({ ok: true, message: "Cancelled — nothing changed." });
    }
    const r = await executeOwnerChange(name as OwnerChangeName, args);
    return NextResponse.json(r.ok ? { ok: true, message: r.data.message } : { ok: false, error: r.error });
  }

  const read = JARVIS_DIRECT_TOOLS.find((t) => t.name === name);
  if (read) {
    const r = await runTool(ctx, name, read.schema, args, (a) => read.handler(ctx, a));
    return NextResponse.json(
      r.ok
        ? { kind: "read", ok: true, data: r.data, content: voiceContent(r.data) }
        : { kind: "read", ok: false, error: r.error, content: voiceContent({ error: r.error }) },
    );
  }

  if (JARVIS_WRITE_TOOLS.has(name)) {
    const r = await previewOwnerChange(name as OwnerChangeName, args);
    if (!r.ok) {
      await audit({ ctx, tool: name, params: args, status: "error", summary: `Jarvis preview failed: ${r.error}` });
      return NextResponse.json({ kind: "confirm", ok: false, error: r.error, content: voiceContent({ error: r.error }) });
    }
    await audit({ ctx, tool: name, params: args, status: "success", summary: `Jarvis proposed "${r.data.title}" — awaiting owner confirmation` });
    return NextResponse.json({
      kind: "confirm",
      ok: true,
      preview: r.data,
      args,
      content: voiceContent({ status: "awaiting_confirmation", action: r.data.title, changes: r.data.changes, warnings: r.data.warnings ?? [], instruction: AWAITING }),
    });
  }

  await audit({ ctx, tool: name, params: args, status: "blocked", summary: "Jarvis called an unknown tool" });
  return NextResponse.json({ kind: "error", ok: false, error: `No tool called ${name}.`, content: voiceContent({ error: `No tool called ${name}.` }) });
}
