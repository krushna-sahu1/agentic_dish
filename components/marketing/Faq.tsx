import { FAQ } from "@/lib/landing/config";
import { Section } from "./Section";

export function Faq() {
  return (
    <Section
      id="faq"
      num="011"
      kicker={FAQ.kicker}
      title={FAQ.title}
      lede={
        <p className="ae-pretty max-w-2xl">
          Straight answers for owners. If yours is not here, ask us on WhatsApp and we will add it.
        </p>
      }
    >
      <div className="divide-y divide-[var(--ae-line-soft)] border-y border-[var(--ae-line-soft)]">
        {FAQ.items.map((item) => (
          <details key={item.q} className="group ae-reveal">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-left marker:hidden">
              <span className="text-[1rem] font-medium tracking-tight text-[var(--ae-fg)] sm:text-[1.05rem]">
                {item.q}
              </span>
              <span
                aria-hidden
                className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-[var(--ae-line-strong)] text-[var(--ae-muted)] transition-transform duration-300 group-open:rotate-45"
              >
                <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M8 3v10M3 8h10" />
                </svg>
              </span>
            </summary>
            <div className="ae-pretty max-w-3xl pb-6 pr-10 text-[0.95rem] leading-relaxed text-[var(--ae-muted)]">
              {item.a}
            </div>
          </details>
        ))}
      </div>
    </Section>
  );
}
