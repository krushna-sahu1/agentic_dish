"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PayButton } from "@/components/chat/PayButton";
import { useCart } from "@/components/providers/CartProvider";
import type { CheckoutData } from "@/lib/services/orders";
import { formatINR } from "@/lib/format";

/** Manual checkout: same prepareCheckout as the agent, then the same human-only Pay button. */
export function CheckoutClient({ disabled, totalPaise, restaurantName }: { disabled: boolean; totalPaise: number; restaurantName: string }) {
  const router = useRouter();
  const { refresh } = useCart();
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<CheckoutData | null>(null);

  if (data)
    return (
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
          router.push(`/orders/${data.order_id}`);
        }}
      />
    );

  return (
    <Button
      size="lg"
      className="w-full"
      disabled={disabled || busy}
      onClick={async () => {
        setBusy(true);
        const res = await fetch("/api/payments/create-order", { method: "POST" });
        const body = await res.json().catch(() => ({}));
        setBusy(false);
        if (!res.ok) return void toast.error(body.error ?? "Couldn't start checkout.");
        setData(body as CheckoutData);
      }}
    >
      {busy ? <Loader2 className="animate-spin" /> : <Lock />} Continue to pay {formatINR(totalPaise)}
    </Button>
  );
}
