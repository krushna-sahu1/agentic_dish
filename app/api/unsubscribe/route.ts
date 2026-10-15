import { NextResponse, type NextRequest } from "next/server";
import { verifyUnsubscribe } from "@/lib/bulk-email/unsubscribe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** RFC 8058 one-click unsubscribe (List-Unsubscribe-Post) — mail clients POST here. */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const email = verifyUnsubscribe(url.searchParams.get("e"), url.searchParams.get("t"));
  if (!email) return NextResponse.json({ error: "Invalid unsubscribe link." }, { status: 400 });
  await createAdminClient().from("email_unsubscribes").upsert({ email }, { onConflict: "email", ignoreDuplicates: true });
  return NextResponse.json({ ok: true });
}

/** A GET (link prefetchers, curious humans) never unsubscribes — send them to the confirm page. */
export function GET(req: NextRequest) {
  const url = new URL(req.url);
  return NextResponse.redirect(new URL(`/unsubscribe${url.search}`, url.origin));
}
