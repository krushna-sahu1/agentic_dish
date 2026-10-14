import Link from "next/link";
import type { Settings } from "@/lib/types";

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

export function HoursList({ settings }: { settings: Settings }) {
  return (
    <dl className="grid grid-cols-[3rem_1fr] gap-y-1 text-sm">
      {DAYS.map(([k, label]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd>{hoursText(settings.opening_hours[k])}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Footer({ settings }: { settings: Settings }) {
  return (
    <footer className="mt-16 border-t bg-muted/40">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="font-display text-lg font-semibold">{settings.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">{settings.tagline}</p>
          <p className="mt-3 text-sm">{settings.address}</p>
          <p className="text-sm">
            <a className="underline-offset-4 hover:underline" href={`tel:${settings.phone?.replace(/\s/g, "")}`}>
              {settings.phone}
            </a>
          </p>
        </div>
        <div>
          <p className="mb-2 font-semibold">Hours</p>
          <HoursList settings={settings} />
        </div>
        <div>
          <p className="font-semibold">Explore</p>
          <ul className="mt-2 space-y-1 text-sm">
            <li><Link className="hover:underline" href="/menu">Menu</Link></li>
            <li><Link className="hover:underline" href="/reservations">Book a table</Link></li>
            <li><Link className="hover:underline" href="/orders">Track your order</Link></li>
            <li><Link className="hover:underline" href="/about">About us</Link></li>
            <li><Link className="hover:underline" href="/contact">Contact</Link></li>
          </ul>
        </div>
      </div>
      <p className="px-4 pb-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {settings.name}. Payments are processed securely by Razorpay — our AI assistant never handles payments.
      </p>
    </footer>
  );
}
