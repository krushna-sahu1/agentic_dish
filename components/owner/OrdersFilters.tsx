"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RANGE_FILTERS, STATUS_FILTERS } from "./order-filters";

/** URL-driven filters for the orders table (status, date range, search). */
export function OrdersFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  // Debounced search.
  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    const t = setTimeout(() => set({ q }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const filtered = !!(params.get("status") || params.get("q") || (params.get("range") && params.get("range") !== "last_7_days"));

  return (
    <div className="flex flex-wrap items-center gap-2 px-5 pb-4">
      <div className="relative min-w-48 flex-1 sm:max-w-72">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input className="pl-9" placeholder="Order # or customer" aria-label="Search orders" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Select aria-label="Filter by status" className="w-auto" value={params.get("status") ?? ""} onChange={(e) => set({ status: e.target.value })}>
        {STATUS_FILTERS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </Select>
      <Select aria-label="Date range" className="w-auto" value={params.get("range") ?? "last_7_days"} onChange={(e) => set({ range: e.target.value })}>
        {RANGE_FILTERS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </Select>
      {filtered && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            set({ status: "", q: "", range: "" });
          }}
        >
          <X /> Clear
        </Button>
      )}
      <Loader2 className={cn("size-4 animate-spin text-muted-foreground transition-opacity", pending ? "opacity-100" : "opacity-0")} aria-hidden />
    </div>
  );
}
