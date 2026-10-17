"use client";

import { Sparkles } from "lucide-react";

/** Floating "Ask our AI host" pill — identical before and after the chat bundle loads. */
export function ChatLauncher({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-40 flex animate-rise items-center gap-2.5 rounded-full bg-foreground py-2 pl-2 pr-5 text-sm font-medium text-background shadow-[0_18px_40px_-12px_rgb(0_0_0/0.45)] transition-transform hover:-translate-y-0.5 focus-visible:outline-offset-4 sm:right-6"
      aria-label="Open the AI assistant"
      data-theme="ai"
      data-testid="chat-launcher"
    >
      <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Sparkles className="size-4" aria-hidden />
      </span>
      <span>
        Ask our AI <span className="hidden sm:inline">host</span>
      </span>
    </button>
  );
}
