"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { SAMPLE_ORDERS } from "@/lib/landing";
import { cn } from "@/lib/utils";

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/**
 * The hero demo: pick a sentence, see the kitchen ticket and the owner's day
 * change. Sample data, no network calls.
 */
export function LiveOrder() {
  const [active, setActive] = useState(0);
  const [day, setDay] = useState({ orders: 27, revenue: 11934 });
  const [accepted, setAccepted] = useState(false);
  const order = SAMPLE_ORDERS[active];
  const total = order.lines.reduce((s, l) => s + l.qty * l.price, 0);
  const gst = Math.round(total * 0.05);

  const pick = (i: number) => {
    setActive(i);
    setAccepted(false);
  };
  const accept = () => {
    setAccepted(true);
    setDay((d) => ({ orders: d.orders + 1, revenue: d.revenue + total + gst }));
  };

  return (
    <div className="rounded-3xl bg-leaf p-4 text-leaf-foreground sm:p-7">
      <p className="text-sm opacity-75">Sample orders. Pick what the customer says:</p>
      <div className="mt-3 flex flex-col items-start gap-2" role="radiogroup" aria-label="What the customer says">
        {SAMPLE_ORDERS.map((o, i) => (
          <button
            key={o.said}
            type="button"
            role="radio"
            aria-checked={i === active}
            onClick={() => pick(i)}
            className={cn(
              "rounded-2xl rounded-bl-sm px-4 py-2.5 text-left text-[15px] transition-colors",
              i === active ? "bg-turmeric font-medium text-[#1b1404]" : "bg-white/8 hover:bg-white/15",
            )}
          >
            {o.said}
          </button>
        ))}
      </div>
      <p className="mt-4 text-[15px] leading-relaxed" aria-live="polite">
        {order.reply}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-[1.25fr_1fr]">
        {/* Kitchen ticket */}
        <div key={active} className="animate-print bg-[#fdfdf8] px-5 pb-6 pt-5 text-[#14201a] [clip-path:polygon(0_0,100%_0,100%_calc(100%-8px),95%_100%,90%_calc(100%-8px),85%_100%,80%_calc(100%-8px),75%_100%,70%_calc(100%-8px),65%_100%,60%_calc(100%-8px),55%_100%,50%_calc(100%-8px),45%_100%,40%_calc(100%-8px),35%_100%,30%_calc(100%-8px),25%_100%,20%_calc(100%-8px),15%_100%,10%_calc(100%-8px),5%_100%,0_calc(100%-8px))]">
          <p className="flex items-baseline justify-between font-display text-2xl">
            #{String(28 + active).padStart(4, "0")} <span className="text-base">{order.type}</span>
          </p>
          <ul className="mt-3 space-y-1.5 border-t border-dashed border-black/30 pt-3 text-[15px]">
            {order.lines.map((l) => (
              <li key={l.name} className="flex justify-between gap-3">
                <span>
                  <b>{l.qty}×</b> {l.name}
                  {l.note && <span className="block pl-6 text-sm text-[#8f5a00]">{l.note}</span>}
                </span>
                <span className="tabular-nums">{rupees(l.qty * l.price)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex justify-between border-t border-dashed border-black/30 pt-2 text-sm">
            <span>GST 5%</span> <span className="tabular-nums">{rupees(gst)}</span>
          </p>
          <p className="flex justify-between font-semibold">
            <span>Total</span> <span className="tabular-nums">{rupees(total + gst)}</span>
          </p>
          <button
            type="button"
            disabled={accepted}
            onClick={accept}
            className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#1b5e3f] text-sm font-medium text-white transition-colors hover:bg-[#154a32] disabled:bg-[#e2eadc] disabled:text-[#1b5e3f]"
          >
            {accepted ? (
              <>
                <Check className="size-4" aria-hidden /> Accepted, ready in 20 min
              </>
            ) : (
              "Accept order"
            )}
          </button>
        </div>

        {/* The owner's day */}
        <dl className="flex flex-row justify-between gap-4 self-start border-white/20 sm:flex-col sm:justify-start sm:gap-6 sm:border-l sm:pl-5">
          <div>
            <dt className="text-sm opacity-75">Orders today</dt>
            <dd className="font-display text-5xl tabular-nums text-turmeric">{day.orders}</dd>
          </div>
          <div>
            <dt className="text-sm opacity-75">Revenue today</dt>
            <dd className="font-display text-5xl tabular-nums text-turmeric">{rupees(day.revenue)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
