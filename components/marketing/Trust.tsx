import { Lock, ShieldCheck } from "lucide-react";
import { TRUST } from "@/lib/landing/config";
import { Section } from "./Section";

export function Trust() {
  return (
    <Section
      id="trust"
      num="007"
      kicker={TRUST.kicker}
      title={TRUST.title}
      lede={
        <p className="ae-pretty max-w-2xl">
          You are running a kitchen, not a research lab. The assistant is powerful precisely because it is not
          left unsupervised.
        </p>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        {/* headline promise */}
        <div className="ae-card ae-reveal relative flex flex-col justify-center overflow-hidden p-7 sm:p-9">
          <div aria-hidden className="ae-glow ae-glow-amber -right-24 -top-24 size-72 opacity-60" />
          <span className="flex size-11 items-center justify-center rounded-xl border border-[rgba(242,163,60,0.35)] bg-[rgba(242,163,60,0.1)] text-[var(--ae-amber)]">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <h3 className="mt-6 text-2xl font-semibold tracking-tight">AI proposes, you approve</h3>
          <p className="ae-pretty mt-4 max-w-md text-[0.95rem] leading-relaxed text-[var(--ae-muted)]">
            Every write — a price, a stock count, a coupon, a refund, a reply to a review — is shown with a
            before and an after, and stays a proposal until you confirm it.
          </p>

          <div className="mt-7 rounded-xl border border-dashed border-[rgba(242,163,60,0.35)] bg-[rgba(242,163,60,0.04)] p-5">
            <div className="flex items-center gap-2.5">
              <Lock className="size-4 shrink-0 text-[var(--ae-amber)]" aria-hidden />
              <p className="ae-eyebrow ae-eyebrow-accent">Payments</p>
            </div>
            <p className="ae-pretty mt-3 text-[0.93rem] leading-relaxed">
              The assistant has no tool that can charge or settle an order. Only a verified Razorpay webhook can
              mark an order paid.
            </p>
          </div>
        </div>

        {/* the rest */}
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {TRUST.items.slice(1).map((item, i) => (
            <li key={item.title} className="ae-card ae-reveal p-6">
              <div className="flex items-center gap-3">
                <span className="ae-num">{String(i + 2).padStart(2, "0")}</span>
                <h3 className="text-[0.98rem] font-semibold tracking-tight">{item.title}</h3>
              </div>
              <p className="ae-pretty mt-2.5 text-[0.9rem] leading-relaxed text-[var(--ae-muted)]">{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
