"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unsubscribeAction } from "@/app/actions/email";

export function UnsubscribeButton({ e, t }: { e: string; t: string }) {
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  const [pending, start] = useTransition();
  if (state === "done")
    return (
      <p role="status" className="mt-6 inline-flex items-center gap-2 font-medium text-success">
        <CheckCircle2 className="size-5" /> You&apos;re unsubscribed. We won&apos;t send you offers again.
      </p>
    );
  return (
    <div className="mt-6 space-y-2">
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await unsubscribeAction(e, t);
            setState(r.ok ? "done" : "error");
          })
        }
      >
        {pending && <Loader2 className="animate-spin" />} Unsubscribe
      </Button>
      {state === "error" && <p role="alert" className="text-sm text-destructive">That didn&apos;t work — the link may be invalid.</p>}
    </div>
  );
}
