import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva("inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium", {
  variants: {
    variant: {
      default: "bg-foreground/[0.07] text-foreground",
      saffron: "bg-saffron-soft text-saffron-ink",
      iris: "bg-iris-soft text-iris-ink",
      secondary: "bg-secondary text-secondary-foreground",
      outline: "border text-foreground",
      success: "bg-success/12 text-success",
      warning: "bg-warning/15 text-warning",
      info: "bg-info/12 text-info",
      destructive: "bg-destructive/12 text-destructive",
      muted: "bg-muted text-muted-foreground",
      ink: "bg-foreground text-background",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
