"use client";

import { useCallback, useRef, type ReactNode } from "react";
import Link from "next/link";

/**
 * A button/link that leans towards the cursor.
 *
 * Purely decorative: it is disabled for keyboard users, for coarse pointers
 * and whenever the visitor asked for reduced motion. Nothing here changes
 * the element's semantics or its focus ring.
 */
export function Magnetic({
  children,
  className,
  strength = 0.16,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  const onMove = useCallback(
    (event: React.PointerEvent<HTMLSpanElement>) => {
      const el = ref.current;
      if (!el) return;
      if (event.pointerType !== "mouse") return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const rect = el.getBoundingClientRect();
      const x = (event.clientX - rect.left - rect.width / 2) * strength;
      const y = (event.clientY - rect.top - rect.height / 2) * strength;
      el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    },
    [strength],
  );

  const onLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "translate3d(0, 0, 0)";
  }, []);

  return (
    <span
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`inline-flex transition-transform duration-200 ease-out ${className ?? ""}`}
    >
      {children}
    </span>
  );
}

/** Primary CTA. */
export function PrimaryCta({
  href,
  children,
  external,
  className,
  magnetic = true,
}: {
  href: string;
  children: ReactNode;
  external?: boolean;
  className?: string;
  magnetic?: boolean;
}) {
  const inner = (
    <>
      {children}
      <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden focusable="false">
        <path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </>
  );

  const classes = `ae-btn ae-btn-primary inline-flex ${className ?? ""}`;

  const body = external ? (
    <a href={href} className={classes} target="_blank" rel="noreferrer noopener">
      {inner}
    </a>
  ) : (
    <Link href={href} className={classes}>
      {inner}
    </Link>
  );

  if (!magnetic) return body;
  return <Magnetic>{body}</Magnetic>;
}

/** Secondary / outline CTA. */
export function GhostCta({
  href,
  children,
  external,
  className,
}: {
  href: string;
  children: ReactNode;
  external?: boolean;
  className?: string;
}) {
  const classes = `ae-btn ae-btn-ghost inline-flex ${className ?? ""}`;
  if (external) {
    return (
      <a href={href} className={classes} target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}
