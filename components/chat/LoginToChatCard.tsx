"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn, Sparkles, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
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
      className={cn(
        "fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-50 w-[min(20rem,calc(100vw-2rem))] animate-rise rounded-2xl border bg-card p-4 text-card-foreground shadow-[0_18px_40px_-12px_rgb(0_0_0/0.35)] sm:right-6",
        className,
      )}
    >
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <X className="size-4" />
        </button>
      )}
      <p className="flex items-center gap-2 pr-6 text-sm font-medium">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Sparkles className="size-3.5" aria-hidden />
        </span>
        Log in to chat with our AI host
      </p>
      <div className="mt-3 flex gap-2">
        <Link href={`/login?next=${next}`} className={buttonVariants({ size: "sm" })}>
          <LogIn aria-hidden /> Log in
        </Link>
        <Link href={`/signup?next=${next}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
          Sign up
        </Link>
      </div>
    </div>
  );
}
