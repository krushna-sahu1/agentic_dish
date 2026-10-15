"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Mic, MicOff, PhoneOff, RotateCcw } from "lucide-react";
import { liveKpisAction } from "@/app/actions/owner";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { JarvisPanels } from "./JarvisPanels";
import { useJarvis, type JarvisStatus } from "./useJarvis";

const JarvisOrb = dynamic(() => import("./JarvisOrb"), { ssr: false });

const STATUS_UI: Record<JarvisStatus, { label: string; dot: string; glow: string }> = {
  idle: { label: "Standby", dot: "bg-white/50", glow: "rgba(200,210,230,0.10)" },
  connecting: { label: "Connecting", dot: "bg-indigo-300 animate-pulse", glow: "rgba(120,130,255,0.16)" },
  listening: { label: "Listening", dot: "bg-emerald-400", glow: "rgba(52,211,153,0.20)" },
  thinking: { label: "Thinking", dot: "bg-violet-400 animate-pulse", glow: "rgba(139,92,246,0.24)" },
  speaking: { label: "Speaking", dot: "bg-orange-400", glow: "rgba(251,146,60,0.24)" },
};

type Kpis = { revenue_today_paise: number; active_orders: number };

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

function HudItem({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[9px] uppercase tracking-[0.2em] text-white/35">{label}</p>
      <p className="truncate font-mono text-sm tabular-nums text-white/85">{value}</p>
    </div>
  );
}

export function JarvisExperience() {
  const j = useJarvis();
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const ui = STATUS_UI[j.status];

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const r = await liveKpisAction();
      if (alive && r.ok) setKpis(r.data as Kpis);
    };
    void load();
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [j.dataTick]);

  // Esc ends the session.
  const { active, end } = j;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && end();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, end]);

  const toggle = () => (j.active ? j.end() : void j.start());
  const lastUser = [...j.captions].reverse().find((c) => c.role === "user");
  const lastJarvis = [...j.captions].reverse().find((c) => c.role === "assistant");

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto overflow-x-hidden bg-[#03050b] text-white lg:overflow-hidden" style={{ colorScheme: "dark" }}>
      {/* Ambient glow follows the orb's state colour */}
      <div aria-hidden className="pointer-events-none fixed inset-0 transition-[background] duration-1000" style={{ background: `radial-gradient(60% 55% at 40% 48%, ${ui.glow}, transparent 70%)` }} />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.07]"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)", backgroundSize: "48px 48px", maskImage: "radial-gradient(ellipse at center, black 20%, transparent 75%)" }}
      />

      {/* HUD */}
      <header className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#03050b]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/owner" aria-label="Back to dashboard" className="rounded-full p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white">
              <ArrowLeft className="size-4" />
            </Link>
            <span className="font-mono text-sm font-semibold tracking-[0.35em]">JARVIS</span>
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/70" role="status" aria-live="polite">
              <span className={cn("size-1.5 rounded-full", ui.dot)} />
              {ui.label}
              {j.muted && j.active ? " · muted" : ""}
            </span>
          </div>
          <div className="ml-auto grid w-full grid-cols-3 gap-x-5 gap-y-2 sm:flex sm:w-auto sm:items-center">
            <HudItem label="Today" value={kpis ? formatINR(kpis.revenue_today_paise) : "—"} />
            <HudItem label="Active orders" value={kpis?.active_orders ?? "—"} />
            <HudItem label="Time" value={now ? new Date(now).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }) : "—"} />
            <HudItem label="Latency" value={j.latencyMs != null ? `${j.latencyMs} ms` : "—"} />
            <HudItem label="Talk time" value={j.startedAt && now ? mmss(now - j.startedAt) : "00:00"} />
          </div>
        </div>
      </header>

      <div className="relative mx-auto grid max-w-[1500px] gap-6 px-4 pb-10 lg:h-[calc(100dvh-57px)] lg:grid-cols-[minmax(0,1fr)_400px] lg:pb-0">
        {/* Orb column */}
        <section className="flex min-h-0 flex-col items-center justify-center pt-4 lg:pt-0">
          <div
            role="button"
            tabIndex={0}
            aria-label={j.active ? "End Jarvis session" : "Start Jarvis"}
            onClick={toggle}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle())}
            className="relative aspect-square w-[min(86vw,46vh)] cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/40 lg:w-[min(52vh,560px)]"
          >
            <JarvisOrb status={j.status} levels={j.levels} />
            {!j.active && !j.error && (
              <span className="pointer-events-none absolute inset-x-0 bottom-[8%] text-center text-[11px] uppercase tracking-[0.3em] text-white/45">Tap to talk</span>
            )}
          </div>

          {/* Live captions */}
          <div className="mt-2 flex min-h-[5.5rem] w-full max-w-2xl flex-col items-center justify-start gap-1.5 px-2 text-center" aria-live="polite">
            <AnimatePresence mode="popLayout" initial={false}>
              {lastUser && (
                <motion.p key={lastUser.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-sm text-white/45 sm:text-base">
                  {lastUser.text}
                </motion.p>
              )}
              {lastJarvis && (
                <motion.p key={lastJarvis.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-base font-medium text-white sm:text-lg">
                  {lastJarvis.text}
                </motion.p>
              )}
            </AnimatePresence>
            {!j.captions.length && !j.error && (
              <p className="text-sm text-white/35">{j.status === "connecting" ? "Waking up Jarvis…" : j.active ? "Ask anything — “How are we doing today?”" : (j.notice ?? "Your voice assistant for the restaurant.")}</p>
            )}
          </div>

          {/* Errors / reconnect */}
          {j.error && (
            <div role="alert" className="mt-2 w-full max-w-md rounded-2xl border border-rose-300/25 bg-rose-500/10 p-4 text-center backdrop-blur-xl">
              <p className="text-sm text-rose-100">{j.error.message}</p>
              {j.error.kind !== "auth" && j.error.kind !== "config" && (
                <button onClick={() => void j.start()} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/85">
                  <RotateCcw className="size-4" aria-hidden /> Reconnect
                </button>
              )}
            </div>
          )}
          {j.notice && j.captions.length > 0 && !j.error && <p className="mt-1 text-xs text-white/40">{j.notice}</p>}

          {/* Controls */}
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={j.toggleMute}
              disabled={!j.active}
              aria-pressed={j.muted}
              aria-label={j.muted ? "Unmute microphone" : "Mute microphone"}
              className={cn(
                "flex size-12 items-center justify-center rounded-full border transition disabled:opacity-30",
                j.muted ? "border-amber-300/40 bg-amber-400/15 text-amber-200" : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10",
              )}
            >
              {j.muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
            </button>
            <button
              onClick={() => (j.active ? j.end() : void j.start())}
              aria-label={j.active ? "End session" : "Start session"}
              className={cn(
                "flex h-12 items-center gap-2 rounded-full px-5 text-sm font-semibold transition",
                j.active ? "bg-rose-500/90 text-white hover:bg-rose-500" : "bg-white text-black hover:bg-white/85",
              )}
            >
              {j.active ? <PhoneOff className="size-4" /> : <Mic className="size-4" />}
              {j.active ? "End" : "Start"}
            </button>
          </div>
        </section>

        {/* Floating panels: beside the orb on desktop, below it on mobile */}
        <aside className="min-h-0 lg:overflow-y-auto lg:py-6 lg:pr-1 [scrollbar-width:thin]" aria-label="Jarvis results">
          <JarvisPanels panels={j.panels} onConfirm={j.confirm} onCancel={j.cancel} onDismiss={j.dismiss} />
        </aside>
      </div>
    </div>
  );
}
