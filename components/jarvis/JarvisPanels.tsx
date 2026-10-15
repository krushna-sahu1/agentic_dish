"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent } from "framer-motion";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Check, Loader2, X } from "lucide-react";
import { formatINR, STATUS_LABEL } from "@/lib/format";
import { stripUserText, type PanelSpec } from "@/lib/jarvis/panels";
import { cn } from "@/lib/utils";
import type { Panel } from "./useJarvis";

const glass = "relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-white shadow-[0_8px_40px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl";

function CountUp({ to, money = true, className }: { to: number; money?: boolean; className?: string }) {
  const mv = useMotionValue(0);
  const [v, setV] = useState(0);
  useMotionValueEvent(mv, "change", (x) => setV(x));
  useEffect(() => {
    const c = animate(mv, to, { duration: 1.4, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
  }, [mv, to]);
  return <span className={cn("tabular-nums", className)}>{money ? formatINR(Math.round(v / 100) * 100) : Math.round(v).toLocaleString("en-IN")}</span>;
}

function Change({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-white/40">—</span>;
  const up = pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums", up ? "text-emerald-300" : "text-rose-300")}>
      <Icon className="size-3.5" aria-hidden />
      {Math.abs(Math.round(pct))}%
    </span>
  );
}

function Header({ title, period, onDismiss }: { title: string; period?: string; onDismiss?: () => void }) {
  return (
    <div className="mb-3 flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/50">{title}</p>
        {period && <p className="truncate text-xs text-white/35">{period}</p>}
      </div>
      {onDismiss && (
        <button onClick={onDismiss} aria-label={`Dismiss ${title}`} className="-m-1 rounded-full p-1 text-white/40 transition hover:bg-white/10 hover:text-white">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 260;
  const h = 56;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 4 - (v / max) * (h - 8)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-3 h-14 w-full overflow-visible" role="img" aria-label="Revenue trend">
      <defs>
        <linearGradient id="jv-spark" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="rgb(251 146 60)" stopOpacity="0.35" />
          <stop offset="1" stopColor="rgb(251 146 60)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path d={`${d} L${w},${h} L0,${h} Z`} fill="url(#jv-spark)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.8 }} />
      <motion.path d={d} fill="none" stroke="rgb(251 146 60)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: "easeOut" }} />
    </svg>
  );
}

function DataPanel({ spec, onDismiss }: { spec: PanelSpec; onDismiss: () => void }) {
  switch (spec.kind) {
    case "kpis":
      return (
        <div className={glass}>
          <Header title={spec.title} period={spec.period} onDismiss={onDismiss} />
          <CountUp to={spec.revenue_paise} className="text-3xl font-semibold" />
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              ["Orders", spec.orders],
              ["Active", spec.active_orders],
              ["Waiting", spec.waiting],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-white/5 px-2 py-2">
                <CountUp to={Number(v)} money={false} className="block text-lg font-semibold" />
                <span className="text-[10px] uppercase tracking-wider text-white/45">{k}</span>
              </div>
            ))}
          </div>
          {spec.avg_rating != null && <p className="mt-2 text-xs text-white/45">Rating (30 days): {spec.avg_rating.toFixed(1)}★</p>}
        </div>
      );
    case "revenue":
      return (
        <div className={glass}>
          <Header title={spec.title} period={spec.period} onDismiss={onDismiss} />
          <div className="flex items-end gap-3">
            <CountUp to={spec.revenue_paise} className="text-3xl font-semibold" />
            <Change pct={spec.change_percent} />
          </div>
          <p className="mt-1 text-xs text-white/45">
            {spec.orders} orders{spec.previous_label ? ` · vs ${spec.previous_label}` : ""}
          </p>
          <Sparkline values={spec.series.map((x) => x.value)} />
        </div>
      );
    case "bars": {
      const max = Math.max(...spec.bars.map((b) => b.value), 1);
      return (
        <div className={glass}>
          <Header title={spec.title} period={spec.period} onDismiss={onDismiss} />
          {spec.bars.length === 0 ? (
            <p className="text-sm text-white/50">No sales in this period.</p>
          ) : (
            <ul className="space-y-2">
              {spec.bars.map((b, i) => (
                <li key={b.label}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate text-white/85">{b.label}</span>
                    <span className="shrink-0 tabular-nums text-white/55">
                      {spec.unit === "paise" ? formatINR(b.value) : `${b.value} sold`}
                      {b.sub ? ` · ${b.sub}` : ""}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                    <motion.div
                      className={cn("h-full rounded-full", i === 0 ? "bg-gradient-to-r from-orange-400 to-amber-300" : "bg-gradient-to-r from-sky-400/80 to-violet-400/80")}
                      initial={{ width: 0 }}
                      animate={{ width: `${(b.value / max) * 100}%` }}
                      transition={{ duration: 0.9, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }
    case "heatmap": {
      const days = [1, 2, 3, 4, 5, 6, 0];
      const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const active = spec.cells.filter((c) => c.orders > 0);
      const minH = active.length ? Math.min(...active.map((c) => c.hour)) : 8;
      const maxH = active.length ? Math.max(...active.map((c) => c.hour)) : 22;
      const hours = Array.from({ length: maxH - minH + 1 }, (_, i) => minH + i);
      const max = Math.max(...spec.cells.map((c) => c.orders), 1);
      const at = (d: number, h: number) => spec.cells.find((c) => c.weekday === d && c.hour === h)?.orders ?? 0;
      return (
        <div className={glass}>
          <Header title={spec.title} period={spec.period} onDismiss={onDismiss} />
          {spec.headline && <p className="-mt-1 mb-3 text-sm font-medium text-orange-200">{spec.headline}</p>}
          <div className="grid gap-[3px]" style={{ gridTemplateColumns: `2rem repeat(${hours.length}, minmax(0, 1fr))` }} role="img" aria-label={spec.headline ?? "Orders by day and hour"}>
            {days.map((d, row) => (
              <div key={d} className="contents">
                <span className="pr-1 text-right text-[10px] leading-4 text-white/45">{names[d]}</span>
                {hours.map((h, col) => {
                  const v = at(d, h);
                  return (
                    <motion.span
                      key={h}
                      title={`${names[d]} ${h}:00 — ${v} orders`}
                      className="h-4 rounded-[3px]"
                      style={{ background: v ? `rgba(251, 146, 60, ${0.12 + (v / max) * 0.88})` : "rgba(255,255,255,0.05)" }}
                      initial={{ opacity: 0, scale: 0.4 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: (row + col) * 0.015 }}
                    />
                  );
                })}
              </div>
            ))}
            <span />
            {hours.map((h) => (
              <span key={h} className="text-center text-[9px] text-white/35">
                {h % 3 === 0 ? `${h % 12 || 12}${h < 12 ? "a" : "p"}` : ""}
              </span>
            ))}
          </div>
        </div>
      );
    }
    case "orders":
      return (
        <div className={glass}>
          <Header title={spec.title} period={spec.period} onDismiss={onDismiss} />
          {spec.orders.length === 0 ? (
            <p className="text-sm text-white/50">No orders here.</p>
          ) : (
            <ul className="space-y-2">
              {spec.orders.map((o, i) => (
                <motion.li key={o.order_number} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }} className="rounded-xl border border-white/8 bg-white/[0.04] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold">{o.order_number.replace(/^ORD-\d{8}-/, "#")}</span>
                    <span className="rounded-full bg-orange-400/15 px-2 py-0.5 text-[10px] font-medium text-orange-200">{STATUS_LABEL[o.status] ?? o.status}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-white/60">{o.items}</p>
                  <div className="mt-1.5 flex justify-between text-[11px] text-white/45">
                    <span>
                      {o.customer ?? "Guest"}
                      {o.order_type ? ` · ${o.order_type.replace(/_/g, " ")}` : ""}
                    </span>
                    <span className="tabular-nums text-white/75">
                      {formatINR(o.total_paise)}
                      {o.minutes_in_status != null ? ` · ${o.minutes_in_status}m` : ""}
                    </span>
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      );
    case "compare":
      return (
        <div className={glass}>
          <Header title={spec.title} onDismiss={onDismiss} />
          <div className="mb-2 grid grid-cols-[1fr_auto_auto_auto] gap-x-3 text-[10px] uppercase tracking-wider text-white/40">
            <span />
            <span className="max-w-[7rem] truncate text-right" title={spec.b_label}>
              Before
            </span>
            <span className="max-w-[7rem] truncate text-right" title={spec.a_label}>
              Now
            </span>
            <span className="w-12 text-right">Δ</span>
          </div>
          <ul className="space-y-1.5">
            {spec.metrics.map((m, i) => (
              <motion.li key={m.metric} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="grid grid-cols-[1fr_auto_auto_auto] items-baseline gap-x-3 text-sm">
                <span className="text-white/70">{m.label}</span>
                <span className="text-right tabular-nums text-white/45">{fmtMetric(m.b, m.money)}</span>
                <span className="text-right font-semibold tabular-nums">{fmtMetric(m.a, m.money)}</span>
                <span className="w-12 text-right">
                  <Change pct={m.change_percent} />
                </span>
              </motion.li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-white/35">
            {spec.a_label} vs {spec.b_label}
          </p>
        </div>
      );
    case "list":
      return (
        <div className={glass}>
          <Header title={spec.title} period={spec.period} onDismiss={onDismiss} />
          <ul className="divide-y divide-white/5 text-sm">
            {spec.rows.map((r, i) => (
              <li key={`${r.label}-${i}`} className="flex justify-between gap-3 py-1.5">
                <span className="truncate text-white/75">{r.label}</span>
                <span className="shrink-0 tabular-nums text-white/50">{r.value}</span>
              </li>
            ))}
          </ul>
        </div>
      );
  }
}

function fmtMetric(v: number | null, money: boolean) {
  if (v == null) return "—";
  if (money) return formatINR(v);
  return Number.isInteger(v) ? v.toLocaleString("en-IN") : v.toFixed(1);
}

function ConfirmPanel({ panel, onConfirm, onCancel, onDismiss }: { panel: Extract<Panel, { type: "confirm" }>; onConfirm: () => void; onCancel: () => void; onDismiss: () => void }) {
  const p = panel.preview;
  const closed = panel.state === "done" || panel.state === "cancelled" || panel.state === "error";
  return (
    <div className={cn(glass, "border-orange-300/30 shadow-[0_0_50px_-12px_rgba(251,146,60,0.45)]")} role="alertdialog" aria-label={p.title}>
      <Header title="Confirm on screen" onDismiss={closed ? onDismiss : undefined} />
      <p className="text-base font-semibold">{p.title}</p>
      {p.description && <p className="mt-1 text-xs text-white/55">{stripUserText(p.description)}</p>}
      {p.changes.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-sm">
          {p.changes.map((c, i) => (
            <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-white/55">{c.label}</span>
              <span className="tabular-nums">
                {c.before != null && <span className="text-white/40 line-through decoration-white/30">{c.before}</span>}
                {c.before != null && c.after != null && <span className="px-1.5 text-white/30">→</span>}
                {c.after != null && <span className="font-medium text-white">{c.after}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {p.table && (
        <div className="mt-3 max-h-32 overflow-auto rounded-lg bg-white/5 p-2 text-xs">
          {p.table.rows.slice(0, 8).map((r, i) => (
            <div key={i} className="flex justify-between gap-2 py-0.5 text-white/70">
              {r.map((c, j) => (
                <span key={j} className={j === 0 ? "truncate" : "shrink-0 tabular-nums"}>
                  {c}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
      {!!p.warnings?.length && (
        <ul className="mt-3 space-y-1">
          {p.warnings.map((w, i) => (
            <li key={i} className="flex gap-1.5 text-xs text-amber-200">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {w}
            </li>
          ))}
        </ul>
      )}
      {panel.state === "pending" || panel.state === "running" ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={onCancel}
            disabled={panel.state === "running"}
            className="rounded-xl border border-white/15 px-3 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={panel.state === "running"}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-black transition disabled:opacity-60",
              p.destructive ? "bg-rose-400 hover:bg-rose-300" : "bg-orange-400 hover:bg-orange-300",
            )}
          >
            {panel.state === "running" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
            Confirm
          </button>
        </div>
      ) : (
        <p className={cn("mt-4 flex items-center gap-1.5 text-sm", panel.state === "done" ? "text-emerald-300" : panel.state === "error" ? "text-rose-300" : "text-white/55")} role="status">
          {panel.state === "done" ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
          {panel.message}
        </p>
      )}
    </div>
  );
}

export function JarvisPanels({ panels, onConfirm, onCancel, onDismiss }: { panels: Panel[]; onConfirm: (id: string) => void; onCancel: (id: string) => void; onDismiss: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <AnimatePresence initial={false} mode="popLayout">
        {panels.map((p) => (
          <motion.div
            key={p.id}
            layout
            initial={{ opacity: 0, x: 40, scale: 0.96, filter: "blur(6px)" }}
            animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: 24, scale: 0.96, filter: "blur(6px)", transition: { duration: 0.35 } }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
          >
            {p.type === "confirm" ? (
              <ConfirmPanel panel={p} onConfirm={() => onConfirm(p.id)} onCancel={() => onCancel(p.id)} onDismiss={() => onDismiss(p.id)} />
            ) : (
              <DataPanel spec={p.spec} onDismiss={() => onDismiss(p.id)} />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
