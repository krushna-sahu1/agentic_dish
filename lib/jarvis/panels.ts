/**
 * Maps a Jarvis tool result to the floating glass panel that visualises it.
 * Pure + client-safe so it can be unit-tested.
 */

export type RangeLike = { label?: string } | string | null | undefined;

export type PanelSpec =
  | { kind: "kpis"; title: string; period: string; revenue_paise: number; orders: number; active_orders: number; waiting: number; avg_rating: number | null }
  | { kind: "revenue"; title: string; period: string; revenue_paise: number; orders: number; change_percent: number | null; previous_label: string | null; series: { label: string; value: number }[] }
  | { kind: "bars"; title: string; period: string; unit: "paise" | "qty"; bars: { label: string; value: number; sub?: string }[] }
  | { kind: "heatmap"; title: string; period: string; cells: { weekday: number; hour: number; orders: number }[]; headline: string | null }
  | { kind: "orders"; title: string; period: string; orders: OrderCard[] }
  | { kind: "compare"; title: string; a_label: string; b_label: string; metrics: { metric: string; label: string; a: number | null; b: number | null; change_percent: number | null; money: boolean }[] }
  | { kind: "list"; title: string; period: string; rows: { label: string; value: string }[] };

export interface OrderCard {
  order_number: string;
  status: string;
  total_paise: number;
  customer: string | null;
  items: string;
  minutes_in_status: number | null;
  order_type: string | null;
}

type Data = Record<string, unknown>;
const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0) || 0);
const label = (r: unknown) => (typeof r === "string" ? r : ((r as { label?: string } | null)?.label ?? ""));
export const stripUserText = (s: unknown) => (s == null ? null : String(s).replace(/<\/?user_text>/g, ""));

const METRIC_LABEL: Record<string, string> = {
  revenue_paise: "Revenue",
  orders: "Orders",
  aov_paise: "Avg order",
  customers: "Customers",
  items_sold: "Items sold",
  cancelled: "Cancelled",
  avg_rating: "Rating",
};

function bucketLabel(bucket: string, granularity: string): string {
  const d = new Date(bucket);
  if (Number.isNaN(d.getTime())) return bucket;
  const opts: Intl.DateTimeFormatOptions =
    granularity === "hour" ? { hour: "numeric", timeZone: "Asia/Kolkata" } : granularity === "month" ? { month: "short", timeZone: "Asia/Kolkata" } : { day: "numeric", month: "short", timeZone: "Asia/Kolkata" };
  return d.toLocaleString("en-IN", opts);
}

function orderCard(o: Data): OrderCard {
  const items = Array.isArray(o.items) ? (o.items as Data[]).map((i) => `${num(i.qty)}× ${i.name_snapshot ?? i.name ?? ""}`).join(", ") : String(o.items ?? "");
  return {
    order_number: String(o.order_number ?? ""),
    status: String(o.status ?? ""),
    total_paise: num(o.total_paise),
    customer: stripUserText(o.customer ?? o.customer_name),
    items,
    minutes_in_status: o.minutes_in_status == null ? null : num(o.minutes_in_status),
    order_type: (o.order_type as string) ?? null,
  };
}

export function toolToPanel(tool: string, raw: unknown): PanelSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Data;
  switch (tool) {
    case "get_live_kpis":
      return {
        kind: "kpis",
        title: "Today so far",
        period: "Today",
        revenue_paise: num(d.revenue_today_paise),
        orders: num(d.orders_today),
        active_orders: num(d.active_orders),
        waiting: num(d.new_orders_waiting),
        avg_rating: d.avg_rating_30d == null ? null : num(d.avg_rating_30d),
      };
    case "get_revenue": {
      const totals = (d.totals ?? {}) as Data;
      const prev = (d.previous ?? {}) as Data;
      const g = String(d.granularity ?? "day");
      return {
        kind: "revenue",
        title: "Revenue",
        period: label(d.range),
        revenue_paise: num(totals.revenue_paise),
        orders: num(totals.orders),
        change_percent: prev.change_percent == null ? null : num(prev.change_percent),
        previous_label: (prev.range_label as string) ?? null,
        series: ((d.series as Data[]) ?? []).map((s) => ({ label: bucketLabel(String(s.bucket), g), value: num(s.revenue_paise) })),
      };
    }
    case "get_top_items":
    case "get_bottom_items": {
      const byQty = d.order_by === "qty";
      const items = ((d.items as Data[]) ?? []).slice(0, 8);
      return {
        kind: "bars",
        title: tool === "get_top_items" ? "Top dishes" : "Slowest dishes",
        period: label(d.range),
        unit: byQty ? "qty" : "paise",
        bars: items.map((i) => ({ label: String(i.name), value: byQty ? num(i.qty) : num(i.revenue_paise), sub: byQty ? undefined : `${num(i.qty)} sold` })),
      };
    }
    case "get_category_breakdown":
      return {
        kind: "bars",
        title: "Categories",
        period: label(d.range),
        unit: "paise",
        bars: ((d.categories as Data[]) ?? []).slice(0, 8).map((c) => ({ label: String(c.category), value: num(c.revenue_paise), sub: `${Math.round(num(c.share))}%` })),
      };
    case "get_peak_hours": {
      const slot = d.busiest_slot as Data | null;
      const hour = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
      return {
        kind: "heatmap",
        title: "Busiest times",
        period: label(d.range),
        cells: ((d.cells as Data[]) ?? []).map((c) => ({ weekday: num(c.weekday), hour: num(c.hour), orders: num(c.orders) })),
        headline: slot ? `Peak: ${slot.day} ${hour(num(slot.hour))}` : null,
      };
    }
    case "list_orders":
      return { kind: "orders", title: `Orders (${num(d.count)})`, period: String(d.range_label ?? ""), orders: ((d.orders as Data[]) ?? []).slice(0, 6).map(orderCard) };
    case "get_order":
      return d.order_number ? { kind: "orders", title: `Order ${d.order_number}`, period: "", orders: [orderCard(d)] } : null;
    case "compare_periods": {
      const a = d.a as Data;
      const b = d.b as Data;
      return {
        kind: "compare",
        title: "Comparison",
        a_label: label(a),
        b_label: label(b),
        metrics: ((d.metrics as Data[]) ?? [])
          .filter((m) => m.metric !== "cancelled" || num(m.a) + num(m.b) > 0)
          .map((m) => ({
            metric: String(m.metric),
            label: METRIC_LABEL[String(m.metric)] ?? String(m.metric),
            a: m.a == null ? null : num(m.a),
            b: m.b == null ? null : num(m.b),
            change_percent: m.change_percent == null ? null : num(m.change_percent),
            money: String(m.metric).endsWith("_paise"),
          })),
      };
    }
    default:
      return genericPanel(tool, d);
  }
}

/** Fallback: the first list in the result, as up to six label/value rows. */
function genericPanel(tool: string, d: Data): PanelSpec | null {
  const title = tool.replace(/^(get|list|find)_/, "").replace(/_/g, " ");
  const list = Object.values(d).find((v) => Array.isArray(v) && v.length && typeof v[0] === "object") as Data[] | undefined;
  const rows: { label: string; value: string }[] = [];
  if (list) {
    for (const x of list.slice(0, 6)) {
      const name = x.name ?? x.code ?? x.title ?? x.order_number ?? x.category ?? x.method ?? x.reason ?? x.tool_name;
      const valueKey = Object.keys(x).find((k) => /paise$|qty|orders|count|rating|status|is_available/.test(k) && k !== "name");
      const v = valueKey ? x[valueKey] : "";
      rows.push({ label: stripUserText(name) ?? "—", value: valueKey?.endsWith("_paise") ? `₹${Math.round(num(v) / 100).toLocaleString("en-IN")}` : String(v ?? "") });
    }
  }
  if (!rows.length) return null;
  return { kind: "list", title: title[0].toUpperCase() + title.slice(1), period: label(d.range), rows };
}
