"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAgent } from "@copilotkit/react-core/v2";
import { useChatActions } from "./chat-actions";

/** The four starter prompts — welcome cards before the first message, chips after it. */
export const CHAT_SUGGESTIONS = [
  { title: "What's spicy?", message: "Which dishes are spicy?" },
  { title: "Veg meal under ₹300", message: "Suggest a veg meal under ₹300" },
  { title: "Add my usual", message: "Add my usual to the cart" },
  { title: "Track my order", message: "Where's my food?" },
];

interface ChatUi {
  /** True once the conversation has at least one message. */
  hasMessages: boolean;
  /** Send a canned prompt (welcome card or chip). */
  sendSuggestion: (text: string) => void;
  /** Latest assistant text — mirrored into an aria-live region. */
  lastAssistantText: string;
}

const Ctx = createContext<ChatUi>({ hasMessages: false, sendSuggestion: () => {}, lastAssistantText: "" });

/**
 * Small UI seam between the chat surface (composer, welcome cards, chips) and
 * the agent: it knows whether the thread has messages yet, can send a canned
 * prompt (waiting for the agent to be ready) and exposes the last reply for
 * screen readers.
 */
export function ChatUiProvider({ children }: { children: React.ReactNode }) {
  const { agent, isReady } = useAgent();
  const { submitUserMessage } = useChatActions();
  const [hasMessages, setHasMessages] = useState(false);
  const [lastAssistantText, setLastAssistantText] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const hasMessagesRef = useRef(false);

  useEffect(() => {
    const syncMessages = () => {
      const next = agent.messages.length > 0;
      if (next === hasMessagesRef.current) return;
      hasMessagesRef.current = next;
      setHasMessages(next);
    };
    const syncReply = () => {
      const last = [...agent.messages].reverse().find((m) => m.role === "assistant");
      const text = typeof last?.content === "string" ? last.content : "";
      setLastAssistantText(text);
    };
    syncMessages();
    const sub = agent.subscribe({ onMessagesChanged: syncMessages, onRunFinalized: syncReply });
    return () => sub.unsubscribe();
  }, [agent]);

  // A prompt tapped before the runtime finished connecting is sent as soon as it is ready.
  useEffect(() => {
    if (!pending || !isReady) return;
    const text = pending;
    setPending(null);
    void submitUserMessage(text);
  }, [pending, isReady, submitUserMessage]);

  const sendSuggestion = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t) return;
      if (isReady) void submitUserMessage(t);
      else setPending(t);
    },
    [isReady, submitUserMessage],
  );

  const value = useMemo(() => ({ hasMessages, sendSuggestion, lastAssistantText }), [hasMessages, sendSuggestion, lastAssistantText]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useChatUi = () => useContext(Ctx);
