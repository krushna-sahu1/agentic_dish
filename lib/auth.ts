import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, Role } from "@/lib/types";

export interface SessionUser {
  userId: string;
  email: string | null;
  role: Role;
  profile: Profile | null;
}

/**
 * Verified user for this request. The role is always read from `profiles`
 * server-side — never from anything the client sends.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  const supabase = await createClient();
  let { data, error } = await supabase.auth.getUser();
  // A dropped connection is not a sign-out: try once more before treating it as one.
  if (error?.name === "AuthRetryableFetchError") ({ data, error } = await supabase.auth.getUser());
  const user = data.user;
  if (!user) return null;
  const { data: profile } = await createAdminClient().from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  return {
    userId: user.id,
    email: user.email ?? null,
    role: (profile?.role as Role) ?? "customer",
    profile: (profile as Profile) ?? null,
  };
});

async function toLogin(): Promise<never> {
  const path = (await headers()).get("x-pathname") ?? "/";
  redirect(`/login?next=${encodeURIComponent(path)}`);
}

/** For pages: the signed-in user, or a redirect to log in. */
export async function requireUser(): Promise<SessionUser> {
  return (await getSessionUser()) ?? toLogin();
}

/** For pages: a signed-in user with one of these roles, else a redirect. */
export async function requireRole(roles: Role[]): Promise<SessionUser> {
  const u = await requireUser();
  if (!roles.includes(u.role)) redirect("/");
  return u;
}

/** A safe in-app path from a `next` param — blocks open redirects (no `//` host). */
export function safeNextPath(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

/**
 * Where to send someone after auth. An explicit safe `next` wins; otherwise the
 * owner/staff dashboard or the menu, using the server-verified role (never the
 * client). Server-only — it reads the request's auth cookies.
 */
export async function postAuthPath(next?: string | null): Promise<string> {
  const safe = safeNextPath(next);
  if (safe !== "/") return safe;
  const user = await getSessionUser();
  return user && (user.role === "owner" || user.role === "staff") ? "/owner" : "/menu";
}
