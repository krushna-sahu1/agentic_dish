import type { ReactNode } from "react";

/**
 * Editorial section chrome: a hairline top rule, a monospace section number,
 * a kicker and an optional lede.
 */
export function Section({
  id,
  num,
  kicker,
  title,
  lede,
  children,
  className,
  tight,
}: {
  id?: string;
  num: string;
  kicker: string;
  title: ReactNode;
  lede?: ReactNode;
  children?: ReactNode;
  className?: string;
  tight?: boolean;
}) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      className={`border-t border-[var(--ae-line-soft)] ${tight ? "py-16 sm:py-20" : "py-20 sm:py-28"} ${className ?? ""}`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="ae-reveal max-w-3xl">
          <div className="flex items-center gap-3">
            <span className="ae-num">{num}</span>
            <span aria-hidden className="h-px w-8 bg-[var(--ae-line-strong)]" />
            <span className="ae-eyebrow">{kicker}</span>
          </div>
          <h2
            id={id ? `${id}-title` : undefined}
            className="ae-display ae-balance mt-5 text-[2.1rem] leading-[1.03] tracking-tight sm:text-[2.75rem]"
          >
            {title}
          </h2>
          {lede ? <div className="ae-pretty mt-5 text-[0.98rem] leading-relaxed text-[var(--ae-muted)] sm:text-base">{lede}</div> : null}
        </div>
        {children ? <div className="mt-12 sm:mt-16">{children}</div> : null}
      </div>
    </section>
  );
}

/** Small caption used under figures and diagrams. */
export function FigureCaption({ children }: { children: ReactNode }) {
  return (
    <figcaption className="ae-mono mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[0.72rem] leading-relaxed text-[var(--ae-dim)]">
      {children}
    </figcaption>
  );
}
