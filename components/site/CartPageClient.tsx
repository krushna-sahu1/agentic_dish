"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowRight, Minus, Plus, ShoppingBag, Sparkles, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useCart } from "@/components/providers/CartProvider";
import {
  applyCouponAction,
  removeCouponAction,
  removeFromCartAction,
  setOrderOptionsAction,
  updateCartItemAction,
} from "@/app/actions/customer";
import type { CartView } from "@/lib/services/cart";
import type { Address } from "@/lib/types";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DishImage } from "./DishImage";
import { VegMark } from "./Markers";
import { openChat } from "./chat-events";
import { clearPendingCoupon, readPendingCoupon } from "./CouponFromLink";

type Coupon = { code: string; description: string | null };

export function CartPageClient({ addresses, coupons, tables }: { addresses: Address[]; coupons: Coupon[]; tables: { number: number; capacity: number }[] }) {
  const { cart, setCart, loading, refresh } = useCart();
  const [pending, start] = useTransition();
  const [coupon, setCoupon] = useState("");

  const act = (fn: () => Promise<{ ok: true; data: CartView } | { ok: false; error: string }>, success?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      setCart(r.data);
      if (success) toast.success(success);
    });

  // Coupon from an email's "Order now" link (/menu?coupon=CODE): apply it once.
  const triedLinkCoupon = useRef(false);
  const [linkCouponNote, setLinkCouponNote] = useState<string | null>(null);
  useEffect(() => {
    if (triedLinkCoupon.current || !cart || cart.lines.length === 0) return;
    const code = readPendingCoupon();
    if (!code) return;
    triedLinkCoupon.current = true;
    if (cart.coupon_code === code) return clearPendingCoupon();
    if (cart.coupon_code) return;
    start(async () => {
      const r = await applyCouponAction(code);
      if (r.ok) {
        setCart(r.data);
        clearPendingCoupon();
        toast.success(`Offer ${code} applied`);
      } else {
        setCoupon(code);
        setLinkCouponNote(`${code}: ${r.error}`);
      }
    });
  }, [cart, setCart]);

  if (!cart)
    return loading ? (
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]" aria-busy="true" aria-label="Loading your cart">
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-4 rounded-2xl border bg-card p-4">
              <Skeleton className="size-24 shrink-0" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-8 w-32 rounded-full" />
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    ) : (
      <ErrorState title="We couldn’t load your cart" description="This is usually a brief connection hiccup. Your items are safe — try again in a moment.">
        <Button onClick={() => void refresh()}>Try again</Button>
      </ErrorState>
    );

  if (cart.lines.length === 0)
    return (
      <EmptyState icon={ShoppingBag} title="Your cart is empty" description="Browse the menu, or just tell our AI host what you’re craving — it’ll fill the cart for you." className="py-20">
        <Link href="/menu" className={buttonVariants()}>Browse the menu</Link>
        <Button variant="outline" onClick={() => openChat("Suggest something popular")}>
          <Sparkles /> Ask our AI
        </Button>
      </EmptyState>
    );

  const t = cart.totals;
  const now = new Date();
  const minSchedule = new Date(now.getTime() + 30 * 60_000 - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

  return (
    <div className={cn("grid items-start gap-8 transition-opacity lg:grid-cols-[1fr_380px]", pending && "opacity-70")} aria-busy={pending}>
      <div className="space-y-3">
        <Link href="/checkout" className="flex items-center justify-between rounded-2xl bg-foreground px-5 py-3.5 text-sm text-background lg:hidden">
          <span>
            Total <span className="font-semibold tabular-nums">{formatINR(t.totalPaise)}</span>
          </span>
          <span className="flex items-center gap-1 font-medium">
            Checkout <ArrowRight className="size-4" />
          </span>
        </Link>
        {cart.warnings.map((w, i) => (
          <p key={i} className="rounded-xl bg-warning/10 px-4 py-2.5 text-sm text-warning">{w}</p>
        ))}
        {cart.lines.map((l) => (
          <Card key={l.id} data-testid="cart-line" className={cn(!l.available && "border-destructive/40")}>
            <CardContent className="flex gap-4 p-3 sm:p-4">
              <DishImage src={l.image_url} alt="" className="size-20 shrink-0 rounded-xl sm:size-24" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="flex items-center gap-2 font-medium">
                    <VegMark veg={l.is_veg} /> {l.name}
                  </p>
                  <span className="font-semibold tabular-nums">{formatINR(l.line_total_paise)}</span>
                </div>
                {!l.available && <p className="text-xs text-destructive">{l.unavailable_reason} — please remove it.</p>}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center rounded-full border bg-background" role="group" aria-label={`Quantity of ${l.name}`}>
                    <Button variant="ghost" size="icon" className="size-8 rounded-full" aria-label="Decrease" onClick={() => act(() => updateCartItemAction({ cart_item_id: l.id, qty: l.qty - 1 }))}>
                      <Minus />
                    </Button>
                    <span className="w-7 text-center text-sm font-medium tabular-nums" aria-live="polite">{l.qty}</span>
                    <Button variant="ghost" size="icon" className="size-8 rounded-full" aria-label="Increase" disabled={l.qty >= 20} onClick={() => act(() => updateCartItemAction({ cart_item_id: l.id, qty: l.qty + 1 }))}>
                      <Plus />
                    </Button>
                  </div>
                  {l.available_variants.length > 0 && (
                    <Select
                      aria-label="Size"
                      className="h-8 w-auto"
                      value={l.variant?.id ?? ""}
                      onChange={(e) => act(() => updateCartItemAction({ cart_item_id: l.id, variant_id: e.target.value || null }))}
                    >
                      <option value="">Standard</option>
                      {l.available_variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                          {v.price_delta_paise ? ` (${v.price_delta_paise > 0 ? "+" : "−"}${formatINR(Math.abs(v.price_delta_paise))})` : ""}
                        </option>
                      ))}
                    </Select>
                  )}
                  <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground hover:text-destructive" onClick={() => act(() => removeFromCartAction(l.id), "Removed")}>
                    <Trash2 /> Remove
                  </Button>
                </div>
                {l.available_addons.length > 0 && (
                  <fieldset className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    <legend className="sr-only">Add-ons</legend>
                    {l.available_addons.map((a) => {
                      const on = l.addons.some((x) => x.id === a.id);
                      return (
                        <label key={a.id} className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            className="accent-[var(--primary)]"
                            checked={on}
                            onChange={() =>
                              act(() =>
                                updateCartItemAction({
                                  cart_item_id: l.id,
                                  addon_ids: on ? l.addons.filter((x) => x.id !== a.id).map((x) => x.id) : [...l.addons.map((x) => x.id), a.id],
                                }),
                              )
                            }
                          />
                          {a.name} (+{formatINR(a.price_paise)})
                        </label>
                      );
                    })}
                  </fieldset>
                )}
                <Input
                  aria-label={`Instructions for ${l.name}`}
                  className="h-8 text-xs"
                  placeholder="Special instructions (e.g. less spicy)"
                  defaultValue={l.special_instructions ?? ""}
                  maxLength={300}
                  onBlur={(e) => e.target.value !== (l.special_instructions ?? "") && act(() => updateCartItemAction({ cart_item_id: l.id, instructions: e.target.value || null }), "Instructions saved")}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-4 lg:sticky lg:top-24">
        <Card>
          <CardHeader><CardTitle>How would you like it?</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1" role="radiogroup" aria-label="Order type">
              {(["delivery", "pickup", "dine_in"] as const).map((ot) => (
                <button
                  key={ot}
                  role="radio"
                  aria-checked={cart.order_type === ot}
                  className={cn("rounded-full py-2 capitalize transition-colors", cart.order_type === ot ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}
                  onClick={() => act(() => setOrderOptionsAction({ order_type: ot }))}
                >
                  {ot.replace("_", "-")}
                </button>
              ))}
            </div>
            {cart.order_type === "delivery" && (
              <div>
                <Label htmlFor="address">Deliver to</Label>
                {addresses.length ? (
                  <Select id="address" value={cart.address_id ?? ""} onChange={(e) => act(() => setOrderOptionsAction({ address_id: e.target.value || null }))}>
                    <option value="">Choose an address</option>
                    {addresses.map((a) => (
                      <option key={a.id} value={a.id}>{a.label}: {a.line1}, {a.pincode}</option>
                    ))}
                  </Select>
                ) : (
                  <p className="text-muted-foreground">No saved addresses. <Link className="text-primary hover:underline" href="/profile#addresses">Add one</Link></p>
                )}
              </div>
            )}
            {cart.order_type === "dine_in" && (
              <div>
                <Label htmlFor="table">Table number</Label>
                <Select id="table" value={cart.table_number ?? ""} onChange={(e) => act(() => setOrderOptionsAction({ table_number: e.target.value ? Number(e.target.value) : null }))}>
                  <option value="">Select your table</option>
                  {tables.map((t) => (
                    <option key={t.number} value={t.number}>Table {t.number} (seats {t.capacity})</option>
                  ))}
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor="when">When</Label>
              <div className="flex gap-2">
                <Input
                  id="when"
                  type="datetime-local"
                  min={minSchedule}
                  defaultValue={cart.scheduled_for ? new Date(new Date(cart.scheduled_for).getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : ""}
                  onBlur={(e) => e.target.value && act(() => setOrderOptionsAction({ scheduled_for: new Date(e.target.value).toISOString() }), "Scheduled")}
                />
                {cart.scheduled_for && <Button variant="outline" size="sm" onClick={() => act(() => setOrderOptionsAction({ scheduled_for: null }), "Set to ASAP")}>ASAP</Button>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{cart.scheduled_for ? "Scheduled order" : "As soon as possible"}</p>
            </div>
            <div>
              <Label htmlFor="notes">Notes for the kitchen</Label>
              <Textarea id="notes" className="min-h-14" maxLength={500} defaultValue={cart.notes ?? ""} onBlur={(e) => e.target.value !== (cart.notes ?? "") && act(() => setOrderOptionsAction({ notes: e.target.value || null }))} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Coupon & tip</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {cart.coupon_code ? (
              <div className="flex items-center justify-between rounded-xl bg-success/10 px-3 py-2 text-success">
                <span className="flex items-center gap-2"><Tag className="size-4" /> {cart.coupon_code}</span>
                <Button variant="ghost" size="sm" onClick={() => act(() => removeCouponAction(), "Coupon removed")}>Remove</Button>
              </div>
            ) : (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (coupon.trim()) act(() => applyCouponAction(coupon), "Coupon applied");
                }}
              >
                <Input aria-label="Coupon code" placeholder="Coupon code" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} />
                <Button type="submit" variant="outline">Apply</Button>
              </form>
            )}
            {cart.coupon_message && <p className="text-xs text-amber-700 dark:text-amber-300">{cart.coupon_message}</p>}
            {!cart.coupon_code && linkCouponNote && <p className="text-xs text-amber-700 dark:text-amber-300">{linkCouponNote}</p>}
            {!cart.coupon_code && coupons.length > 0 && (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {coupons.slice(0, 4).map((c) => (
                  <li key={c.code}>
                    <button className="font-mono text-primary hover:underline" onClick={() => act(() => applyCouponAction(c.code), "Coupon applied")}>{c.code}</button> — {c.description}
                  </li>
                ))}
              </ul>
            )}
            <div>
              <p className="mb-1">Tip for the team</p>
              <div className="flex gap-1.5">
                {[0, 2000, 3000, 5000].map((tip) => (
                  <Button key={tip} size="sm" variant={cart.tip_paise === tip ? "default" : "outline"} onClick={() => act(() => setOrderOptionsAction({ tip_paise: tip }))}>
                    {tip ? formatINR(tip) : "None"}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent>
            <dl className="space-y-1 text-sm">
              <Line k={`Subtotal (${cart.item_count} items)`} v={t.subtotalPaise} />
              {t.discountPaise > 0 && <Line k="Discount" v={-t.discountPaise} />}
              {t.packagingFeePaise > 0 && <Line k="Packaging" v={t.packagingFeePaise} />}
              {cart.order_type === "delivery" && <Line k="Delivery" v={t.deliveryFeePaise} free={t.deliveryFeePaise === 0} />}
              <Line k="GST" v={t.taxPaise} />
              {t.tipPaise > 0 && <Line k="Tip" v={t.tipPaise} />}
              <div className="mt-2 flex items-baseline justify-between border-t pt-3 text-base font-semibold">
                <dt>Total</dt>
                <dd className="font-display text-3xl font-normal tabular-nums" data-testid="cart-page-total">{formatINR(t.totalPaise)}</dd>
              </div>
            </dl>
            <Link href="/checkout" className={cn(buttonVariants({ size: "lg" }), "mt-5 w-full")}>Proceed to checkout <ArrowRight /></Link>
            <p className="mt-3 text-center text-xs text-muted-foreground">Secure payment via Razorpay on the next step.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Line({ k, v, free }: { k: string; v: number; free?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="tabular-nums">{free ? "Free" : v < 0 ? `−${formatINR(-v)}` : formatINR(v)}</dd>
    </div>
  );
}
