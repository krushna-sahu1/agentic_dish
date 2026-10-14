"use client";

import { Sparkles } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { openChat } from "./chat-events";

export function AskAiButton({ prompt, label = "Ask our AI", ...props }: { prompt?: string; label?: string } & ButtonProps) {
  return (
    <Button {...props} onClick={() => openChat(prompt)}>
      <Sparkles /> {label}
    </Button>
  );
}
