import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, Role } from "@/lib/types";

export interface SessionUser {
  userId: string;
  email: string | null;
  role: Role;
  profile: Profile | null;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public code: "unauthenticated" | "forbidden" = "unauthenticated",
  ) {
    super(message);
  }
}

/**
 * Verified user for this request. The role is always read from `profiles`
 * server-side — never from anything the client sends.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await createAdminClient().from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  return {
    userId: user.id,
    email: user.email ?? null,
    role: (profile?.role as Role) ?? "customer",
    profile: (profile as Profile) ?? null,
  };
});

export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) throw new AuthError("Please log in to continue.");
  return u;
}

export async function requireRole(roles: Role[]): Promise<SessionUser> {
  const u = await requireUser();
  if (!roles.includes(u.role)) throw new AuthError("You don't have access to this.", "forbidden");
  return u;
}
