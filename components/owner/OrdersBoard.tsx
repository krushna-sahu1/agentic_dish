"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Clock, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { executeOwnerChange, liveOrdersAction } from "@/app/actions/owner";
import type { OwnerOrderView } from "@/lib/services/owner";
import { createClient } from "@/lib/supabase/client";
import { formatINR, STATUS_LABEL } from "@/lib/format";
import { formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";

const COLUMNS = [
  { status: "paid", title: "New" },
  { status: "accepted", title: "Accepted" },
  { status: "preparing", title: "Preparing" },
  { status: "ready", title: "Ready" },
  { status: "out_for_delivery", title: "Out for delivery" },
] as const;

const ACTION_LABEL: Record<string, string> = { accepted: "Accept", preparing: "Start preparing", ready: "Mark ready", out_for_delivery: "Out for delivery", completed: "Complete" };
const strip = (s: string | null) => (s ? s.replace(/<\/?user_text>/g, "") : s);

/** Kitchen screen: live kanban of active orders (Supabase Realtime). Each button click is the human confirmation. */
export function OrdersBoard({ initial }: { initial: { active: OwnerOrderView[]; recent: OwnerOrderView[] } }) {
  const [data, setData] = useState(initial);
  const [pending, start] = useTransition();
  const [cancel, setCancel] = useState<OwnerOrderView | null>(null);
  const [reason, setReason] = useState("");
  const [eta, setEta] = useState<Record<string, number>>({});

  const reload = useCallback(async () => {
    const r = await liveOrdersAction();
    if (r.ok) setData(r.data);
  }, []);

  useEffect(() => {
    const t = setInterval(reload, 30_000);
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return () => clearInterval(t);
    const supabase = createClient();
    const ch = supabase.channel("orders-board").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => void reload()).subscribe();
    return () => {
      clearInterval(t);
      void supabase.removeChannel(ch);
    };
  }, [reload]);

  const move = (o: OwnerOrderView, status: string) =>
    start(async () => {
      const r = await executeOwnerChange("update_order_status", { order_ref: o.order_number, status, eta_minutes: status === "accepted" ? (eta[o.id] ?? 20) : undefined });
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.data.message);
      void reload();
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid min-h-[60vh] flex-1 auto-cols-[minmax(260px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
        {COLUMNS.map((col) => {
          const orders = data.active.filter((o) => o.status === col.status).sort((a, b) => a.created_at.localeCompare(b.created_at));
          return (
            <section key={col.status} aria-label={col.title} className="flex min-h-0 flex-col rounded-2xl bg-muted/60 p-2.5">
              <h2 className="mb-2.5 flex items-center justify-between px-1.5 text-sm font-medium">
                {col.title} <span className="rounded-full bg-card px-2 py-0.5 text-xs tabular-nums">{orders.length}</span>
              </h2>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                {orders.map((o) => (
                  <article key={o.id} data-testid="board-order" data-order={o.order_number} className={cn("animate-rise rounded-xl border bg-card p-3 text-sm shadow-sm", col.status === "paid" && "border-primary/60 ring-1 ring-primary/30")}>
                    <div className="flex items-center justify-between">
                      <Link href={`/owner/orders/${o.id}`} className="text-base font-semibold hover:underline">#{o.order_number.split("-").pop()}</Link>
                      <span className={cn("flex items-center gap-1 text-xs", o.minutes_in_status > 20 ? "font-semibold text-destructive" : "text-muted-foreground")}>
                        <Clock className="size-3" /> {o.minutes_in_status}m
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {o.order_type.replace("_", "-")}{o.table_number ? ` · Table ${o.table_number}` : ""} · {formatINR(o.total_paise)} · {o.customer_name ?? ""}
                    </p>
                    <ul className="mt-1.5 space-y-0.5">
                      {o.items.map((i, k) => (
                        <li key={k}>
                          <b>{i.qty}×</b> {i.name_snapshot}
                          {(i.variant_snapshot || i.addons_snapshot?.length || i.special_instructions) && (
                            <span className="block pl-4 text-xs text-warning">{[i.variant_snapshot?.name, ...(i.addons_snapshot ?? []).map((a) => `+${a.name}`), strip(i.special_instructions)].filter(Boolean).join(" · ")}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {o.notes && <p className="mt-1.5 rounded-lg bg-muted px-2 py-1 text-xs">Note: {strip(o.notes)}</p>}
                    {o.scheduled_for && <p className="mt-1 text-xs text-primary">Scheduled {formatTime(o.scheduled_for)}</p>}
                    {o.estimated_ready_at && col.status !== "paid" && <p className="mt-1 text-xs text-muted-foreground">ETA {formatTime(o.estimated_ready_at)}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {col.status === "paid" && (
                        <select aria-label="Ready in minutes" className="h-8 rounded-full border bg-card px-2 text-xs" value={eta[o.id] ?? 20} onChange={(e) => setEta({ ...eta, [o.id]: Number(e.target.value) })}>
                          {[10, 15, 20, 30, 45].map((m) => <option key={m} value={m}>{m} min</option>)}
                        </select>
                      )}
                      {o.next_statuses.filter((s) => s !== "cancelled" && (s !== "out_for_delivery" || o.order_type === "delivery")).slice(0, 2).map((s) => (
                        <Button key={s} size="sm" className="h-8" variant={s === o.next_statuses[0] ? "default" : "outline"} disabled={pending} onClick={() => move(o, s)}>
                          {ACTION_LABEL[s]}
                        </Button>
                      ))}
                      {o.next_statuses.includes("cancelled") && (
                        <Button size="icon" variant="ghost" className="ml-auto size-8 text-destructive" aria-label={`Cancel ${o.order_number}`} onClick={() => { setCancel(o); setReason(""); }}>
                          <X />
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
                {orders.length === 0 && <p className="rounded-xl border border-dashed px-2 py-6 text-center text-xs text-muted-foreground">No orders</p>}
              </div>
            </section>
          );
        })}
      </div>
      {data.recent.length > 0 && (
        <details className="mt-3 rounded-2xl border bg-card px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium">Done today ({data.recent.length})</summary>
          <ul className="mt-1 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
            {data.recent.map((o) => <li key={o.id}><Link className="hover:underline" href={`/owner/orders/${o.id}`}>{o.order_number}</Link> · {STATUS_LABEL[o.status]} · {formatINR(o.total_paise)}</li>)}
          </ul>
        </details>
      )}
      <Dialog open={!!cancel} onClose={() => setCancel(null)} title={`Cancel ${cancel?.order_number ?? ""}?`}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!cancel) return;
            start(async () => {
              const r = await executeOwnerChange("cancel_order", { order_ref: cancel.order_number, reason });
              if (!r.ok) return void toast.error(r.error);
              toast.success(r.data.message);
              setCancel(null);
              void reload();
            });
          }}
        >
          <Input aria-label="Reason" required minLength={3} placeholder="Reason (shared with the customer)" value={reason} onChange={(e) => setReason(e.target.value)} />
          {cancel?.paid_at && <p className="text-xs text-warning">This order is paid. Cancelling doesn&apos;t refund it — ask the assistant to issue a refund after.</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCancel(null)}>Keep order</Button>
            <Button type="submit" variant="destructive" disabled={pending}>Cancel order</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
