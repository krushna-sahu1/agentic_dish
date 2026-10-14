import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;

/**
 * Service-role client. SERVER ONLY — bypasses RLS. Callers must have already
 * verified the user and role (see lib/auth.ts and lib/agents/guard.ts) and must
 * scope every query to that user where applicable.
 */
export function createAdminClient(): SupabaseClient {
  if (typeof window !== "undefined") throw new Error("admin client must never be used in the browser");
  if (!admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase env vars missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
    admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return admin;
}
