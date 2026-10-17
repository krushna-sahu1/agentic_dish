"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useSession } from "@/components/providers/SessionProvider";
import { LoginToChatCard } from "@/components/chat/LoginToChatCard";
import { openChat } from "./chat-events";

/**
 * Opens the AI host. The chat now requires a session, so logged-out visitors get
 * a "log in to chat" card instead of starting the assistant.
 */
export function AskAiButton({ prompt, label = "Ask our AI", ...props }: { prompt?: string; label?: string } & ButtonProps) {
  const session = useSession();
  const [loginCard, setLoginCard] = useState(false);
  return (
    <>
      <Button {...props} onClick={() => (session ? openChat(prompt) : setLoginCard(true))}>
        <Sparkles /> {label}
      </Button>
      {!session && loginCard && <LoginToChatCard onClose={() => setLoginCard(false)} />}
    </>
  );
}
