import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Variant = "default" | "success" | "warning" | "info" | "destructive" | "muted" | "saffron" | "iris" | "ink";

const STATUS: Record<string, { label: string; variant: Variant }> = {
  awaiting_payment: { label: "Awaiting payment", variant: "muted" },
  paid: { label: "New", variant: "iris" },
  accepted: { label: "Accepted", variant: "info" },
  preparing: { label: "Preparing", variant: "saffron" },
  ready: { label: "Ready", variant: "success" },
  out_for_delivery: { label: "Out for delivery", variant: "info" },
  completed: { label: "Completed", variant: "ink" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  refunded: { label: "Refunded", variant: "muted" },
  payment_failed: { label: "Payment failed", variant: "destructive" },
};

export const ORDER_STATUS_OPTIONS = Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }));

/** Order status pill: label + dot, so state never relies on colour alone. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const s = STATUS[status] ?? { label: status, variant: "muted" as const };
  return (
    <Badge variant={s.variant} className={className}>
      <span className={cn("size-1.5 rounded-full bg-current", status === "paid" && "animate-pulse")} aria-hidden />
      {s.label}
    </Badge>
  );
}
