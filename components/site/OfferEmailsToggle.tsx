"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setOfferEmailsAction } from "@/app/actions/email";

/** Profile: "Email me offers and updates" (bulk emails from the restaurant). */
export function OfferEmailsToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        className="mt-0.5 accent-[var(--primary)]"
        checked={on}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          setOn(next);
          start(async () => {
            const r = await setOfferEmailsAction(next);
            if (!r.ok) {
              setOn(!next);
              toast.error(r.error);
            } else toast.success(next ? "You'll get our offers by email." : "No more offer emails.");
          });
        }}
      />
      <span>
        <span className="font-medium">Email me offers and updates</span>
        <span className="block text-xs text-muted-foreground">Occasional discounts and news. Order emails are always sent.</span>
      </span>
    </label>
  );
}
