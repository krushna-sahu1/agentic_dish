import { HOW_IT_WORKS } from "@/lib/landing/config";
import { Section } from "./Section";

export function HowItWorks() {
  return (
    <Section
      id="how"
      num="008"
      kicker={HOW_IT_WORKS.kicker}
      title={HOW_IT_WORKS.title}
      lede={
        <p className="ae-pretty max-w-2xl">
          You do not need to change your kitchen, your POS or your staff habits on day one. You need a menu and a
          decision.
        </p>
      }
    >
      <ol className="grid gap-4 lg:grid-cols-3">
        {HOW_IT_WORKS.steps.map((step, i) => (
          <li key={step.step} className="ae-card ae-reveal relative p-6 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <span className="ae-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="ae-tag ae-tag-accent">{step.timeline}</span>
            </div>
            <h3 className="mt-6 text-xl font-semibold tracking-tight">{step.title}</h3>
            <p className="ae-pretty mt-3 text-[0.93rem] leading-relaxed text-[var(--ae-muted)]">{step.body}</p>
            {i < HOW_IT_WORKS.steps.length - 1 ? (
              <span
                aria-hidden
                className="absolute -right-4 top-1/2 hidden h-px w-8 bg-[var(--ae-line-strong)] lg:block"
              />
            ) : null}
          </li>
        ))}
      </ol>

      <p className="ae-mono mt-6 text-[0.68rem] text-[var(--ae-dim)]">
        Timelines are indicative placeholders — we confirm the real onboarding plan with you.
      </p>
    </Section>
  );
}
