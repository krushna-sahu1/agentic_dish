import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { audit, checkRateLimit } from "@/lib/agents/guard";
import { jarvisSettings } from "@/lib/jarvis/prompt";
import { getMenu } from "@/lib/services/menu";
import { getSettings } from "@/lib/services/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AGENT_URL = "wss://agent.deepgram.com/v1/agent/converse";
const TOKEN_TTL_SECONDS = 30; // only needs to outlive the WebSocket handshake

/**
 * Owner-only: mints a short-lived Deepgram JWT (the API key never reaches the
 * browser) and returns the Voice Agent Settings message for this session.
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (user.role !== "owner") return NextResponse.json({ error: "Jarvis is only available to the owner." }, { status: 403 });

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Jarvis isn't configured yet (DEEPGRAM_API_KEY)." }, { status: 503 });
  if (!(await checkRateLimit({ userId: user.userId, agent: "owner" }))) return NextResponse.json({ error: "Too many sessions — wait a moment." }, { status: 429 });

  const grant = await fetch("https://api.deepgram.com/v1/auth/grant", {
    method: "POST",
    headers: { Authorization: `Token ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ttl_seconds: TOKEN_TTL_SECONDS }),
    cache: "no-store",
  }).catch(() => null);
  if (!grant?.ok) {
    console.error("[jarvis] token grant failed", grant?.status, await grant?.text().catch(() => ""));
    return NextResponse.json({ error: "Couldn't reach the voice service. Try again." }, { status: 502 });
  }
  const { access_token, expires_in } = (await grant.json()) as { access_token: string; expires_in: number };

  const [restaurant, menu] = await Promise.all([getSettings(), getMenu().catch(() => null)]);
  const keyterms = (menu?.items ?? []).map((i) => i.name).slice(0, 45);
  const settings = jarvisSettings({ restaurantName: restaurant.name, ownerName: user.profile?.full_name ?? null, keyterms });

  await audit({ ctx: { userId: user.userId, agent: "owner" }, tool: "jarvis_session", params: null, status: "success", summary: "Jarvis voice session started" });
  return NextResponse.json({ url: AGENT_URL, token: access_token, expiresIn: expires_in, settings }, { headers: { "Cache-Control": "no-store" } });
}
