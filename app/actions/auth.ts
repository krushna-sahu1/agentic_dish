"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { postAuthPath } from "@/lib/auth";

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

/** Post-login/signup destination, resolved from the server session's role. */
export async function resolvePostAuthPath(next: string | null): Promise<string> {
  return postAuthPath(next);
}
