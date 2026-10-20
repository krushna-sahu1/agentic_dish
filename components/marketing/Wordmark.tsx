import { SITE } from "@/lib/landing/config";

/**
 * Wordmark + a small geometric mark. Pure SVG — no image request, no client
 * JavaScript, so it can be rendered from a server component.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <svg viewBox="0 0 32 32" className="size-7 shrink-0" role="img" aria-label={`${SITE.name} logo`}>
        <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="9" fill="none" stroke="var(--ae-line-strong)" strokeWidth="1.5" />
        <circle cx="16" cy="16" r="5" fill="var(--ae-amber)" />
        <path d="M16 4.5a11.5 11.5 0 0 1 11.5 11.5" fill="none" stroke="var(--ae-cyan)" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M16 27.5A11.5 11.5 0 0 1 4.5 16" fill="none" stroke="var(--ae-violet)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span className="text-[0.95rem] font-semibold tracking-tight">{SITE.name}</span>
    </span>
  );
}
