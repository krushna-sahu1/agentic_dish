import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron, runDailySummary } from "@/lib/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel Cron (Authorization: Bearer $CRON_SECRET). */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req.headers.get("authorization"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await runDailySummary());
  } catch (e) {
    console.error("[cron daily-summary]", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
