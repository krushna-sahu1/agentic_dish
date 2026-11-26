import { ShieldCheck, ShoppingBag, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Static, CSS-only preview of the AI host shown in the home hero.
 * Shows the agent "working out loud" (mono trace lines) and the human-only Pay rule.
 */
export function HeroChatDemo({ open, statusLabel }: { open: boolean; statusLabel: string }) {
  return (
    <div className="relative mx-auto w-full max-w-lg animate-fade lg:max-w-none">
      <div className="ai-ring rounded-[1.75rem] p-2.5">
        <div className="flex items-center gap-3 border-b px-3 pb-3.5 pt-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-iris-soft text-iris">
            <Sparkles className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">AI host</p>
            <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <span className={cn("size-1.5 rounded-full", open ? "bg-success" : "bg-muted-foreground")} aria-hidden />
              {statusLabel}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-success/12 px-2.5 py-1 text-[11px] font-medium text-success">Live</span>
        </div>

        <div className="space-y-3.5 rounded-b-[1.3rem] bg-background/60 px-3 pb-3 pt-4 text-sm">
          <p className="ml-auto w-fit max-w-[85%] rounded-[18px] rounded-br-[4px] bg-foreground px-4 py-2.5 text-[15px] text-background">
            Something light, no onion, under ₹250
          </p>
          <p className="agent-trace flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-iris" aria-hidden />
            search_menu(no onion, ≤ ₹250) · check_allergens ✓
          </p>
          <p className="text-[15px] leading-relaxed">Two light picks — both clear of onion and your saved allergies.</p>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { name: "Idli", price: "₹60", img: "/dishes/idli.svg" },
              { name: "Ghee Roast Dosa", price: "₹150", img: "/dishes/dosa.svg" },
            ].map((d) => (
              <div key={d.name} className="overflow-hidden rounded-[14px] border bg-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.img} alt="" width={200} height={150} className="aspect-[4/3] w-full object-cover" />
                <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                  <span className="truncate text-[13px] font-semibold">{d.name}</span>
                  <span className="font-mono text-xs">{d.price}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2.5 rounded-[14px] border bg-card px-3.5 py-3">
            <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden />
            <p className="text-[13px] text-muted-foreground">
              Ready to pay <span className="font-mono text-foreground">₹210</span> — only you can press Pay.
            </p>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-7 -left-4 hidden items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-[0_20px_40px_-20px_rgb(20_19_15/0.35)] sm:flex lg:-left-8">
        <span className="flex size-9 items-center justify-center rounded-[10px] bg-saffron-soft text-saffron-ink">
          <ShoppingBag className="size-4" aria-hidden />
        </span>
        <div>
          <p className="text-[13px] font-semibold">2 items · ₹210</p>
          <p className="text-xs text-muted-foreground">Allergen-checked</p>
        </div>
      </div>
    </div>
  );
}
