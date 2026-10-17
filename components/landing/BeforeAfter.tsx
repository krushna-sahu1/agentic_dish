const OLD_WAY = [
  "Open the menu and scroll past every category",
  "Filter veg, spice and price by hand",
  "Tap into each dish to read the ingredients",
  "Check allergens against your notes",
  "Build the cart item by item",
  "Re-check totals, then pay",
];

/**
 * "One sentence replaces ten taps" — a static before/after comparison.
 * The animated rainbow border is reserved for the hero card, so this uses a
 * plain bordered card to stay calm.
 */
export function BeforeAfter() {
  return (
    <section aria-labelledby="one-sentence" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
      <div className="reveal max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Before / after</p>
        <h2 id="one-sentence" className="mt-4 text-balance text-4xl leading-[1.02] tracking-tight sm:text-5xl">
          One sentence replaces ten taps.
        </h2>
        <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
          No menu archaeology. Tell the AI host what you feel like and it does the reading, the filtering and the maths for you.
        </p>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <div className="reveal rounded-3xl border border-border bg-card/60 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">The old way</p>
          <ol className="mt-5 space-y-3 text-sm text-muted-foreground">
            {OLD_WAY.map((step, i) => (
              <li key={step} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border text-[11px] tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <div className="reveal flex flex-col rounded-3xl border border-primary/30 bg-primary/[0.04] p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">With your AI host</p>
          <p className="mt-5 text-pretty text-xl font-medium leading-snug text-foreground sm:text-2xl">
            &ldquo;Something light, no onion, under ₹250.&rdquo;
          </p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Two dishes, allergen-checked and priced — sitting in your cart, one tap from checkout.
          </p>
          <span className="mt-auto inline-flex w-fit items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">1 sentence · 1 tap to review</span>
        </div>
      </div>
    </section>
  );
}
