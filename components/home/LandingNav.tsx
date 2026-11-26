"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu as MenuIcon, X } from "lucide-react";
import { LogoMark } from "@/components/site/Logo";
import { BRAND } from "@/lib/business";
import { cn } from "@/lib/utils";

const LINKS = [
  ["#capabilities", "Capabilities"],
  ["#safety", "Safety"],
  ["#voice", "Voice"],
  ["#autopilot", "Autopilot"],
] as const;

/** Floating dark nav for the owner-facing landing page. */
export function LandingNav({ dashboardHref, signedIn }: { dashboardHref: string; signedIn: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="sticky top-0 z-40 px-4 pt-4 sm:px-6">
      <nav
        aria-label="Main"
        className="mx-auto flex h-[60px] max-w-[1240px] items-center gap-3 rounded-[18px] border border-[#26262b] bg-[#141417]/85 pl-4 pr-2 text-[#f4f3ef] backdrop-blur-xl"
      >
        <Link href="/" className="flex items-center gap-2.5" aria-label={`${BRAND.name} — home`}>
          <LogoMark className="size-[30px]" inverted />
          <span className="whitespace-nowrap font-display text-[19px] leading-none">{BRAND.name}</span>
        </Link>
        <div className="ml-5 hidden items-center gap-0.5 md:flex">
          {LINKS.map(([href, label]) => (
            <a key={href} href={href} className="rounded-full px-3 py-2 text-sm text-[#b3b0a8] transition-colors hover:text-[#f4f3ef]">
              {label}
            </a>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!signedIn && (
            <Link href="/login" className="hidden h-[42px] items-center rounded-xl border border-[#33333a] px-4 text-sm font-medium transition-colors hover:bg-white/5 sm:inline-flex">
              Log in
            </Link>
          )}
          <Link href={dashboardHref} className="inline-flex h-[42px] items-center rounded-xl bg-[#f4f3ef] px-4 text-sm font-medium text-[#0c0c0e] transition-colors hover:bg-white">
            {signedIn ? "Open dashboard" : "Get started"}
          </Link>
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-xl border border-[#33333a] md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-5" /> : <MenuIcon className="size-5" />}
          </button>
        </div>
      </nav>

      <div
        className={cn(
          "fixed inset-x-0 bottom-0 top-[88px] z-40 flex-col gap-1 bg-[#0c0c0e] px-6 pt-4 text-[#f4f3ef] md:hidden",
          open ? "flex animate-fade" : "hidden",
        )}
      >
        {LINKS.map(([href, label]) => (
          <a key={href} href={href} onClick={() => setOpen(false)} className="border-b border-[#26262b] py-4 font-display text-3xl">
            {label}
          </a>
        ))}
        {!signedIn && (
          <Link href="/login" className="mt-6 flex h-12 items-center justify-center rounded-[14px] border border-[#33333a] font-medium">
            Log in
          </Link>
        )}
      </div>
    </div>
  );
}
