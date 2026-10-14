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

  return (
    <section className="rounded-xl border bg-card p-4" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant={terminal ? "destructive" : status === "completed" ? "success" : "default"} data-testid="order-status">{STATUS_LABEL[status] ?? status}</Badge>
        {eta && !terminal && !["completed", "awaiting_payment"].includes(status) && (
          <span className="flex items-center gap-1.5 text-sm"><Clock className="size-4 text-primary" /> Ready around <b>{formatTime(eta)}</b></span>
        )}
      </div>
      <ol className="mt-4 space-y-3">
        {(terminal ? events.map((e) => e.status) : flow).map((s, i) => {
          const ev = [...events].reverse().find((e) => e.status === s);
          const done = reached.has(s) || flow.indexOf(status) >= flow.indexOf(s);
          return (
            <li key={`${s}-${i}`} className="flex items-start gap-3">
              {done ? <CheckCircle2 className="mt-0.5 size-5 text-success" /> : <Circle className="mt-0.5 size-5 text-muted-foreground" />}
              <div className={cn("text-sm", !done && "text-muted-foreground")}>
                <p className="font-medium">{STATUS_LABEL[s] ?? s}</p>
                {ev && <p className="text-xs text-muted-foreground">{formatDateTime(ev.at)}{ev.note ? ` · ${ev.note}` : ""}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
