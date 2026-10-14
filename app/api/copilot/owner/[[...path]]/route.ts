import { createAgentRouteHandler } from "@/lib/agents/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const handle = createAgentRouteHandler("owner", "/api/copilot/owner");

export const GET = handle;
export const POST = handle;
