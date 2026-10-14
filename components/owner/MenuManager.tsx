"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { executeOwnerChange } from "@/app/actions/owner";
import type { OwnerChangeSchemaName } from "@/lib/agents/owner/change-schemas";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChangeDialog } from "./ChangeDialog";

interface Row {
  id: string;
  name: string;
  category: string;
  price_paise: number;
  is_available: boolean;
  stock_qty: number | null;
  low_stock_threshold: number;
  sold_30d: number;
}
interface Inv {
  id: string;
  name: string;
  unit: string;
  qty: number;
  low_threshold: number;
  is_low: boolean;
}

export function MenuManager({ items, inventory, role }: { items: Row[]; inventory: Inv[]; role: "owner" | "staff" }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const [change, setChange] = useState<{ name: OwnerChangeSchemaName; args: Record<string, unknown>; title: string } | null>(null);
  const filtered = useMemo(() => items.filter((i) => `${i.name} ${i.category}`.toLowerCase().includes(q.toLowerCase())), [items, q]);

  const run = (name: OwnerChangeSchemaName, args: Record<string, unknown>) =>
    start(async () => {
      const r = await executeOwnerChange(name, args);
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.data.message);
      router.refresh();
    });

  return (
    <div className="space-y-8 overflow-y-auto pb-8">
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-display text-2xl font-semibold">Menu & stock</h1>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="Filter dishes" aria-label="Filter dishes" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs">
              <tr>
                <th className="px-3 py-2">Dish</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2">Available</th>
                <th className="px-3 py-2">Portions left</th>
                <th className="px-3 py-2 text-right">Sold 30d</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id} className={cn("border-t", !i.is_available && "bg-destructive/5")} data-testid="menu-row" data-dish={i.name}>
                  <td className="px-3 py-2 font-medium">{i.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{i.category}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatINR(i.price_paise)}
                    {role === "owner" && (
                      <Button variant="ghost" size="icon" className="ml-1 size-7" aria-label={`Edit ${i.name}`} onClick={() => setChange({ name: "update_menu_item", args: { item_ref: i.id, price_paise: i.price_paise }, title: `Edit ${i.name}` })}>
                        <Pencil />
                      </Button>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <input type="checkbox" role="switch" className="size-4 accent-[var(--primary)]" checked={i.is_available} disabled={pending} onChange={(e) => run("set_item_availability", { item_ref: i.id, is_available: e.target.checked })} aria-label={`${i.name} available`} />
                      <span className={cn("text-xs", i.is_available ? "text-success" : "text-destructive")}>{i.is_available ? "On" : "Sold out"}</span>
                    </label>
                  </td>
                  <td className="px-3 py-2">
                    <form
                      className="flex items-center gap-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const v = new FormData(e.currentTarget).get("stock") as string;
                        run("update_stock", { item_ref: i.id, stock_qty: v === "" ? null : Number(v) });
                      }}
                    >
                      <Input name="stock" type="number" min={0} className={cn("h-8 w-20", i.stock_qty !== null && i.stock_qty <= i.low_stock_threshold && "border-amber-500")} defaultValue={i.stock_qty ?? ""} placeholder="∞" aria-label={`${i.name} portions left`} />
                      <Button size="sm" variant="outline" className="h-8" disabled={pending}>Save</Button>
                    </form>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{i.sold_30d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {role === "owner" && <p className="mt-2 text-xs text-muted-foreground">Tip: ask the assistant for bigger edits — &ldquo;increase all dosa prices by 10%&rdquo;, &ldquo;add a new dish&rdquo;, &ldquo;set pairings for dalma&rdquo;.</p>}
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Inventory</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {inventory.map((inv) => (
            <form
              key={inv.id}
              className={cn("flex items-center gap-2 rounded-xl border bg-card p-2.5 text-sm", inv.is_low && "border-amber-500/60 bg-amber-500/5")}
              onSubmit={(e) => {
                e.preventDefault();
                run("update_inventory", { inventory_ref: inv.id, qty: Number(new FormData(e.currentTarget).get("qty")) });
              }}
            >
              <span className="flex-1">
                {inv.name}
                {inv.is_low && <span className="ml-1 text-xs text-amber-700 dark:text-amber-300">low</span>}
                <span className="block text-xs text-muted-foreground">low at {inv.low_threshold} {inv.unit}</span>
              </span>
              <Input name="qty" type="number" step="0.1" min={0} className="h-8 w-20" defaultValue={inv.qty} aria-label={`${inv.name} quantity in ${inv.unit}`} />
              <span className="w-6 text-xs text-muted-foreground">{inv.unit}</span>
              <Button size="sm" variant="outline" className="h-8" disabled={pending}>Save</Button>
            </form>
          ))}
        </div>
      </section>

      <ChangeDialog change={change} onClose={(applied) => { setChange(null); if (applied) router.refresh(); }} />
    </div>
  );
}
