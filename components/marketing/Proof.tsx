import { PROOF } from "@/lib/landing/config";
import { Section } from "./Section";

export function Proof() {
  return (
    <Section
      id="proof"
      num="010"
      kicker={PROOF.kicker}
      title={PROOF.title}
      lede={
        <p className="ae-pretty max-w-2xl">
          No awards, no invented numbers. Just what the product actually does, and a space for the restaurants
          who let us say more.
        </p>
      }
    >
      {/* true product facts */}
      <ul className="grid gap-px overflow-hidden rounded-[var(--ae-radius)] border border-[var(--ae-line)] bg-[var(--ae-line-soft)] sm:grid-cols-2 lg:grid-cols-4">
        {PROOF.facts.map((fact) => (
          <li key={fact.label} className="bg-[var(--ae-bg)] p-6">
            <p className="text-[0.95rem] font-semibold tracking-tight">{fact.label}</p>
            <p className="ae-mono mt-2 text-[0.7rem] leading-relaxed text-[var(--ae-dim)]">{fact.detail}</p>
          </li>
        ))}
      </ul>

      {/* placeholder testimonials — clearly marked */}
      <div className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-xl font-semibold tracking-tight">{PROOF.quotesTitle}</h3>
          <p className="ae-mono text-[0.68rem] text-[var(--ae-amber)]">{PROOF.quotesNote}</p>
        </div>

        <ul className="mt-5 grid gap-4 sm:grid-cols-3">
          {PROOF.quotes.map((q) => (
            <li key={q.quote} className="ae-card ae-placeholder p-6">
              <span className="ae-tag ae-tag-accent">Placeholder</span>
              <blockquote className="ae-pretty mt-4 text-[0.95rem] leading-relaxed text-[var(--ae-muted)]">
                “{q.quote}”
              </blockquote>
              <p className="ae-mono mt-4 text-[0.68rem] text-[var(--ae-dim)]">
                {q.name} · {q.role}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
