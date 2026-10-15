"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { DashboardPage } from "@/components/owner/Page";

export default function OwnerError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <DashboardPage>
      <ErrorState
        title="This page didn’t load"
        description="Something went wrong on our side — usually a brief database or network hiccup. Your data is safe. Try again, or head back to the overview."
      >
        <Button onClick={reset}>Try again</Button>
        <Link href="/owner" className={buttonVariants({ variant: "outline" })}>
          Back to overview
        </Link>
      </ErrorState>
      {error.digest && <p className="mt-3 text-center text-xs text-muted-foreground">Reference: {error.digest}</p>}
    </DashboardPage>
  );
}
