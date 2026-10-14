/** Scheduled jobs (Vercel Cron → app/api/cron/*). All idempotent via owner_alerts.dedupe_key. */
import { createAdminClient } from "@/lib/supabase/admin";
import { dailySummaryEmail, sendEmail } from "@/lib/email";
import { formatINR } from "@/lib/format";
import { fetchOrderPayments, razorpayConfigured } from "@/lib/razorpay";
import { processEvent } from "@/lib/payments/webhook";
import { addDays, resolveRange, zonedDateString, startOfZonedDay } from "@/lib/time";
import { getBottomItems, getRatingsSummary, getRevenue, getTopItems } from "@/lib/agents/owner/analytics";
import { getLowStock } from "@/lib/services/owner";

async function getLowStockSummary(): Promise<string[]> {
  const low = await getLowStock();
  return [
    ...low.inventory.map((i) => `${i.name} (${i.qty} ${i.unit})`),
    ...low.menu_items.map((i) => `${i.name} (${i.stock_qty} left)`),
  ];
}

const db = () => createAdminClient();

export function isAuthorizedCron(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && header === `Bearer ${secret}`;
}

async function alertOnce(row: { type: string; title: string; body?: string; severity: "info" | "warning" | "critical"; data?: unknown; dedupe_key: string }) {
  const { error } = await db().from("owner_alerts").insert(row);
  return !error; // unique violation on dedupe_key → already alerted
}

// ---------------------------------------------------------------- daily summary
export async function runDailySummary(now = new Date()) {
  const y = resolveRange("yesterday", undefined, undefined, now);
  const yr = { preset: "custom" as const, from: y.fromDate, to: y.toDate };
  const [rev, top, bottom, ratings, low] = await Promise.all([
    getRevenue({ range: yr, granularity: "day" }),
    getTopItems({ range: yr, limit: 3 }),
    getBottomItems({ range: yr, limit: 3 }),
    getRatingsSummary({ range: yr }),
    getLowStockSummary(),
  ]);
  const { data: notable } = await db()
    .from("reviews")
    .select("rating, comment")
    .gte("created_at", y.from)
    .lt("created_at", y.to)
    .not("comment", "is", null)
    .or("rating.lte.2,rating.eq.5")
    .order("rating")
    .limit(3);

  const lines = [
    `Revenue: ${formatINR(rev.totals.revenue_paise)} from ${rev.totals.orders} orders (AOV ${formatINR(rev.totals.aov_paise)})${rev.previous.change_percent != null ? `, ${rev.previous.change_percent > 0 ? "+" : ""}${rev.previous.change_percent}% vs the day before` : ""}`,
    `Top dishes: ${top.items.map((i) => `${i.name} (${i.qty})`).join(", ") || "—"}`,
    `Slowest: ${bottom.items.map((i) => `${i.name} (${i.qty})`).join(", ") || "—"}`,
    `Rating: ${ratings.overall.avg_rating ?? "no reviews"}${ratings.overall.reviews ? ` from ${ratings.overall.reviews} reviews` : ""}`,
    ...(notable ?? []).map((r) => `${r.rating}★ “${String(r.comment).slice(0, 120)}”`),
    low.length ? `Low stock: ${low.join(", ")}` : "Stock levels OK",
  ];
  const title = `Good morning — here's ${y.label.replace(" (IST)", "")}`;
  const created = await alertOnce({ type: "daily_summary", title, body: lines.join("\n"), severity: "info", data: { lines, range: y }, dedupe_key: `daily-summary-${y.fromDate}` });
  if (created) await sendEmail(process.env.OWNER_ALERT_EMAIL, title, dailySummaryEmail(title, lines));
  return { created, title, lines };
}

// ---------------------------------------------------------------- hourly alerts
const STUCK_MINUTES: Record<string, number> = { paid: 10, accepted: 20, preparing: 40, ready: 20, out_for_delivery: 60 };

export async function runAlerts(now = new Date()) {
  const out: string[] = [];
  const today = zonedDateString(now);
  const hourKey = `${today}-${now.getUTCHours()}`;

  // 1. Low stock (inventory + dish portions)
  for (const msg of await getLowStockSummary()) {
    if (await alertOnce({ type: "low_stock", title: `Low stock: ${msg}`, severity: "warning", dedupe_key: `low-stock-${today}-${msg}` })) out.push(`low_stock ${msg}`);
  }

  // 2. Stuck orders
  const { data: active } = await db().from("orders").select("id, order_number, status, updated_at, created_at").in("status", Object.keys(STUCK_MINUTES));
  for (const o of active ?? []) {
    const mins = (now.getTime() - new Date(o.updated_at ?? o.created_at).getTime()) / 60_000;
    if (mins > STUCK_MINUTES[o.status]) {
      if (await alertOnce({ type: "stuck_order", title: `${o.order_number} stuck in "${o.status}" for ${Math.round(mins)} min`, severity: "warning", data: { order_id: o.id }, dedupe_key: `stuck-${o.id}-${o.status}` }))
        out.push(`stuck ${o.order_number}`);
    }
  }

  // 3. Cancellation spike (last 2 hours)
  const since = new Date(now.getTime() - 2 * 3600_000).toISOString();
  const { data: recent } = await db().from("orders").select("status").gte("created_at", since);
  const cancelled = (recent ?? []).filter((o) => o.status === "cancelled").length;
  if ((recent ?? []).length >= 5 && cancelled / (recent ?? []).length > 0.2) {
    if (await alertOnce({ type: "cancellation_spike", title: `Cancellation spike: ${cancelled} of ${(recent ?? []).length} orders in the last 2 hours`, severity: "critical", dedupe_key: `cancel-spike-${hourKey}` }))
      out.push("cancellation_spike");
  }

  // 4. Negative reviews in the last hour without an alert yet
  const { data: neg } = await db().from("reviews").select("id, rating, comment").lte("rating", 2).gte("created_at", new Date(now.getTime() - 3600_000).toISOString());
  for (const r of neg ?? []) {
    if (await alertOnce({ type: "negative_review", title: `${r.rating}★ review`, body: String(r.comment ?? "").slice(0, 300), severity: "warning", data: { review_id: r.id }, dedupe_key: `neg-review-${r.id}` })) out.push(`negative_review ${r.id}`);
  }

  // 5. Sales drop >30% vs 4-week same-weekday average (checked once per day for yesterday)
  const yesterday = addDays(today, -1);
  const { data: already } = await db().from("owner_alerts").select("id").eq("dedupe_key", `sales-drop-check-${yesterday}`).maybeSingle();
  if (!already) {
    await alertOnce({ type: "internal", title: "sales drop check", severity: "info", dedupe_key: `sales-drop-check-${yesterday}` }).then(() =>
      db().from("owner_alerts").update({ is_read: true }).eq("dedupe_key", `sales-drop-check-${yesterday}`),
    );
    const from = startOfZonedDay(addDays(yesterday, -28)).toISOString();
    const to = startOfZonedDay(today).toISOString();
    const { data: daily } = await db().rpc("analytics_item_daily", { p_from: from, p_to: to });
    const rows = (daily ?? []) as { day: string; menu_item_id: string; name: string; qty: number }[];
    const ydow = new Date(`${yesterday}T00:00:00Z`).getUTCDay();
    const byItem = new Map<string, { name: string; base: number[]; y: number }>();
    for (const r of rows) {
      const d = String(r.day).slice(0, 10);
      const e = byItem.get(r.menu_item_id) ?? { name: r.name, base: [], y: 0 };
      if (d === yesterday) e.y = Number(r.qty);
      else if (new Date(`${d}T00:00:00Z`).getUTCDay() === ydow) e.base.push(Number(r.qty));
      byItem.set(r.menu_item_id, e);
    }
    for (const [id, e] of byItem) {
      const avg = e.base.reduce((a, b) => a + b, 0) / 4;
      if (avg >= 5 && e.y < avg * 0.7) {
        const drop = Math.round((1 - e.y / avg) * 100);
        if (await alertOnce({ type: "sales_drop", title: `${e.name} sales down ${drop}%`, body: `Sold ${e.y} yesterday vs ${avg.toFixed(1)} avg on the same weekday (last 4 weeks).`, severity: "warning", data: { menu_item_id: id }, dedupe_key: `sales-drop-${yesterday}-${id}` }))
          out.push(`sales_drop ${e.name}`);
      }
    }
  }
  return { alerts: out };
}

// ---------------------------------------------------------------- expire unpaid
export async function runExpireUnpaid(now = new Date()) {
  const cutoff = new Date(now.getTime() - 30 * 60_000).toISOString();
  const { data: stale } = await db().from("orders").select("id, order_number, razorpay_order_id").eq("status", "awaiting_payment").lt("created_at", cutoff).limit(100);
  const expired: string[] = [];
  const reconciled: string[] = [];
  for (const o of stale ?? []) {
    // Reconcile a possibly-missed webhook using Razorpay's API (server-side truth, never client input).
    if (o.razorpay_order_id && razorpayConfigured()) {
      try {
        const { items } = await fetchOrderPayments(o.razorpay_order_id);
        const captured = items.find((p) => p.status === "captured");
        if (captured) {
          await processEvent({ event: "payment.captured", payload: { payment: { entity: captured } } });
          reconciled.push(o.order_number);
          continue;
        }
      } catch (e) {
        console.error("reconcile failed", o.order_number, e);
      }
    }
    const { error } = await db().rpc("set_order_status", { p_order_id: o.id, p_status: "cancelled", p_actor: null, p_note: "Payment not completed within 30 minutes", p_cancel_reason: "payment_timeout" });
    if (!error) expired.push(o.order_number);
  }
  return { expired, reconciled };
}
