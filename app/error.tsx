"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <main id="main" className="mx-auto flex min-h-[70dvh] max-w-2xl items-center px-4 py-16">
      <ErrorState
        className="w-full"
        title="Something went wrong"
        description="We couldn’t load this page. It’s usually a brief connection hiccup — your cart and orders are safe."
      >
        <Button onClick={reset}>Try again</Button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Go home
        </Link>
      </ErrorState>
    </main>
  );
}
