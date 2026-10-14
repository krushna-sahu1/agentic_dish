"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { useAgent, useCopilotKit } from "@copilotkit/react-core/v2";

interface ChatActions {
  /** Voice-ready seam: any input source (typed, chips, cards, future mic) sends text through here. */
  submitUserMessage: (text: string) => Promise<void>;
  /** Append a local assistant note (e.g. payment confirmed via Realtime). */
  postAssistantNote: (text: string) => void;
}

const Ctx = createContext<ChatActions>({ submitUserMessage: async () => {}, postAssistantNote: () => {} });

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `m${Date.now()}${Math.random()}`);

export function ChatActionsProvider({ children, maxChars = 2000 }: { children: React.ReactNode; maxChars?: number }) {
  const { agent } = useAgent();
  const { copilotkit } = useCopilotKit();

  const submitUserMessage = useCallback(
    async (text: string) => {
      const t = text.trim().slice(0, maxChars);
      if (!t) return;
      agent.addMessage({ id: uid(), role: "user", content: t });
      await copilotkit.runAgent({ agent });
    },
    [agent, copilotkit, maxChars],
  );

  const postAssistantNote = useCallback(
    (text: string) => {
      agent.addMessage({ id: uid(), role: "assistant", content: text });
    },
    [agent],
  );

  const value = useMemo(() => ({ submitUserMessage, postAssistantNote }), [submitUserMessage, postAssistantNote]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useChatActions = () => useContext(Ctx);
