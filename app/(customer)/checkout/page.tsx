import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckoutClient } from "@/components/site/CheckoutClient";
import { AddressForm } from "@/components/site/AddressForm";
import { requireUser } from "@/lib/auth";
import { listAddresses } from "@/lib/services/account";
import { validateCheckout } from "@/lib/services/orders";
import { getSettings } from "@/lib/services/settings";
import { formatINR } from "@/lib/format";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const user = await requireUser();
  const [v, addresses, settings] = await Promise.all([validateCheckout(user.userId), listAddresses(user.userId), getSettings()]);
  const cart = v.cart;
  const t = cart.totals;

  return (
    <div className="grid gap-6 py-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <h1 className="font-display text-3xl font-semibold">Checkout</h1>
        {!v.ok && (
          <div className="space-y-1 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm" role="alert">
            {v.errors.map((e, i) => (
              <p key={i} className="flex gap-2"><AlertTriangle className="size-4 shrink-0 text-destructive" /> {e}</p>
            ))}
            <Link href="/cart" className={`${buttonVariants({ variant: "outline", size: "sm" })} mt-2`}>Back to cart</Link>
          </div>
        )}
        <Card>
          <CardHeader><CardTitle className="capitalize">{cart.order_type.replace("_", "-")}{cart.scheduled_for ? ` · scheduled for ${formatDateTime(cart.scheduled_for)}` : " · ASAP"}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {cart.order_type === "delivery" && (
              <>
                {cart.address ? (
                  <p>Delivering to <b>{cart.address.label}</b>: {cart.address.line1}{cart.address.line2 ? `, ${cart.address.line2}` : ""}, {cart.address.city} {cart.address.pincode}</p>
                ) : (
                  <p className="text-muted-foreground">Choose a delivery address on the <Link href="/cart" className="text-primary hover:underline">cart page</Link>{addresses.length ? "" : " or add one below"}.</p>
                )}
                {addresses.length === 0 && <AddressForm />}
              </>
            )}
            {cart.order_type === "dine_in" && <p>Table {cart.table_number ?? "—"}</p>}
            {cart.order_type === "pickup" && <p>Pick up from {settings.address}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Items</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {cart.lines.map((l) => (
                <li key={l.id} className="flex justify-between gap-3 py-2">
                  <span>
                    {l.qty} × {l.name}
                    {(l.variant || l.addons.length || l.special_instructions) && (
                      <span className="block text-xs text-muted-foreground">{[l.variant?.name, ...l.addons.map((a) => `+ ${a.name}`), l.special_instructions].filter(Boolean).join(" · ")}</span>
                    )}
                  </span>
                  <span className="tabular-nums">{formatINR(l.line_total_paise)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
      <Card className="h-fit lg:sticky lg:top-24">
        <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
        <CardContent>
          <dl className="space-y-1 text-sm">
            <Row k="Subtotal" v={t.subtotalPaise} />
            {t.discountPaise > 0 && <Row k={`Discount (${cart.coupon_code})`} v={-t.discountPaise} />}
            {t.packagingFeePaise > 0 && <Row k="Packaging" v={t.packagingFeePaise} />}
            {t.deliveryFeePaise > 0 && <Row k="Delivery" v={t.deliveryFeePaise} />}
            <Row k={`GST (${settings.gst_percent}%)`} v={t.taxPaise} />
            {t.tipPaise > 0 && <Row k="Tip" v={t.tipPaise} />}
            <div className="flex justify-between border-t pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(t.totalPaise)}</dd></div>
          </dl>
          <div className="mt-4">
            <CheckoutClient disabled={!v.ok} totalPaise={t.totalPaise} restaurantName={settings.name} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="tabular-nums">{v < 0 ? `−${formatINR(-v)}` : formatINR(v)}</dd>
    </div>
  );
}
