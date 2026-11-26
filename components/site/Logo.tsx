import { BRAND } from "@/lib/business";
import { cn } from "@/lib/utils";

/**
 * Brand mark (bowl + spark): an ink tile, a paper bowl and a saffron spark.
 * It follows the theme by default; `inverted` pins the light tile for always-dark
 * surfaces (footer, dashboard sidebar, Jarvis).
 */
export function LogoMark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  const tile = inverted ? "#f4f3ef" : "var(--foreground)";
  const bowl = inverted ? "#111113" : "var(--background)";
  return (
    <svg viewBox="0 0 40 40" className={cn("size-8 shrink-0", className)} aria-hidden>
      <rect width="40" height="40" rx="11" fill={tile} />
      <path d="M9 20.5h22a11 11 0 0 1-22 0z" fill={bowl} />
      <path d="M20 6.5l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z" fill="var(--saffron)" />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      <span className="whitespace-nowrap font-display text-[1.2rem] leading-none sm:text-[1.35rem]">{BRAND.name}</span>
    </span>
  );
}
