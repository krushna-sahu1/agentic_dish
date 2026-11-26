import { cn } from "@/lib/utils";
import { spiceLabel } from "@/lib/format";

/** Indian veg / non-veg mark (square with dot / triangle). */
export function VegMark({ veg, className }: { veg: boolean; className?: string }) {
  return (
    <span
      role="img"
      aria-label={veg ? "Vegetarian" : "Non-vegetarian"}
      title={veg ? "Vegetarian" : "Non-vegetarian"}
      className={cn("inline-flex size-[15px] shrink-0 items-center justify-center rounded-[3px] border-[1.5px] bg-card", veg ? "border-veg" : "border-nonveg", className)}
    >
      {veg ? <span className="size-2 rounded-full bg-veg" /> : <span className="h-0 w-0 border-x-[4px] border-b-[7px] border-x-transparent border-b-nonveg" />}
    </span>
  );
}

export function SpiceLevel({ level, className }: { level: number; className?: string }) {
  if (level <= 0) return null;
  return (
    <span role="img" className={cn("inline-flex items-center gap-[3px] whitespace-nowrap", className)} aria-label={`${spiceLabel(level)} (${level} of 5)`} title={spiceLabel(level)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} aria-hidden className={cn("size-[5px] rounded-full", n <= level ? "bg-saffron-ink" : "bg-foreground/15")} />
      ))}
    </span>
  );
}
