"use client";

import { CONTACT, HERO, INTEGRATIONS, SITE } from "@/lib/landing/config";
import { AgentOrb } from "./AgentOrb";
import { GhostCta, PrimaryCta } from "./Buttons";
import { useView } from "./ViewProvider";

export function Hero() {
  const { view } = useView();

  return (
    <section id="top" aria-labelledby="hero-title" className="ae-shell relative overflow-hidden pt-14 pb-16 sm:pt-20 sm:pb-24">
      {/* ground: grid + grain + glow pair */}
      <div aria-hidden className="ae-grid-bg" />
      <div aria-hidden className="ae-noise" />
      <div aria-hidden className="ae-glow ae-glow-amber -top-40 -left-32 size-[38rem] opacity-60" />
      <div aria-hidden className="ae-glow ae-glow-cool -top-24 right-[-10rem] size-[34rem] opacity-50" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-14 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
          {/* ── copy ── */}
          <div>
            <div className="flex items-center gap-3">
              <span className="ae-num">001</span>
              <span aria-hidden className="h-px w-8 bg-[var(--ae-line-strong)]" />
              <span className="ae-eyebrow">AI ordering &amp; operations for restaurants</span>
            </div>

            <h1 id="hero-title" className="ae-display ae-balance mt-6 text-[2.6rem] leading-[0.97] sm:text-[3.6rem] lg:text-[4.25rem]">
              <span className="block">{HERO.headline}</span>
              <span className="mt-2 block text-[var(--ae-amber)]">{HERO.headlineAccent}</span>
            </h1>

            <p
              key={view}
              className="ae-pretty mt-7 max-w-xl text-[1.02rem] leading-relaxed text-[var(--ae-muted)] sm:text-lg"
            >
              {HERO.subhead[view]}
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <PrimaryCta href={CONTACT.demoUrl} external>
                {HERO.primaryCta}
              </PrimaryCta>
              <GhostCta href={CONTACT.liveDemoUrl}>{HERO.secondaryCta}</GhostCta>
            </div>

            <p className="ae-mono mt-6 text-[0.72rem] leading-relaxed text-[var(--ae-dim)]">
              No app to install · No per-order fee · Your menu, your brand, your customers
            </p>
          </div>

          {/* ── visual ── */}
          <div className="relative">
            <AgentOrb />
          </div>
        </div>

        {/* ── works with ── */}
        <div className="mt-16 border-t border-[var(--ae-line-soft)] pt-7 sm:mt-24">
          <h2 className="ae-eyebrow">Works with the stack you already trust</h2>
          <ul className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-4">
            {INTEGRATIONS.map((name) => (
              <li key={name} className="flex items-center gap-2.5">
                <span aria-hidden className="size-1.5 rounded-full bg-[var(--ae-amber)]" />
                <span className="text-[0.95rem] font-medium tracking-tight text-[var(--ae-muted)]">{name}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Screen-reader summary of the brand for the page header. */}
      <p className="sr-only">{SITE.description}</p>
    </section>
  );
}
