"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChefHat, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { alertsAction, liveKpisAction, markAlertsReadAction } from "@/app/actions/owner";
import { createClient } from "@/lib/supabase/client";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AlertCard, AlertsBellIcon } from "./OwnerCards";

type Kpis = { revenue_today_paise: number; orders_today: number; active_orders: number; new_orders_waiting: number; avg_rating_30d: number | null };
type Alert = { id: string; title: string; body: string | null; severity: string; created_at: string; is_read: boolean; type: string };

/** Short two-tone chime (Web Audio — no asset needed). */
function chime() {
  try {
    const ctx = new AudioContext();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.3);
    });
  } catch {
    /* audio blocked until user interaction */
  }
}

export function OwnerShell({ role, name, children }: { role: "owner" | "staff"; name: string | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const seen = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    const [k, a] = await Promise.all([liveKpisAction(), alertsAction()]);
    if (k.ok) setKpis(k.data as Kpis);
    if (a.ok) setAlerts(a.data as Alert[]);
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, 60_000);
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return () => clearInterval(t);
    const supabase = createClient();
    const ch = supabase
      .channel("owner-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (p) => {
        const row = p.new as { id: string; status: string; order_number: string };
        if (row?.status === "paid" && !seen.current.has(row.id)) {
          seen.current.add(row.id);
          chime();
          toast.success(`New order ${row.order_number}`, { description: "Waiting to be accepted", action: { label: "Open board", onClick: () => (window.location.href = "/owner/orders") } });
        }
        void refresh();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "owner_alerts" }, () => void refresh())
      .subscribe();
    return () => {
      clearInterval(t);
      void supabase.removeChannel(ch);
    };
  }, [refresh]);

  const unread = alerts.filter((a) => !a.is_read && a.type !== "internal");
  const nav = [
    { href: "/owner", label: "Assistant" },
    { href: "/owner/orders", label: "Live orders" },
    { href: "/owner/menu", label: "Menu & stock" },
    ...(role === "owner" ? [{ href: "/owner/settings", label: "Settings" }] : []),
  ];

  return (
    <div className="flex h-dvh flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2">
          <Link href="/owner" className="flex items-center gap-2 font-display font-semibold">
            <ChefHat className="size-5 text-primary" /> <span className="hidden sm:inline">Kitchen HQ</span>
          </Link>
          <nav aria-label="Owner" className="flex gap-1 overflow-x-auto">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-sm", pathname === n.href ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent")}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <div className="relative">
              <Button variant="ghost" size="icon" aria-label={`Alerts, ${unread.length} unread`} aria-expanded={bellOpen} onClick={() => setBellOpen((o) => !o)}>
                <AlertsBellIcon count={unread.length} />
              </Button>
              {bellOpen && (
                <div className="absolute right-0 z-50 mt-2 max-h-[70vh] w-[min(92vw,380px)] overflow-auto rounded-xl border bg-popover p-2 shadow-xl">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-sm font-semibold">Alerts</p>
                    <Button variant="ghost" size="sm" onClick={async () => { await markAlertsReadAction(); void refresh(); }}>Mark all read</Button>
                  </div>
                  <AlertCard alerts={alerts.filter((a) => a.type !== "internal")} />
                </div>
              )}
            </div>
            <ThemeToggle />
            <Link href="/" className="hidden items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent sm:flex">
              Site <ExternalLink className="size-3.5" />
            </Link>
          </div>
        </div>
        <div className="border-t bg-muted/40">
          <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-x-4 px-4 py-1.5 text-xs sm:grid-cols-4" data-testid="kpi-strip" aria-live="polite">
            {role === "owner" && <Kpi label="Revenue today" value={kpis ? formatINR(kpis.revenue_today_paise) : "…"} />}
            <Kpi label="Orders today" value={kpis ? String(kpis.orders_today) : "…"} />
            <Kpi label="Active orders" value={kpis ? `${kpis.active_orders}${kpis.new_orders_waiting ? ` (${kpis.new_orders_waiting} new)` : ""}` : "…"} highlight={!!kpis?.new_orders_waiting} />
            <Kpi label="Avg rating (30d)" value={kpis?.avg_rating_30d ? `${kpis.avg_rating_30d} ★` : "…"} />
          </dl>
        </div>
      </header>
      <main id="main" className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-4 py-3">
        <p className="sr-only">Signed in as {name} ({role})</p>
        {children}
      </main>
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("font-semibold tabular-nums", highlight && "text-primary")}>{value}</dd>
    </div>
  );
}
