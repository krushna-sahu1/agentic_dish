"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChefHat, LayoutDashboard, LogOut, Menu as MenuIcon, ShoppingBag, Sparkles, User, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/components/providers/CartProvider";
import { useSession } from "@/components/providers/SessionProvider";
import { signOutAction } from "@/app/actions/auth";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { openChat } from "./chat-events";

const NAV = [
  { href: "/menu", label: "Menu" },
  { href: "/reservations", label: "Book a table" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function Header({ name, statusLabel, isOpen }: { name: string; statusLabel: string; isOpen: boolean }) {
  const { count } = useCart();
  const session = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

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
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex min-w-0 items-center gap-2 font-display text-lg font-semibold">
          <ChefHat className="size-6 shrink-0 text-primary" aria-hidden />
          <span className="truncate">{name}</span>
        </Link>
        <Badge variant={isOpen ? "success" : "destructive"} className="hidden lg:inline-flex">
          <span className={cn("size-1.5 rounded-full", isOpen ? "bg-success" : "bg-destructive")} aria-hidden />
          {statusLabel}
        </Badge>
        <nav aria-label="Main" className="ml-auto hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), pathname.startsWith(n.href) && "bg-accent")}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 md:ml-2">
          <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => openChat()}>
            <Sparkles /> Ask AI
          </Button>
          <ThemeToggle />
          <Link
            href="/cart"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative")}
            aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
          >
            <ShoppingBag />
            {count > 0 && (
              <span
                data-testid="cart-count"
                className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground"
              >
                {count}
              </span>
            )}
          </Link>
          {session ? (
            <div className="relative" ref={userRef}>
              <Button variant="ghost" size="icon" aria-label="Account menu" aria-expanded={userOpen} onClick={() => setUserOpen((o) => !o)}>
                <User />
              </Button>
              {userOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border bg-popover p-1 shadow-lg" onClick={() => setUserOpen(false)}>
                  <p className="truncate px-3 py-2 text-xs text-muted-foreground">{session.name ?? session.email}</p>
                  {(session.role === "owner" || session.role === "staff") && (
                    <Link href="/owner" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent">
                      <LayoutDashboard className="size-4" /> Owner assistant
                    </Link>
                  )}
                  {[
                    ["/orders", "My orders"],
                    ["/reservations", "Reservations"],
                    ["/favorites", "Favourites"],
                    ["/profile", "Profile"],
                  ].map(([href, label]) => (
                    <Link key={href} href={href} className="block rounded-lg px-3 py-2 text-sm hover:bg-accent">
                      {label}
                    </Link>
                  ))}
                  <form action={signOutAction}>
                    <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent">
                      <LogOut className="size-4" /> Log out
                    </button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={buttonVariants({ size: "sm" })}>
              Log in
            </Link>
          )}
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" aria-expanded={mobileOpen} onClick={() => setMobileOpen((o) => !o)}>
            {mobileOpen ? <X /> : <MenuIcon />}
          </Button>
        </div>
      </div>
      {mobileOpen && (
        <nav aria-label="Mobile" className="border-t px-4 py-2 md:hidden" onClick={() => setMobileOpen(false)}>
          <p className="px-3 py-2 text-xs text-muted-foreground">{statusLabel}</p>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="block rounded-lg px-3 py-2.5 text-sm hover:bg-accent">
              {n.label}
            </Link>
          ))}
          <button className="block w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-accent" onClick={() => openChat()}>
            Ask our AI
          </button>
        </nav>
      )}
    </header>
  );
}
