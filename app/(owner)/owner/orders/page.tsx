import Link from "next/link";
import { Inbox, SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { OrdersBoard } from "@/components/owner/OrdersBoard";
import { OrdersFilters } from "@/components/owner/OrdersFilters";
import { RANGE_FILTERS, STATUS_FILTERS } from "@/components/owner/order-filters";
import { OrdersTable } from "@/components/owner/OrdersTable";
import { DashboardPage, PageHeader, Panel } from "@/components/owner/Page";
import { requireRole } from "@/lib/auth";
import { listOrders } from "@/lib/services/owner";
import type { OrderStatus } from "@/lib/types";
import type { RangePreset } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Orders" };

type Search = Promise<{ view?: string; status?: string; range?: string; q?: string }>;

export default async function OrdersPage({ searchParams }: { searchParams: Search }) {
  await requireRole(["owner", "staff"]);
  const sp = await searchParams;
  const view = sp.view === "board" ? "board" : "table";

  const tabs = (
    <div className="inline-flex rounded-full bg-muted p-1 text-sm" role="tablist" aria-label="Orders view">
      {[
        ["table", "All orders", "/owner/orders"],
        ["board", "Live board", "/owner/orders?view=board"],
      ].map(([key, label, href]) => (
        <Link
          key={key}
          href={href}
          role="tab"
          aria-selected={view === key}
          className={cn("rounded-full px-4 py-1.5 transition-colors", view === key ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          {label}
        </Link>
      ))}
    </div>
  );

  if (view === "board") {
    let initial;
    try {
      const [active, recent] = await Promise.all([
        listOrders({ active_only: true, limit: 100 }),
        listOrders({ status: ["completed", "cancelled"], range: { preset: "today" }, limit: 20 }),
      ]);
      initial = { active: active.orders, recent: recent.orders };
    } catch {
      initial = null;
    }
    return (
      <DashboardPage className="flex min-h-0 flex-1 flex-col lg:max-w-none">
        <PageHeader title="Orders" description="Live kitchen board — updates in real time." actions={tabs} />
        {initial ? <OrdersBoard initial={initial} /> : <ErrorState title="The live board couldn’t load" description="Check your connection and refresh the page." />}
      </DashboardPage>
    );
  }

  const statusParam = STATUS_FILTERS.some((s) => s.value === sp.status) ? sp.status : "";
  const range = (RANGE_FILTERS.some((r) => r.value === sp.range) ? sp.range : "last_7_days") as RangePreset;
  const q = (sp.q ?? "").trim().toLowerCase();

  let orders: Awaited<ReturnType<typeof listOrders>>["orders"] | undefined;
  let failed = false;
  try {
    const r = await listOrders({
      status: statusParam && statusParam !== "active" ? (statusParam as OrderStatus) : undefined,
      active_only: statusParam === "active",
      range: { preset: range },
      limit: 200,
    });
    orders = r.orders.filter((o) => !q || o.order_number.toLowerCase().includes(q) || (o.customer_name ?? "").toLowerCase().includes(q));
  } catch {
    failed = true;
  }

  return (
    <DashboardPage>
      <PageHeader title="Orders" description="Search, filter and open any order." actions={tabs} />
      <Panel
        className="overflow-hidden"
        title={orders ? `${orders.length} order${orders.length === 1 ? "" : "s"}` : "Orders"}
        description={RANGE_FILTERS.find((r) => r.value === range)?.label}
      >
        <OrdersFilters />
        {failed ? (
          <ErrorState title="We couldn’t load orders" description="The database didn’t respond. Refresh the page to try again." className="mx-5 mb-5" />
        ) : orders?.length ? (
          <OrdersTable orders={orders} />
        ) : statusParam || q ? (
          <EmptyState icon={SearchX} title="No matching orders" description="Try a different status, a wider date range, or clear the search." className="mx-5 mb-5">
            <Link href="/owner/orders" className={buttonVariants({ variant: "outline" })}>
              Clear filters
            </Link>
          </EmptyState>
        ) : (
          <EmptyState icon={Inbox} title="No orders in this period" description="Orders show up here as soon as customers pay." className="mx-5 mb-5" />
        )}
      </Panel>
    </DashboardPage>
  );
}
