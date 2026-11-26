import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Buttons follow the design language: ink (default) carries the one primary action per view,
 * saffron is for food/money actions (add to cart), iris only for AI entry points.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-[background-color,color,border-color,box-shadow,transform] duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/85",
        dark: "bg-foreground text-background hover:bg-foreground/85",
        saffron: "bg-saffron text-saffron-foreground hover:brightness-[1.06]",
        iris: "bg-iris text-iris-foreground hover:brightness-110",
        "iris-soft": "border border-iris-line bg-iris-soft text-iris-ink hover:border-iris/50",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-card hover:border-foreground/30 hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "rounded-none text-foreground underline underline-offset-4 decoration-foreground/30 hover:decoration-foreground",
      },
      size: {
        default: "h-11 px-[18px] text-[15px]",
        sm: "h-9 rounded-[10px] px-3.5 text-sm",
        lg: "h-12 rounded-[14px] px-6 text-base",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
));
Button.displayName = "Button";
