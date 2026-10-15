"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, LayoutDashboard, LogOut, Menu as MenuIcon, ShoppingBag, Sparkles, User, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useCart } from "@/components/providers/CartProvider";
import { useSession } from "@/components/providers/SessionProvider";
import { signOutAction } from "@/app/actions/auth";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "./Logo";
import { openChat } from "./chat-events";

const NAV = [
  { href: "/menu", label: "Menu" },
  { href: "/reservations", label: "Book a table" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function Header({ statusLabel, isOpen }: { statusLabel: string; isOpen: boolean }) {
  const { count } = useCart();
  const session = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile sheet on navigation and lock page scroll while it's open.
  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!userOpen) return;
    const close = (e: MouseEvent) => {
      if (!userRef.current?.contains(e.target as Node)) setUserOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setUserOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [userOpen]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-[background-color,border-color,box-shadow] duration-300",
        scrolled || mobileOpen ? "border-b bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70" : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:h-[72px] sm:px-6">
        <Link href="/" className="min-w-0" aria-label="Agentic Dish — home">
          <Logo markClassName="size-7 sm:size-8" />
        </Link>

        <nav aria-label="Main" className="ml-6 hidden items-center gap-1 md:flex">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn("rounded-full px-3.5 py-2 text-sm transition-colors", active ? "bg-foreground/[0.06] font-medium" : "text-muted-foreground hover:text-foreground")}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <span className="mr-2 hidden items-center gap-2 text-xs text-muted-foreground xl:flex">
            <span className={cn("relative flex size-2")} aria-hidden>
              {isOpen && <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />}
              <span className={cn("relative inline-flex size-2 rounded-full", isOpen ? "bg-success" : "bg-destructive")} />
            </span>
            {statusLabel}
          </span>
          <Button variant="ghost" size="sm" className="hidden h-9 sm:inline-flex" onClick={() => openChat()}>
            <Sparkles className="text-primary" /> Ask AI
          </Button>
          <ThemeToggle />
          <Link
            href="/cart"
            className={cn(buttonVariants({ variant: count > 0 ? "dark" : "ghost", size: count > 0 ? "sm" : "icon" }), count > 0 && "h-9 gap-1.5 px-3")}
            aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
          >
            <ShoppingBag />
            {count > 0 && (
              <span data-testid="cart-count" className="tabular-nums">
                {count}
              </span>
            )}
          </Link>
          {session ? (
            <div className="relative" ref={userRef}>
              <Button variant="ghost" size="icon" aria-label="Account menu" aria-haspopup="menu" aria-expanded={userOpen} onClick={() => setUserOpen((o) => !o)}>
                <User />
              </Button>
              {userOpen && (
                <div role="menu" className="absolute right-0 mt-2 w-60 animate-rise rounded-2xl border bg-popover p-1.5 shadow-xl" onClick={() => setUserOpen(false)}>
                  <p className="truncate px-3 pb-2 pt-1.5 text-xs text-muted-foreground">{session.name ?? session.email}</p>
                  {(session.role === "owner" || session.role === "staff") && (
                    <Link role="menuitem" href="/owner" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium hover:bg-accent">
                      <LayoutDashboard className="size-4 text-primary" /> Dashboard
                    </Link>
                  )}
                  {[
                    ["/orders", "My orders"],
                    ["/reservations", "Reservations"],
                    ["/favorites", "Favourites"],
                    ["/profile", "Profile"],
                  ].map(([href, label]) => (
                    <Link role="menuitem" key={href} href={href} className="block rounded-xl px-3 py-2 text-sm hover:bg-accent">
                      {label}
                    </Link>
                  ))}
                  <div className="my-1 border-t" />
                  <form action={signOutAction}>
                    <button role="menuitem" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
                      <LogOut className="size-4" /> Log out
                    </button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={cn(buttonVariants({ size: "sm" }), "ml-1 hidden h-9 sm:inline-flex")}>
              Log in
            </Link>
          )}
          <Button variant="ghost" size="icon" className="md:hidden" aria-label={mobileOpen ? "Close menu" : "Open menu"} aria-expanded={mobileOpen} onClick={() => setMobileOpen((o) => !o)}>
            {mobileOpen ? <X /> : <MenuIcon />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <nav aria-label="Mobile" className="fixed inset-x-0 bottom-0 top-16 z-40 flex animate-fade flex-col overflow-y-auto bg-background px-6 pb-8 pt-4 md:hidden">
          <p className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn("size-2 rounded-full", isOpen ? "bg-success" : "bg-destructive")} aria-hidden /> {statusLabel}
          </p>
          {NAV.map((n, i) => (
            <Link
              key={n.href}
              href={n.href}
              style={{ animationDelay: `${i * 40}ms` }}
              className="flex animate-rise items-center justify-between border-b py-4 font-display text-3xl"
            >
              {n.label} <ArrowRight className="size-5 text-muted-foreground" />
            </Link>
          ))}
          <div className="mt-8 grid gap-3">
            <Button
              size="lg"
              onClick={() => {
                setMobileOpen(false);
                openChat();
              }}
            >
              <Sparkles /> Order with our AI host
            </Button>
            {!session && (
              <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
                Log in
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
