import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Standard dashboard page container + header (title, optional description and actions). */
export function DashboardPage({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8", className)}>{children}</div>;
}

export function PageHeader({ title, description, actions, eyebrow }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-2.5">{eyebrow}</div>}
        <h1 className="font-display text-[2.25rem] leading-[1.02] sm:text-[2.75rem]">{title}</h1>
        {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: LucideIcon;
  highlight?: boolean;
}) {
  return (
    <div className={cn("rounded-[18px] border bg-card p-5", highlight && "border-saffron/50 bg-saffron-soft/50")}>
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow">{label}</p>
        <span className={cn("flex size-8 items-center justify-center rounded-full", highlight ? "bg-saffron text-saffron-foreground" : "bg-secondary text-muted-foreground")}>
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-3 font-display text-[2.4rem] leading-none tabular-nums">{value}</p>
      {hint && <div className="mt-2.5 text-[13px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** Card with a header row; used for dashboard widgets. */
export function Panel({ title, description, action, children, className }: { title: string; description?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[18px] border bg-card", className)} aria-label={title}>
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
        <div>
          <h2 className="text-base font-semibold tracking-[-0.01em]">{title}</h2>
          {description && <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
