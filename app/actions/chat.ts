"use server";

/** Chat history persistence (agent_conversations / agent_messages), per user and agent. */
import { getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type StoredMessage = { id: string; role: string; content?: unknown; toolCalls?: unknown; toolCallId?: string };
const MAX_MESSAGES = 80;

export async function loadConversationAction(agent: "customer" | "owner") {
  const user = await getSessionUser();
  if (!user) return null;
  const db = createAdminClient();
  const { data: conv } = await db
    .from("agent_conversations")
    .select("id, title, last_message_at")
    .eq("user_id", user.userId)
    .eq("agent", agent)
    .gte("last_message_at", new Date(Date.now() - 7 * 86_400_000).toISOString())
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!conv) return null;
  const { data: rows } = await db.from("agent_messages").select("content").eq("conversation_id", conv.id).order("created_at").limit(MAX_MESSAGES);
  return { conversationId: conv.id as string, messages: (rows ?? []).map((r) => r.content as StoredMessage) };
}

export async function saveConversationAction(agent: "customer" | "owner", conversationId: string | null, messages: StoredMessage[]) {
  const user = await getSessionUser();
  if (!user || !Array.isArray(messages) || messages.length === 0) return null;
  if (agent === "owner" && user.role !== "owner" && user.role !== "staff") return null;
  const db = createAdminClient();
  const trimmed = messages.slice(-MAX_MESSAGES).map((m) => ({
    id: String(m.id),
    role: String(m.role),
    content: typeof m.content === "string" ? m.content.slice(0, 20000) : m.content,
    toolCalls: m.toolCalls,
    toolCallId: m.toolCallId,
  }));
  let id = conversationId;
  if (id) {
    const { data } = await db.from("agent_conversations").select("id").eq("id", id).eq("user_id", user.userId).maybeSingle();
    if (!data) id = null;
  }
  if (!id) {
    const firstUser = trimmed.find((m) => m.role === "user");
    const { data, error } = await db
      .from("agent_conversations")
      .insert({ user_id: user.userId, agent, title: typeof firstUser?.content === "string" ? firstUser.content.slice(0, 80) : "Conversation" })
      .select("id")
      .single();
    if (error) return null;
    id = data.id as string;
  }
  await db.from("agent_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", id);
  await db.from("agent_messages").delete().eq("conversation_id", id);
  await db.from("agent_messages").insert(
    trimmed.map((m, i) => ({
      conversation_id: id,
      role: m.role,
      content: m,
      tool_calls: m.toolCalls ?? null,
      created_at: new Date(Date.now() + i).toISOString(),
    })),
  );
  return id;
}

export async function newConversationAction(agent: "customer" | "owner") {
  const user = await getSessionUser();
  if (!user) return null;
  // Starting fresh: the next save creates a new conversation row.
  await createAdminClient()
    .from("agent_conversations")
    .update({ last_message_at: new Date(Date.now() - 8 * 86_400_000).toISOString() })
    .eq("user_id", user.userId)
    .eq("agent", agent);
  return true;
}
