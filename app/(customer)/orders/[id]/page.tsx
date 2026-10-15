import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderTracker } from "@/components/site/OrderTracker";
import { ReorderButton } from "@/components/site/ReorderButton";
import { ReviewForm } from "@/components/site/ReviewForm";
import { requireUser } from "@/lib/auth";
import { getOrderForUser } from "@/lib/services/orders";
import { ServiceError } from "@/lib/services/errors";
import { formatINR } from "@/lib/format";

export const metadata: Metadata = { title: "Order details" };
export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  let d;
  try {
    d = await getOrderForUser(user.userId, id);
  } catch (e) {
    if (e instanceof ServiceError) notFound();
    throw e;
  }
  const o = d.order;
  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-4xl sm:text-5xl">{o.order_number}</h1>
        <ReorderButton orderId={o.id} />
      </div>
      <OrderTracker orderId={o.id} orderType={o.order_type} initialStatus={o.status} initialEta={o.estimated_ready_at} initialEvents={d.events.map((e) => ({ status: e.status, at: e.created_at, note: e.note }))} />
      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-2 font-semibold">Items</h2>
        <ul className="divide-y text-sm">
          {d.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-2 py-2">
              <span>
                {i.qty} × {i.name_snapshot}
                {(i.variant_snapshot || i.addons_snapshot?.length || i.special_instructions) && (
                  <span className="block text-xs text-muted-foreground">{[i.variant_snapshot?.name, ...(i.addons_snapshot ?? []).map((a) => `+ ${a.name}`), i.special_instructions].filter(Boolean).join(" · ")}</span>
                )}
              </span>
              <span className="tabular-nums">{formatINR(i.line_total_paise)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t pt-3 text-sm">
          {[
            ["Subtotal", o.subtotal_paise],
            ["Discount", -o.discount_paise],
            ["Packaging", o.packaging_fee_paise],
            ["Delivery", o.delivery_fee_paise],
            ["GST", o.tax_paise],
            ["Tip", o.tip_paise],
          ]
            .filter(([, v]) => v !== 0)
            .map(([k, v]) => (
              <div key={k as string} className="flex justify-between">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="tabular-nums">{(v as number) < 0 ? `−${formatINR(-(v as number))}` : formatINR(v as number)}</dd>
              </div>
            ))}
          <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{formatINR(o.total_paise)}</dd></div>
        </dl>
      </section>
      {d.can_review && <ReviewForm orderId={o.id} items={d.items.filter((i) => i.menu_item_id).map((i) => ({ id: i.menu_item_id!, name: i.name_snapshot }))} />}
    </div>
  );
}
