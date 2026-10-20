"use client";

import { DINER_FEATURES, OWNER_FEATURES } from "@/lib/landing/config";
import { Section } from "./Section";
import { useView } from "./ViewProvider";

/**
 * The two audience sections. The nav toggle highlights the set that matches
 * the current view — diner cards glow when you are looking as a diner, owner
 * cards glow when you are looking as an owner.
 */
function FeatureCard({
  title,
  body,
  active,
  index,
}: {
  title: string;
  body: string;
  active: boolean;
  index: number;
}) {
  return (
    <li
      className={`ae-card ae-reveal h-full p-6 sm:p-7 ${active ? "ae-card-active" : ""}`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start gap-3">
        <span className="ae-num mt-0.5">{String(index + 1).padStart(2, "0")}</span>
        <h3 className="text-[1.05rem] font-semibold leading-snug tracking-tight">{title}</h3>
      </div>
      <p className="ae-pretty mt-3 text-[0.93rem] leading-relaxed text-[var(--ae-muted)]">{body}</p>
    </li>
  );
}

/** A tiny bar chart, used as a purely decorative illustration. */
function MiniBars() {
  const bars = [38, 62, 48, 80, 55, 71, 92];
  return (
    <svg viewBox="0 0 220 92" className="w-full max-w-[19rem]" aria-hidden focusable="false">
      {bars.map((h, i) => (
        <rect
          key={i}
          x={i * 31 + 4}
          y={92 - h}
          width="18"
          height={h}
          rx="4"
          fill={i === 6 ? "var(--ae-amber)" : "rgba(255,255,255,0.14)"}
        />
      ))}
    </svg>
  );
}

/** The before / after preview that every write has to show. */
function DiffPreview() {
  return (
    <div className="rounded-xl border border-[var(--ae-line)] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="ae-eyebrow">Paneer tikka</span>
        <span className="ae-tag ae-tag-accent">Confirm</span>
      </div>
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
    </div>
  );
}

export function DinerFeatures() {
  const { view } = useView();
  const active = view === "diners";

  return (
    <Section
      id="diners"
      num="004"
      kicker={DINER_FEATURES.kicker}
      title={DINER_FEATURES.title}
      lede={
        <p className="ae-pretty max-w-2xl">
          The same assistant your staff sees, on your diner&apos;s side of the table — and it never guesses about
          an allergen.
        </p>
      }
    >
      <ul className="grid gap-4 sm:grid-cols-2">
        {DINER_FEATURES.items.map((item, i) => (
          <FeatureCard key={item.title} title={item.title} body={item.body} active={active} index={i} />
        ))}
      </ul>
    </Section>
  );
}

export function OwnerFeatures() {
  const { view } = useView();
  const active = view === "owners";
  const [ask, change, ...rest] = OWNER_FEATURES.items;

  return (
    <Section
      id="features"
      num="005"
      kicker={OWNER_FEATURES.kicker}
      title={OWNER_FEATURES.title}
      lede={
        <p className="ae-pretty max-w-2xl">
          This is the part that changes your week. Ask a question, get a chart. Ask for a change, approve it once.
          Both from the same conversation.
        </p>
      }
    >
      {/* flagship pair */}
      <div className="grid gap-4 lg:grid-cols-2">
        <article
          className={`ae-card ae-reveal p-6 sm:p-8 ${active ? "ae-card-active" : ""}`}
        >
          <p className="ae-num">01</p>
          <h3 className="mt-3 text-xl font-semibold tracking-tight">{ask.title}</h3>
          <p className="ae-pretty mt-3 max-w-md text-[0.95rem] leading-relaxed text-[var(--ae-muted)]">{ask.body}</p>
          <div className="mt-6 rounded-xl border border-[var(--ae-line)] bg-white/[0.02] p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="ae-mono text-[0.7rem] text-[var(--ae-dim)]">“which dish is performing best this week?”</p>
              <span className="ae-tag">Sample data</span>
            </div>
            <div className="mt-4">
              <MiniBars />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[var(--ae-line-soft)] pt-4 text-center">
              {[
                ["Revenue", "₹1,24,800"],
                ["Orders", "318"],
                ["Average order", "₹392"],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="ae-mono text-[0.6rem] tracking-[0.14em] text-[var(--ae-dim)] uppercase">{label}</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="ae-mono mt-3 text-[0.66rem] text-[var(--ae-dim)]">
            Illustrative layout with sample numbers — your assistant answers with your own data.
          </p>
        </article>

        <article className={`ae-card ae-reveal p-6 sm:p-8 ${active ? "ae-card-active" : ""}`}>
          <p className="ae-num">02</p>
          <h3 className="mt-3 text-xl font-semibold tracking-tight">{change.title}</h3>
          <p className="ae-pretty mt-3 max-w-md text-[0.95rem] leading-relaxed text-[var(--ae-muted)]">{change.body}</p>
          <div className="mt-6 space-y-3">
            <div className="rounded-xl border border-[var(--ae-line)] bg-white/[0.02] p-4">
              <p className="ae-mono text-[0.7rem] text-[var(--ae-dim)]">“mark paneer tikka sold out”</p>
              <div className="mt-3">
                <DiffPreview />
              </div>
            </div>
            <ul className="flex flex-wrap gap-2">
              {["Prices", "Stock", "Menu", "Coupons", "Refunds", "Reservations", "Settings", "Review replies"].map(
                (c) => (
                  <li key={c} className="ae-tag">
                    {c}
                  </li>
                ),
              )}
            </ul>
          </div>
        </article>
      </div>

      {/* the rest */}
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((item, i) => (
          <FeatureCard key={item.title} title={item.title} body={item.body} active={active} index={i + 2} />
        ))}
      </ul>
    </Section>
  );
}
