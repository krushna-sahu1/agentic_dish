import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, CreditCard, MapPin, StickyNote, User } from "lucide-react";
import { DashboardPage, Panel } from "@/components/owner/Page";
import { OrderActions } from "@/components/owner/OrderActions";
import { StatusBadge } from "@/components/owner/StatusBadge";
import { requireRole } from "@/lib/auth";
import { getOrderOwner } from "@/lib/services/owner";
import { ServiceError } from "@/lib/services/errors";
import { formatINR, STATUS_LABEL } from "@/lib/format";
import { formatDateTime, formatTime } from "@/lib/time";

export const metadata = { title: "Order details" };

const TYPE_LABEL: Record<string, string> = { delivery: "Delivery", pickup: "Pickup", dine_in: "Dine-in" };
const strip = (s: string | null) => (s ? s.replace(/<\/?user_text>/g, "") : s);

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["owner", "staff"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  let o;
  try {
    o = await getOrderOwner(id);
  } catch (e) {
    if (e instanceof ServiceError && e.code === "not_found") notFound();
    throw e;
  }
  // resolveOrder falls back to fuzzy order-number matching; a detail URL must match exactly.
  if (o.id !== id) notFound();

  const addr = o.address_snapshot as Record<string, string> | null;
  const address = addr ? [addr.line1, addr.line2, addr.landmark, addr.city, addr.pincode].filter(Boolean).join(", ") : null;
  const refunded = o.status === "refunded" || o.refunds.some((r) => r.status !== "failed");
  const bill: [string, number][] = (
    [
      ["Subtotal", o.subtotal_paise],
      ["Discount", -o.discount_paise],
      ["Packaging", o.packaging_fee_paise],
      ["Delivery", o.delivery_fee_paise],
      ["GST", o.tax_paise],
      ["Tip", o.tip_paise],
    ] as [string, number][]
  ).filter(([k, v]) => v !== 0 || k === "Subtotal");

  return (
    <DashboardPage className="max-w-5xl">
      <Link href="/owner/orders" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All orders
      </Link>

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-5xl leading-none">#{o.order_number.split("-").pop()}</h1>
            <StatusBadge status={o.status} className="text-sm" />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {o.order_number} · {TYPE_LABEL[o.order_type] ?? o.order_type} · placed {formatDateTime(o.created_at)}
            {o.minutes_in_status > 0 && !["completed", "cancelled", "refunded"].includes(o.status) && ` · ${o.minutes_in_status} min in “${STATUS_LABEL[o.status] ?? o.status}”`}
          </p>
        </div>
        <OrderActions
          isOwner={user.role === "owner"}
          order={{ order_number: o.order_number, status: o.status, order_type: o.order_type, next_statuses: o.next_statuses, paid_at: o.paid_at, refunded }}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Panel title="Items" description={`${o.items.reduce((s, i) => s + i.qty, 0)} items`}>
            <ul className="divide-y border-t">
              {o.items.map((i, k) => (
                <li key={k} className="flex gap-4 px-5 py-3.5 text-sm">
                  <span className="w-8 shrink-0 font-semibold tabular-nums">{i.qty}×</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{i.name_snapshot}</p>
                    {(!!i.variant_snapshot || !!i.addons_snapshot?.length) && (
                      <p className="text-xs text-muted-foreground">{[i.variant_snapshot?.name, ...(i.addons_snapshot ?? []).map((a) => `+ ${a.name}`)].filter(Boolean).join(" · ")}</p>
                    )}
                    {i.special_instructions && <p className="mt-1 text-xs text-warning">“{strip(i.special_instructions)}”</p>}
                  </div>
                  <span className="tabular-nums">{formatINR(i.line_total_paise)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1.5 border-t px-5 py-4 text-sm">
              {bill.map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-muted-foreground">
                    {k}
                    {k === "Discount" && o.coupon_code ? ` (${o.coupon_code})` : ""}
                  </dt>
                  <dd className="tabular-nums">{v < 0 ? `−${formatINR(-v)}` : formatINR(v)}</dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between border-t pt-3">
                <dt className="font-medium">Total</dt>
                <dd className="font-display text-3xl tabular-nums">{formatINR(o.total_paise)}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Timeline">
            {o.events?.length ? (
              <ol className="relative mx-5 mb-5 space-y-4 border-l pl-5">
                {o.events.map((e) => (
                  <li key={e.id} className="relative text-sm">
                    <span className="absolute -left-[26px] top-1.5 size-2.5 rounded-full border-2 border-card bg-primary" aria-hidden />
                    <p className="font-medium">{STATUS_LABEL[e.status] ?? e.status}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(e.created_at)}
                      {e.note ? ` · ${strip(e.note)}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="px-5 pb-5 text-sm text-muted-foreground">No status changes recorded yet.</p>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Customer">
            <dl className="space-y-3 px-5 pb-5 text-sm">
              <Row icon={User} label="Name" value={o.customer_name ?? "Guest"} sub={o.customer_phone_masked ?? undefined} />
              {o.order_type === "delivery" && <Row icon={MapPin} label="Deliver to" value={address ?? "No address on file"} />}
              {o.table_number && <Row icon={MapPin} label="Table" value={`Table ${o.table_number}`} />}
              {o.scheduled_for && <Row icon={CalendarClock} label="Scheduled for" value={formatDateTime(o.scheduled_for)} />}
              {o.estimated_ready_at && <Row icon={CalendarClock} label="Estimated ready" value={formatTime(o.estimated_ready_at)} />}
              {o.notes && <Row icon={StickyNote} label="Kitchen note" value={strip(o.notes) ?? ""} />}
              {o.cancelled_reason && <Row icon={StickyNote} label="Cancellation reason" value={strip(o.cancelled_reason) ?? ""} />}
            </dl>
          </Panel>

          <Panel title="Payment">
            <div className="space-y-3 px-5 pb-5 text-sm">
              {o.payments.length ? (
                o.payments.map((p) => (
                  <div key={p.razorpay_payment_id} className="flex items-start gap-3">
                    <CreditCard className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium capitalize">
                        {p.method ?? "Payment"} · {p.status}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.razorpay_payment_id} · {formatDateTime(p.created_at)}
                      </p>
                    </div>
                    <span className="tabular-nums">{formatINR(p.amount_paise)}</span>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">{o.paid_at ? `Paid ${formatDateTime(o.paid_at)}` : "Not paid yet."}</p>
              )}
              {o.refunds.map((r) => (
                <div key={r.razorpay_refund_id ?? r.created_at} className="rounded-xl bg-muted px-3 py-2 text-xs">
                  Refund {formatINR(r.amount_paise)} · {r.status} · {formatDateTime(r.created_at)}
                  {r.reason ? ` — ${r.reason}` : ""}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </DashboardPage>
  );
}

function Row({ icon: Icon, label, value, sub }: { icon: typeof User; label: string; value: string; sub?: string }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd>{value}</dd>
        {sub && <dd className="text-xs text-muted-foreground">{sub}</dd>}
      </div>
    </div>
  );
}
