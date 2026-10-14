"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Minus, Plus, Sparkles, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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

type Coupon = { code: string; description: string | null };

export function CartPageClient({ addresses, coupons, tables }: { addresses: Address[]; coupons: Coupon[]; tables: { number: number; capacity: number }[] }) {
  const { cart, setCart, loading } = useCart();
  const [pending, start] = useTransition();
  const [coupon, setCoupon] = useState("");

  const act = (fn: () => Promise<{ ok: true; data: CartView } | { ok: false; error: string }>, success?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      setCart(r.data);
      if (success) toast.success(success);
    });

  if (!cart) return loading ? <Skeleton className="h-64 w-full" /> : <p>Couldn&apos;t load your cart.</p>;

  if (cart.lines.length === 0)
    return (
      <div className="rounded-2xl border bg-card p-10 text-center">
        <p className="text-lg font-medium">Your cart is empty</p>
        <p className="mt-1 text-sm text-muted-foreground">Browse the menu or just tell our AI what you&apos;re craving.</p>
        <div className="mt-4 flex justify-center gap-3">
          <Link href="/menu" className={buttonVariants()}>Browse menu</Link>
          <Button variant="outline" onClick={() => openChat("Suggest something popular")}>
            <Sparkles /> Ask AI
          </Button>
        </div>
      </div>
    );

  const t = cart.totals;
  const now = new Date();
  const minSchedule = new Date(now.getTime() + 30 * 60_000 - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

  return (
    <div className={cn("grid gap-6 lg:grid-cols-[1fr_360px]", pending && "opacity-80")}>
      <div className="space-y-3">
        {cart.warnings.map((w, i) => (
          <p key={i} className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">{w}</p>
        ))}
        {cart.lines.map((l) => (
          <Card key={l.id} data-testid="cart-line" className={cn(!l.available && "border-destructive/40")}>
            <CardContent className="flex gap-3 p-3">
              <DishImage src={l.image_url} alt="" className="size-20 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="flex items-center gap-2 font-medium">
                    <VegMark veg={l.is_veg} /> {l.name}
                  </p>
                  <span className="font-semibold tabular-nums">{formatINR(l.line_total_paise)}</span>
                </div>
                {!l.available && <p className="text-xs text-destructive">{l.unavailable_reason} — please remove it.</p>}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center rounded-lg border" role="group" aria-label={`Quantity of ${l.name}`}>
                    <Button variant="ghost" size="icon" className="size-8" aria-label="Decrease" onClick={() => act(() => updateCartItemAction({ cart_item_id: l.id, qty: l.qty - 1 }))}>
                      <Minus />
                    </Button>
                    <span className="w-8 text-center text-sm" aria-live="polite">{l.qty}</span>
                    <Button variant="ghost" size="icon" className="size-8" aria-label="Increase" disabled={l.qty >= 20} onClick={() => act(() => updateCartItemAction({ cart_item_id: l.id, qty: l.qty + 1 }))}>
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
                  <Button variant="ghost" size="sm" className="ml-auto text-destructive" onClick={() => act(() => removeFromCartAction(l.id), "Removed")}>
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

      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Order type</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Order type">
              {(["delivery", "pickup", "dine_in"] as const).map((ot) => (
                <button
                  key={ot}
                  role="radio"
                  aria-checked={cart.order_type === ot}
                  className={cn("rounded-md py-1.5 capitalize", cart.order_type === ot ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}
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
              <div className="flex items-center justify-between rounded-lg bg-success/10 px-3 py-2">
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
          <CardHeader><CardTitle>Bill</CardTitle></CardHeader>
          <CardContent>
            <dl className="space-y-1 text-sm">
              <Line k={`Subtotal (${cart.item_count} items)`} v={t.subtotalPaise} />
              {t.discountPaise > 0 && <Line k="Discount" v={-t.discountPaise} />}
              {t.packagingFeePaise > 0 && <Line k="Packaging" v={t.packagingFeePaise} />}
              {cart.order_type === "delivery" && <Line k="Delivery" v={t.deliveryFeePaise} free={t.deliveryFeePaise === 0} />}
              <Line k="GST" v={t.taxPaise} />
              {t.tipPaise > 0 && <Line k="Tip" v={t.tipPaise} />}
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums" data-testid="cart-page-total">{formatINR(t.totalPaise)}</dd>
              </div>
            </dl>
            <Link href="/checkout" className={cn(buttonVariants({ size: "lg" }), "mt-4 w-full")}>Proceed to checkout</Link>
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
