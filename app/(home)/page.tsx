import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";
import { AskShowcase } from "@/components/home/AskShowcase";
import { LandingNav } from "@/components/home/LandingNav";
import { LogoMark } from "@/components/site/Logo";
import { getSessionUser } from "@/lib/auth";
import { BRAND } from "@/lib/business";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: `${BRAND.name} — Run your restaurant by talking to it` },
  description:
    "An AI operator for restaurants: a guest agent that takes orders and bookings, and an owner assistant that answers with live numbers and changes nothing without your Confirm.",
};

const FEED = [
  { t: "New paid order — chime played", at: "now", c: "bg-[#8f80ff]" },
  { t: "Guest agent booked a table for 4", at: "1m", c: "bg-[#3fcb7e]" },
  { t: "Allergen check stopped a peanut dish", at: "3m", c: "bg-[#ff7a2e]" },
  { t: "An order is waiting 6 min", at: "6m", c: "bg-[#f06a63]" },
  { t: "Stock low: batter below reorder level", at: "12m", c: "bg-[#ff7a2e]" },
  { t: "Daily brief ready", at: "7:00", c: "bg-[#8d8a83]" },
];

const HERO_BARS: [number, number][] = [[52, 60], [70, 82], [78, 100], [40, 46], [44, 52], [58, 66], [48, 60]];

const PILLARS = [
  ["Answers with live data", "Charts and tables straight from your orders, menu and reviews."],
  ["Proposes, never presumes", "Every change shows a before/after and waits for your click."],
  ["Talk or type", "Chat on any screen, or hands-free voice from the kitchen."],
  ["Realtime by default", "New orders, stock and status changes update everywhere instantly."],
] as const;

const GUEST = [
  ["Orders by text or voice", "add_to_cart"],
  ["Checks allergies on every add", "allergen guard"],
  ["Finds the best coupon", "apply_coupon"],
  ["Books and cancels tables", "check_reservation_availability"],
  ["Tracks orders live", "get_order_status"],
  ["Hands the Pay button to a human", "prepare_checkout"],
] as const;

const OWNER = [
  ["Revenue, trends and comparisons", "compare_periods"],
  ["Busy hours and demand forecast", "forecast_demand"],
  ["Menu, prices and stock changes", "confirm-gated"],
  ["Coupons and opt-in email campaigns", "draft_email"],
  ["Review summaries and ratings", "get_feedback_summary"],
  ["PDF and CSV reports", "generate_report"],
] as const;

const PIPELINE = [
  { t: "You ask", b: "Plain language, typed or spoken.", tag: "chat · voice", tone: "plain" },
  { t: "Typed tool", b: "The model can only call tools with a strict schema — never free-form SQL.", tag: "schema-validated", tone: "plain" },
  { t: "Role check", b: "Staff and owners see and change only what their role allows.", tag: "guard · RLS", tone: "plain" },
  { t: "Your click", b: "Writes become a before/after card. Nothing runs until you confirm.", tag: "human-in-the-loop", tone: "ink" },
  { t: "Audit log", b: "Every call is recorded with who, what and when.", tag: "on the record", tone: "iris" },
] as const;

const WAVE = [14, 26, 40, 22, 52, 34, 58, 30, 44, 20, 12];

export default async function HomePage() {
  const user = await getSessionUser().catch(() => null);
  const isTeam = user?.role === "owner" || user?.role === "staff";
  const dashboardHref = isTeam ? "/owner" : user ? "/menu" : "/login?next=/owner";

  return (
    <div className="bg-background">
      {/* ───────────── Hero (always dark) ───────────── */}
      <section className="relative isolate bg-[#0c0c0e] pb-0 text-[#f4f3ef]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 [background-image:radial-gradient(#26262b_1px,transparent_1px)] [background-size:28px_28px] [mask-image:linear-gradient(to_bottom,#000_30%,transparent_95%)]"
        />
        <LandingNav dashboardHref={dashboardHref} signedIn={!!user} />

        <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
          <div className="pb-14 pt-16 text-center sm:pt-24 lg:pt-28">
            <p className="inline-flex h-8 items-center gap-2.5 rounded-full border border-[#33333a] px-3.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#b3b0a8] sm:text-[11px]">
              <span className="size-[7px] rounded-full bg-[#8f80ff] shadow-[0_0_12px_#8f80ff]" aria-hidden />
              An AI operator for restaurants
            </p>
            <h1 className="mx-auto mt-7 max-w-[1100px] text-balance font-display text-[3.25rem] leading-[0.92] sm:text-[5.5rem] lg:text-[7rem] lg:leading-[0.9]">
              Run your restaurant by <span className="text-[#ff7a2e]">talking</span> to it.
            </h1>
            <p className="mx-auto mt-7 max-w-[640px] text-pretty text-[17px] leading-relaxed text-[#b3b0a8] sm:text-xl">
              One AI takes orders from your guests. Another answers your business questions with live numbers. Neither changes a thing until you click Confirm.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link href={dashboardHref} className="inline-flex h-[54px] items-center gap-2 rounded-[14px] bg-[#ff7a2e] px-6 text-base font-semibold text-[#0c0c0e] transition-[filter] hover:brightness-110">
                Open the dashboard <ArrowRight className="size-4" aria-hidden />
              </Link>
              <a href="#capabilities" className="inline-flex h-[54px] items-center gap-2 rounded-[14px] border border-[#33333a] px-6 text-base font-medium transition-colors hover:bg-white/5">
                See what it can do <ArrowDown className="size-4" aria-hidden />
              </a>
            </div>
          </div>

          {/* The "cockpit": live feed · owner conversation · pending change */}
          <div
            aria-label="Preview of the owner dashboard with the AI at work"
            role="img"
            className="relative -mb-24 grid gap-3 rounded-[28px] border border-[#26262b] bg-[#101013] p-3 shadow-[0_60px_120px_-40px_rgb(91_71_245/0.35)] sm:-mb-32 lg:grid-cols-[280px_minmax(0,1fr)_300px]"
          >
            <div className="hidden rounded-[18px] border border-[#26262b] bg-[#141417] p-4 lg:block">
              <p className="flex justify-between font-mono text-[11px] uppercase tracking-[0.14em] text-[#8d8a83]">
                Live feed <span className="text-[#3fcb7e]">● realtime</span>
              </p>
              <ul className="mt-3.5 space-y-2.5">
                {FEED.map((f) => (
                  <li key={f.t} className="flex items-start gap-2.5 text-[13px] leading-snug">
                    <span className={cn("mt-[5px] size-2 shrink-0 rounded-full", f.c)} />
                    <span className="flex-1 text-[#d8d6d0]">{f.t}</span>
                    <span className="font-mono text-[11px] text-[#6e6b65]">{f.at}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-3 rounded-[18px] border border-[#26262b] bg-[#141417] p-4 text-left sm:p-5">
              <p className="self-end rounded-[18px] rounded-br-[4px] bg-[#f4f3ef] px-4 py-2.5 text-[15px] text-[#0c0c0e]">How did this week compare to last week?</p>
              <p className="font-mono text-xs text-[#a99dff]">→ compare_periods(this_week, last_week) · get_top_items · 230 ms</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["Revenue", "▲ 9.4%"],
                  ["Orders", "▲ 21"],
                  ["Avg ticket", "flat"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-[#1c1c20] p-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#8d8a83]">{k}</p>
                    <p className="mt-1.5 font-display text-xl sm:text-2xl">{v}</p>
                  </div>
                ))}
              </div>
              <div className="flex h-28 items-end gap-2.5 border-b border-[#26262b] px-1 pt-2" aria-hidden>
                {HERO_BARS.map(([prev, now], idx) => (
                  <div key={idx} className="flex h-full flex-1 items-end gap-[3px]">
                    <span className="flex-1 rounded-t-[4px] bg-[#33333a]" style={{ height: `${prev}%` }} />
                    <span className={cn("flex-1 rounded-t-[4px]", idx === 2 ? "bg-[#ff7a2e]" : "bg-[#f4f3ef]")} style={{ height: `${now}%` }} />
                  </div>
                ))}
              </div>
              <p className="text-sm leading-relaxed text-[#d8d6d0]">
                Up across the board. The weekend carried it — Sunday alone beat last Sunday by a fifth. One dish grew fastest but picked up two late-delivery complaints.
              </p>
            </div>

            <div className="hidden flex-col gap-3 lg:flex">
              <div className="rounded-[18px] border border-[#ff7a2e] bg-[#141417] p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#ff9a5c]">Waiting for your OK</p>
                <p className="mt-2.5 text-[15px] font-semibold">Mark a dish sold out until tomorrow</p>
                <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-xs">
                  <div className="rounded-[10px] bg-[#1c1c20] px-2.5 py-2 text-[#b3b0a8]">
                    Before
                    <br />
                    <span className="text-[#f4f3ef]">Available</span>
                  </div>
                  <div className="rounded-[10px] bg-[#ff7a2e]/12 px-2.5 py-2 text-[#ff9a5c]">
                    After
                    <br />
                    <span className="text-[#f4f3ef]">Sold out</span>
                  </div>
                </div>
                <div className="mt-3 flex gap-1.5">
                  <span className="flex h-[38px] flex-1 items-center justify-center rounded-xl bg-[#f4f3ef] text-[13px] font-medium text-[#0c0c0e]">Confirm</span>
                  <span className="flex h-[38px] items-center rounded-xl border border-[#33333a] px-3 text-[13px]">Cancel</span>
                </div>
              </div>
              <div className="rounded-[18px] border border-[#26262b] bg-[#141417] p-4 text-[13px]">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#8d8a83]">Kitchen right now</p>
                {[
                  ["Active orders", "7", ""],
                  ["Waiting to accept", "3", "text-[#ff9a5c]"],
                  ["Low on stock", "2 items", ""],
                ].map(([k, v, c]) => (
                  <p key={k} className="mt-2.5 flex justify-between">
                    <span className="text-[#b3b0a8]">{k}</span>
                    <span className={cn("font-mono", c)}>{v}</span>
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── Pillars ───────────── */}
      <section aria-label="What it does" className="pt-36 sm:pt-44">
        <ul className="mx-auto grid max-w-[1240px] border-y px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {PILLARS.map(([t, b], i) => (
            <li key={t} className={cn("py-7 sm:px-6", i > 0 && "border-t sm:border-t-0", i % 2 === 1 && "sm:border-l", i === 2 && "lg:border-l", i === 0 && "sm:pl-0")}>
              <p className="font-mono text-xs text-saffron-ink">{String(i + 1).padStart(2, "0")}</p>
              <p className="mt-2.5 text-[17px] font-semibold">{t}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{b}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ───────────── Ask it anything ───────────── */}
      <section id="capabilities" aria-labelledby="capabilities-title" className="mx-auto max-w-[1240px] scroll-mt-28 px-4 pt-24 sm:px-6 lg:pt-32">
        <AskShowcase />
      </section>

      {/* ───────────── Two agents ───────────── */}
      <section aria-labelledby="two-agents" className="mx-auto max-w-[1240px] px-4 pt-24 sm:px-6 lg:pt-36">
        <p className="eyebrow">Two agents · one kitchen</p>
        <h2 id="two-agents" className="mt-4 max-w-4xl text-balance font-display text-[2.75rem] leading-[0.96] sm:text-[4rem]">
          One talks to your guests. One works for you.
        </h2>
        <div className="mt-11 grid gap-4 lg:grid-cols-2">
          <div className="rounded-[28px] border bg-card p-7 sm:p-9">
            <span className="inline-flex h-7 items-center rounded-full bg-saffron-soft px-3 text-xs font-medium text-saffron-ink">Guest agent</span>
            <h3 className="mt-5 font-display text-3xl leading-[1.05] sm:text-[2.1rem]">A host that never puts anyone on hold.</h3>
            <ul className="mt-6">
              {GUEST.map(([t, tool]) => (
                <li key={t} className="flex items-center justify-between gap-4 border-b py-2.5 text-sm last:border-0">
                  <span>{t}</span>
                  <span className="truncate font-mono text-xs text-muted-foreground">{tool}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[28px] bg-[#14130f] p-7 text-[#f4f3ef] sm:p-9 dark:border dark:bg-card">
            <span className="inline-flex h-7 items-center rounded-full bg-[#8f80ff]/15 px-3 text-xs font-medium text-[#a99dff]">Owner agent</span>
            <h3 className="mt-5 font-display text-3xl leading-[1.05] sm:text-[2.1rem]">An analyst and a manager who answer in seconds.</h3>
            <ul className="mt-6">
              {OWNER.map(([t, tool]) => (
                <li key={t} className="flex items-center justify-between gap-4 border-b border-[#26262b] py-2.5 text-sm last:border-0">
                  <span>{t}</span>
                  <span className="truncate font-mono text-xs text-[#8d8a83]">{tool}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ───────────── Safety ───────────── */}
      <section id="safety" aria-labelledby="safety-title" className="mx-auto max-w-[1240px] scroll-mt-28 px-4 pt-24 sm:px-6 lg:pt-36">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">Confirm-first architecture</p>
            <h2 id="safety-title" className="mt-4 max-w-3xl text-balance font-display text-[2.75rem] leading-[0.96] sm:text-[4rem]">
              Smart enough to act. Built to ask first.
            </h2>
          </div>
          <p className="max-w-sm text-base leading-relaxed text-muted-foreground">The model never writes SQL and never touches money. Every capability is a typed tool that passes the same checkpoints.</p>
        </div>
        <ol className="mt-12 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          {PIPELINE.map((s, i) => (
            <li
              key={s.t}
              className={cn(
                "flex min-h-[190px] flex-col rounded-[20px] border p-5 sm:p-6",
                s.tone === "plain" && "bg-card",
                s.tone === "ink" && "border-foreground bg-foreground text-background",
                s.tone === "iris" && "border-iris-line bg-iris-soft text-iris-ink",
              )}
            >
              <span className="font-mono text-xs opacity-70">{String(i + 1).padStart(2, "0")}</span>
              <span className="mt-3.5 text-lg font-semibold tracking-[-0.01em]">{s.t}</span>
              <span className="mt-2 text-[13px] leading-relaxed opacity-80">{s.b}</span>
              <span className="mt-auto pt-3.5 font-mono text-[11px] opacity-65">{s.tag}</span>
            </li>
          ))}
        </ol>
        <div className="mt-4 grid gap-2.5 md:grid-cols-3">
          {[
            ["The AI never pays", "It prepares checkout; only a human presses Pay. A database rule blocks any payment status change from outside the payment webhook."],
            ["Server-side money math", "Prices, discounts and tax come from one server function — never from the model's arithmetic."],
            ["Everything is on the record", "Who asked, what changed, and when. Ask “show today's changes” any time."],
          ].map(([t, b]) => (
            <div key={t} className="rounded-[20px] border bg-card p-6">
              <p className="text-base font-semibold">{t}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────── Voice ───────────── */}
      <section id="voice" aria-labelledby="voice-title" className="mt-24 scroll-mt-28 bg-[#0c0c0e] text-[#f4f3ef] lg:mt-36">
        <div className="mx-auto grid max-w-[1240px] items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-32">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#8d8a83]">Jarvis · voice mode</p>
            <h2 id="voice-title" className="mt-4 font-display text-[3rem] leading-[0.94] sm:text-[4.5rem]">
              Hands full?
              <br />
              Just say it.
            </h2>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-[#b3b0a8]">
              Talk to your restaurant from the pass. Jarvis reads back what it heard, shows the answer on screen, and waits for your “yes” before it changes anything.
            </p>
            <div className="mt-8 flex max-w-md flex-col gap-2.5">
              {["“How many orders are waiting?”", "“Accept the oldest one with twenty-five minutes.”"].map((l) => (
                <p key={l} className="rounded-[16px] border border-[#26262b] bg-[#141417] px-4 py-3.5 text-[15px]">
                  {l}
                </p>
              ))}
              <p className="rounded-[16px] border border-[#26262b] bg-[#141417] px-4 py-3.5 text-[15px] text-[#a99dff]">“Done — order accepted.”</p>
            </div>
          </div>
          <div aria-hidden className="relative mx-auto flex size-[300px] items-center justify-center sm:size-[440px]">
            <span className="absolute inset-0 rounded-full border border-[#1f1f24]" />
            <span className="absolute inset-[9%] rounded-full border border-[#26262b]" />
            <span className="absolute inset-[18%] rounded-full border-[1.5px] border-[#8f80ff]/45" />
            <span className="absolute inset-[27%] rounded-full bg-[radial-gradient(circle_at_35%_30%,#a79bff_0%,#5b47f5_45%,#1a1442_100%)] shadow-[0_0_100px_rgb(91_71_245/0.5)]" />
            <span className="absolute right-[33%] top-[26%] size-3.5 rounded-full bg-[#ff7a2e] shadow-[0_0_24px_#ff7a2e]" />
            <span className="relative flex h-14 items-center gap-[5px]">
              {WAVE.map((h, i) => (
                <span key={i} className="w-[5px] rounded-full bg-white" style={{ height: h }} />
              ))}
            </span>
          </div>
        </div>
      </section>

      {/* ───────────── Autopilot ───────────── */}
      <section id="autopilot" aria-labelledby="autopilot-title" className="mx-auto max-w-[1240px] scroll-mt-28 px-4 pt-24 sm:px-6 lg:pt-36">
        <p className="eyebrow">Autopilot</p>
        <h2 id="autopilot-title" className="mt-4 max-w-3xl text-balance font-display text-[2.75rem] leading-[0.96] sm:text-[4rem]">
          It keeps working after you close.
        </h2>
        <div className="mt-11 grid gap-4 lg:grid-cols-3">
          <div className="rounded-[24px] border bg-card p-7">
            <p className="font-mono text-xs text-muted-foreground">Every morning</p>
            <p className="mt-3 text-xl font-semibold">A brief of yesterday</p>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">Revenue, best sellers, complaints and stock — waiting at the top of your dashboard.</p>
            <p className="mt-5 rounded-[14px] bg-iris-soft p-3.5 text-[13px] leading-relaxed text-iris-ink">
              Revenue up on the day. Best seller held. Two complaints about late delivery. One ingredient below reorder level.
            </p>
          </div>
          <div className="rounded-[24px] border bg-card p-7">
            <p className="font-mono text-xs text-muted-foreground">All day</p>
            <p className="mt-3 text-xl font-semibold">Alerts before it hurts</p>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">Low stock, orders waiting too long, bad reviews — and a chime for every new paid order.</p>
            <div className="mt-5 space-y-2 text-[13px]">
              <p className="rounded-xl bg-saffron-soft px-3 py-2.5 text-saffron-ink">Batter below reorder level</p>
              <p className="rounded-xl bg-destructive/10 px-3 py-2.5 text-destructive">Order waiting 6 minutes</p>
            </div>
          </div>
          <div className="rounded-[24px] border bg-card p-7">
            <p className="font-mono text-xs text-muted-foreground">In the background</p>
            <p className="mt-3 text-xl font-semibold">Loose ends, tied up</p>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">Unpaid orders expire on their own. Reports export to PDF or CSV. Campaign emails go only to guests who opted in.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["expire-unpaid", "daily-summary", "alerts"].map((j) => (
                <span key={j} className="rounded-lg bg-muted px-2.5 py-1.5 font-mono text-xs">
                  {j}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── Closing CTA ───────────── */}
      <section aria-labelledby="cta-title" className="mx-auto max-w-[1240px] px-4 pb-6 pt-24 sm:px-6 lg:pt-36">
        <div className="flex flex-wrap items-end justify-between gap-10 rounded-[36px] bg-[#ff7a2e] px-7 py-14 text-[#0c0c0e] sm:px-14 sm:py-20">
          <h2 id="cta-title" className="max-w-3xl font-display text-[3.25rem] leading-[0.9] sm:text-[6.5rem] sm:leading-[0.88]">
            Stop clicking.
            <br />
            Start asking.
          </h2>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[260px]">
            <Link href={dashboardHref} className="inline-flex h-14 items-center justify-center gap-2 rounded-[14px] bg-[#0c0c0e] px-6 text-base font-medium text-[#f4f3ef] transition-colors hover:bg-black">
              Open the dashboard <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link href="/menu" className="inline-flex h-14 items-center justify-center rounded-[14px] border border-[#0c0c0e]/30 px-6 text-base font-medium transition-colors hover:bg-black/5">
              Try the guest AI
            </Link>
          </div>
        </div>
      </section>

      {/* ───────────── One-line footer ───────────── */}
      <footer className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-4 px-4 pb-8 pt-6 sm:px-6">
        <span className="flex items-center gap-2.5">
          <LogoMark className="size-6" />
          <span className="font-mono text-xs text-muted-foreground">
            © {new Date().getFullYear()} {BRAND.name}
          </span>
        </span>
        <nav aria-label="Footer" className="flex gap-5 text-[13px] text-muted-foreground">
          <Link href="/login" className="hover:text-foreground">
            Log in
          </Link>
          <Link href="/menu" className="hover:text-foreground">
            Guest site
          </Link>
          <Link href="/contact" className="hover:text-foreground">
            Contact
          </Link>
        </nav>
      </footer>
    </div>
  );
}
