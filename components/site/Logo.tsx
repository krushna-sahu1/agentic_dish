import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** Brand mark (bowl + spark) used in the navbar, footer and dashboard sidebar. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--primary)" />
      <path d="M6.5 15.5h19a9.5 9.5 0 0 1-19 0z" fill="var(--primary-foreground)" />
      <path d="M16 4.5l1.25 2.75L20 8.5l-2.75 1.25L16 12.5l-1.25-2.75L12 8.5l2.75-1.25z" fill="var(--primary-foreground)" />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      <span className="font-display text-[1.6rem] leading-none tracking-tight">{BRAND.name}</span>
    </span>
  );
}
