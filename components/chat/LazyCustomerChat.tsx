"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";

const CustomerChat = dynamic(() => import("./CustomerChat").then((m) => m.CustomerChat), { ssr: false });

type Props = { restaurantName: string; isOpen: boolean; statusLabel: string };

/**
 * Keeps the AI chat bundle off the critical path (Lighthouse): renders only the
 * launcher until the user clicks it, something calls openChat(), or the browser is idle.
 */
export function LazyCustomerChat(props: Props) {
  const [load, setLoad] = useState(false);
  const [initial, setInitial] = useState<{ open: boolean; prompt?: string }>({ open: false });

  useEffect(() => {
    if (load) return;
    const onOpen = (e: Event) => {
      setInitial({ open: true, prompt: (e as CustomEvent<{ prompt?: string }>).detail?.prompt });
      setLoad(true);
    };
    window.addEventListener("agentic:open-chat", onOpen);
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    const idle = w.requestIdleCallback ? w.requestIdleCallback(() => setLoad(true), { timeout: 6000 }) : globalThis.setTimeout(() => setLoad(true), 4000);
    return () => {
      window.removeEventListener("agentic:open-chat", onOpen);
      if (w.cancelIdleCallback) w.cancelIdleCallback(idle as number);
      else clearTimeout(idle as unknown as number);
    };
  }, [load]);

  if (load) return <CustomerChat {...props} initialOpen={initial.open} initialPrompt={initial.prompt} />;
  return (
    <button
      onClick={() => {
        setInitial({ open: true });
        setLoad(true);
      }}
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg"
      aria-label="Open the AI assistant"
      data-testid="chat-launcher"
    >
      <MessageCircle className="size-5" /> <span className="hidden sm:inline">Ask our AI</span>
    </button>
  );
}
