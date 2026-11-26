const OLD_WAY = [
  "Open the menu and scroll past every category",
  "Filter veg, spice and price by hand",
  "Tap into each dish to read the ingredients",
  "Check allergens against your notes",
  "Build the cart item by item",
  "Re-check totals, then pay",
];

/** "One sentence replaces ten taps" — a static before/after comparison. */
export function BeforeAfter() {
  return (
    <section aria-labelledby="one-sentence" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
      <div className="reveal max-w-2xl">
        <p className="eyebrow">Before / after</p>
        <h2 id="one-sentence" className="mt-3 text-balance font-display text-4xl leading-[1.02] sm:text-[3.25rem]">
          One sentence replaces ten taps.
        </h2>
        <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">
          No menu archaeology. Tell the AI host what you feel like and it does the reading, the filtering and the maths for you.
        </p>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <div className="reveal rounded-[28px] border bg-card p-7 sm:p-10">
          <p className="eyebrow">The old way</p>
          <p className="mt-3 font-display text-2xl leading-tight text-muted-foreground sm:text-3xl">Scroll. Filter. Read every label. Tap, tap, tap.</p>
          <ol className="mt-7 space-y-3 text-[15px] text-muted-foreground">
            {OLD_WAY.map((step, i) => (
              <li key={step} className="flex items-start gap-3">
                <span className="w-4 shrink-0 font-mono text-xs leading-6 tabular-nums">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <div className="reveal flex flex-col rounded-[28px] bg-[#14130f] p-7 text-[#f4f3ef] sm:p-10 dark:border dark:bg-card">
          <p className="eyebrow !text-[#a8a59d]">With your AI host</p>
          <p className="mt-3 font-display text-2xl leading-tight sm:text-3xl">Say it once. Check it. Pay.</p>
          <p className="mt-7 rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-4 text-lg leading-snug">
            &ldquo;Something light, no onion, under ₹250.&rdquo;
          </p>
          <p className="mt-4 font-mono text-xs leading-7 text-[#a99dff]">
            → search_menu · check_allergens ✓
            <br />→ add_to_cart ×2 · ₹210
            <br />→ prepare_checkout · waiting for you to pay
          </p>
          <p className="mt-auto pt-6 text-sm leading-relaxed text-[#b3b0a8]">Two dishes, allergen-checked and priced — one tap from checkout.</p>
        </div>
      </div>
    </section>
  );
}
