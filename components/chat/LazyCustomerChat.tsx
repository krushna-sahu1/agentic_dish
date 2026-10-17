"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useSession } from "@/components/providers/SessionProvider";
import { openChat } from "@/components/site/chat-events";
import { ChatLauncher } from "./ChatLauncher";
import { LoginToChatCard } from "./LoginToChatCard";

const CustomerChat = dynamic(() => import("./CustomerChat").then((m) => m.CustomerChat), { ssr: false });

type Props = { restaurantName: string; isOpen: boolean; statusLabel: string; menuItemNames: string[] };

/**
 * Keeps the AI chat bundle off the critical path (Lighthouse): renders only the
 * launcher until the user clicks it, something calls openChat(), or the browser
 * is idle. When the visitor isn't logged in the chat never starts — the gate
 * shows a "log in to chat" card instead.
 */
export function LazyCustomerChat(props: Props) {
  const session = useSession();
  const [load, setLoad] = useState(false);
  const [loginCard, setLoginCard] = useState(false);
  const [initial, setInitial] = useState<{ open: boolean; prompt?: string }>({ open: false });

  useEffect(() => {
    if (load) return;
    const onOpen = (e: Event) => {
      if (!session) {
        setLoginCard(true);
        return;
      }
      setInitial({ open: true, prompt: (e as CustomEvent<{ prompt?: string }>).detail?.prompt });
      setLoad(true);
    };
    window.addEventListener("agentic:open-chat", onOpen);
    if (!session) return () => window.removeEventListener("agentic:open-chat", onOpen);
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    const idle = w.requestIdleCallback ? w.requestIdleCallback(() => setLoad(true), { timeout: 6000 }) : globalThis.setTimeout(() => setLoad(true), 4000);
    return () => {
      window.removeEventListener("agentic:open-chat", onOpen);
      if (w.cancelIdleCallback) w.cancelIdleCallback(idle as number);
      else clearTimeout(idle as unknown as number);
    };
  }, [load, session]);

  // Returning from login with ?openChat=1: open the chat once, then drop the flag.
  useEffect(() => {
    if (!session) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("openChat") !== "1") return;
    url.searchParams.delete("openChat");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    openChat();
  }, [session]);

  if (!session) {
    return loginCard ? (
      <LoginToChatCard onClose={() => setLoginCard(false)} />
    ) : (
      <ChatLauncher onClick={() => setLoginCard(true)} />
    );
  }

  if (load) return <CustomerChat {...props} initialOpen={initial.open} initialPrompt={initial.prompt} />;
  return (
    <ChatLauncher
      onClick={() => {
        setInitial({ open: true });
        setLoad(true);
      }}
    />
  );
}
