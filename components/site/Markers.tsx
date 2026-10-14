import { cn } from "@/lib/utils";
import { spiceLabel } from "@/lib/format";

/** Indian veg / non-veg mark (square with dot / triangle). */
export function VegMark({ veg, className }: { veg: boolean; className?: string }) {
  return (
    <span
      role="img"
      aria-label={veg ? "Vegetarian" : "Non-vegetarian"}
      title={veg ? "Vegetarian" : "Non-vegetarian"}
      className={cn("inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] border-2 bg-card", veg ? "border-veg" : "border-nonveg", className)}
    >
      {veg ? <span className="size-2 rounded-full bg-veg" /> : <span className="h-0 w-0 border-x-[4px] border-b-[7px] border-x-transparent border-b-nonveg" />}
    </span>
  );
}

export function SpiceLevel({ level, className }: { level: number; className?: string }) {
  if (level <= 0) return null;
  return (
    <span className={cn("text-xs whitespace-nowrap", className)} aria-label={`${spiceLabel(level)} (${level} of 5)`} title={spiceLabel(level)}>
      <span aria-hidden>{"🌶".repeat(level)}</span>
    </span>
  );
}
