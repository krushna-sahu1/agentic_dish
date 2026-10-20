import { CLOSING, CONTACT } from "@/lib/landing/config";
import { GhostCta, PrimaryCta } from "./Buttons";

export function Closing() {
  return (
    <section aria-labelledby="closing-title" className="relative overflow-hidden border-t border-[var(--ae-line-soft)] py-24 sm:py-32">
      {/* atmosphere */}
      <div aria-hidden className="ae-grid-bg opacity-60" />
      <div aria-hidden className="ae-noise" />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-[-40%] top-[10%] -z-10"
        style={{
          background:
            "radial-gradient(46% 60% at 22% 40%, rgba(242,163,60,0.28), transparent 70%), radial-gradient(42% 56% at 78% 30%, rgba(63,208,214,0.22), transparent 72%), radial-gradient(50% 60% at 52% 92%, rgba(155,123,245,0.2), transparent 72%)",
          filter: "blur(28px)",
        }}
      />

      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
        <p className="ae-eyebrow">{CLOSING.kicker}</p>
        <h2 id="closing-title" className="ae-display ae-balance mt-6 text-[2.2rem] leading-[1.02] sm:text-[3.25rem]">
          {CLOSING.title}
        </h2>
        <p className="ae-pretty mx-auto mt-6 max-w-2xl text-[1.02rem] leading-relaxed text-[var(--ae-muted)]">
          {CLOSING.body}
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <PrimaryCta href={CONTACT.demoUrl} external>
            {CLOSING.primaryCta}
          </PrimaryCta>
          <GhostCta href={CONTACT.liveDemoUrl}>{CLOSING.secondaryCta}</GhostCta>
        </div>

        <p className="ae-mono mt-8 text-[0.72rem] text-[var(--ae-dim)]">
          Prefer to talk?{" "}
          <a
            href={`mailto:${CONTACT.email}`}
            className="text-[var(--ae-amber)] underline underline-offset-4 hover:opacity-80"
          >
            {CONTACT.email}
          </a>{" "}
          ·{" "}
          <a
            href={CONTACT.demoUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-[var(--ae-amber)] underline underline-offset-4 hover:opacity-80"
          >
            WhatsApp {CONTACT.whatsappDisplay}
          </a>
        </p>
      </div>
    </section>
  );
}
