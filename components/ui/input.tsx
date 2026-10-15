import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-xl border border-input bg-card px-3.5 py-2 text-sm transition-colors placeholder:text-muted-foreground/80 hover:border-foreground/25 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn("flex min-h-20 w-full rounded-xl border border-input bg-card px-3.5 py-2.5 transition-colors hover:border-foreground/25 text-sm placeholder:text-muted-foreground disabled:opacity-50", className)}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium", className)} {...props} />;
}

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn("flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm transition-colors hover:border-foreground/25 disabled:opacity-50", className)} {...props} />
));
Select.displayName = "Select";
