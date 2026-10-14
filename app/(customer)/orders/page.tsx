import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ReorderButton } from "@/components/site/ReorderButton";
import { requireUser } from "@/lib/auth";
import { listMyOrders } from "@/lib/services/orders";
import { formatINR, STATUS_LABEL } from "@/lib/format";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "My orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const user = await requireUser();
  const orders = await listMyOrders(user.userId, 30);
  return (
    <div className="mx-auto max-w-3xl py-6">
      <h1 className="mb-4 font-display text-3xl font-semibold">My orders</h1>
      {orders.length === 0 ? (
        <p className="text-muted-foreground">
          No orders yet. <Link href="/menu" className="text-primary hover:underline">Browse the menu</Link>
        </p>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/orders/${o.id}`} className="font-semibold hover:underline">{o.order_number}</Link>
                <Badge variant={o.status === "completed" ? "success" : ["cancelled", "refunded", "payment_failed"].includes(o.status) ? "muted" : "default"}>{STATUS_LABEL[o.status]}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(o.created_at)} · {o.order_type.replace("_", "-")} · {formatINR(o.total_paise)}</p>
              <p className="mt-1 text-sm">{o.order_items.map((i) => `${i.qty}× ${i.name_snapshot}`).join(", ")}</p>
              <div className="mt-3 flex gap-2">
                <Link href={`/orders/${o.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>Details</Link>
                <ReorderButton orderId={o.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
