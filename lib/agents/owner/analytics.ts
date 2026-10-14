/**
 * Owner analytics — thin typed wrappers over the read-only SQL RPCs in
 * supabase/migrations/*_analytics.sql. Every function resolves a date range in
 * the restaurant timezone and returns that range's label so answers can state it.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { percentChange } from "@/lib/format";
import { addDays, previousPeriod, resolveRange, zonedDateString, DEFAULT_TZ, type RangePreset, type ResolvedRange } from "@/lib/time";

export interface RangeInput {
  preset?: RangePreset;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD inclusive
}

export function range(r: RangeInput | undefined, fallback: RangePreset = "last_7_days"): ResolvedRange {
  if (r?.from) return resolveRange("custom", { from: r.from, to: r.to }, DEFAULT_TZ);
  return resolveRange(r?.preset ?? fallback, undefined, DEFAULT_TZ);
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await createAdminClient().rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

const n = (v: unknown) => Number(v ?? 0);

const itemRow = (x: Record<string, unknown>) => ({
  menu_item_id: x.menu_item_id as string,
  name: x.name as string,
  category: x.category as string,
  qty: n(x.qty),
  revenue_paise: n(x.revenue_paise),
  orders: n(x.orders),
});

export async function getRevenue(input: { range?: RangeInput; granularity?: "hour" | "day" | "week" | "month" }) {
  const r = range(input.range);
  const g = input.granularity ?? (r.days <= 1 ? "hour" : r.days > 62 ? "week" : "day");
  const rows = await rpc<{ bucket: string; revenue_paise: number; orders: number; aov_paise: number }[]>("analytics_revenue", {
    p_from: r.from,
    p_to: r.to,
    p_granularity: g,
  });
  const series = rows.map((x) => ({ bucket: x.bucket, revenue_paise: n(x.revenue_paise), orders: n(x.orders), aov_paise: n(x.aov_paise) }));
  const total = series.reduce((a, x) => a + x.revenue_paise, 0);
  const orders = series.reduce((a, x) => a + x.orders, 0);
  const prev = previousPeriod(r);
  const prevRows = await rpc<{ revenue_paise: number; orders: number }[]>("analytics_revenue", { p_from: prev.from, p_to: prev.to, p_granularity: "day" });
  const prevTotal = prevRows.reduce((a, x) => a + n(x.revenue_paise), 0);
  const best = [...series].sort((a, b) => b.revenue_paise - a.revenue_paise)[0];
  return {
    range: r,
    granularity: g,
    totals: { revenue_paise: total, orders, aov_paise: orders ? Math.round(total / orders) : 0 },
    previous: { range_label: prev.label, revenue_paise: prevTotal, change_percent: percentChange(total, prevTotal) },
    best_bucket: best && best.revenue_paise > 0 ? best : null,
    series,
  };
}

export async function getTopItems(input: { range?: RangeInput; limit?: number; order_by?: "revenue" | "qty" }) {
  const r = range(input.range, "this_week");
  const rows = await rpc<Record<string, unknown>[]>("analytics_top_items", {
    p_from: r.from,
    p_to: r.to,
    p_limit: input.limit ?? 10,
    p_order_by: input.order_by ?? "revenue",
  });
  return { range: r, order_by: input.order_by ?? "revenue", items: rows.map(itemRow) };
}

export async function getBottomItems(input: { range?: RangeInput; limit?: number }) {
  const r = range(input.range, "last_30_days");
  const rows = await rpc<Record<string, unknown>[]>("analytics_bottom_items", { p_from: r.from, p_to: r.to, p_limit: input.limit ?? 10 });
  return { range: r, items: rows.map(itemRow) };
}

export async function getCategoryBreakdown(input: { range?: RangeInput }) {
  const r = range(input.range, "last_30_days");
  const rows = await rpc<Record<string, unknown>[]>("analytics_category_breakdown", { p_from: r.from, p_to: r.to });
  return { range: r, categories: rows.map((x) => ({ category: x.category as string, qty: n(x.qty), revenue_paise: n(x.revenue_paise), share: n(x.share) })) };
}

export async function getPeakHours(input: { range?: RangeInput }) {
  const r = range(input.range, "last_30_days");
  const rows = await rpc<{ weekday: number; hour: number; orders: number; revenue_paise: number }[]>("analytics_peak_hours", { p_from: r.from, p_to: r.to });
  const cells = rows.map((x) => ({ weekday: n(x.weekday), hour: n(x.hour), orders: n(x.orders), revenue_paise: n(x.revenue_paise) }));
  const byHour = new Map<number, number>();
  const byDay = new Map<number, number>();
  for (const c of cells) {
    byHour.set(c.hour, (byHour.get(c.hour) ?? 0) + c.orders);
    byDay.set(c.weekday, (byDay.get(c.weekday) ?? 0) + c.orders);
  }
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const peakHour = [...byHour.entries()].sort((a, b) => b[1] - a[1])[0];
  const peakDay = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];
  const peakCell = [...cells].sort((a, b) => b.orders - a.orders)[0];
  return {
    range: r,
    cells,
    busiest_hour: peakHour ? { hour: peakHour[0], orders: peakHour[1] } : null,
    busiest_day: peakDay ? { day: days[peakDay[0]], orders: peakDay[1] } : null,
    busiest_slot: peakCell ? { day: days[peakCell.weekday], hour: peakCell.hour, orders: peakCell.orders } : null,
  };
}

export async function getOrderTypeSplit(input: { range?: RangeInput }) {
  const r = range(input.range, "last_30_days");
  const rows = await rpc<Record<string, unknown>[]>("analytics_order_type_split", { p_from: r.from, p_to: r.to });
  return { range: r, split: rows.map((x) => ({ order_type: x.order_type as string, orders: n(x.orders), revenue_paise: n(x.revenue_paise) })) };
}

export async function getCustomerStats(input: { range?: RangeInput }) {
  const r = range(input.range, "last_30_days");
  const stats = await rpc<Record<string, unknown>>("analytics_customer_stats", { p_from: r.from, p_to: r.to });
  return { range: r, ...stats };
}

export async function getCouponPerformance(input: { range?: RangeInput }) {
  const r = range(input.range, "last_30_days");
  const rows = await rpc<Record<string, unknown>[]>("analytics_coupon_performance", { p_from: r.from, p_to: r.to });
  return { range: r, coupons: rows.map((x) => ({ code: x.code as string, orders: n(x.orders), discount_paise: n(x.discount_paise), revenue_paise: n(x.revenue_paise), avg_order_paise: n(x.avg_order_paise) })) };
}

type Summary = { revenue_paise: number; orders: number; aov_paise: number; customers: number; cancelled: number; discount_paise: number; items_sold: number; avg_rating: number | null };

export async function comparePeriods(input: { a?: RangeInput; b?: RangeInput }) {
  // a = current (default this week so far), b = comparison (default the same length just before a)
  const a = range(input.a, "this_week");
  const b = input.b ? range(input.b) : previousPeriod(a);
  const res = await rpc<{ a: Summary; b: Summary }>("analytics_compare_periods", { p_from_a: a.from, p_to_a: a.to, p_from_b: b.from, p_to_b: b.to });
  const metrics = (["revenue_paise", "orders", "aov_paise", "customers", "items_sold", "cancelled", "avg_rating"] as const).map((k) => ({
    metric: k,
    a: res.a[k] == null ? null : Number(res.a[k]),
    b: res.b[k] == null ? null : Number(res.b[k]),
    change_percent: res.a[k] == null || res.b[k] == null ? null : percentChange(Number(res.a[k]), Number(res.b[k])),
  }));
  return { a: { label: a.label, range: a }, b: { label: b.label, range: b }, metrics };
}

export async function getRatingsSummary(input: { range?: RangeInput }) {
  const r = range(input.range, "last_30_days");
  const rows = await rpc<Record<string, unknown>[]>("analytics_ratings", { p_from: r.from, p_to: r.to });
  const items = rows.map((x) => ({ name: x.name as string, avg_rating: n(x.avg_rating), reviews: n(x.reviews), positive: n(x.positive), neutral: n(x.neutral), negative: n(x.negative) }));
  const total = items.reduce((a, x) => a + x.reviews, 0);
  const avg = total ? items.reduce((a, x) => a + x.avg_rating * x.reviews, 0) / total : null;
  return {
    range: r,
    overall: { avg_rating: avg ? Math.round(avg * 100) / 100 : null, reviews: total, positive: items.reduce((a, x) => a + x.positive, 0), neutral: items.reduce((a, x) => a + x.neutral, 0), negative: items.reduce((a, x) => a + x.negative, 0) },
    items: items.filter((x) => x.reviews >= 2).sort((a, b) => b.avg_rating - a.avg_rating),
  };
}

export async function getCancellations(input: { range?: RangeInput }) {
  const r = range(input.range, "last_30_days");
  const rows = await rpc<Record<string, unknown>[]>("analytics_cancellations", { p_from: r.from, p_to: r.to });
  const reasons = rows.map((x) => ({ reason: x.reason as string, orders: n(x.orders), value_paise: n(x.value_paise) }));
  return { range: r, total: reasons.reduce((a, x) => a + x.orders, 0), lost_paise: reasons.reduce((a, x) => a + x.value_paise, 0), reasons };
}

export async function getPaymentMethods(input: { range?: RangeInput }) {
  const r = range(input.range, "last_30_days");
  const rows = await rpc<Record<string, unknown>[]>("analytics_payment_methods", { p_from: r.from, p_to: r.to });
  return { range: r, methods: rows.map((x) => ({ method: x.method as string, payments: n(x.payments), amount_paise: n(x.amount_paise) })) };
}

/** Today's live numbers (also available to staff). */
export async function getLiveKpis() {
  const r = resolveRange("today");
  const db = createAdminClient();
  const [today, active, ratings, awaiting] = await Promise.all([
    db.from("orders").select("total_paise, status").gte("created_at", r.from).lt("created_at", r.to),
    db.from("orders").select("id", { count: "exact", head: true }).in("status", ["paid", "accepted", "preparing", "ready", "out_for_delivery"]),
    db.from("reviews").select("rating").gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString()),
    db.from("orders").select("id", { count: "exact", head: true }).eq("status", "paid"),
  ]);
  const rev = (today.data ?? []).filter((o) => ["paid", "accepted", "preparing", "ready", "out_for_delivery", "completed"].includes(o.status as string));
  const ratingsList = (ratings.data ?? []).map((x) => x.rating as number);
  return {
    date_label: r.label,
    revenue_today_paise: rev.reduce((a, o) => a + (o.total_paise as number), 0),
    orders_today: rev.length,
    active_orders: active.count ?? 0,
    new_orders_waiting: awaiting.count ?? 0,
    avg_rating_30d: ratingsList.length ? Math.round((ratingsList.reduce((a, b) => a + b, 0) / ratingsList.length) * 100) / 100 : null,
  };
}

/** Same-weekday average over the last 8 weeks, per item, for the next N days. */
export async function forecastDemand(input: { days_ahead?: number; limit?: number }) {
  const daysAhead = Math.max(1, Math.min(input.days_ahead ?? 1, 7));
  const today = zonedDateString(new Date());
  const r = resolveRange("custom", { from: addDays(today, -56), to: addDays(today, -1) });
  const rows = await rpc<{ day: string; menu_item_id: string; name: string; qty: number }[]>("analytics_item_daily", { p_from: r.from, p_to: r.to });
  const dow = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();
  const days = Array.from({ length: daysAhead }, (_, i) => addDays(today, i + 1));
  const names = new Map<string, string>();
  const byItemDow = new Map<string, number>();
  for (const x of rows) {
    names.set(x.menu_item_id, x.name);
    const k = `${x.menu_item_id}|${dow(String(x.day).slice(0, 10))}`;
    byItemDow.set(k, (byItemDow.get(k) ?? 0) + n(x.qty));
  }
  const forecast = [...names.entries()].map(([id, name]) => {
    const perDay = days.map((d) => Math.round(((byItemDow.get(`${id}|${dow(d)}`) ?? 0) / 8) * 10) / 10);
    return { menu_item_id: id, name, per_day: perDay, total: Math.round(perDay.reduce((a, b) => a + b, 0)) };
  });
  forecast.sort((a, b) => b.total - a.total);
  return { method: "Same-weekday average over the last 8 weeks", days, items: forecast.slice(0, input.limit ?? 15) };
}

/** Raw recent reviews for the LLM to summarise into themes (comments are wrapped as untrusted data by the tool layer). */
export async function getRecentReviews(input: { range?: RangeInput; limit?: number; rating_max?: number }) {
  const r = range(input.range, "last_30_days");
  let q = createAdminClient()
    .from("reviews")
    .select("id, rating, comment, sentiment, created_at, menu_items(name)")
    .gte("created_at", r.from)
    .lt("created_at", r.to)
    .not("comment", "is", null)
    .order("created_at", { ascending: false })
    .limit(Math.min(input.limit ?? 80, 200));
  if (input.rating_max) q = q.lte("rating", input.rating_max);
  const { data } = await q;
  return {
    range: r,
    reviews: (data ?? []).map((x) => ({
      id: x.id as string,
      rating: x.rating as number,
      item: (x.menu_items as unknown as { name: string } | null)?.name ?? null,
      sentiment: x.sentiment as string | null,
      comment: x.comment as string,
    })),
  };
}
