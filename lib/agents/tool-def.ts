import type { z } from "zod";
import type { AgentContext } from "./guard";

/**
 * Framework-agnostic tool definition. The CopilotKit runtime adapter
 * (lib/agents/runtime.ts) turns these into backend actions; every call goes
 * through guard.runTool (role check → Zod → handler → audit).
 */
export interface ToolDef<S extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  schema: S;
  handler: (ctx: AgentContext, args: z.infer<S>) => Promise<unknown>;
}

export const tool = <S extends z.ZodTypeAny>(t: ToolDef<S>): ToolDef<S> => t;
