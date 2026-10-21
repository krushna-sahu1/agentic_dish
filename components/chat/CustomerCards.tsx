"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, Check, Clock, ShoppingBag, Star, Utensils } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DishImage } from "@/components/site/DishImage";
import { SpiceLevel, VegMark } from "@/components/site/Markers";
import { AddToCartButton } from "@/components/site/AddToCartButton";
import { useCart } from "@/components/providers/CartProvider";
import { addManyToCartAction, addToCartAction } from "@/app/actions/customer";
import { createClient } from "@/lib/supabase/client";
import { formatINRExact, STATUS_LABEL } from "@/lib/format";
import { formatDateTime, formatTime } from "@/lib/time";
import type { AddToCartInput } from "@/lib/services/cart";
import type { ItemSummary } from "@/lib/services/menu";
import { cn } from "@/lib/utils";
import { CardShell } from "./shared";
import { PayButton } from "./PayButton";
import { useChatActions } from "./chat-actions";

type Dish = ItemSummary & { reason?: string; qty?: number; line_total_paise?: number };

// ---------------------------------------------------------------- dishes
export function DishCarousel({ title, items, notes }: { title?: string; items: Dish[]; notes?: string[] }) {
  if (!items.length) return <CardShell><p className="text-sm text-muted-foreground">No dishes matched.</p></CardShell>;
  return (
    <div className="my-2 w-full" data-testid="dish-carousel">
      {title && <p className="mb-1.5 text-sm font-semibold">{title}</p>}
      <div className="flex snap-x gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {items.map((d) => (
          <MiniDish key={d.id} d={d} />
        ))}
      </div>
      {notes?.length ? <p className="text-xs text-muted-foreground">{notes.join(" ")}</p> : null}
    </div>
  );
}

function MiniDish({ d }: { d: Dish }) {
  return (
    <article className="flex w-44 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/0.04),0_14px_30px_-26px_rgb(0_0_0/0.55)]" data-testid="mini-dish" data-dish={d.slug}>
      <Link href={`/menu/${d.slug}`} className="relative">
        <DishImage src={d.image_url} alt="" className={cn("aspect-[4/3]", !d.available && "grayscale")} />
        {!d.available && <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-semibold text-white">SOLD OUT</span>}
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-2">
        <div className="flex items-start gap-1.5">
          <VegMark veg={d.is_veg} className="mt-0.5" />
          <p className="flex-1 text-xs font-semibold leading-tight">{d.name}</p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <SpiceLevel level={d.spice_level} />
          {d.rating ? (
            <span className="flex items-center gap-0.5">
              <Star className="size-3 fill-amber-400 text-amber-400" />
              {Number(d.rating).toFixed(1)}
            </span>
          ) : null}
        </div>
        {d.reason && <p className="line-clamp-2 text-[11px] text-muted-foreground">{d.reason}</p>}
        <div className="mt-auto flex items-center justify-between pt-1">
          <span className="text-sm font-semibold">{formatINRExact(d.price_paise)}</span>
          <AddToCartButton item={d} className="h-7 px-2.5 text-xs" />
        </div>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------- combo
export interface Combo {
  title: string;
  party_size: number;
  budget_paise: number | null;
  items: Dish[];
  subtotal_paise: number;
  tax_paise: number;
  estimated_total_paise: number;
  notes: string[];
}

export function ComboSuggestionCard({ combo }: { combo: Combo }) {
  const { setCart } = useCart();
  const [pending, start] = useTransition();
  const [added, setAdded] = useState(false);
  const addAll = () =>
    start(async () => {
      const r = await addManyToCartAction(combo.items.map((i) => ({ item_id: i.id, qty: i.qty ?? 1 })));
      if (!r.ok) return void toast.error(r.error);
      setCart(r.data.cart);
      setAdded(true);
      if (r.data.skipped.length) toast.warning(`Skipped: ${r.data.skipped.map((s) => s.name).join(", ")}`);
      else toast.success("Added everything to your cart");
    });
  return (
    <CardShell
      title={<span className="flex items-center gap-2"><Utensils className="size-4 text-primary" /> {combo.title}</span>}
      footer={
        <>
          <Button size="sm" className="h-9" onClick={addAll} disabled={pending || added} data-testid="add-all">
            {added ? <Check /> : <ShoppingBag />} {added ? "Added" : "Add all"}
          </Button>
          <span className="ml-auto text-sm">
            ≈ <b>{formatINRExact(combo.estimated_total_paise)}</b> <span className="text-xs text-muted-foreground">incl. GST</span>
          </span>
        </>
      }
    >
      <ul className="divide-y text-sm">
        {combo.items.map((i) => (
          <li key={i.id} className="flex items-center gap-2 py-1.5">
            <VegMark veg={i.is_veg} />
            <span className="flex-1">
              {i.qty ?? 1} × {i.name}
            </span>
            <span className="tabular-nums">{formatINRExact(i.line_total_paise ?? i.price_paise)}</span>
          </li>
        ))}
      </ul>
      {combo.budget_paise ? (
        <p className={cn("mt-2 text-xs", combo.estimated_total_paise <= combo.budget_paise ? "text-success" : "text-destructive")}>
          Budget {formatINRExact(combo.budget_paise)} · {combo.estimated_total_paise <= combo.budget_paise ? "within budget" : "over budget"}
        </p>
      ) : null}
      {combo.notes?.length ? <p className="mt-1 text-xs text-muted-foreground">{combo.notes.join(" ")}</p> : null}
    </CardShell>
  );
}

// ---------------------------------------------------------------- disambiguation
export function ItemOptionsCard({ message, options, qty = 1 }: { message: string; options: { id: string; name: string; price_paise: number }[]; qty?: number }) {
  return (
    <CardShell title={message}>
      <ul className="space-y-1.5">
        {options.map((o) => (
          <li key={o.id} className="flex items-center justify-between gap-2 text-sm">
            <span>{o.name}</span>
            <span className="flex items-center gap-2">
              <span className="text-muted-foreground">{formatINRExact(o.price_paise)}</span>
              <AddToCartButton item={{ id: o.id, name: o.name, price_paise: o.price_paise, available: true, has_options: false }} qty={qty} className="h-7 px-2.5 text-xs" />
            </span>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}

// ---------------------------------------------------------------- allergen warning
export function AllergenWarningCard({ message, pending: input }: { message: string; pending: AddToCartInput }) {
  const { setCart } = useCart();
  const [state, setState] = useState<"ask" | "added" | "cancelled">("ask");
  const [busy, start] = useTransition();
  const { postAssistantNote } = useChatActions();
  if (state !== "ask")
    return <p className="my-1 text-sm text-muted-foreground">{state === "added" ? "✓ Added anyway at your request." : "Okay — not added."}</p>;
  return (
    <div className="my-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm" data-testid="allergen-warning" role="alert">
      <p className="flex gap-2 font-medium">
        <AlertTriangle className="size-4 shrink-0 text-destructive" /> {message}
      </p>
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={() =>
            start(async () => {
              const r = await addToCartAction({ ...input, acknowledge_conflicts: true });
              if (!r.ok) return void toast.error(r.error);
              if (r.data.status === "added") {
                setCart(r.data.cart);
                setState("added");
                postAssistantNote(`Added ${r.data.item.name} after you confirmed the warning.`);
              }
            })
          }
        >
          Add anyway
        </Button>
        <Button size="sm" variant="outline" onClick={() => setState("cancelled")}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- cart
export interface CompactCart {
  lines: { cart_item_id: string; name: string; qty: number; variant: string | null; addons: string[]; special_instructions: string | null; line_total_paise: number; available: boolean }[];
  order_type: string;
  coupon_code: string | null;
  coupon_message: string | null;
  totals: { subtotalPaise: number; discountPaise: number; packagingFeePaise: number; deliveryFeePaise: number; taxPaise: number; tipPaise: number; totalPaise: number };
  item_count: number;
  warnings: string[];
}

const stripTags = (s: string | null) => (s ? s.replace(/<\/?user_text>/g, "") : s);

export function CartSummaryCard({ cart, headline }: { cart: CompactCart; headline?: string }) {
  const { refresh } = useCart();
  useEffect(() => {
    void refresh();
  }, [refresh]);
  if (!cart.lines.length) return <CardShell><p className="text-sm text-muted-foreground">Your cart is empty.</p></CardShell>;
  const t = cart.totals;
  return (
    <CardShell
      title={headline ?? `Your cart · ${cart.item_count} item${cart.item_count === 1 ? "" : "s"}`}
      footer={
        <>
          <Link href="/cart" className="chat-card__action chat-card__action--ghost">View cart</Link>
          <span className="ml-auto text-sm">
            Total <b data-testid="cart-total">{formatINRExact(t.totalPaise)}</b>
          </span>
        </>
      }
    >
      <ul className="space-y-1 text-sm" data-testid="cart-summary">
        {cart.lines.map((l) => (
          <li key={l.cart_item_id} className={cn("flex justify-between gap-2", !l.available && "text-muted-foreground line-through")}>
            <span>
              {l.qty} × {l.name}
              {(l.variant || l.addons.length || l.special_instructions) && (
                <span className="block text-xs text-muted-foreground">{[l.variant, ...l.addons.map((a) => `+ ${a}`), stripTags(l.special_instructions)].filter(Boolean).join(" · ")}</span>
              )}
            </span>
            <span className="tabular-nums">{formatINRExact(l.line_total_paise)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-2 space-y-0.5 border-t pt-2 text-xs text-muted-foreground">
        <Row k="Subtotal" v={t.subtotalPaise} />
        {t.discountPaise > 0 && <Row k={`Discount${cart.coupon_code ? ` (${cart.coupon_code})` : ""}`} v={-t.discountPaise} />}
        {t.packagingFeePaise > 0 && <Row k="Packaging" v={t.packagingFeePaise} />}
        {t.deliveryFeePaise > 0 && <Row k="Delivery" v={t.deliveryFeePaise} />}
        <Row k="GST" v={t.taxPaise} />
        {t.tipPaise > 0 && <Row k="Tip" v={t.tipPaise} />}
      </dl>
      {[...cart.warnings, ...(cart.coupon_message ? [cart.coupon_message] : [])].map((w, i) => (
        <p key={i} className="mt-1 text-xs text-amber-700 dark:text-amber-300">{w}</p>
      ))}
    </CardShell>
  );
}

function Row({ k, v }: { k: string; v: number }) {
  return (
    <div className="flex justify-between">
      <dt>{k}</dt>
      <dd className="tabular-nums">{v < 0 ? `−${formatINRExact(-v)}` : formatINRExact(v)}</dd>
    </div>
  );
}

// ---------------------------------------------------------------- checkout
export interface CheckoutData {
  order_id: string;
  order_number: string;
  razorpay_order_id: string;
  razorpay_key_id: string;
  amount_paise: number;
  breakdown: { subtotal_paise: number; discount_paise: number; packaging_fee_paise: number; delivery_fee_paise: number; tax_paise: number; tip_paise: number; total_paise: number; coupon_code: string | null };
  lines: { name: string; qty: number; line_total_paise: number; details: string | null }[];
  order_type: string;
  prefill: { name: string | null; email: string | null; contact: string | null };
}

export function CheckoutCard({ data, restaurantName }: { data: CheckoutData; restaurantName: string }) {
  const { postAssistantNote } = useChatActions();
  const { refresh } = useCart();
  const b = data.breakdown;
  return (
    <CardShell title={`Checkout · ${data.order_number}`} tone="action" footer={
      <PayButton
        orderId={data.order_id}
        orderNumber={data.order_number}
        razorpayOrderId={data.razorpay_order_id}
        keyId={data.razorpay_key_id}
        amountPaise={data.amount_paise}
        restaurantName={restaurantName}
        prefill={data.prefill}
        onPaid={() => {
          void refresh();
          postAssistantNote(`✅ Payment received for ${data.order_number}! The kitchen has your order — ask "where's my food?" anytime to track it.`);
        }}
      />
    }>
      <ul className="space-y-1 text-sm" data-testid="checkout-lines">
        {data.lines.map((l, i) => (
          <li key={i} className="flex justify-between gap-2">
            <span>
              {l.qty} × {l.name}
              {l.details && <span className="block text-xs text-muted-foreground">{stripTags(l.details)}</span>}
            </span>
            <span className="tabular-nums">{formatINRExact(l.line_total_paise)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-2 space-y-0.5 border-t pt-2 text-xs text-muted-foreground">
        <Row k="Subtotal" v={b.subtotal_paise} />
        {b.discount_paise > 0 && <Row k={`Discount (${b.coupon_code})`} v={-b.discount_paise} />}
        {b.packaging_fee_paise > 0 && <Row k="Packaging" v={b.packaging_fee_paise} />}
        {b.delivery_fee_paise > 0 && <Row k="Delivery" v={b.delivery_fee_paise} />}
        <Row k="GST" v={b.tax_paise} />
        {b.tip_paise > 0 && <Row k="Tip" v={b.tip_paise} />}
        <div className="flex justify-between pt-1 text-sm font-semibold text-foreground">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatINRExact(b.total_paise)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">{data.order_type.replace("_", "-")} · Prices calculated by our server. You pay only when you press Pay.</p>
    </CardShell>
  );
}

// ---------------------------------------------------------------- order status
export interface OrderStatusData {
  order_id: string;
  order_number: string;
  status: string;
  order_type: string;
  total_paise: number;
  eta_minutes: number | null;
  estimated_ready_at: string | null;
  items: { name: string; qty: number }[];
  timeline: { status: string; at: string; note: string | null }[];
}

const FLOW = ["paid", "accepted", "preparing", "ready", "out_for_delivery", "completed"];

export function OrderStatusCard({ data }: { data: OrderStatusData }) {
  const [status, setStatus] = useState(data.status);
  const [timeline, setTimeline] = useState(data.timeline);
  const [eta, setEta] = useState(data.estimated_ready_at);
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const supabase = createClient();
    const ch = supabase
      .channel(`order-${data.order_id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${data.order_id}` }, (p) => {
        const row = p.new as { status: string; estimated_ready_at: string | null };
        setStatus(row.status);
        setEta(row.estimated_ready_at);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_status_events", filter: `order_id=eq.${data.order_id}` }, (p) => {
        const e = p.new as { status: string; created_at: string; note: string | null };
        setTimeline((t) => [...t, { status: e.status, at: e.created_at, note: e.note }]);
      })
      .subscribe();
    return () => void supabase.removeChannel(ch);
  }, [data.order_id]);

  const steps = FLOW.filter((s) => s !== "out_for_delivery" || data.order_type === "delivery");
  const idx = steps.indexOf(status);
  const terminal = ["cancelled", "refunded", "payment_failed", "awaiting_payment"].includes(status);
  return (
    <CardShell
      title={
        <span className="flex items-center justify-between gap-2">
          <span>{data.order_number}</span>
          <Badge variant={terminal ? "destructive" : status === "completed" ? "success" : "default"} data-testid="order-status">{STATUS_LABEL[status] ?? status}</Badge>
        </span>
      }
      footer={<Link href={`/orders/${data.order_id}`} className="chat-card__action chat-card__action--ghost">Order details</Link>}
    >
      {!terminal && (
        <ol className="mb-2 flex items-center gap-1" aria-label="Order progress">
          {steps.map((s, i) => (
            <li key={s} className="flex flex-1 flex-col items-center gap-1">
              <span className={cn("h-1.5 w-full rounded-full", i <= idx ? "bg-primary" : "bg-muted")} />
              <span className={cn("text-[10px] capitalize", i === idx ? "font-semibold text-foreground" : "text-muted-foreground")}>{s.replace(/_/g, " ")}</span>
            </li>
          ))}
        </ol>
      )}
      {eta && !terminal && status !== "completed" && (
        <p className="flex items-center gap-1.5 text-sm">
          <Clock className="size-4 text-primary" /> Ready around <b>{formatTime(eta)}</b>
        </p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">{data.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</p>
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-muted-foreground">Timeline</summary>
        <ul className="mt-1 space-y-0.5">
          {timeline.map((e, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span>{STATUS_LABEL[e.status] ?? e.status}{e.note ? ` — ${stripTags(e.note)}` : ""}</span>
              <span className="text-muted-foreground">{formatDateTime(e.at)}</span>
            </li>
          ))}
        </ul>
      </details>
    </CardShell>
  );
}

// ---------------------------------------------------------------- lists
export function OrdersListCard({ orders }: { orders: { id: string; order_number: string; status: string; total_paise: number; created_at: string; items: string[] }[] }) {
  if (!orders.length) return <CardShell><p className="text-sm text-muted-foreground">No orders yet.</p></CardShell>;
  return (
    <CardShell title="Your recent orders">
      <ul className="divide-y text-sm">
        {orders.map((o) => (
          <li key={o.id} className="py-1.5">
            <Link href={`/orders/${o.id}`} className="flex justify-between gap-2 hover:underline">
              <span>{o.order_number}</span>
              <span>{formatINRExact(o.total_paise)}</span>
            </Link>
            <p className="text-xs text-muted-foreground">{STATUS_LABEL[o.status]} · {formatDateTime(o.created_at)} · {o.items.join(", ")}</p>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}

export function CouponsCard({ coupons }: { coupons: { code: string; description: string | null }[] }) {
  if (!coupons.length) return <CardShell><p className="text-sm text-muted-foreground">No coupons available right now.</p></CardShell>;
  return (
    <CardShell title="Coupons you can use">
      <ul className="space-y-1 text-sm">
        {coupons.map((c) => (
          <li key={c.code} className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">{c.code}</Badge>
            <span className="text-muted-foreground">{c.description}</span>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}

export function ReservationsCard({ reservations }: { reservations: { id: string; party_size: number; reserved_for: string; status: string; table_number: number | null }[] }) {
  if (!reservations.length) return <CardShell><p className="text-sm text-muted-foreground">No reservations yet.</p></CardShell>;
  return (
    <CardShell title="Your reservations" footer={<Link href="/reservations" className="chat-card__action chat-card__action--ghost">Manage</Link>}>
      <ul className="space-y-1 text-sm">
        {reservations.map((r) => (
          <li key={r.id} className="flex justify-between gap-2">
            <span>{formatDateTime(r.reserved_for)} · {r.party_size} people{r.table_number ? ` · T${r.table_number}` : ""}</span>
            <Badge variant={r.status === "confirmed" ? "success" : r.status === "cancelled" ? "muted" : "default"}>{r.status}</Badge>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}
