import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { postAuthPath } from "@/lib/auth";

/** OAuth / email-link landing: exchange the code for a session, then continue. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Safe `next` wins; otherwise owner/staff → /owner, customers → /menu (server-verified role).
      const dest = await postAuthPath(url.searchParams.get("next"));
      return NextResponse.redirect(new URL(dest, url.origin));
    }
  }
  return NextResponse.redirect(new URL("/login?error=Could%20not%20sign%20you%20in", url.origin));
}
