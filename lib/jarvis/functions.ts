/**
 * Deepgram Voice Agent function definitions, generated from the SAME Zod
 * schemas the chat assistant uses (owner read tools + confirm-gated changes),
 * so there is one source of truth. No `endpoint` is set: every call is
 * client-side and goes browser → /api/jarvis/tools, which re-checks the role.
 */
import { z } from "zod";
import { ownerReadTools } from "@/lib/agents/owner/tools";
import { OWNER_CHANGE_SCHEMAS } from "@/lib/agents/owner/change-schemas";

export interface DeepgramFunction {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const JARVIS_WRITE_TOOLS = new Set<string>(Object.keys(OWNER_CHANGE_SCHEMAS));
export const JARVIS_READ_TOOLS = new Set<string>(ownerReadTools.map((t) => t.name));

/** Zod → plain JSON Schema object (input side, so defaulted fields stay optional). */
export function zodToParameters(schema: z.ZodTypeAny): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
  delete json.$schema;
  if (json.type !== "object") return { type: "object", properties: {} };
  if (!json.properties) json.properties = {};
  return json;
}

export function jarvisFunctions(): DeepgramFunction[] {
  const reads = ownerReadTools.map((t) => ({ name: t.name, description: t.description, parameters: zodToParameters(t.schema) }));
  const writes = Object.entries(OWNER_CHANGE_SCHEMAS).map(([name, def]) => ({
    name,
    description: `${def.description} WRITE ACTION: calling this only shows a Confirm card; nothing changes until the owner taps Confirm.`,
    parameters: zodToParameters(def.schema),
  }));
  return [...reads, ...writes];
}
