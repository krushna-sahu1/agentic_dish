"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { CONTACT, NAV_LINKS, SITE } from "@/lib/landing/config";
import { Wordmark } from "./Wordmark";
import { useView } from "./ViewProvider";
import type { Audience } from "@/lib/landing/config";

const VIEWS: { id: Audience; label: string }[] = [
  { id: "diners", label: "Diners" },
  { id: "owners", label: "Owners" },
];

export function SiteNav() {
  const { view, setView } = useView();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled || open ? "border-b border-[var(--ae-line)] bg-[rgba(7,8,12,0.82)] backdrop-blur-xl" : "border-b border-transparent"
      }`}
    >
      <nav aria-label="Main" className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3.5 sm:px-6">
        <Link href="#top" className="rounded-md" aria-label={`${SITE.name} — top of page`}>
          <Wordmark />
        </Link>

        <ul className="ml-6 hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="rounded-full px-3 py-2 text-sm text-[var(--ae-muted)] transition-colors hover:bg-white/5 hover:text-[var(--ae-fg)]"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-3">
          {/* Audience switch — same idea as the Human/Agent toggle in the product. */}
          <div
            role="group"
            aria-label="Show the site for diners or for restaurant owners"
            className="hidden items-center gap-0.5 rounded-full border border-[var(--ae-line)] bg-white/[0.03] p-0.5 sm:flex"
          >
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setView(v.id)}
                aria-pressed={view === v.id}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === v.id ? "bg-[var(--ae-amber)] text-[#1a1206]" : "text-[var(--ae-muted)] hover:text-[var(--ae-fg)]"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          <a
            href={CONTACT.demoUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="ae-btn ae-btn-primary ae-btn-sm hidden sm:inline-flex"
          >
            Book a demo
          </a>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            className="inline-flex size-10 items-center justify-center rounded-full border border-[var(--ae-line)] text-[var(--ae-fg)] lg:hidden"
          >
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </nav>

      {open && (
        <div id="mobile-menu" className="border-t border-[var(--ae-line)] bg-[rgba(7,8,12,0.96)] backdrop-blur-xl lg:hidden">
          <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
            <ul className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-3 py-2.5 text-[0.95rem] text-[var(--ae-muted)] hover:bg-white/5 hover:text-[var(--ae-fg)]"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>

            <div
              role="group"
              aria-label="Show the site for diners or for restaurant owners"
              className="mt-4 flex items-center gap-0.5 rounded-full border border-[var(--ae-line)] bg-white/[0.03] p-0.5 sm:hidden"
            >
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setView(v.id)}
                  aria-pressed={view === v.id}
                  className={`flex-1 rounded-full px-3 py-2 text-xs font-medium transition-colors ${
                    view === v.id ? "bg-[var(--ae-amber)] text-[#1a1206]" : "text-[var(--ae-muted)]"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>

            <a
              href={CONTACT.demoUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="ae-btn ae-btn-primary mt-4 inline-flex w-full"
            >
              Book a demo
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
