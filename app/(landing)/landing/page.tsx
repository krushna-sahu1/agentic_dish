import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LiveOrder } from "@/components/landing/LiveOrder";
import { Logo } from "@/components/site/Logo";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { buttonVariants } from "@/components/ui/button";
import { BRAND } from "@/lib/business";
import { LANDING } from "@/lib/landing";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: { absolute: LANDING.title },
  description: LANDING.description,
  alternates: { canonical: "/landing" },
  openGraph: { type: "website", url: "/landing", siteName: BRAND.name, title: LANDING.title, description: LANDING.description },
};

const wrap = "mx-auto max-w-7xl px-4 sm:px-6";
const h2 = "text-balance font-display text-4xl sm:text-5xl lg:text-6xl";

function Cta({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      <Link href="/" className={buttonVariants({ size: "lg" })}>
        Try the demo restaurant <ArrowRight aria-hidden />
      </Link>
      {LANDING.demoUrl ? (
        <a href={LANDING.demoUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Book a demo
        </a>
      ) : (
        <Link href="/login?next=/owner" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Open the dashboard
        </Link>
      )}
    </div>
  );
}

/** The page that sells the product to restaurant owners. Static; all copy is in lib/landing.ts. */
export default function LandingPage() {
  const { hero, day, confirm, limits, own, faq, closing } = LANDING;
  return (
    <>
      <header className={cn(wrap, "flex h-16 items-center gap-6 sm:h-[72px]")}>
        <Link href="/landing" aria-label={`${BRAND.name} for restaurants`}>
          <Logo />
        </Link>
        <nav aria-label="Main" className="ml-auto hidden gap-6 text-sm text-muted-foreground md:flex">
          <a href="#day" className="hover:text-foreground">A day with it</a>
          <a href="#confirm" className="hover:text-foreground">Approvals</a>
          <a href="#limits" className="hover:text-foreground">Limits</a>
          <a href="#faq" className="hover:text-foreground">Questions</a>
        </nav>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <ThemeToggle />
          <Link href="/login?next=/owner" className={buttonVariants({ size: "sm", className: "h-9" })}>
            Owner login
          </Link>
        </div>
      </header>

      <main id="main">
        <section className={cn(wrap, "grid gap-12 pb-20 pt-8 sm:pt-14 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-16 lg:pb-28")}>
          <div>
            <h1 className="text-balance font-display text-[3.25rem] sm:text-7xl lg:text-[5.25rem]">{hero.title}</h1>
            <p className="mt-6 max-w-lg text-pretty text-lg leading-relaxed text-muted-foreground">{hero.body}</p>
            <Cta className="mt-8" />
          </div>
          <LiveOrder />
        </section>

        <section id="day" className="scroll-mt-8 border-y bg-card">
          <div className={cn(wrap, "py-20 lg:py-28")}>
            <h2 className={h2}>{day.title}</h2>
            <ol className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {day.moments.map((m) => (
                <li key={m.time} className="border-t-2 border-primary pt-4">
                  <p className="font-display text-3xl tabular-nums text-primary">{m.time}</p>
                  <h3 className="mt-3 text-lg font-semibold">{m.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{m.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="confirm" className={cn(wrap, "grid scroll-mt-8 gap-12 py-20 lg:grid-cols-2 lg:items-center lg:gap-20 lg:py-28")}>
          <div>
            <h2 className={h2}>{confirm.title}</h2>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">{confirm.body}</p>
          </div>
          <figure className="rounded-2xl border bg-card p-5 sm:p-6">
            <p className="ml-auto w-fit rounded-2xl rounded-br-sm bg-secondary px-4 py-2.5 text-[15px]">{confirm.example.ask}</p>
            <div className="mt-5 overflow-hidden rounded-xl border">
              <p className="border-b px-4 py-3 font-semibold">{confirm.example.heading}</p>
              <table className="w-full text-[15px]">
                <thead className="text-left text-sm text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Dish</th>
                    <th className="px-4 py-2 text-right font-medium">Before</th>
                    <th className="px-4 py-2 text-right font-medium">After</th>
                  </tr>
                </thead>
                <tbody>
                  {confirm.example.rows.map(([dish, before, after]) => (
                    <tr key={dish} className="border-t">
                      <td className="px-4 py-2.5">{dish}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground line-through">{before}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div aria-hidden className="mt-4 flex gap-2">
              <span className={buttonVariants({ className: "pointer-events-none" })}>Confirm</span>
              <span className={buttonVariants({ variant: "outline", className: "pointer-events-none" })}>Cancel</span>
            </div>
            <figcaption className="sr-only">Example of a proposed price change waiting for the owner to confirm.</figcaption>
          </figure>
        </section>

        <section id="limits" className="scroll-mt-8 bg-leaf text-leaf-foreground">
          <div className={cn(wrap, "py-20 lg:py-28")}>
            <h2 className={cn(h2, "text-turmeric")}>{limits.title}</h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed opacity-85">{limits.body}</p>
            <dl className="mt-12 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
              {limits.items.map((i) => (
                <div key={i.title}>
                  <dt className="text-lg font-semibold">{i.title}</dt>
                  <dd className="mt-1.5 text-[15px] leading-relaxed opacity-80">{i.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className={cn(wrap, "py-20 lg:py-28")} aria-labelledby="own">
          <h2 id="own" className={h2}>{own.title}</h2>
          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-[15px]">
              <thead className="text-left text-sm text-muted-foreground">
                <tr>
                  <th className="w-36 py-3 font-medium"><span className="sr-only">What</span></th>
                  <th className="py-3 pr-6 font-medium">On a marketplace</th>
                  <th className="py-3 font-medium">With {BRAND.name}</th>
                </tr>
              </thead>
              <tbody>
                {own.rows.map(([what, theirs, yours]) => (
                  <tr key={what} className="border-t">
                    <th scope="row" className="py-4 pr-4 text-left font-semibold">{what}</th>
                    <td className="py-4 pr-6 text-muted-foreground">{theirs}</td>
                    <td className="py-4">{yours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="faq" className="scroll-mt-8 border-t">
          <div className={cn(wrap, "grid gap-10 py-20 lg:grid-cols-[1fr_1.6fr] lg:py-28")}>
            <h2 className={h2}>{faq.title}</h2>
            <div className="divide-y border-y">
              {faq.items.map((f) => (
                <details key={f.q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span aria-hidden className="text-2xl font-normal text-muted-foreground transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t bg-card">
          <div className={cn(wrap, "py-20 lg:py-28")}>
            <h2 className={cn(h2, "max-w-3xl")}>{closing.title}</h2>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">{closing.body}</p>
            <Cta className="mt-8" />
          </div>
        </section>
      </main>

      <footer className={cn(wrap, "flex flex-wrap items-center justify-between gap-3 border-t py-8 text-sm text-muted-foreground")}>
        <p>© {new Date().getFullYear()} {BRAND.name}</p>
        <p>Payments are processed by Razorpay. The AI never handles them.</p>
      </footer>
    </>
  );
}
