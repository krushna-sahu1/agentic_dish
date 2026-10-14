import { createAgentRouteHandler } from "@/lib/agents/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const handle = createAgentRouteHandler("customer", "/api/copilot/customer");

export const GET = handle;
export const POST = handle;
