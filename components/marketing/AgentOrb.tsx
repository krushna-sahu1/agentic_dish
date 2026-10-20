"use client";

import { useEffect, useState } from "react";
import { HERO } from "@/lib/landing/config";
import { useView } from "./ViewProvider";

/**
 * The agent orb: concentric hairlines, a warm core and one cool arc.
 * Pure CSS + SVG — no images, no canvas, no 3D library.
 */
export function AgentOrb() {
  const { view } = useView();
  const labels = HERO.orbLabels[view];
  const [active, setActive] = useState(0);

  useEffect(() => {
    setActive(0);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setActive((n) => (n + 1) % labels.length), 3200);
    return () => window.clearInterval(id);
  }, [labels]);

  const positions = [
    "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2",
    "right-0 top-1/2 -translate-y-1/2 translate-x-1/2",
    "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2",
    "left-0 top-1/2 -translate-y-1/2 -translate-x-1/2",
  ];

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[26rem]">
      {/* ambient glow */}
      <div aria-hidden className="ae-glow ae-glow-amber -inset-16 opacity-70" />
      <div aria-hidden className="ae-glow ae-glow-cool -inset-10 opacity-60" />

      <div className="ae-orb absolute inset-[14%]">
        {/* outer hairline */}
        <div aria-hidden className="ae-orb-ring" style={{ borderColor: "rgba(255,255,255,0.14)" }} />
        {/* rotating dashed ring */}
        <div
          aria-hidden
          className="ae-orb-ring ae-orb-ring-dashed ae-orb-spin"
          style={{ inset: "-8%", borderColor: "rgba(255,255,255,0.13)" }}
        />
        {/* rotating arc with a travelling dot */}
        <div
          aria-hidden
          className="ae-orb-ring ae-orb-spin-rev"
          style={{
            inset: "-16%",
            borderColor: "transparent",
            borderTopColor: "var(--ae-cyan)",
            borderRightColor: "rgba(63,208,214,0.2)",
          }}
        />
        <div aria-hidden className="ae-orb-spin absolute inset-[-16%]">
          <span className="absolute left-1/2 top-0 size-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--ae-cyan)] shadow-[0_0_14px_rgba(63,208,214,0.9)]" />
        </div>

        {/* glass sphere */}
        <div
          aria-hidden
          className="absolute inset-[19%] rounded-full border border-white/10 bg-white/[0.025] backdrop-blur-[2px]"
        />
        {/* warm core — soft, so the label stays legible on top */}
        <div
          aria-hidden
          className="absolute inset-[24%] rounded-full"
          style={{
            background:
              "radial-gradient(circle at 30% 26%, rgba(242,163,60,0.42), rgba(242,163,60,0.08) 46%, rgba(9,10,14,0) 74%)",
            filter: "blur(6px)",
          }}
        />
        <div aria-hidden className="absolute inset-[23%] rounded-full border border-white/[0.07]" />
      </div>

      {/* centre label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
        <span className="ae-eyebrow ae-eyebrow-bright">Agent</span>
        <span className="text-[1.05rem] font-semibold tracking-tight">Agentic Eats</span>
        <span className="ae-tag mt-1 bg-black/50 backdrop-blur-sm">
          <span className="size-1.5 rounded-full bg-[var(--ae-amber)]" aria-hidden />
          Online
        </span>
      </div>

      {/* orbiting capability chips */}
      <ul className="absolute inset-0" aria-label="What the agent can do">
        {labels.map((label, i) => (
          <li
            key={label}
            className={`absolute ${positions[i]} ae-mono whitespace-nowrap rounded-full border px-3 py-1.5 text-[0.68rem] backdrop-blur-sm transition-colors duration-500 ${
              i === active
                ? "border-[rgba(242,163,60,0.5)] bg-[rgba(242,163,60,0.12)] text-[var(--ae-fg)]"
                : "border-[var(--ae-line)] bg-[rgba(13,15,22,0.85)] text-[var(--ae-dim)]"
            }`}
          >
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
