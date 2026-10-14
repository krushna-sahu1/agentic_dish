"use client";

import { useEffect, useRef } from "react";
import { useAgent } from "@copilotkit/react-core/v2";
import { loadConversationAction, saveConversationAction } from "@/app/actions/chat";

/** Restores the user's latest conversation on mount and saves after each run. */
export function useChatPersistence(agentKind: "customer" | "owner", enabled: boolean) {
  const { agent, isReady } = useAgent();
  const convId = useRef<string | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (!enabled || !isReady || loaded.current) return;
    loaded.current = true;
    loadConversationAction(agentKind)
      .then((c) => {
        if (!c || agent.messages.length > 0) return;
        convId.current = c.conversationId;
        agent.setMessages(c.messages as Parameters<typeof agent.setMessages>[0]);
      })
      .catch(() => undefined);
  }, [agent, agentKind, enabled, isReady]);

  useEffect(() => {
    if (!enabled || !isReady) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        if (agent.isRunning || agent.messages.length === 0) return;
        const msgs = JSON.parse(JSON.stringify(agent.messages));
        convId.current = (await saveConversationAction(agentKind, convId.current, msgs).catch(() => null)) ?? convId.current;
      }, 800);
    };
    const sub = agent.subscribe({ onRunFinalized: save, onMessagesChanged: save });
    return () => {
      clearTimeout(t);
      sub.unsubscribe();
    };
  }, [agent, agentKind, enabled, isReady]);

  return {
    reset: () => {
      convId.current = null;
      agent.setMessages([]);
    },
  };
}
