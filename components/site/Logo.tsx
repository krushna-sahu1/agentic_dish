import { BRAND } from "@/lib/business";
import { cn } from "@/lib/utils";

/** Brand mark: a folded banana leaf. Used in the navbar, footer and dashboard sidebar. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--primary)" />
      <path d="M7 25C7 13.5 13.5 7 25 7c0 11.5-6.5 18-18 18z" fill="var(--primary-foreground)" />
      <path d="M7 25 19 13" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      <span className="font-display text-[1.45rem] leading-none">{BRAND.name}</span>
    </span>
  );
}
