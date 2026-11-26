"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { STATUS_LABEL } from "@/lib/format";
import { formatDateTime, formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";

type Ev = { status: string; at: string; note: string | null };

const HEADLINE: Record<string, string> = {
  awaiting_payment: "Waiting for your payment.",
  paid: "Sent to the kitchen.",
  accepted: "The kitchen has it.",
  preparing: "Sizzling on the tawa.",
  ready: "Ready and waiting.",
  out_for_delivery: "On its way to you.",
  completed: "Enjoy your meal.",
  cancelled: "This order was cancelled.",
  refunded: "This order was refunded.",
  payment_failed: "The payment didn't go through.",
};

/** Live status timeline via Supabase Realtime (orders + order_status_events). */
export function OrderTracker({ orderId, orderType, initialStatus, initialEta, initialEvents }: { orderId: string; orderType: string; initialStatus: string; initialEta: string | null; initialEvents: Ev[] }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [eta, setEta] = useState(initialEta);
  const [events, setEvents] = useState(initialEvents);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const supabase = createClient();
    const ch = supabase
      .channel(`track-${orderId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` }, (p) => {
        const row = p.new as { status: string; estimated_ready_at: string | null };
        setStatus(row.status);
        setEta(row.estimated_ready_at);
        if (row.status === "completed") router.refresh();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_status_events", filter: `order_id=eq.${orderId}` }, (p) => {
        const e = p.new as { status: string; created_at: string; note: string | null };
        setEvents((list) => [...list, { status: e.status, at: e.created_at, note: e.note }]);
      })
      .subscribe();
    return () => void supabase.removeChannel(ch);
  }, [orderId, router]);

  const flow = ["awaiting_payment", "paid", "accepted", "preparing", "ready", ...(orderType === "delivery" ? ["out_for_delivery"] : []), "completed"];
  const reached = new Set(events.map((e) => e.status));
  const terminal = ["cancelled", "refunded", "payment_failed"].includes(status);

  const steps = terminal ? [] : flow.filter((s) => s !== "awaiting_payment");
  const currentIdx = steps.indexOf(status);
  const showEta = eta && !terminal && !["completed", "awaiting_payment"].includes(status);

  return (
    <section className="overflow-hidden rounded-[28px] border bg-card" aria-live="polite">
      <div className="bg-[#14130f] p-6 text-[#f4f3ef] sm:p-8 dark:bg-muted">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <Badge
              variant={terminal ? "destructive" : status === "completed" ? "success" : "saffron"}
              className={cn(terminal ? "bg-[#f06a63]/15 text-[#f9a29d]" : status === "completed" ? "bg-[#3fcb7e]/15 text-[#5fe09a]" : "bg-[#ff7a2e]/15 text-[#ff9a5c]")}
              data-testid="order-status"
            >
              <span className={cn("size-1.5 rounded-full bg-current", !terminal && status !== "completed" && "animate-pulse")} aria-hidden />
              {STATUS_LABEL[status] ?? status}
            </Badge>
            <p className="mt-4 max-w-md font-display text-3xl leading-[1.05] sm:text-4xl">{HEADLINE[status] ?? STATUS_LABEL[status] ?? status}</p>
          </div>
          {showEta && (
            <div className="text-right">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#a8a59d]">Ready around</p>
              <p className="mt-1 flex items-center justify-end gap-2 font-display text-5xl leading-none">
                <Clock className="size-6 text-[#ff7a2e]" aria-hidden />
                {formatTime(eta)}
              </p>
            </div>
          )}
        </div>
        {steps.length > 0 && (
          <ol className="mt-8 grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label="Order progress">
            {steps.map((s, i) => {
              const done = currentIdx >= i || reached.has(s);
              return (
                <li key={s} className="min-w-0">
                  <span className={cn("block h-1.5 rounded-full", done ? "bg-[#ff7a2e]" : "bg-white/15")} />
                  <span className={cn("mt-2 block truncate text-xs", done ? "text-[#f4f3ef]" : "text-[#8d8a83]")}>{STATUS_LABEL[s]?.split(" — ")[0] ?? s}</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      <div className="p-6 sm:p-8">
        <h2 className="text-base font-semibold">What&apos;s happened</h2>
        <ol className="mt-5 space-y-4">
          {(terminal ? events.map((e) => e.status) : flow).map((s, i) => {
            const ev = [...events].reverse().find((e) => e.status === s);
            const done = reached.has(s) || flow.indexOf(status) >= flow.indexOf(s);
            return (
              <li key={`${s}-${i}`} className="flex items-start gap-3">
                {done ? <CheckCircle2 className="mt-0.5 size-5 text-success" /> : <Circle className="mt-0.5 size-5 text-muted-foreground/60" />}
                <div className={cn("text-sm", !done && "text-muted-foreground")}>
                  <p className="font-medium">{STATUS_LABEL[s] ?? s}</p>
                  {ev && <p className="mt-0.5 font-mono text-xs text-muted-foreground">{formatDateTime(ev.at)}{ev.note ? ` · ${ev.note}` : ""}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
