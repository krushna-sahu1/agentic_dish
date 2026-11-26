"use client";

import { MessageCircle } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { openChat } from "./chat-events";

/** Opens the AI host, optionally with a first message. Logged-out visitors get the log-in card (LazyCustomerChat). */
export function AskAiButton({ prompt, label = "Ask our AI", plain = false, ...props }: { prompt?: string; label?: string; plain?: boolean } & ButtonProps) {
  return (
    <Button {...props} onClick={() => openChat(prompt)}>
      {!plain && <MessageCircle />} {label}
    </Button>
  );
}
