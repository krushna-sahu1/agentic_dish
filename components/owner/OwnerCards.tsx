"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, Bell, Download, FileText, Info, Minus, Table2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatINR, formatNumber, STATUS_LABEL } from "@/lib/format";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";

const SERIES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];
const strip = (s: unknown) => (typeof s === "string" ? s.replace(/<\/?user_text>/g, "") : s);

export type Fmt = "inr" | "num" | "pct" | "text";
export const fmtValue = (v: unknown, f: Fmt = "text") =>
  v == null ? "—" : f === "inr" ? formatINR(Number(v)) : f === "num" ? formatNumber(Number(v)) : f === "pct" ? `${v}%` : String(strip(v));

/** Compact ₹ for axes: ₹12.3k, ₹1.2L. */
const shortINR = (paise: number) => {
  const r = paise / 100;
  if (r >= 100000) return `₹${(r / 100000).toFixed(1)}L`;
  if (r >= 1000) return `₹${(r / 1000).toFixed(1)}k`;
  return `₹${Math.round(r)}`;
};

function toCsv(columns: { key: string; label: string }[], rows: Record<string, unknown>[]) {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(strip(v));
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map((c) => esc(c.label)).join(","), ...rows.map((r) => columns.map((c) => esc(r[c.key])).join(","))].join("\n");
}

function downloadCsv(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface Column {
  key: string;
  label: string;
  fmt?: Fmt;
  align?: "left" | "right";
}

// ---------------------------------------------------------------- frame
export function ChartFrame({
  title,
  subtitle,
  insight,
  columns,
  rows,
  children,
  defaultView = "chart",
}: {
  title: string;
  subtitle?: string;
  insight?: string;
  columns: Column[];
  rows: Record<string, unknown>[];
  children?: React.ReactNode;
  defaultView?: "chart" | "table";
}) {
  const [view, setView] = useState<"chart" | "table">(children ? defaultView : "table");
  return (
    <figure className="my-2 w-full overflow-hidden rounded-xl border bg-card shadow-sm" data-testid="owner-card">
      <div className="flex items-start justify-between gap-2 border-b px-3 py-2">
        <div className="min-w-0">
          <figcaption className="text-sm font-semibold">{title}</figcaption>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          {children && (
            <Button variant="ghost" size="icon" className="size-7" aria-label={view === "chart" ? "Show table" : "Show chart"} title={view === "chart" ? "Table view" : "Chart view"} onClick={() => setView(view === "chart" ? "table" : "chart")}>
              {view === "chart" ? <Table2 /> : <BarChart3 />}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="size-7" aria-label="Download CSV" title="Download CSV" onClick={() => downloadCsv(title, toCsv(columns, rows))}>
            <Download />
          </Button>
        </div>
      </div>
      <div className="p-3">{view === "chart" && children ? children : <DataTable columns={columns} rows={rows} />}</div>
      {insight && <p className="border-t px-3 py-2 text-xs text-muted-foreground">{insight}</p>}
    </figure>
  );
}

export function DataTable({ columns, rows, maxHeight = 320 }: { columns: Column[]; rows: Record<string, unknown>[]; maxHeight?: number }) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      const x = a[sort.key];
      const y = b[sort.key];
      if (typeof x === "number" && typeof y === "number") return (x - y) * sort.dir;
      return String(x ?? "").localeCompare(String(y ?? "")) * sort.dir;
    });
  }, [rows, sort]);
  if (!rows.length) return <p className="text-sm text-muted-foreground">No data for this range.</p>;
  return (
    <div className="overflow-auto rounded-lg border" style={{ maxHeight }}>
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-muted">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn("px-2 py-1.5 font-medium", c.align === "right" || c.fmt === "inr" || c.fmt === "num" ? "text-right" : "text-left")} aria-sort={sort?.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                <button className="hover:underline" onClick={() => setSort({ key: c.key, dir: sort?.key === c.key ? (sort.dir === 1 ? -1 : 1) : -1 })}>
                  {c.label}
                  {sort?.key === c.key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={i} className="border-t">
              {columns.map((c) => (
                <td key={c.key} className={cn("px-2 py-1 align-top", (c.align === "right" || c.fmt === "inr" || c.fmt === "num") && "text-right tabular-nums")}>
                  {fmtValue(r[c.key], c.fmt)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------- KPIs
export interface Kpi {
  label: string;
  value: string;
  sub?: string;
  change?: number | null;
  invert?: boolean;
}

export function KpiCards({ items, title }: { items: Kpi[]; title?: string }) {
  return (
    <div className="my-2 w-full" data-testid="kpi-cards">
      {title && <p className="mb-1.5 text-sm font-semibold">{title}</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map((k) => (
          <div key={k.label} className="rounded-xl border bg-card p-3 shadow-sm">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums">{k.value}</p>
            {k.change != null && <Change value={k.change} invert={k.invert} />}
            {k.sub && <p className="text-[11px] text-muted-foreground">{k.sub}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Change({ value, invert }: { value: number | null; invert?: boolean }) {
  if (value == null) return <span className="text-xs text-muted-foreground">n/a</span>;
  const good = invert ? value < 0 : value > 0;
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", value === 0 ? "text-muted-foreground" : good ? "text-success" : "text-destructive")}>
      <Icon className="size-3.5" aria-hidden />
      {value > 0 ? "+" : ""}
      {value}% <span className="sr-only">{good ? "(better)" : "(worse)"}</span>
    </span>
  );
}

// ---------------------------------------------------------------- tooltip
function TipBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------- line
export function LineChartCard({ title, subtitle, insight, data, xLabel, yKey, yFmt = "inr", columns }: { title: string; subtitle?: string; insight?: string; data: Record<string, unknown>[]; xLabel: (row: Record<string, unknown>) => string; yKey: string; yFmt?: Fmt; columns: Column[] }) {
  const rows = data.map((d) => ({ ...d, __x: xLabel(d) }));
  return (
    <ChartFrame title={title} subtitle={subtitle} insight={insight} columns={columns} rows={rows}>
      <div className="h-48 w-full" role="img" aria-label={`${title} line chart`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
            <XAxis dataKey="__x" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} minTickGap={16} />
            <YAxis tickLine={false} axisLine={false} width={48} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickFormatter={(v) => (yFmt === "inr" ? shortINR(v) : formatNumber(v))} />
            <Tooltip cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }} content={({ active, payload, label }) => (active && payload?.length ? <TipBox label={String(label)} value={fmtValue(payload[0].value, yFmt)} /> : null)} />
            <Line type="monotone" dataKey={yKey} stroke="var(--chart-1)" strokeWidth={2} dot={rows.length <= 14 ? { r: 3, strokeWidth: 2, stroke: "var(--card)", fill: "var(--chart-1)" } : false} activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

// ---------------------------------------------------------------- bar (horizontal, single series)
export function BarChartCard({ title, subtitle, insight, data, labelKey, valueKey, valueFmt = "inr", columns, color = "var(--chart-1)" }: { title: string; subtitle?: string; insight?: string; data: Record<string, unknown>[]; labelKey: string; valueKey: string; valueFmt?: Fmt; columns: Column[]; color?: string }) {
  const height = Math.max(120, data.length * 30 + 16);
  return (
    <ChartFrame title={title} subtitle={subtitle} insight={insight} columns={columns} rows={data}>
      <div className="w-full" style={{ height }} role="img" aria-label={`${title} bar chart`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }} barCategoryGap={4}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey={labelKey} tickLine={false} axisLine={false} width={130} tick={{ fontSize: 11, fill: "var(--foreground)" }} />
            <Tooltip cursor={{ fill: "var(--muted)" }} content={({ active, payload }) => (active && payload?.length ? <TipBox label={String(payload[0].payload[labelKey])} value={fmtValue(payload[0].value, valueFmt)} /> : null)} />
            <Bar dataKey={valueKey} fill={color} radius={[0, 4, 4, 0]} isAnimationActive={false} label={{ position: "right", fontSize: 10, fill: "var(--muted-foreground)", formatter: (v: unknown) => (valueFmt === "inr" ? shortINR(Number(v)) : formatNumber(Number(v))) }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

// ---------------------------------------------------------------- donut (≤6 slices + Other)
export function PieChartCard({ title, subtitle, insight, data, labelKey, valueKey, valueFmt = "inr", columns }: { title: string; subtitle?: string; insight?: string; data: Record<string, unknown>[]; labelKey: string; valueKey: string; valueFmt?: Fmt; columns: Column[] }) {
  const slices = useMemo(() => {
    const sorted = [...data].sort((a, b) => Number(b[valueKey]) - Number(a[valueKey]));
    const top = sorted.slice(0, 5);
    const rest = sorted.slice(5);
    if (rest.length) top.push({ [labelKey]: "Other", [valueKey]: rest.reduce((s, r) => s + Number(r[valueKey]), 0) });
    return top;
  }, [data, labelKey, valueKey]);
  const total = slices.reduce((s, r) => s + Number(r[valueKey]), 0);
  return (
    <ChartFrame title={title} subtitle={subtitle} insight={insight} columns={columns} rows={data}>
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <div className="h-40 w-40 shrink-0" role="img" aria-label={`${title} donut chart`}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={slices} dataKey={valueKey} nameKey={labelKey} innerRadius="58%" outerRadius="95%" paddingAngle={1} stroke="var(--card)" strokeWidth={2} isAnimationActive={false}>
                {slices.map((s, i) => (
                  <Cell key={i} fill={s[labelKey] === "Other" ? "var(--chart-other)" : SERIES[i]} />
                ))}
              </Pie>
              <Tooltip content={({ active, payload }) => (active && payload?.length ? <TipBox label={String(payload[0].name)} value={`${fmtValue(payload[0].value, valueFmt)} · ${total ? Math.round((Number(payload[0].value) / total) * 100) : 0}%`} /> : null)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="w-full space-y-1 text-xs" aria-label="Legend">
          {slices.map((s, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: s[labelKey] === "Other" ? "var(--chart-other)" : SERIES[i] }} aria-hidden />
              <span className="flex-1 capitalize">{String(s[labelKey]).replace(/_/g, " ")}</span>
              <span className="tabular-nums">{fmtValue(s[valueKey], valueFmt)}</span>
              <span className="w-9 text-right tabular-nums text-muted-foreground">{total ? Math.round((Number(s[valueKey]) / total) * 100) : 0}%</span>
            </li>
          ))}
        </ul>
      </div>
    </ChartFrame>
  );
}

// ---------------------------------------------------------------- heatmap (weekday × hour, sequential)
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function HeatmapCard({ title, subtitle, insight, cells }: { title: string; subtitle?: string; insight?: string; cells: { weekday: number; hour: number; orders: number; revenue_paise: number }[] }) {
  const hours = cells.length ? Array.from({ length: Math.max(...cells.map((c) => c.hour)) - Math.min(...cells.map((c) => c.hour)) + 1 }, (_, i) => Math.min(...cells.map((c) => c.hour)) + i) : [];
  const max = Math.max(1, ...cells.map((c) => c.orders));
  const at = (d: number, h: number) => cells.find((c) => c.weekday === d && c.hour === h);
  const order = [1, 2, 3, 4, 5, 6, 0];
  const step = (v: number) => (v === 0 ? 0 : Math.min(7, 1 + Math.floor((v / max) * 6.999)));
  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      insight={insight}
      columns={[{ key: "day", label: "Day" }, { key: "hour", label: "Hour" }, { key: "orders", label: "Orders", fmt: "num" }, { key: "revenue_paise", label: "Revenue", fmt: "inr" }]}
      rows={cells.map((c) => ({ day: DAYS[c.weekday], hour: `${c.hour}:00`, orders: c.orders, revenue_paise: c.revenue_paise }))}
    >
      <div className="overflow-x-auto" role="img" aria-label={`${title} heatmap`}>
        <div className="inline-grid gap-[2px] text-[10px]" style={{ gridTemplateColumns: `2.25rem repeat(${hours.length}, minmax(1.25rem, 1fr))` }}>
          <span />
          {hours.map((h) => (
            <span key={h} className="text-center text-muted-foreground">{h % 3 === 0 ? h : ""}</span>
          ))}
          {order.map((d) => (
            <div key={d} className="contents">
              <span className="pr-1 text-right leading-5 text-muted-foreground">{DAYS[d]}</span>
              {hours.map((h) => {
                const c = at(d, h);
                const v = c?.orders ?? 0;
                return <span key={h} className="h-5 rounded-[3px]" style={{ background: `var(--seq-${step(v)})` }} title={`${DAYS[d]} ${h}:00 — ${v} orders${c ? `, ${formatINR(c.revenue_paise)}` : ""}`} />;
              })}
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
          Fewer
          {[1, 2, 3, 4, 5, 6, 7].map((s) => (
            <span key={s} className="h-2.5 w-4 rounded-sm" style={{ background: `var(--seq-${s})` }} aria-hidden />
          ))}
          More orders
        </div>
      </div>
    </ChartFrame>
  );
}

// ---------------------------------------------------------------- comparison
const METRIC_LABEL: Record<string, { label: string; fmt: Fmt; invert?: boolean }> = {
  revenue_paise: { label: "Revenue", fmt: "inr" },
  orders: { label: "Orders", fmt: "num" },
  aov_paise: { label: "Avg order value", fmt: "inr" },
  customers: { label: "Customers", fmt: "num" },
  items_sold: { label: "Items sold", fmt: "num" },
  cancelled: { label: "Cancellations", fmt: "num", invert: true },
  avg_rating: { label: "Avg rating", fmt: "text" },
};

export function ComparisonCard({ a, b, metrics }: { a: string; b: string; metrics: { metric: string; a: number | null; b: number | null; change_percent: number | null }[] }) {
  return (
    <figure className="my-2 w-full overflow-hidden rounded-xl border bg-card shadow-sm" data-testid="comparison-card">
      <figcaption className="border-b px-3 py-2 text-sm">
        <b>{a.replace(" (IST)", "")}</b> <span className="text-muted-foreground">vs</span> <b>{b.replace(" (IST)", "")}</b>
      </figcaption>
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
        {metrics.map((m) => {
          const meta = METRIC_LABEL[m.metric] ?? { label: m.metric, fmt: "num" as Fmt };
          return (
            <div key={m.metric} className="rounded-lg border p-2">
              <p className="text-xs text-muted-foreground">{meta.label}</p>
              <p className="font-semibold tabular-nums">{fmtValue(m.a, meta.fmt)}</p>
              <p className="flex items-center justify-between gap-1 text-[11px] text-muted-foreground">
                <span>was {fmtValue(m.b, meta.fmt)}</span>
                <Change value={m.change_percent} invert={meta.invert} />
              </p>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

// ---------------------------------------------------------------- orders / alerts / reports
export interface OwnerOrder {
  order_number: string;
  status: string;
  order_type: string;
  total_paise: number;
  customer?: string | null;
  items: string;
  created_at: string;
  minutes_in_status?: number;
  table_number?: number | null;
  notes?: string | null;
}

export function OrderCard({ o }: { o: OwnerOrder }) {
  return (
    <div className="rounded-lg border bg-card p-2.5 text-sm" data-testid="order-card">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{o.order_number.split("-").pop()} <span className="text-xs font-normal text-muted-foreground">{o.order_number}</span></span>
        <Badge variant={o.status === "paid" ? "default" : o.status === "completed" ? "success" : "secondary"}>{STATUS_LABEL[o.status] ?? o.status}</Badge>
      </div>
      <p className="mt-1 text-xs">{strip(o.items) as string}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {o.order_type.replace("_", "-")}{o.table_number ? ` · T${o.table_number}` : ""} · {formatINR(o.total_paise)}{o.customer ? ` · ${strip(o.customer)}` : ""} · {formatDateTime(o.created_at)}
        {o.minutes_in_status != null ? ` · ${o.minutes_in_status} min in status` : ""}
      </p>
      {o.notes && <p className="mt-1 rounded bg-muted px-1.5 py-0.5 text-xs">Note: {strip(o.notes) as string}</p>}
    </div>
  );
}

export function OrderListCard({ title, orders }: { title: string; orders: OwnerOrder[] }) {
  return (
    <figure className="my-2 w-full rounded-xl border bg-card p-3 shadow-sm">
      <figcaption className="mb-2 flex items-center justify-between text-sm font-semibold">
        {title}
        <Link href="/owner/orders" className="text-xs font-normal text-primary hover:underline">Open live board →</Link>
      </figcaption>
      {orders.length === 0 ? <p className="text-sm text-muted-foreground">No orders.</p> : <div className="grid max-h-80 gap-2 overflow-auto sm:grid-cols-2">{orders.slice(0, 20).map((o) => <OrderCard key={o.order_number} o={o} />)}</div>}
    </figure>
  );
}

export function AlertCard({ alerts }: { alerts: { id: string; title: string; body: string | null; severity: string; created_at: string }[] }) {
  if (!alerts.length) return <p className="my-1 text-sm text-muted-foreground">No alerts. 🎉</p>;
  return (
    <ul className="my-2 w-full space-y-1.5">
      {alerts.slice(0, 10).map((a) => (
        <li key={a.id} className={cn("flex gap-2 rounded-lg border p-2 text-sm", a.severity === "critical" ? "border-destructive/50 bg-destructive/5" : a.severity === "warning" ? "border-amber-500/40 bg-amber-500/5" : "")}>
          {a.severity === "info" ? <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-label="Info" /> : <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", a.severity === "critical" ? "text-destructive" : "text-amber-600")} aria-label={a.severity} />}
          <div>
            <p className="font-medium">{a.title}</p>
            {a.body && <p className="whitespace-pre-line text-xs text-muted-foreground">{strip(a.body) as string}</p>}
            <p className="text-[10px] text-muted-foreground">{formatDateTime(a.created_at)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ReportCard({ label, summary, downloads }: { label: string; summary: { revenue_paise: number; orders: number; aov_paise: number; change_percent: number | null; avg_rating: number | null }; downloads: { csv: string; pdf: string } }) {
  return (
    <figure className="my-2 w-full rounded-xl border bg-card p-3 shadow-sm" data-testid="report-card">
      <figcaption className="flex items-center gap-2 text-sm font-semibold"><FileText className="size-4 text-primary" /> Report · {label}</figcaption>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div><dt className="text-xs text-muted-foreground">Revenue</dt><dd className="font-semibold">{formatINR(summary.revenue_paise)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Orders</dt><dd className="font-semibold">{formatNumber(summary.orders)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">AOV</dt><dd className="font-semibold">{formatINR(summary.aov_paise)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Rating</dt><dd className="font-semibold">{summary.avg_rating ?? "—"}</dd></div>
      </dl>
      <div className="mt-3 flex gap-2">
        <a href={downloads.csv} className={buttonVariants({ size: "sm", variant: "outline" })} download><Download /> CSV</a>
        <a href={downloads.pdf} className={buttonVariants({ size: "sm", variant: "outline" })} download><Download /> PDF</a>
      </div>
    </figure>
  );
}

export function AlertsBellIcon({ count }: { count: number }) {
  return (
    <span className="relative inline-flex">
      <Bell className="size-5" />
      {count > 0 && <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] font-semibold text-destructive-foreground">{count}</span>}
    </span>
  );
}
