import { OwnerChat } from "@/components/owner/OwnerChat";
import { requireRole } from "@/lib/auth";
import { canUseTool } from "@/lib/agents/guard";
import { OWNER_CHANGE_NAMES } from "@/lib/agents/owner/changes";
import { createAdminClient } from "@/lib/supabase/admin";
import { zonedDateString, addDays } from "@/lib/time";

export const metadata = { title: "AI assistant" };

export default async function OwnerAssistantPage() {
  const user = await requireRole(["owner", "staff"]);
  const role = user.role === "owner" ? "owner" : "staff";
  const allowed = OWNER_CHANGE_NAMES.filter((n) => canUseTool({ agent: "owner", role: user.role, userId: user.userId }, n).ok);

  // "Good morning — here's yesterday" (written by the daily-summary cron).
  let greeting: { title: string; lines: string[] } | null = null;
  if (role === "owner") {
    const yesterday = addDays(zonedDateString(new Date()), -1);
    const { data } = await createAdminClient().from("owner_alerts").select("title, data").eq("dedupe_key", `daily-summary-${yesterday}`).maybeSingle();
    if (data) greeting = { title: data.title as string, lines: ((data.data as { lines?: string[] })?.lines ?? []) as string[] };
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col px-3 py-4 sm:px-6 lg:px-10 lg:py-8">
      <OwnerChat role={role} allowedChanges={allowed} greeting={greeting} />
    </div>
  );
}
