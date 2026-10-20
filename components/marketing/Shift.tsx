import { SHIFT } from "@/lib/landing/config";
import { Section } from "./Section";

export function Shift() {
  return (
    <Section
      id="shift"
      num="002"
      kicker={SHIFT.kicker}
      title={SHIFT.title}
      lede={
        <div className="space-y-5">
          {SHIFT.body.map((paragraph) => (
            <p key={paragraph.slice(0, 24)} className="ae-pretty max-w-2xl">
              {paragraph}
            </p>
          ))}
        </div>
      }
    >
      {/* Three quiet markers for the three problems named in the copy. */}
      <ul className="grid gap-px overflow-hidden rounded-[var(--ae-radius)] border border-[var(--ae-line)] bg-[var(--ae-line-soft)] sm:grid-cols-3">
        {[
          { k: "The phone", v: "Orders, questions and complaints land on whoever picks up." },
          { k: "The commission", v: "Every order carries someone else's margin." },
          { k: "The dashboard", v: "Charts of the past, no answers about the next hour." },
        ].map((item) => (
          <li key={item.k} className="bg-[var(--ae-bg)] p-6 sm:p-7">
            <p className="ae-eyebrow">{item.k}</p>
            <p className="ae-pretty mt-3 text-[0.95rem] leading-relaxed text-[var(--ae-muted)]">{item.v}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
