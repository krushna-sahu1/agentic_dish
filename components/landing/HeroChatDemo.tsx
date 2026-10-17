import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * CSS-only animated chat demo that replaces the hero food photo.
 * The animated rainbow border lives here and nowhere else on the page.
 */
export function HeroChatDemo({ open, statusLabel }: { open: boolean; statusLabel: string }) {
  return (
    <div className="relative mx-auto w-full max-w-md animate-fade lg:max-w-none">
      {/* Soft blue halo behind the ring */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-6 -bottom-10 top-10 -z-10 rounded-[3rem] bg-primary/10 blur-3xl"
      />
      <div className="ai-ring rounded-[1.75rem] p-1 shadow-[0_40px_120px_-45px_rgb(47_107_255/0.55)]">
        <div className="rounded-[1.5rem] bg-card p-4 sm:p-5">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
              <Sparkles className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">AI host</p>
              <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <span className={cn("size-1.5 rounded-full", open ? "bg-success" : "bg-muted-foreground")} aria-hidden />
                {statusLabel}
              </p>
            </div>
            <span className="ai-float shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">Live</span>
          </div>

          <div className="space-y-3 pt-4 text-sm">
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-foreground px-3.5 py-2 text-background">
              Something light, no onion, under ₹250
            </p>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Sparkles className="size-3" aria-hidden />
              </span>
              <div className="rounded-2xl rounded-tl-md bg-muted px-3.5 py-2">
                <p className="flex items-center gap-1 font-medium text-foreground">
                  <Check className="size-3.5 text-success" aria-hidden /> 2 dishes · ₹240
                </p>
                <p className="mt-0.5 text-muted-foreground">No onion and no peanut — cleared against your allergies.</p>
              </div>
            </div>
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-foreground px-3.5 py-2 text-background">Book a table for 4 tonight?</p>
            <div className="flex w-fit items-center gap-1.5 rounded-2xl rounded-tl-md bg-muted px-3.5 py-3">
              <span className="ai-dot size-1.5 rounded-full bg-muted-foreground" />
              <span className="ai-dot size-1.5 rounded-full bg-muted-foreground" />
              <span className="ai-dot size-1.5 rounded-full bg-muted-foreground" />
            </div>
          </div>

          <p className="mt-4 text-center text-[11px] text-muted-foreground">AI can make mistakes. You confirm every order.</p>
        </div>
      </div>
    </div>
  );
}
