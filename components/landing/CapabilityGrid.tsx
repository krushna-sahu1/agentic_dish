import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CalendarCheck, Check, CreditCard, MessageCircle, Truck } from "lucide-react";

/** Only capabilities that actually exist in the customer agent today. */
const CAPABILITIES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: MessageCircle,
    title: "Order by voice or text",
    body: "Say “two masala dosas, less spicy” — typed or spoken. The AI finds the dish and adds it to your cart.",
  },
  {
    icon: AlertTriangle,
    title: "Allergen checks",
    body: "It compares every dish with your saved allergies and asks before anything risky goes in.",
  },
  {
    icon: CalendarCheck,
    title: "Table booking",
    body: "Ask for a table for four tonight and the AI checks availability, then holds it once you confirm.",
  },
  {
    icon: Truck,
    title: "Live order tracking",
    body: "Follow your order from the kitchen to your door, the pickup counter or the table.",
  },
  {
    icon: Check,
    title: "You confirm everything",
    body: "Orders, cancellations and bookings all wait for your tap. The AI never acts on its own.",
  },
  {
    icon: CreditCard,
    title: "Payments stay human",
    body: "Checkout runs through Razorpay. The AI prepares the order but never touches your money.",
  },
];

export function CapabilityGrid() {
  return (
    <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {CAPABILITIES.map(({ icon: Icon, title, body }) => (
        <li
          key={title}
          className="reveal group rounded-3xl border border-border bg-card/60 p-6 transition-colors hover:border-primary/40 sm:p-7"
        >
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <Icon className="size-5" aria-hidden />
          </span>
          <h3 className="mt-4 text-base font-semibold tracking-tight">{title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
        </li>
      ))}
    </ul>
  );
}
