import { cn } from "@/lib/utils";

/** Standard dashboard page container + header (title, optional description and actions). */
export function DashboardPage({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[86rem] px-4 py-6 sm:px-6 lg:px-8 lg:py-7", className)}>{children}</div>;
}

export function PageHeader({ title, description, actions, eyebrow }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 text-xs text-muted-foreground">{eyebrow}</div>}
        <h1 className="font-display text-3xl sm:text-4xl">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** One row of headline numbers, read left to right. */
export function StatStrip({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("grid grid-cols-2 overflow-hidden rounded-2xl border bg-card [&>*]:border-border max-lg:[&>*:nth-child(even)]:border-l max-lg:[&>*:nth-child(n+3)]:border-t lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none lg:[&>*+*]:border-l", className)} {...props}>
      {children}
    </div>
  );
}

export function Stat({ label, value, hint, highlight }: { label: string; value: React.ReactNode; hint?: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={cn("px-5 py-4", highlight && "bg-turmeric/12")}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-4xl tabular-nums">{value}</p>
      {hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** Card with a header row; used for dashboard widgets. */
export function Panel({ title, description, action, children, className }: { title: string; description?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border bg-card", className)} aria-label={title}>
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
