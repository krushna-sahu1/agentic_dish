"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Bar = { k: string; w: number; v: string; hot?: boolean };
type Scene =
  | { kind: "bars"; label: string; q: string; trace: string; a: string; rows: Bar[] }
  | { kind: "heat"; label: string; q: string; trace: string; a: string }
  | { kind: "confirm"; label: string; q: string; trace: string; a: string; title: string; before: string; after: string; cta: string };

/** Illustrative questions and answers for the owner assistant (sample data, real tool names). */
const SCENES: Scene[] = [
  {
    kind: "bars",
    label: "Sales",
    q: "Which dishes made the most money this week?",
    trace: "get_top_items(last_7_days, by revenue) · 210 ms",
    a: "Your top two carried most of the week. The third is rising fastest — up about a third on last week.",
    rows: [
      { k: "Masala Dosa", w: 100, v: "₹21.5k" },
      { k: "Chicken Biryani", w: 76, v: "₹16.2k" },
      { k: "Mutton Kasa", w: 53, v: "₹11.4k", hot: true },
      { k: "Ghee Roast Dosa", w: 45, v: "₹9.8k" },
      { k: "Filter Coffee", w: 33, v: "₹7.1k" },
    ],
  },
  {
    kind: "heat",
    label: "Busy hours",
    q: "When are we busiest?",
    trace: "get_peak_hours(last_30_days) · 260 ms",
    a: "Weekend lunch and Friday dinner. Saturday 1 pm is your single busiest hour — staff up there first.",
  },
  {
    kind: "confirm",
    label: "Menu & stock",
    q: "We're out of batter. Pull the dish for today.",
    trace: "get_low_stock → propose availability change · waiting for you",
    a: "Here's the change. Nothing happens until you confirm.",
    title: "Change · needs your OK",
    before: "Available · 9 portions",
    after: "Sold out until tomorrow",
    cta: "Confirm",
  },
  {
    kind: "confirm",
    label: "Marketing",
    q: "Email regulars a weekend offer.",
    trace: "draft_email(opted-in guests) · draft ready",
    a: "Drafted for guests who opted in to offers. Review the copy, then send.",
    title: "Email · opted-in guests only",
    before: "Draft",
    after: "“15% off this weekend”",
    cta: "Review & send",
  },
  {
    kind: "bars",
    label: "Reviews",
    q: "What are people complaining about?",
    trace: "get_feedback_summary(last_14_days) · 190 ms",
    a: "Mostly delivery time on weekend nights. Food quality is rated highly; portion size came up twice.",
    rows: [
      { k: "Late delivery", w: 100, v: "9", hot: true },
      { k: "Cold on arrival", w: 44, v: "4" },
      { k: "Portion size", w: 22, v: "2" },
      { k: "Wrong item", w: 11, v: "1" },
    ],
  },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HEAT = ["bg-[var(--seq-0)]", "bg-[var(--seq-1)]", "bg-[var(--seq-2)]", "bg-[var(--seq-3)]", "bg-[var(--seq-4)]", "bg-[var(--seq-5)]"];
const level = (day: number, hour: number) => {
  const lunch = hour >= 1 && hour <= 3 ? 2 : 0;
  const dinner = hour >= 8 && hour <= 10 ? 2 : 0;
  const weekend = day >= 4 ? 1 : 0;
  const peak = day === 5 && hour === 2 ? 2 : 0;
  return Math.min(5, lunch + dinner + weekend + peak);
};

/** "Ask it anything": tabbed examples of what the owner assistant answers. */
export function AskShowcase() {
  const [i, setI] = useState(0);
  const s = SCENES[i];

  return (
    <div className="grid items-start gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
      <div className="lg:sticky lg:top-28">
        <p className="eyebrow !text-iris-ink">Ask it anything</p>
        <h2 id="capabilities-title" className="mt-4 text-balance font-display text-[2.75rem] leading-[0.96] sm:text-[4rem]">
          If you can say it, it can answer it.
        </h2>
        <p className="mt-5 max-w-md text-[17px] leading-relaxed text-muted-foreground sm:text-lg">
          Sales, stock, reviews, customers, campaigns. Every answer comes from your own database — as a chart, a table or a change waiting for your OK.
        </p>
        <div role="tablist" aria-label="Example questions" className="mt-8 flex flex-wrap gap-2">
          {SCENES.map((sc, idx) => (
            <button
              key={sc.label}
              type="button"
              role="tab"
              id={`ask-tab-${idx}`}
              aria-selected={idx === i}
              aria-controls="ask-panel"
              onClick={() => setI(idx)}
              className={cn(
                "h-11 rounded-full border px-[18px] text-sm font-medium transition-colors",
                idx === i ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
              )}
            >
              {sc.label}
            </button>
          ))}
        </div>
      </div>

      <div
        id="ask-panel"
        role="tabpanel"
        aria-labelledby={`ask-tab-${i}`}
        aria-live="polite"
        className="rounded-[24px] border bg-card p-5 shadow-[0_40px_80px_-48px_rgb(20_19_15/0.4)] sm:p-7"
      >
        <div className="flex items-center gap-3 border-b pb-4">
          <span className="flex size-9 items-center justify-center rounded-[11px] bg-iris text-iris-foreground">
            <Sparkles className="size-4" aria-hidden />
          </span>
          <div>
            <p className="text-[15px] font-semibold">Owner assistant</p>
            <p className="text-xs text-muted-foreground">Reads everything. Changes nothing without you.</p>
          </div>
        </div>

        <div key={i} className="animate-rise">
          <p className="ml-auto mt-5 w-fit max-w-[85%] rounded-[18px] rounded-br-[4px] bg-foreground px-4 py-3 text-[15px] text-background sm:text-base">{s.q}</p>
          <p className="agent-trace mt-4">→ {s.trace}</p>
          <p className="mt-2.5 text-[15px] leading-relaxed sm:text-base">{s.a}</p>

          {s.kind === "bars" && (
            <ul className="mt-5 space-y-3">
              {s.rows.map((r) => (
                <li key={r.k} className="grid grid-cols-[minmax(0,130px)_minmax(0,1fr)_56px] items-center gap-3 sm:grid-cols-[150px_minmax(0,1fr)_70px]">
                  <span className="truncate text-sm">{r.k}</span>
                  <span className="h-2.5 rounded-full bg-muted">
                    <span className={cn("block h-full rounded-full", r.hot ? "bg-saffron" : "bg-foreground")} style={{ width: `${r.w}%` }} />
                  </span>
                  <span className="text-right font-mono text-[13px]">{r.v}</span>
                </li>
              ))}
            </ul>
          )}

          {s.kind === "heat" && (
            <div className="mt-5" role="img" aria-label="Heatmap of orders by day and hour, darkest on weekend lunches and Friday dinner">
              <div className="space-y-1">
                {DAYS.map((d, di) => (
                  <div key={d} className="flex items-center gap-1">
                    <span className="w-9 font-mono text-[11px] text-muted-foreground">{d}</span>
                    {Array.from({ length: 12 }, (_, h) => (
                      <span key={h} className={cn("h-5 flex-1 rounded-[5px] sm:h-[22px]", HEAT[level(di, h)])} />
                    ))}
                  </div>
                ))}
              </div>
              <p className="mt-2 pl-10 font-mono text-[11px] text-muted-foreground">11 am → 10 pm</p>
            </div>
          )}

          {s.kind === "confirm" && (
            <div className="mt-5 rounded-[18px] border-[1.5px] border-foreground p-4 sm:p-5">
              <p className="eyebrow !text-saffron-ink">{s.title}</p>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <div className="rounded-xl bg-muted px-3.5 py-3">
                  <p className="eyebrow">Before</p>
                  <p className="mt-1.5 text-[15px]">{s.before}</p>
                </div>
                <div className="rounded-xl bg-saffron-soft px-3.5 py-3">
                  <p className="eyebrow !text-saffron-ink">After</p>
                  <p className="mt-1.5 text-[15px] font-semibold">{s.after}</p>
                </div>
              </div>
              <div className="mt-3.5 flex gap-2" aria-hidden>
                <span className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground">{s.cta}</span>
                <span className="inline-flex h-10 items-center rounded-xl border px-4 text-sm font-medium">Edit</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
