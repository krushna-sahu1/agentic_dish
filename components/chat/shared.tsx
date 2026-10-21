"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircle2, Loader2, LogIn, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ParsedResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: string; data?: Record<string, unknown> };

/** Tool results arrive as JSON strings ({ok,data} | {ok:false,error,code}). */
export function parseResult<T = unknown>(result: string | undefined | null): ParsedResult<T> | null {
  if (result == null) return null;
  try {
    const v = typeof result === "string" ? JSON.parse(result) : result;
    if (v && typeof v === "object" && "ok" in v) return v as ParsedResult<T>;
    return { ok: true, data: v as T };
  } catch {
    return { ok: false, error: String(result) };
  }
}

const PROGRESS: Record<string, string> = {
  search_menu: "Looking through the menu…",
  get_item_details: "Fetching dish details…",
  get_recommendations: "Picking recommendations…",
  get_pairings: "Finding good pairings…",
  add_to_cart: "Adding to cart…",
  update_cart_item: "Updating your cart…",
  remove_from_cart: "Removing from cart…",
  view_cart: "Checking your cart…",
  set_order_options: "Updating order options…",
  apply_coupon: "Applying coupon…",
  remove_coupon: "Removing coupon…",
  prepare_checkout: "Preparing your checkout…",
  get_order_status: "Checking your order…",
  reorder: "Adding your previous order…",
  get_revenue: "Crunching revenue…",
  get_top_items: "Ranking dishes…",
  compare_periods: "Comparing periods…",
  get_peak_hours: "Mapping busy hours…",
  get_feedback_summary: "Reading reviews…",
  generate_report: "Building the report…",
};

export function ToolProgress({ name, done, error }: { name: string; done?: boolean; error?: string | null }) {
  const label = PROGRESS[name] ?? `${name.replace(/_/g, " ")}…`;
  return (
    <div
      className={cn(
        "my-1 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground",
        error && "border-destructive/40 text-destructive",
      )}
      role="status"
    >
      {error ? <XCircle className="size-3.5" /> : done ? <CheckCircle2 className="size-3.5 text-success" /> : <Loader2 className="size-3.5 animate-spin" />}
      {error ?? (done ? label.replace("…", "").replace(/ing\b/, "ed") : label)}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p className="my-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}

export function LoginPromptCard({ message = "Log in to manage your cart, orders and bookings." }: { message?: string }) {
  const pathname = usePathname();
  return (
    <CardShell>
      <p className="text-sm">{message}</p>
      <div className="mt-3 flex gap-2">
        <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="chat-card__action">
          <LogIn aria-hidden /> Log in
        </Link>
        <Link href={`/signup?next=${encodeURIComponent(pathname)}`} className="chat-card__action chat-card__action--ghost">
          Sign up
        </Link>
      </div>
    </CardShell>
  );
}

/**
 * The one card shell every tool result uses: rounded corners, light elevation
 * and (optionally) a header/footer. `tone="action"` marks the cards the user
 * has to act on (confirm, pay) so they read differently from pure information.
 */
export function CardShell({
  title,
  children,
  className,
  footer,
  tone = "info",
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
  tone?: "info" | "action" | "danger";
}) {
  return (
    <div
      className={cn(
        "chat-card my-2 w-full",
        tone === "action" && "chat-card--action",
        tone === "danger" && "chat-card--danger",
        className,
      )}
    >
      {title && <div className="chat-card__title">{title}</div>}
      <div className="chat-card__body">{children}</div>
      {footer && <div className="chat-card__footer">{footer}</div>}
    </div>
  );
}
