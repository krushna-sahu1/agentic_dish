"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Mic, Sparkles } from "lucide-react";
import { DEMO } from "@/lib/landing/config";
import { FigureCaption, Section } from "./Section";

/**
 * Section 006 — the scripted product demo.
 *
 * Nothing here talks to a model or an API: it is a fixed sequence of beats
 * revealed on a timer, with a typing effect. The point is to show the shape
 * of the conversation, not to pretend to be one.
 */

type CardKind = "dishes" | "cart" | "chart" | "confirm";

type Beat =
  | { role: "user"; text: string }
  | { role: "ai"; text: string; card?: CardKind };

const TYPE_MS = 16;
const DWELL_MS = 1100;

function useReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/* ── mock UI pieces ───────────────────────────────────────────────────────── */

function DishCards() {
  const dishes = [
    { name: "Burnt chilli paneer tikka", price: "₹240", note: "Peanut-free · medium spice", veg: true },
    { name: "Gongura chilli chicken", price: "₹280", note: "Peanut-free · hot", veg: false },
  ];
  return (
    <div className="grid gap-2">
      {dishes.map((d) => (
        <div key={d.name} className="flex items-center gap-3 rounded-xl border border-[var(--ae-line)] bg-white/[0.03] p-3">
          <span
            aria-hidden
            className={`flex size-8 shrink-0 items-center justify-center rounded-lg border text-[0.65rem] ${
              d.veg ? "border-[rgba(74,222,128,0.4)] text-[#4ade80]" : "border-[rgba(242,122,122,0.45)] text-[#f27a7a]"
            }`}
          >
            {d.veg ? "V" : "N"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.85rem] font-medium">{d.name}</p>
            <p className="ae-mono mt-0.5 text-[0.66rem] text-[var(--ae-dim)]">{d.note}</p>
          </div>
          <span className="ae-mono shrink-0 text-[0.8rem] tabular-nums">{d.price}</span>
        </div>
      ))}
    </div>
  );
}

function CartCard() {
  return (
    <div className="rounded-xl border border-[var(--ae-line)] bg-white/[0.03] p-3">
      <div className="flex items-center gap-2">
        <span className="flex size-5 items-center justify-center rounded-full bg-[rgba(74,222,128,0.16)] text-[#4ade80]">
          <Check className="size-3" aria-hidden />
        </span>
        <p className="text-[0.85rem] font-medium">Added to your cart</p>
      </div>
      <p className="ae-mono mt-2 text-[0.7rem] text-[var(--ae-dim)]">2 items · ₹520 · delivery or pickup</p>
      <p className="ae-mono mt-1 text-[0.66rem] text-[var(--ae-dim)]">pay by Razorpay at checkout</p>
    </div>
  );
}

function SalesChart() {
  // Sample numbers for a scripted preview — not a real result.
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const values = [62, 31, 58, 70, 66, 88, 74];
  return (
    <div className="rounded-xl border border-[var(--ae-line)] bg-white/[0.03] p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="ae-mono text-[0.66rem] text-[var(--ae-dim)]">Sample data · last 7 days</p>
        <span className="ae-tag ae-tag-accent">Tuesday</span>
      </div>
      <svg viewBox="0 0 260 86" className="mt-3 w-full" aria-hidden focusable="false">
        {values.map((v, i) => (
          <g key={days[i]}>
            <rect
              x={i * 37 + 5}
              y={86 - v}
              width="24"
              height={v}
              rx="5"
              fill={i === 1 ? "var(--ae-amber)" : "rgba(255,255,255,0.14)"}
            />
            <text
              x={i * 37 + 17}
              y="84"
              textAnchor="middle"
              className="ae-svg-mono-sm"
              style={{ fontSize: 8, fill: i === 1 ? "var(--ae-amber)" : "var(--ae-dim)" }}
            >
              {days[i]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function ConfirmCard() {
  return (
    <div className="rounded-xl border border-[rgba(242,163,60,0.35)] bg-[rgba(242,163,60,0.05)] p-3">
      <p className="ae-eyebrow">Confirm before this happens</p>
      <div className="mt-3 space-y-1.5 text-[0.82rem]">
        <div className="flex items-center gap-2 text-[var(--ae-dim)]">
          <span className="ae-mono w-14 shrink-0">before</span>
          <span className="line-through">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="ae-mono w-14 shrink-0 text-[var(--ae-amber)]">after</span>
          <span className="font-medium">Sold out</span>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <span className="ae-btn ae-btn-primary ae-btn-sm inline-flex cursor-not-allowed opacity-90" aria-hidden>
          Confirm
        </span>
        <span className="ae-btn ae-btn-ghost ae-btn-sm inline-flex cursor-not-allowed" aria-hidden>
          Cancel
        </span>
      </div>
      <p className="ae-mono mt-2 text-[0.62rem] text-[var(--ae-dim)]">Preview only — buttons are inactive in this demo.</p>
    </div>
  );
}

/* ── scripts ──────────────────────────────────────────────────────────────── */

const SCRIPTS: Record<string, Beat[]> = {
  diner: [
    { role: "user", text: "Something spicy, no peanuts, under ₹300" },
    {
      role: "ai",
      text: "Two dishes fit that — both peanut-free, both under ₹300:",
      card: "dishes",
    },
    { role: "user", text: "The paneer one. Extra chilli." },
    { role: "ai", text: "Added. Your cart is ready whenever you are.", card: "cart" },
  ],
  owner: [
    { role: "user", text: "Why did sales dip on Tuesday?" },
    {
      role: "ai",
      text: "Tuesday came in under your recent average for that weekday. Two dishes did most of the damage.",
      card: "chart",
    },
    { role: "user", text: "Mark paneer tikka sold out" },
    { role: "ai", text: "Here is the change. Nothing happens until you confirm.", card: "confirm" },
  ],
};

function CardFor({ kind }: { kind: CardKind }) {
  if (kind === "dishes") return <DishCards />;
  if (kind === "cart") return <CartCard />;
  if (kind === "chart") return <SalesChart />;
  return <ConfirmCard />;
}

/* ── the demo ─────────────────────────────────────────────────────────────── */

export function ProductDemo() {
  const [tab, setTab] = useState<"diner" | "owner">("diner");
  const [revealed, setRevealed] = useState(0);
  const [typed, setTyped] = useState("");
  const reduced = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);

  const beats = useMemo(() => SCRIPTS[tab], [tab]);

  const reset = useCallback(() => {
    setRevealed(0);
    setTyped("");
  }, []);

  // Type out the newest AI beat, then advance.
  useEffect(() => {
    if (revealed >= beats.length) return;
    const beat = beats[revealed];
    if (beat.role !== "ai") {
      setTyped("");
      const t = window.setTimeout(() => setRevealed((n) => n + 1), reduced ? 250 : 650);
      return () => window.clearTimeout(t);
    }

    if (reduced) {
      setTyped(beat.text);
      const t = window.setTimeout(() => setRevealed((n) => n + 1), DWELL_MS);
      return () => window.clearTimeout(t);
    }

    setTyped("");
    let i = 0;
    const type = window.setInterval(() => {
      i += 1;
      setTyped(beat.text.slice(0, i));
      if (i >= beat.text.length) {
        window.clearInterval(type);
        window.setTimeout(() => setRevealed((n) => n + 1), DWELL_MS);
      }
    }, TYPE_MS);
    return () => window.clearInterval(type);
  }, [revealed, beats, reduced]);

  // Keep the newest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [revealed, typed]);

  const done = revealed >= beats.length;

  return (
    <Section
      id="demo"
      num="006"
      kicker={DEMO.kicker}
      title={DEMO.title}
      lede={
        <p className="ae-pretty max-w-2xl">
          Two conversations, side by side. The diner talks about food; the owner talks about the business. Both
          end with a human deciding.
        </p>
      }
    >
      <div className="ae-reveal mx-auto max-w-5xl overflow-hidden rounded-[var(--ae-radius)] border border-[var(--ae-line)] bg-[var(--ae-panel)]">
        {/* tab bar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--ae-line)] px-4 py-3 sm:px-6">
          <div role="tablist" aria-label="Demo conversations" className="flex items-center gap-1 rounded-full border border-[var(--ae-line)] bg-white/[0.02] p-1">
            {DEMO.tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                id={`demo-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`demo-panel-${t.id}`}
                type="button"
                onClick={() => {
                  setTab(t.id as "diner" | "owner");
                  reset();
                }}
                className={`ae-tab px-4 py-1.5 text-[0.8rem] font-medium`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <p className="ae-mono order-3 w-full text-[0.68rem] text-[var(--ae-dim)] sm:order-none sm:w-auto">
            Scripted preview · sample data · no API calls
          </p>

          <button
            type="button"
            onClick={reset}
            className="ae-btn ae-btn-ghost ae-btn-sm ml-auto inline-flex"
          >
            Replay
          </button>
        </div>

        {/* chat window */}
        <div
          role="tabpanel"
          id={`demo-panel-${tab}`}
          aria-labelledby={`demo-tab-${tab}`}
          className="grid gap-0 lg:grid-cols-[1fr]"
        >
          <div
            ref={scrollRef}
            aria-label="Scripted conversation"
            className="max-h-[30rem] min-h-[22rem] space-y-4 overflow-y-auto px-4 py-6 sm:px-6 lg:max-h-none lg:min-h-0 lg:overflow-visible"
          >
            {beats.slice(0, revealed).map((beat, i) => (
              <Message key={i} beat={beat} />
            ))}

            {/* the user beat lands first, then the assistant answers */}
            {!done && beats[revealed]?.role === "user" && <Message beat={beats[revealed]} />}

            {/* the beat currently being typed / dwelled on */}
            {!done && beats[revealed]?.role === "ai" && (
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[rgba(242,163,60,0.16)] text-[var(--ae-amber)]">
                  <Sparkles className="size-3" aria-hidden />
                </span>
                <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-[var(--ae-line)] bg-white/[0.03] px-3.5 py-2.5">
                  {typed ? (
                    <p className="text-[0.92rem] leading-relaxed">
                      {typed}
                      <span className="ae-caret" aria-hidden />
                    </p>
                  ) : (
                    <span className="flex items-center gap-1 py-1">
                      <span className="ae-typing-dot size-1.5 rounded-full bg-[var(--ae-dim)]" />
                      <span className="ae-typing-dot size-1.5 rounded-full bg-[var(--ae-dim)]" />
                      <span className="ae-typing-dot size-1.5 rounded-full bg-[var(--ae-dim)]" />
                    </span>
                  )}
                </div>
              </div>
            )}

            {done && (
              <p className="ae-mono pt-2 text-[0.68rem] text-[var(--ae-dim)]">
                End of the scripted preview. Your real conversations run on your own data.
              </p>
            )}
          </div>

          {/* input bar (decorative) */}
          <div className="border-t border-[var(--ae-line)] px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3 rounded-full border border-[var(--ae-line)] bg-white/[0.02] px-4 py-2.5">
              <Mic className="size-4 shrink-0 text-[var(--ae-dim)]" aria-hidden />
              <span className="ae-mono truncate text-[0.72rem] text-[var(--ae-dim)]">
                {tab === "diner" ? "ask for a dish, a table, or a reorder…" : "ask about sales, stock, a change…"}
              </span>
              <span className="ae-mono ml-auto shrink-0 text-[0.68rem] text-[var(--ae-dim)]">↵</span>
            </div>
          </div>
        </div>
      </div>

      <FigureCaption>
        <span className="text-[var(--ae-amber)]">Figure 2</span>
        <span>{DEMO.caption.replace(/^Figure 2 — /, "")}</span>
      </FigureCaption>
    </Section>
  );
}

function Message({ beat }: { beat: Beat }) {
  if (beat.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-[var(--ae-panel-2)] px-3.5 py-2.5 text-[0.92rem] leading-relaxed">
          {beat.text}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[rgba(242,163,60,0.16)] text-[var(--ae-amber)]">
        <Sparkles className="size-3" aria-hidden />
      </span>
      <div className="max-w-[85%] space-y-2.5">
        <div className="rounded-2xl rounded-tl-md border border-[var(--ae-line)] bg-white/[0.03] px-3.5 py-2.5">
          <p className="text-[0.92rem] leading-relaxed">{beat.text}</p>
        </div>
        {beat.card ? <CardFor kind={beat.card} /> : null}
      </div>
    </div>
  );
}
