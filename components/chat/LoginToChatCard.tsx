"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shown in place of the AI chat when the visitor isn't logged in — the chat
 * itself now requires a session. Uses the same /login?next= redirect as the
 * rest of the site.
 */
export function LoginToChatCard({ onClose, className }: { onClose?: () => void; className?: string }) {
  const pathname = usePathname();
  // Return to this page after auth and auto-open the chat once (the ?openChat=1 flag).
  const next = encodeURIComponent(`${pathname}?openChat=1`);
  return (
    <div
      role="dialog"
      aria-label="Log in to chat with our AI host"
      data-testid="chat-login-card"
      data-theme="ai"
      className={cn("chat-login-card", className)}
    >
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Close" className="chat-login-card__close">
          <X aria-hidden />
        </button>
      )}
      <p className="chat-login-card__title">
        <span className="chat-login-card__icon" aria-hidden>
          <Sparkles />
        </span>
        Log in to chat with our AI host
      </p>
      <div className="chat-login-card__actions">
        <Link href={`/login?next=${next}`} className="chat-login-card__primary">
          <LogIn aria-hidden /> Log in
        </Link>
        <Link href={`/signup?next=${next}`} className="chat-login-card__secondary">
          Sign up
        </Link>
      </div>
    </div>
  );
}
