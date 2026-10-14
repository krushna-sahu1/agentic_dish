/** Formatting helpers shared by UI, agents and emails. */

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** 12345600 paise → "₹1,23,456" (Indian grouping). */
export function formatINR(paise: number | null | undefined): string {
  const v = (paise ?? 0) / 100;
  return `₹${inr.format(Math.round(v * 100) / 100)}`;
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function formatNumber(n: number | null | undefined): string {
  return new Intl.NumberFormat("en-IN").format(n ?? 0);
}

export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const d = phone.replace(/\D/g, "");
  if (d.length < 4) return null;
  return d.slice(0, 2) + "x".repeat(d.length - 4) + d.slice(-2);
}

export function maskEmail(email: string | null | undefined): string | null {
  if (!email || !email.includes("@")) return null;
  const [user, domain] = email.split("@");
  return `${user[0]}${"*".repeat(Math.max(user.length - 1, 1))}@${domain}`;
}

export function percentChange(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function spiceLabel(level: number): string {
  return ["Not spicy", "Mild", "Medium", "Spicy", "Very spicy", "Fiery"][Math.max(0, Math.min(5, level))];
}

export const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "Awaiting payment",
  paid: "Paid — waiting for kitchen",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  payment_failed: "Payment failed",
};
