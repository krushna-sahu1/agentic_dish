import Link from "next/link";
import { ArrowRight, IndianRupee, Inbox, ReceiptText, Sparkles, Star, Timer, UtensilsCrossed } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { DashboardPage, PageHeader, Panel, StatCard } from "@/components/owner/Page";
import { OrdersTable } from "@/components/owner/OrdersTable";
import { RevenueChart } from "@/components/owner/RevenueChart";
import { Change } from "@/components/owner/OwnerCards";
import { requireRole } from "@/lib/auth";
import { getLiveKpis, getRevenue, getTopItems } from "@/lib/agents/owner/analytics";
import { listOrders } from "@/lib/services/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatINR, formatNumber } from "@/lib/format";
import { addDays, zonedDateString } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Overview" };

const settled = <T,>(r: PromiseSettledResult<T>) => (r.status === "fulfilled" ? r.value : null);

function greetingFor(date: Date) {
  const h = Number(date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function OwnerOverviewPage() {
  const user = await requireRole(["owner", "staff"]);
  const isOwner = user.role === "owner";
  const yesterday = addDays(zonedDateString(new Date()), -1);

  const [kpisR, revenueR, topR, recentR, summaryR] = await Promise.allSettled([
    getLiveKpis(),
    isOwner ? getRevenue({ range: { preset: "last_7_days" }, granularity: "day" }) : Promise.resolve(null),
    getTopItems({ range: { preset: "last_7_days" }, limit: 5, order_by: isOwner ? "revenue" : "qty" }),
    listOrders({ limit: 8 }),
    isOwner ? createAdminClient().from("owner_alerts").select("title, data").eq("dedupe_key", `daily-summary-${yesterday}`).maybeSingle() : Promise.resolve(null),
  ]);
  const kpis = settled(kpisR);
  const revenue = settled(revenueR);
  const top = settled(topR);
  const recent = settled(recentR);
  const summary = settled(summaryR)?.data as { title: string; data: { lines?: string[] } } | null | undefined;

  const firstName = user.profile?.full_name?.split(" ")[0];
  const maxTop = Math.max(1, ...(top?.items ?? []).map((i) => (isOwner ? i.revenue_paise : i.qty)));

  return (
    <DashboardPage>
      <PageHeader
        eyebrow={new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" })}
        title={`${greetingFor(new Date())}${firstName ? `, ${firstName}` : ""}.`}
        description="Here’s how the kitchen is doing today."
        actions={
          <>
            <Link href="/owner/orders?view=board" className={buttonVariants({ variant: "outline" })}>
              Live board
            </Link>
            <Link href="/owner/assistant" className={buttonVariants()}>
              <Sparkles /> Ask the assistant
            </Link>
          </>
        }
      />

      {summary && (
        <details className="mb-6 rounded-2xl border bg-card px-5 py-4 text-sm" open>
          <summary className="cursor-pointer font-medium">{summary.title}</summary>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-muted-foreground">
            {(summary.data?.lines ?? []).map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </details>
      )}

      {/* Stat cards */}
      {kpis ? (
        <div className={cn("grid grid-cols-2 gap-3 sm:gap-4", isOwner ? "lg:grid-cols-4" : "lg:grid-cols-3")} data-testid="stat-cards">
          {isOwner && <StatCard label="Revenue today" value={formatINR(kpis.revenue_today_paise)} icon={IndianRupee} hint={kpis.orders_today ? `Avg ${formatINR(Math.round(kpis.revenue_today_paise / kpis.orders_today))} per order` : "No paid orders yet"} />}
          <StatCard label="Orders today" value={formatNumber(kpis.orders_today)} icon={ReceiptText} hint="Paid and in progress" />
          <StatCard
            label="Active orders"
            value={formatNumber(kpis.active_orders)}
            icon={Timer}
            highlight={kpis.new_orders_waiting > 0}
            hint={
              kpis.new_orders_waiting > 0 ? (
                <Link href="/owner/orders?view=board" className="font-medium text-primary hover:underline">
                  {kpis.new_orders_waiting} waiting to be accepted →
                </Link>
              ) : (
                "Nothing waiting"
              )
            }
          />
          <StatCard label="Avg rating" value={kpis.avg_rating_30d ? `${kpis.avg_rating_30d}` : "—"} icon={Star} hint="Last 30 days" />
        </div>
      ) : (
        <ErrorState title="Live numbers are unavailable" description="We couldn’t reach the database just now. The rest of the dashboard may still work — refresh in a moment." className="py-8" />
      )}

      <div className={cn("mt-6 grid gap-6", isOwner && "lg:grid-cols-[1.6fr_1fr]")}>
        {isOwner && (
          <Panel
            title="Revenue, last 7 days"
            description={
              revenue ? (
                <span className="inline-flex items-center gap-2">
                  {formatINR(revenue.totals.revenue_paise)} · {formatNumber(revenue.totals.orders)} orders · <Change value={revenue.previous.change_percent} /> vs previous 7 days
                </span>
              ) : undefined
            }
          >
            <div className="px-3 pb-4">
              {revenue ? (
                revenue.series.some((s) => s.revenue_paise > 0) ? (
                  <RevenueChart
                    data={revenue.series.map((s) => ({
                      label: new Date(`${String(s.bucket).slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" }),
                      revenue_paise: s.revenue_paise,
                      orders: s.orders,
                    }))}
                  />
                ) : (
                  <EmptyState title="No sales yet this week" description="Revenue will appear here as soon as orders are paid." className="mx-2 border-0 py-10" />
                )
              ) : (
                <ErrorState title="Couldn’t load revenue" description="The analytics service didn’t respond. Try refreshing." className="mx-2 py-10" />
              )}
            </div>
          </Panel>
        )}

        <Panel title="Top dishes" description={`Last 7 days · by ${isOwner ? "revenue" : "portions sold"}`} action={<Link href="/owner/menu" className="text-xs font-medium text-primary hover:underline">Menu →</Link>}>
          {top ? (
            top.items.length ? (
              <ol className="space-y-4 px-5 pb-5 pt-1">
                {top.items.map((i, idx) => {
                  const v = isOwner ? i.revenue_paise : i.qty;
                  return (
                    <li key={i.menu_item_id}>
                      <div className="flex items-baseline gap-3 text-sm">
                        <span className="w-4 font-display text-lg text-muted-foreground">{idx + 1}</span>
                        <span className="min-w-0 flex-1 truncate font-medium">{i.name}</span>
                        <span className="tabular-nums text-muted-foreground">{isOwner ? formatINR(i.revenue_paise) : `${formatNumber(i.qty)} sold`}</span>
                      </div>
                      <div className="ml-7 mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                        <div className="h-full rounded-full bg-chart-1" style={{ width: `${Math.max(4, (v / maxTop) * 100)}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <EmptyState icon={UtensilsCrossed} title="No sales yet" description="Your best sellers will show up here." className="mx-5 mb-5 py-8" />
            )
          ) : (
            <ErrorState title="Couldn’t load top dishes" className="mx-5 mb-5 py-8" />
          )}
        </Panel>
      </div>

      <Panel
        className="mt-6 overflow-hidden"
        title="Recent orders"
        description="The latest orders across every status"
        action={
          <Link href="/owner/orders" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            All orders <ArrowRight />
          </Link>
        }
      >
        {recent ? (
          recent.orders.length ? (
            <OrdersTable orders={recent.orders} />
          ) : (
            <EmptyState icon={Inbox} title="No orders yet" description="New orders appear here the moment they’re paid." className="mx-5 mb-5" />
          )
        ) : (
          <ErrorState title="Couldn’t load orders" description="Please refresh the page in a moment." className="mx-5 mb-5" />
        )}
      </Panel>
    </DashboardPage>
  );
}
