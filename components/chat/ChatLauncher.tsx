"use client";

import { Sparkles } from "lucide-react";

/** Floating "Ask our AI host" pill — identical before and after the chat bundle loads. */
export function ChatLauncher({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="chat-launcher"
      aria-label="Open the AI assistant"
      data-theme="ai"
      data-testid="chat-launcher"
    >
      <span className="chat-launcher__icon" aria-hidden>
        <Sparkles />
      </span>
      <span className="chat-launcher__label">
        Ask our AI <span className="hidden sm:inline">host</span>
      </span>
    </button>
  );
}
