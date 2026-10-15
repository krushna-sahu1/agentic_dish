"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { executeOwnerChange } from "@/app/actions/owner";
import { ChangeDialog } from "./ChangeDialog";

const ACTION_LABEL: Record<string, string> = { accepted: "Accept order", preparing: "Start preparing", ready: "Mark ready", out_for_delivery: "Out for delivery", completed: "Complete" };

/** Status buttons for a single order. Every click is the human confirmation (same as the live board). */
export function OrderActions({
  order,
  isOwner,
}: {
  order: { order_number: string; status: string; order_type: string; next_statuses: string[]; paid_at: string | null; refunded: boolean };
  isOwner: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [eta, setEta] = useState(20);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [refund, setRefund] = useState(false);

  const next = order.next_statuses.filter((s) => s !== "cancelled" && (s !== "out_for_delivery" || order.order_type === "delivery"));
  const canCancel = order.next_statuses.includes("cancelled");
  const canRefund = isOwner && !!order.paid_at && !order.refunded && ["cancelled", "completed"].includes(order.status);

  const move = (status: string) =>
    start(async () => {
      const r = await executeOwnerChange("update_order_status", { order_ref: order.order_number, status, eta_minutes: status === "accepted" ? eta : undefined });
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.data.message);
      router.refresh();
    });

  if (!next.length && !canCancel && !canRefund) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {order.status === "paid" && (
        <Select aria-label="Ready in minutes" className="h-10 w-auto rounded-full" value={eta} onChange={(e) => setEta(Number(e.target.value))}>
          {[10, 15, 20, 30, 45].map((m) => (
            <option key={m} value={m}>
              Ready in {m} min
            </option>
          ))}
        </Select>
      )}
      {next.slice(0, 2).map((s, i) => (
        <Button key={s} variant={i === 0 ? "default" : "outline"} disabled={pending} onClick={() => move(s)}>
          {ACTION_LABEL[s] ?? s}
        </Button>
      ))}
      {canCancel && (
        <Button
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={pending}
          onClick={() => {
            setReason("");
            setCancelOpen(true);
          }}
        >
          <X /> Cancel order
        </Button>
      )}
      {canRefund && (
        <Button variant="outline" onClick={() => setRefund(true)}>
          <RotateCcw /> Issue refund
        </Button>
      )}

      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} title={`Cancel ${order.order_number}?`}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await executeOwnerChange("cancel_order", { order_ref: order.order_number, reason });
              if (!r.ok) return void toast.error(r.error);
              toast.success(r.data.message);
              setCancelOpen(false);
              router.refresh();
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason">Reason</Label>
            <Input id="cancel-reason" required minLength={3} placeholder="Shared with the customer" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {order.paid_at && <p className="rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning">This order is paid. Cancelling doesn&apos;t refund it — use “Issue refund” afterwards.</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCancelOpen(false)}>
              Keep order
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              Cancel order
            </Button>
          </div>
        </form>
      </Dialog>

      <ChangeDialog
        change={refund ? { name: "issue_refund", args: { order_ref: order.order_number, reason: order.status === "cancelled" ? "Order cancelled" : "Refund issued by the restaurant" }, title: `Refund ${order.order_number}` } : null}
        onClose={(applied) => {
          setRefund(false);
          if (applied) router.refresh();
        }}
      />
    </div>
  );
}
