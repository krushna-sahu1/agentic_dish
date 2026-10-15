import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/site/Logo";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Link href="/" aria-label="Home">
        <Logo />
      </Link>
      <p className="mt-16 font-display text-8xl leading-none text-primary">404</p>
      <h1 className="mt-4 font-display text-4xl">This page isn&apos;t on the menu.</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">The link may be broken or the page may have moved.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonVariants()}>
          Back home
        </Link>
        <Link href="/menu" className={buttonVariants({ variant: "outline" })}>
          Browse the menu
        </Link>
      </div>
    </main>
  );
}
