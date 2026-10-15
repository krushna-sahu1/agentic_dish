import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { OwnerOrderView } from "@/lib/services/owner";
import { formatINR } from "@/lib/format";
import { formatDateTime } from "@/lib/time";
import { StatusBadge } from "./StatusBadge";

const TYPE_LABEL: Record<string, string> = { delivery: "Delivery", pickup: "Pickup", dine_in: "Dine-in" };
const shortNo = (n: string) => `#${n.split("-").pop()}`;
const itemsSummary = (o: OwnerOrderView) => o.items.map((i) => `${i.qty}× ${i.name_snapshot}`).join(", ");

/** Orders as a table on desktop and stacked rows on mobile; every row opens the order detail. */
export function OrdersTable({ orders }: { orders: OwnerOrderView[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-5 py-2.5 font-medium">Order</th>
              <th className="px-3 py-2.5 font-medium">Customer</th>
              <th className="px-3 py-2.5 font-medium">Items</th>
              <th className="px-3 py-2.5 font-medium">Type</th>
              <th className="px-3 py-2.5 text-right font-medium">Total</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Placed</th>
              <th className="w-10 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="group relative border-b transition-colors last:border-0 hover:bg-muted/40" data-testid="orders-row">
                <td className="px-5 py-3">
                  <Link href={`/owner/orders/${o.id}`} className="font-semibold after:absolute after:inset-0" aria-label={`Open order ${o.order_number}`}>
                    {shortNo(o.order_number)}
                  </Link>
                  <span className="block text-xs text-muted-foreground">{o.order_number}</span>
                </td>
                <td className="px-3 py-3">{o.customer_name ?? <span className="text-muted-foreground">Guest</span>}</td>
                <td className="max-w-64 px-3 py-3">
                  <span className="line-clamp-1 text-muted-foreground">{itemsSummary(o)}</span>
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  {TYPE_LABEL[o.order_type] ?? o.order_type}
                  {o.table_number ? ` · T${o.table_number}` : ""}
                </td>
                <td className="px-3 py-3 text-right font-medium tabular-nums">{formatINR(o.total_paise)}</td>
                <td className="px-3 py-3">
                  <StatusBadge status={o.status} />
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{formatDateTime(o.created_at)}</td>
                <td className="px-3 py-3 text-muted-foreground">
                  <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y border-t md:hidden">
        {orders.map((o) => (
          <li key={o.id}>
            <Link href={`/owner/orders/${o.id}`} className="flex items-start gap-3 px-4 py-3.5 active:bg-muted/60">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{shortNo(o.order_number)}</span>
                  <StatusBadge status={o.status} />
                </div>
                <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{itemsSummary(o)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {o.customer_name ?? "Guest"} · {TYPE_LABEL[o.order_type] ?? o.order_type} · {formatDateTime(o.created_at)}
                </p>
              </div>
              <span className="font-medium tabular-nums">{formatINR(o.total_paise)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
