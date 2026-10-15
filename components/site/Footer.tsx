import Link from "next/link";
import { BRAND } from "@/lib/brand";
import type { Settings } from "@/lib/types";
import { LogoMark } from "./Logo";

const DAYS: [string, string][] = [
  ["mon", "Mon"],
  ["tue", "Tue"],
  ["wed", "Wed"],
  ["thu", "Thu"],
  ["fri", "Fri"],
  ["sat", "Sat"],
  ["sun", "Sun"],
];

export function hoursText(slots: { open: string; close: string }[] | undefined) {
  return slots?.length ? slots.map((s) => `${s.open}–${s.close}`).join(", ") : "Closed";
}

export function HoursList({ settings, className }: { settings: Settings; className?: string }) {
  return (
    <dl className={className ?? "grid grid-cols-[3rem_1fr] gap-y-1 text-sm"}>
      {DAYS.map(([k, label]) => (
        <div key={k} className="contents">
          <dt className="opacity-60">{label}</dt>
          <dd className="tabular-nums">{hoursText(settings.opening_hours[k])}</dd>
        </div>
      ))}
    </dl>
  );
}

const LINKS: [string, [string, string][]][] = [
  [
    "Order",
    [
      ["/menu", "Full menu"],
      ["/cart", "Your cart"],
      ["/orders", "Track an order"],
    ],
  ],
  [
    "Visit",
    [
      ["/reservations", "Book a table"],
      ["/about", "Our story"],
      ["/contact", "Contact"],
    ],
  ],
];

/** Dark, editorial footer shared by every customer-facing page. */
export function Footer({ settings }: { settings: Settings }) {
  return (
    <footer className="mt-24 bg-[oklch(0.19_0.01_60)] text-[oklch(0.93_0.012_85)] dark:bg-card">
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-16 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-3" aria-label={`${BRAND.name} — home`}>
              <LogoMark className="size-10" />
              <span className="font-display text-4xl leading-none">{BRAND.name}</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm opacity-70">{settings.tagline || BRAND.tagline}</p>
            {settings.address && <p className="mt-6 max-w-xs text-sm opacity-90">{settings.address}</p>}
            {settings.phone && (
              <a className="mt-1 inline-block text-sm underline-offset-4 opacity-90 hover:underline" href={`tel:${settings.phone.replace(/\s/g, "")}`}>
                {settings.phone}
              </a>
            )}
          </div>
          {LINKS.map(([title, links]) => (
            <div key={title}>
              <p className="text-xs font-medium uppercase tracking-[0.18em] opacity-50">{title}</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {links.map(([href, label]) => (
                  <li key={href}>
                    <Link className="opacity-85 transition-opacity hover:opacity-100 hover:underline hover:underline-offset-4" href={href}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] opacity-50">Hours</p>
            <HoursList settings={settings} className="mt-4 grid grid-cols-[3rem_1fr] gap-y-1.5 text-sm" />
          </div>
        </div>
        <div className="mt-16 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs opacity-60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
          </p>
          <p>Payments are processed securely by Razorpay — our AI host never handles payments.</p>
        </div>
      </div>
    </footer>
  );
}
