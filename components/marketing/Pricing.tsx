import { CONTACT, PRICING, SITE } from "@/lib/landing/config";
import { Section } from "./Section";

export function Pricing() {
  return (
    <Section
      id="pricing"
      num="012"
      kicker={PRICING.kicker}
      title={PRICING.title}
      lede={<p className="ae-pretty max-w-2xl">{PRICING.note}</p>}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {PRICING.tiers.map((tier, i) => (
          <div
            key={tier.name}
            className={`ae-card ae-reveal relative flex flex-col p-7 sm:p-8 ${
              tier.featured ? "ae-card-active lg:-mt-4 lg:mb-4" : ""
            }`}
          >
            {tier.featured ? (
              <span className="ae-tag ae-tag-accent absolute -top-3 left-7 bg-[var(--ae-bg)]">
                Most popular
              </span>
            ) : null}

            <p className="ae-eyebrow">
              {String(i + 1).padStart(2, "0")} · {tier.name}
            </p>

            <p className="mt-5 flex items-baseline gap-2">
              <span className="ae-display text-[2.6rem] leading-none">{tier.price}</span>
              {tier.period ? <span className="text-sm text-[var(--ae-dim)]">{tier.period}</span> : null}
            </p>

            <p className="ae-pretty mt-4 text-[0.93rem] leading-relaxed text-[var(--ae-muted)]">{tier.summary}</p>

            <ul className="mt-7 space-y-3 border-t border-[var(--ae-line-soft)] pt-6">
              {tier.features.map((f) => (
                <li key={f} className="flex gap-3 text-[0.9rem] leading-relaxed text-[var(--ae-muted)]">
                  <span aria-hidden className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-[var(--ae-amber)]" />
                  {f}
                </li>
              ))}
            </ul>

            <a
              href={CONTACT.demoUrl}
              target="_blank"
              rel="noreferrer noopener"
              className={`ae-btn mt-8 inline-flex w-full ${tier.featured ? "ae-btn-primary" : "ae-btn-ghost"}`}
            >
              {tier.cta}
            </a>
          </div>
        ))}
      </div>

      <p className="ae-mono mt-8 text-[0.68rem] leading-relaxed text-[var(--ae-dim)]">
        Prices are placeholders until we confirm your plan. One-time setup, if any, is agreed in writing before you
        commit. Nothing here is a live quote from {SITE.name}.
      </p>
    </Section>
  );
}
