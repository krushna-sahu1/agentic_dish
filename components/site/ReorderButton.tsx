"use client";

import { useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/providers/CartProvider";
import { reorderAction } from "@/app/actions/customer";

export function ReorderButton({ orderId }: { orderId: string }) {
  const { setCart } = useCart();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await reorderAction(orderId);
          if (!r.ok) return void toast.error(r.error);
          setCart(r.data.cart);
          toast.success(`Added ${r.data.added.length} item(s) to your cart`);
          if (r.data.skipped.length) toast.warning(`Unavailable: ${r.data.skipped.map((s) => s.name).join(", ")}`);
        })
      }
    >
      <RotateCcw /> Reorder
    </Button>
  );
}
