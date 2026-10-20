import { ARCHITECTURE } from "@/lib/landing/config";
import { FigureCaption, Section } from "./Section";

/**
 * Figure 1 — the architecture diagram.
 *
 * Desktop: a hand-built SVG (labels stay crisp at any width).
 * Mobile: the same information as a stacked flow, because a 1000px-wide
 * diagram squeezed into 360px would be unreadable.
 */

const TOOL_Y = [48, 86, 124, 162, 200, 238, 276];
const INPUT_Y = [56, 110, 278, 332];

export function Architecture() {
  const { input, agent, tools } = ARCHITECTURE.layers;

  return (
    <Section
      id="architecture"
      num="003"
      kicker={ARCHITECTURE.kicker}
      title={ARCHITECTURE.title}
      lede={
        <p className="ae-pretty max-w-2xl">
          Diners and owners talk to the same agent layer. The agent reads your data, decides what to do and
          proposes it. Everything that writes waits for a human.
        </p>
      }
    >
      <figure className="ae-reveal">
        <div className="overflow-hidden rounded-[var(--ae-radius)] border border-[var(--ae-line)] bg-[var(--ae-panel)] p-4 sm:p-8">
          {/* ── desktop diagram ── */}
          <div className="hidden lg:block">
            <svg viewBox="0 0 1000 500" className="w-full" role="img" aria-labelledby="arch-title arch-desc">
              <title id="arch-title">How Agentic Eats is wired</title>
              <desc id="arch-desc">
                Diner and owner chat and voice feed an AI agent. The agent calls tools for the menu, cart,
                orders, reservations, inventory, analytics and email campaigns, all inside a marked AI
                boundary. Payments sit outside that boundary: the AI never touches payments, and only
                verified Razorpay webhooks can mark an order paid.
              </desc>

              <defs>
                <marker id="ae-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ae-cyan)" />
                </marker>
                <marker id="ae-arrow-amber" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ae-amber)" />
                </marker>
              </defs>

              {/* ── inputs ── */}
              <text x="8" y="44" className="ae-svg-mono">DINER</text>
              <text x="8" y="266" className="ae-svg-mono">OWNER</text>

              {input.map((label, i) => {
                const y = INPUT_Y[i];
                return (
                  <g key={label}>
                    <rect x="8" y={y} width="188" height="44" rx="12" fill="rgba(255,255,255,0.035)" stroke="var(--ae-line)" />
                    <circle cx="26" cy={y + 22} r="3.5" fill={i < 2 ? "var(--ae-cyan)" : "var(--ae-violet)"} />
                    <text x="40" y={y + 27} className="ae-svg-label">
                      {label}
                    </text>
                  </g>
                );
              })}

              {/* ── AI boundary ── */}
              <rect
                x="232"
                y="16"
                width="756"
                height="340"
                rx="18"
                fill="rgba(255,255,255,0.012)"
                stroke="var(--ae-line-strong)"
                strokeDasharray="5 7"
              />
              <text x="248" y="40" className="ae-svg-mono">
                AI BOUNDARY · READS AND PROPOSES
              </text>

              {/* connectors: inputs → agent */}
              <g fill="none" stroke="var(--ae-line-strong)" strokeWidth="1.2">
                <path className="ae-flow" d="M 196 78 C 230 78, 230 150, 262 150" />
                <path className="ae-flow" d="M 196 132 C 230 132, 230 182, 262 182" />
                <path className="ae-flow" d="M 196 300 C 230 300, 230 230, 262 230" />
                <path className="ae-flow" d="M 196 354 C 230 354, 230 262, 262 262" />
              </g>

              {/* ── the agent ── */}
              <rect x="262" y="110" width="212" height="204" rx="16" fill="rgba(242,163,60,0.06)" stroke="rgba(242,163,60,0.35)" />
              <circle className="ae-pulse-node" cx="278" cy="134" r="4" fill="var(--ae-amber)" />
              <text x="292" y="139" className="ae-svg-strong">
                {agent[0]}
              </text>
              <text x="278" y="160" className="ae-svg-mono-sm">
                understands intent
              </text>

              <line x1="278" y1="176" x2="458" y2="176" stroke="var(--ae-line)" />
              <text x="278" y="202" className="ae-svg-label">
                {agent[1]}
              </text>
              <text x="278" y="220" className="ae-svg-mono-sm">
                reads your data, plans the call
              </text>

              <line x1="278" y1="236" x2="458" y2="236" stroke="var(--ae-line)" />
              <text x="278" y="262" className="ae-svg-label">
                {agent[2]}
              </text>
              <text x="278" y="280" className="ae-svg-mono-sm">
                nothing writes without you
              </text>

              {/* connectors: agent → tools */}
              <path className="ae-flow" d="M 474 212 L 600 212" fill="none" stroke="var(--ae-line-strong)" strokeWidth="1.2" />
              <path d="M 600 64 L 600 292" fill="none" stroke="var(--ae-line-strong)" strokeWidth="1.2" />
              {TOOL_Y.map((y) => (
                <path key={y} className="ae-flow" d={`M 600 ${y + 16} L 700 ${y + 16}`} fill="none" stroke="var(--ae-line-strong)" strokeWidth="1.2" />
              ))}

              {/* ── tools ── */}
              {tools.map((label, i) => {
                const y = TOOL_Y[i];
                return (
                  <g key={label}>
                    <rect x="700" y={y} width="288" height="32" rx="9" fill="rgba(255,255,255,0.03)" stroke="var(--ae-line)" />
                    <circle cx="718" cy={y + 16} r="2.5" fill="var(--ae-amber)" />
                    <text x="732" y={y + 21} className="ae-svg-label">
                      {label}
                    </text>
                  </g>
                );
              })}

              {/* ── the only path that marks an order paid ── */}
              <path
                d="M 844 392 L 844 362"
                fill="none"
                stroke="var(--ae-amber)"
                strokeWidth="1.4"
                strokeDasharray="4 4"
                markerEnd="url(#ae-arrow-amber)"
              />
              <text x="856" y="382" className="ae-svg-mono" style={{ fill: "var(--ae-amber)" }}>
                WEBHOOK
              </text>

              {/* ── locked payments band ── */}
              <rect
                x="8"
                y="392"
                width="980"
                height="92"
                rx="16"
                fill="rgba(242,163,60,0.05)"
                stroke="rgba(242,163,60,0.4)"
                strokeDasharray="6 6"
              />
              {/* lock glyph */}
              <g transform="translate(36 424)" fill="none" stroke="var(--ae-amber)" strokeWidth="1.6">
                <rect x="0" y="10" width="20" height="15" rx="4" fill="rgba(242,163,60,0.15)" />
                <path d="M 5 10 V 7 a 5 5 0 0 1 10 0 v 3" />
              </g>
              <text x="76" y="428" className="ae-svg-strong">
                Payments live outside the AI
              </text>
              <text x="76" y="452" className="ae-svg-mono-sm">
                {ARCHITECTURE.lockedNote}
              </text>
              <rect x="792" y="410" width="172" height="56" rx="12" fill="rgba(255,255,255,0.03)" stroke="var(--ae-line)" />
              <text x="808" y="433" className="ae-svg-mono" style={{ fill: "var(--ae-cyan)" }}>
                RAZORPAY WEBHOOK
              </text>
              <text x="808" y="453" className="ae-svg-mono-sm">
                the only path to “paid”
              </text>
            </svg>
          </div>

          {/* ── mobile diagram ── */}
          <ol className="flex flex-col gap-6 lg:hidden">
            <li>
              <p className="ae-eyebrow">DINER &amp; OWNER</p>
              <ul className="mt-3 grid grid-cols-2 gap-2">
                {input.map((label) => (
                  <li key={label} className="rounded-xl border border-[var(--ae-line)] bg-white/[0.03] px-3 py-2.5 text-sm">
                    {label}
                  </li>
                ))}
              </ul>
            </li>
            <li className="relative rounded-2xl border border-[rgba(242,163,60,0.35)] bg-[rgba(242,163,60,0.06)] p-5">
              <p className="ae-eyebrow ae-eyebrow-accent">AI BOUNDARY</p>
              <ul className="mt-3 space-y-2">
                {agent.map((label, i) => (
                  <li key={label} className="text-sm">
                    <span className="font-medium">{label}</span>
                    <span className="ml-2 text-[var(--ae-dim)]">
                      {
                        ["understands intent", "reads your data, plans the call", "nothing writes without you"][i]
                      }
                    </span>
                  </li>
                ))}
              </ul>
            </li>
            <li>
              <p className="ae-eyebrow">TOOLS</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {tools.map((label) => (
                  <li key={label} className="rounded-full border border-[var(--ae-line)] bg-white/[0.03] px-3 py-1.5 text-xs">
                    {label}
                  </li>
                ))}
              </ul>
            </li>
            <li className="rounded-2xl border border-dashed border-[rgba(242,163,60,0.4)] bg-[rgba(242,163,60,0.05)] p-5">
              <p className="ae-eyebrow ae-eyebrow-accent">LOCKED</p>
              <p className="mt-3 text-sm leading-relaxed text-[var(--ae-muted)]">{ARCHITECTURE.lockedNote}</p>
            </li>
          </ol>
        </div>

        <FigureCaption>
          <span className="text-[var(--ae-amber)]">Figure 1</span>
          <span>{ARCHITECTURE.caption.replace(/^Figure 1 — /, "")}</span>
        </FigureCaption>
      </figure>
    </Section>
  );
}
