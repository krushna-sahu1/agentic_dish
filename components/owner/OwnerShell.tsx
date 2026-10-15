"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, ExternalLink, LayoutDashboard, Menu as MenuIcon, ReceiptText, Settings, Sparkles, UtensilsCrossed, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { LogoMark } from "@/components/site/Logo";
import { alertsAction, liveKpisAction, markAlertsReadAction } from "@/app/actions/owner";
import { createClient } from "@/lib/supabase/client";
import { BRAND } from "@/lib/brand";
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

/** Dashboard chrome: sidebar navigation (drawer on mobile), alerts and live new-order notifications. */
export function OwnerShell({ role, name, children }: { role: "owner" | "staff"; name: string | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const seen = useRef<Set<string>>(new Set());
  const bellRef = useRef<HTMLDivElement>(null);

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
          toast.success(`New order ${row.order_number}`, { description: "Waiting to be accepted", action: { label: "Open", onClick: () => (window.location.href = `/owner/orders/${row.id}`) } });
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

  useEffect(() => setNavOpen(false), [pathname]);

  useEffect(() => {
    if (!bellOpen) return;
    const close = (e: MouseEvent) => !bellRef.current?.contains(e.target as Node) && setBellOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setBellOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [bellOpen]);

  const unread = alerts.filter((a) => !a.is_read && a.type !== "internal");
  const nav = [
    { href: "/owner", label: "Overview", icon: LayoutDashboard, exact: true },
    { href: "/owner/orders", label: "Orders", icon: ReceiptText, count: kpis?.new_orders_waiting },
    { href: "/owner/menu", label: "Menu", icon: UtensilsCrossed },
    { href: "/owner/assistant", label: "AI assistant", icon: Sparkles },
    ...(role === "owner"
      ? [
          { href: "/owner/jarvis", label: "Jarvis", icon: AudioLines },
          { href: "/owner/settings", label: "Settings", icon: Settings },
        ]
      : []),
  ];
  const current = nav.find((n) => (n.exact ? pathname === n.href : pathname.startsWith(n.href)));

  const bell = (
    <div className="relative" ref={bellRef}>
      <Button variant="ghost" size="icon" aria-label={`Alerts, ${unread.length} unread`} aria-expanded={bellOpen} onClick={() => setBellOpen((o) => !o)}>
        <AlertsBellIcon count={unread.length} />
      </Button>
      {bellOpen && (
        <div className="absolute right-0 z-50 mt-2 max-h-[70vh] w-[min(92vw,380px)] animate-rise overflow-auto rounded-2xl border bg-popover p-2 shadow-xl">
          <div className="flex items-center justify-between px-2 py-1">
            <p className="text-sm font-semibold">Alerts</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await markAlertsReadAction();
                void refresh();
              }}
            >
              Mark all read
            </Button>
          </div>
          {alerts.filter((a) => a.type !== "internal").length ? (
            <AlertCard alerts={alerts.filter((a) => a.type !== "internal")} />
          ) : (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
          )}
        </div>
      )}
    </div>
  );

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link href="/owner" className="flex items-center gap-2.5 px-3 pb-6 pt-1">
        <LogoMark className="size-8" />
        <span className="min-w-0">
          <span className="block font-display text-2xl leading-none">{BRAND.name}</span>
          <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Dashboard</span>
        </span>
      </Link>
      <nav aria-label="Dashboard" className="grid gap-0.5">
        {nav.map((n) => {
          const active = n === current;
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <n.icon className="size-4" aria-hidden />
              <span className="flex-1">{n.label}</span>
              {!!n.count && (
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums", active ? "bg-primary text-primary-foreground" : "bg-primary/12 text-primary")}>
                  {n.count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-3 pt-6">
        {kpis && (
          <div className="rounded-2xl border bg-background/60 p-3 text-xs" aria-live="polite">
            <p className="flex items-center gap-2 font-medium">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>
              Live
            </p>
            <p className="mt-1 text-muted-foreground">
              {kpis.active_orders} active · {kpis.orders_today} today
            </p>
          </div>
        )}
        <div className="flex items-center gap-2 border-t px-1 pt-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold uppercase">{(name ?? role).slice(0, 1)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{name ?? "Team member"}</span>
            <span className="block text-xs capitalize text-muted-foreground">{role}</span>
          </span>
          <ThemeToggle />
        </div>
        <Link href="/" className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
          View website <ExternalLink className="size-3" aria-hidden />
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r bg-card/50 p-4 lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Dashboard navigation">
          <button className="absolute inset-0 animate-fade bg-black/40" aria-label="Close navigation" onClick={() => setNavOpen(false)} />
          <aside className="relative h-full w-72 max-w-[85vw] animate-rise border-r bg-background p-4 shadow-2xl">
            <Button variant="ghost" size="icon" className="absolute right-3 top-3" aria-label="Close navigation" onClick={() => setNavOpen(false)}>
              <X />
            </Button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur sm:px-6 lg:h-16">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" onClick={() => setNavOpen(true)}>
            <MenuIcon />
          </Button>
          <p className="text-sm font-medium">{current?.label ?? "Dashboard"}</p>
          <div className="ml-auto flex items-center gap-1">{bell}</div>
        </header>
        <main id="main" className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <p className="sr-only">
            Signed in as {name} ({role})
          </p>
          {children}
        </main>
      </div>
    </div>
  );
}
