import Link from "next/link";
import { CONTACT, FOOTER, SITE } from "@/lib/landing/config";
import { Wordmark } from "./Wordmark";

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--ae-line)] bg-[#05060a]">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Link href="#top" className="inline-flex rounded-md" aria-label={`${SITE.name} — top of page`}>
              <Wordmark />
            </Link>
            <p className="ae-pretty mt-5 max-w-sm text-[0.9rem] leading-relaxed text-[var(--ae-muted)]">{FOOTER.blurb}</p>
            <div className="mt-6 space-y-1.5 text-[0.9rem]">
              <p>
                <a
                  href={`mailto:${CONTACT.email}`}
                  className="text-[var(--ae-muted)] underline-offset-4 hover:text-[var(--ae-fg)] hover:underline"
                >
                  {CONTACT.email}
                </a>
              </p>
              <p>
                <a
                  href={CONTACT.demoUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-[var(--ae-muted)] underline-offset-4 hover:text-[var(--ae-fg)] hover:underline"
                >
                  WhatsApp {CONTACT.whatsappDisplay}
                </a>
              </p>
            </div>
          </div>

          {FOOTER.columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="ae-eyebrow">{col.title}</h2>
              <ul className="mt-5 space-y-3">
                {col.links.map((link) => {
                  const external = link.href.startsWith("http");
                  return (
                    <li key={link.label}>
                      {external ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-[0.9rem] text-[var(--ae-muted)] underline-offset-4 hover:text-[var(--ae-fg)] hover:underline"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <a
                          href={link.href}
                          className="text-[0.9rem] text-[var(--ae-muted)] underline-offset-4 hover:text-[var(--ae-fg)] hover:underline"
                        >
                          {link.label}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-[var(--ae-line-soft)] pt-7 text-[0.78rem] text-[var(--ae-dim)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {SITE.legalName}. All rights reserved.
          </p>
          <p className="ae-pretty max-w-md">{FOOTER.paymentNote}</p>
          <ul className="flex gap-5">
            {FOOTER.legal.map((link) => (
              <li key={link.href}>
                {/* Placeholder routes — replace with the real legal pages. */}
                <a href={link.href} className="underline-offset-4 hover:text-[var(--ae-fg)] hover:underline">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
