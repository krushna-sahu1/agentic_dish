"use client";

import "@copilotkit/react-core/v2/styles.css";
import { useMemo, useState } from "react";
import { RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { CopilotChat, CopilotKitProvider, useAgentContext, useConfigureSuggestions, type ReactHumanInTheLoop, type ReactToolCallRenderer } from "@copilotkit/react-core/v2";
import { Button } from "@/components/ui/button";
import { ChatActionsProvider } from "@/components/chat/chat-actions";
import { ConfirmCard } from "@/components/chat/ConfirmCard";
import { ErrorNote, parseResult, ToolProgress } from "@/components/chat/shared";
import { useChatPersistence } from "@/components/chat/useChatPersistence";
import { OWNER_CHANGE_SCHEMAS, type OwnerChangeSchemaName } from "@/lib/agents/owner/change-schemas";
import { executeOwnerChange, previewOwnerChange, rejectOwnerChange, uploadDishImageAction } from "@/app/actions/owner";
import { newConversationAction } from "@/app/actions/chat";
import { formatINR, formatNumber } from "@/lib/format";
import { AlertCard, BarChartCard, ChartFrame, ComparisonCard, DataTable, HeatmapCard, KpiCards, LineChartCard, OrderCard, OrderListCard, PieChartCard, ReportCard, type Column } from "./OwnerCards";

/* eslint-disable @typescript-eslint/no-explicit-any */
type RenderProps = { name: string; args: Record<string, any>; status: string; result?: string };

function card(name: string, body: (d: any, args: Record<string, any>) => React.ReactNode): ReactToolCallRenderer<any> {
  function Render(p: RenderProps) {
    if (p.status !== "complete") return <ToolProgress name={name} />;
    const r = parseResult<any>(p.result);
    if (!r) return null;
    if (!r.ok) return <ErrorNote message={r.error} />;
    return <>{body(r.data, p.args ?? {})}</>;
  }
  Render.displayName = `Owner_${name}`;
  return { name, args: z.any(), render: Render as never };
}

const bucketLabel = (iso: string, g: string) => {
  const d = new Date(String(iso).replace(" ", "T").slice(0, 19) + "Z");
  if (g === "hour") return `${String(d.getUTCHours()).padStart(2, "0")}:00`;
  if (g === "month") return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
};
const itemCols: Column[] = [{ key: "name", label: "Dish" }, { key: "category", label: "Category" }, { key: "qty", label: "Qty", fmt: "num" }, { key: "revenue_paise", label: "Revenue", fmt: "inr" }, { key: "orders", label: "Orders", fmt: "num" }];
const autoCols = (rows: Record<string, unknown>[]): Column[] =>
  Object.keys(rows[0] ?? {})
    .filter((k) => !/(^id$|_id$|^user_id$|params$)/.test(k) && typeof rows[0][k] !== "object")
    .slice(0, 8)
    .map((k) => ({ key: k, label: k.replace(/_paise$/, "").replace(/_/g, " "), fmt: k.endsWith("_paise") ? "inr" : typeof rows[0][k] === "number" ? "num" : "text" }));

function buildRenderers(): ReactToolCallRenderer<any>[] {
  return [
    card("get_revenue", (d) => (
      <>
        <KpiCards
          title={d.range.label}
          items={[
            { label: "Revenue", value: formatINR(d.totals.revenue_paise), change: d.previous.change_percent, sub: `vs ${d.previous.range_label.replace(" (IST)", "")}` },
            { label: "Orders", value: formatNumber(d.totals.orders) },
            { label: "Avg order", value: formatINR(d.totals.aov_paise) },
            { label: "Best " + (d.granularity === "hour" ? "hour" : "day"), value: d.best_bucket ? bucketLabel(d.best_bucket.bucket, d.granularity) : "—", sub: d.best_bucket ? formatINR(d.best_bucket.revenue_paise) : undefined },
          ]}
        />
        <LineChartCard
          title={`Revenue by ${d.granularity}`}
          subtitle={d.range.label}
          data={d.series}
          xLabel={(r) => bucketLabel(String(r.bucket), d.granularity)}
          yKey="revenue_paise"
          columns={[{ key: "__x", label: d.granularity }, { key: "revenue_paise", label: "Revenue", fmt: "inr" }, { key: "orders", label: "Orders", fmt: "num" }, { key: "aov_paise", label: "AOV", fmt: "inr" }]}
        />
      </>
    )),
    card("get_top_items", (d) => (
      <BarChartCard title={`Top dishes by ${d.order_by === "qty" ? "quantity" : "revenue"}`} subtitle={d.range.label} data={d.items} labelKey="name" valueKey={d.order_by === "qty" ? "qty" : "revenue_paise"} valueFmt={d.order_by === "qty" ? "num" : "inr"} columns={itemCols} insight={d.items[0] ? `${d.items[0].name} leads with ${d.order_by === "qty" ? `${d.items[0].qty} sold` : formatINR(d.items[0].revenue_paise)}.` : undefined} />
    )),
    card("get_bottom_items", (d) => <BarChartCard title="Slowest-selling dishes" subtitle={d.range.label} data={d.items} labelKey="name" valueKey="qty" valueFmt="num" columns={itemCols} color="var(--chart-2)" />),
    card("get_category_breakdown", (d) => <PieChartCard title="Revenue by category" subtitle={d.range.label} data={d.categories} labelKey="category" valueKey="revenue_paise" columns={[{ key: "category", label: "Category" }, { key: "qty", label: "Qty", fmt: "num" }, { key: "revenue_paise", label: "Revenue", fmt: "inr" }, { key: "share", label: "Share %", fmt: "num" }]} />),
    card("get_peak_hours", (d) => (
      <HeatmapCard title="When you're busiest" subtitle={d.range.label} cells={d.cells} insight={d.busiest_slot ? `Peak: ${d.busiest_slot.day} ${d.busiest_slot.hour}:00 · busiest day ${d.busiest_day?.day} · busiest hour ${d.busiest_hour?.hour}:00.` : undefined} />
    )),
    card("get_order_type_split", (d) => <PieChartCard title="Delivery vs pickup vs dine-in" subtitle={d.range.label} data={d.split} labelKey="order_type" valueKey="revenue_paise" columns={[{ key: "order_type", label: "Type" }, { key: "orders", label: "Orders", fmt: "num" }, { key: "revenue_paise", label: "Revenue", fmt: "inr" }]} />),
    card("get_payment_methods", (d) => <PieChartCard title="Payment methods" subtitle={d.range.label} data={d.methods} labelKey="method" valueKey="amount_paise" columns={[{ key: "method", label: "Method" }, { key: "payments", label: "Payments", fmt: "num" }, { key: "amount_paise", label: "Amount", fmt: "inr" }]} />),
    card("get_customer_stats", (d) => (
      <>
        <KpiCards title={d.range.label} items={[{ label: "Customers", value: formatNumber(d.total_customers) }, { label: "New", value: formatNumber(d.new_customers) }, { label: "Returning", value: formatNumber(d.returning_customers) }, { label: "Repeat rate", value: `${d.repeat_rate_percent}%` }]} />
        <ChartFrame title="Top customers (contact masked)" columns={[{ key: "name", label: "Name" }, { key: "phone", label: "Phone" }, { key: "orders", label: "Orders", fmt: "num" }, { key: "revenue_paise", label: "Spent", fmt: "inr" }]} rows={d.top_customers} />
      </>
    )),
    card("get_coupon_performance", (d) => <ChartFrame title="Coupon performance" subtitle={d.range.label} columns={[{ key: "code", label: "Code" }, { key: "orders", label: "Orders", fmt: "num" }, { key: "discount_paise", label: "Discount given", fmt: "inr" }, { key: "revenue_paise", label: "Revenue", fmt: "inr" }, { key: "avg_order_paise", label: "Avg order", fmt: "inr" }]} rows={d.coupons} />),
    card("compare_periods", (d) => <ComparisonCard a={d.a.label} b={d.b.label} metrics={d.metrics} />),
    card("get_ratings_summary", (d) => (
      <>
        <KpiCards title={d.range.label} items={[{ label: "Avg rating", value: d.overall.avg_rating ? `${d.overall.avg_rating} ★` : "—" }, { label: "Reviews", value: formatNumber(d.overall.reviews) }, { label: "Positive", value: formatNumber(d.overall.positive) }, { label: "Negative", value: formatNumber(d.overall.negative) }]} />
        <ChartFrame title="Ratings by dish" columns={[{ key: "name", label: "Dish" }, { key: "avg_rating", label: "Avg", fmt: "num" }, { key: "reviews", label: "Reviews", fmt: "num" }, { key: "negative", label: "Negative", fmt: "num" }]} rows={d.items} />
      </>
    )),
    card("get_cancellations", (d) => <PieChartCard title={`Cancellations & refunds (${d.total})`} subtitle={`${d.range.label} · ${formatINR(d.lost_paise)} lost`} data={d.reasons} labelKey="reason" valueKey="orders" valueFmt="num" columns={[{ key: "reason", label: "Reason" }, { key: "orders", label: "Orders", fmt: "num" }, { key: "value_paise", label: "Value", fmt: "inr" }]} />),
    card("get_live_kpis", (d) => <KpiCards title={`Today so far · ${d.date_label}`} items={[{ label: "Revenue today", value: formatINR(d.revenue_today_paise) }, { label: "Orders today", value: formatNumber(d.orders_today) }, { label: "Active orders", value: formatNumber(d.active_orders), sub: `${d.new_orders_waiting} waiting to be accepted` }, { label: "Avg rating (30d)", value: d.avg_rating_30d ? `${d.avg_rating_30d} ★` : "—" }]} />),
    card("forecast_demand", (d) => <ChartFrame title="Demand forecast" subtitle={`${d.method} · ${d.days.join(", ")}`} columns={[{ key: "name", label: "Dish" }, ...d.days.map((day: string, i: number) => ({ key: `d${i}`, label: day.slice(5), fmt: "num" as const })), { key: "total", label: "Total", fmt: "num" }]} rows={d.items.map((it: any) => ({ ...it, ...Object.fromEntries(it.per_day.map((v: number, i: number) => [`d${i}`, v])) }))} />),
    card("get_feedback_summary", (d) => <p className="my-1 text-xs text-muted-foreground">Read {d.counts.total} reviews ({d.counts.negative} negative, {d.counts.neutral} neutral, {d.counts.positive} positive) · {d.range.label}</p>),
    card("list_orders", (d) => <OrderListCard title={`${d.count} order${d.count === 1 ? "" : "s"}${d.range_label ? ` · ${d.range_label}` : ""}`} orders={d.orders} />),
    card("get_order", (d) => <div className="my-2 w-full"><OrderCard o={{ ...d, items: d.items.map((i: any) => `${i.qty}× ${i.name_snapshot}`).join(", "), customer: d.customer_name }} /></div>),
    card("find_menu_items", (d) => <ChartFrame title="Menu items" columns={[{ key: "name", label: "Dish" }, { key: "category", label: "Category" }, { key: "price_paise", label: "Price", fmt: "inr" }, { key: "is_available", label: "Available" }, { key: "stock_qty", label: "Stock" }, { key: "sold_30d", label: "Sold 30d", fmt: "num" }]} rows={d.items} />),
    card("list_inventory", (d) => <ChartFrame title="Inventory" columns={[{ key: "name", label: "Ingredient" }, { key: "qty", label: "Qty", fmt: "num" }, { key: "unit", label: "Unit" }, { key: "low_threshold", label: "Low at", fmt: "num" }, { key: "is_low", label: "Low?" }]} rows={d.items} />),
    card("get_low_stock", (d) => (
      <ChartFrame
        title="Low stock"
        columns={[{ key: "name", label: "Item" }, { key: "kind", label: "Type" }, { key: "level", label: "Level" }]}
        rows={[
          ...d.inventory.map((i: any) => ({ name: i.name, kind: "Ingredient", level: `${i.qty} ${i.unit} (low at ${i.low_threshold})` })),
          ...d.menu_items.map((i: any) => ({ name: i.name, kind: "Dish portions", level: `${i.stock_qty} left` })),
          ...d.unavailable_items.map((i: any) => ({ name: i.name, kind: "Dish", level: "Sold out" })),
        ]}
      />
    )),
    card("list_coupons", (d) => <ChartFrame title="Coupons" columns={[{ key: "code", label: "Code" }, { key: "description", label: "Offer" }, { key: "state", label: "State" }, { key: "redemptions", label: "Used", fmt: "num" }]} rows={d.coupons} />),
    card("list_reservations", (d) => <ChartFrame title="Reservations" columns={[{ key: "reserved_for", label: "When" }, { key: "guest_name", label: "Guest" }, { key: "party_size", label: "Party", fmt: "num" }, { key: "table_number", label: "Table" }, { key: "status", label: "Status" }, { key: "phone", label: "Phone" }]} rows={d.reservations.map((r: any) => ({ ...r, reserved_for: new Date(r.reserved_for).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) }))} />),
    card("list_reviews", (d) => <ChartFrame title="Reviews" columns={[{ key: "rating", label: "★", fmt: "num" }, { key: "item", label: "Dish" }, { key: "comment", label: "Comment" }, { key: "owner_reply", label: "Reply" }]} rows={d.reviews} />),
    card("get_settings", (d) => <div className="my-2 w-full"><DataTable columns={[{ key: "k", label: "Setting" }, { key: "v", label: "Value" }]} rows={Object.entries(d ?? {}).filter(([k]) => !["id", "singleton", "created_at", "updated_at"].includes(k)).map(([k, v]) => ({ k: k.replace(/_/g, " "), v: k.endsWith("_paise") ? formatINR(v as number) : typeof v === "object" ? JSON.stringify(v) : String(v) }))} /></div>),
    card("get_customer", (d) => <ChartFrame title="Customer" columns={[{ key: "name", label: "Name" }, { key: "phone", label: "Phone" }, { key: "email", label: "Email" }, { key: "orders", label: "Orders", fmt: "num" }, { key: "lifetime_value_paise", label: "LTV", fmt: "inr" }]} rows={d.customers} />),
    card("get_audit_log", (d) => <ChartFrame title="Changes made" subtitle={d.range.label} columns={[{ key: "created_at", label: "When" }, { key: "actor", label: "By" }, { key: "tool_name", label: "Change" }, { key: "result_summary", label: "Result" }, { key: "status", label: "Status" }]} rows={d.entries.map((e: any) => ({ ...e, created_at: new Date(e.created_at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" }) }))} />),
    card("list_alerts", (d) => <AlertCard alerts={d.alerts} />),
    card("generate_report", (d) => <ReportCard label={d.range.label} summary={d.summary} downloads={d.downloads} />),
    { name: "*", args: z.any(), render: ((p: RenderProps) => (p.status !== "complete" ? <ToolProgress name={p.name} /> : (() => { const r = parseResult<any>(p.result); if (r && !r.ok) return <ErrorNote message={r.error} />; const rows = Array.isArray(r?.data) ? r.data : null; return rows?.length ? <div className="my-2 w-full"><DataTable columns={autoCols(rows)} rows={rows} /></div> : <ToolProgress name={p.name} done />; })())) as never },
  ];
}

function buildHitl(allowed: Set<string>): ReactHumanInTheLoop[] {
  return (Object.keys(OWNER_CHANGE_SCHEMAS) as OwnerChangeSchemaName[])
    .filter((n) => allowed.has(n))
    .map((name) => {
      const def = OWNER_CHANGE_SCHEMAS[name];
      function Render(p: { args: Record<string, unknown>; status: string; result?: string; respond?: (r: unknown) => Promise<void> }) {
        return (
          <ConfirmCard
            args={p.args ?? {}}
            status={p.status as "inProgress" | "executing" | "complete"}
            result={p.result}
            respond={p.respond}
            preview={(a) => previewOwnerChange(name, a)}
            execute={(a) => executeOwnerChange(name, a)}
            reject={(a) => rejectOwnerChange(name, a)}
            upload={uploadDishImageAction}
            confirmLabel={name === "issue_refund" ? "Issue refund" : name === "reply_to_review" ? "Post reply" : "Confirm"}
          />
        );
      }
      Render.displayName = `OwnerConfirm_${name}`;
      return { name, description: `${def.description} Shows a Confirm card with a before → after diff; only applied if the human clicks Confirm.`, parameters: def.schema as never, render: Render as never } as ReactHumanInTheLoop;
    });
}

const OWNER_SUGGESTIONS = [
  { title: "How did we do today?", message: "How did we do today?" },
  { title: "Best dish this week", message: "Which dish is performing best this week?" },
  { title: "This week vs last week", message: "Compare this week vs last week" },
  { title: "Peak hours", message: "When are we busiest?" },
  { title: "What's low in stock?", message: "What's low in stock?" },
  { title: "Show live orders", message: "Show live orders" },
];
const STAFF_SUGGESTIONS = [OWNER_SUGGESTIONS[0], OWNER_SUGGESTIONS[4], OWNER_SUGGESTIONS[5], { title: "Today's reservations", message: "Show today's reservations" }];

function Bindings({ role }: { role: "owner" | "staff" }) {
  useConfigureSuggestions({ suggestions: role === "owner" ? OWNER_SUGGESTIONS : STAFF_SUGGESTIONS, available: "always" });
  useAgentContext({ description: "Signed-in role", value: role });
  useAgentContext({ description: "Current IST time", value: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) });
  useChatPersistence("owner", true);
  return null;
}

export function OwnerChat({ role, allowedChanges, greeting }: { role: "owner" | "staff"; allowedChanges: string[]; greeting: { title: string; lines: string[] } | null }) {
  const [resetKey, setResetKey] = useState(0);
  const renderers = useMemo(() => buildRenderers(), []);
  const hitl = useMemo(() => buildHitl(new Set(allowedChanges)), [allowedChanges]);
  return (
    <CopilotKitProvider
      key={resetKey}
      runtimeUrl="/api/copilot/owner"
      renderToolCalls={renderers}
      humanInTheLoop={hitl}
      enableInspector={false}
      showIntelligenceIndicator={false}
      onError={({ error }) => {
        console.error("[owner assistant]", error);
        toast.error("The assistant is unavailable right now — the orders board and menu pages still work.", { id: "owner-assistant-error" });
      }}
    >
      <ChatActionsProvider>
        <Bindings role={role} />
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex flex-wrap items-end justify-between gap-3 pb-4">
            <div>
              <h1 className="font-display text-4xl leading-none sm:text-5xl">AI assistant</h1>
              <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><Sparkles className="size-4 text-primary" /> Ask anything about sales, dishes, orders or settings.</p>
            </div>
            <Button variant="outline" size="sm" onClick={async () => { await newConversationAction("owner"); setResetKey((k) => k + 1); }}>
              <RotateCcw /> New chat
            </Button>
          </div>
          {greeting && (
            <details className="mb-3 rounded-2xl border bg-card px-4 py-3 text-sm" open>
              <summary className="cursor-pointer font-medium">{greeting.title}</summary>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">{greeting.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
            </details>
          )}
          <div className="min-h-[420px] flex-1 overflow-hidden rounded-3xl border bg-card">
            <CopilotChat
              className="h-full"
              labels={{
                chatInputPlaceholder: role === "owner" ? "e.g. which dish is performing best this week?" : "e.g. accept order 42 and say 20 minutes",
                welcomeMessageText: "Hi! I'm your restaurant assistant. Every change I suggest needs your Confirm click.",
                chatDisclaimerText: "Numbers come from your database. Changes apply only after you confirm.",
              }}
            />
          </div>
        </div>
      </ChatActionsProvider>
    </CopilotKitProvider>
  );
}

