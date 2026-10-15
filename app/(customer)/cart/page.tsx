import type { Metadata } from "next";
import { CartPageClient } from "@/components/site/CartPageClient";
import { requireUser } from "@/lib/auth";
import { listAddresses } from "@/lib/services/account";
import { listAvailableCoupons } from "@/lib/services/cart";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Your cart" };

export default async function CartPage() {
  const user = await requireUser();
  const [addresses, coupons, { data: tables }] = await Promise.all([
    listAddresses(user.userId),
    listAvailableCoupons(user.userId),
    createAdminClient().from("tables").select("number, capacity").eq("is_active", true).order("number"),
  ]);
  return (
    <div className="py-10">
      <h1 className="mb-8 font-display text-5xl">Your cart</h1>
      <CartPageClient addresses={addresses} coupons={coupons} tables={(tables ?? []) as { number: number; capacity: number }[]} />
    </div>
  );
}
