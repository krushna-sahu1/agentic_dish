"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Package, Pencil, Plus, Search, SearchX, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import { DishImage } from "@/components/site/DishImage";
import { VegMark } from "@/components/site/Markers";
import { executeOwnerChange } from "@/app/actions/owner";
import type { OwnerChangeSchemaName } from "@/lib/agents/owner/change-schemas";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "./Page";
import { DishFormDialog, emptyDish, type DishFormValue } from "./DishFormDialog";

export interface MenuRow {
  id: string;
  name: string;
  slug: string;
  category: string;
  category_slug: string;
  description: string;
  image_url: string | null;
  price_paise: number;
  is_veg: boolean;
  spice_level: number;
  tags: string[];
  prep_time_min: number;
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

export function MenuManager({ items, inventory, categories, role }: { items: MenuRow[]; inventory: Inv[]; categories: { slug: string; name: string }[]; role: "owner" | "staff" }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [availability, setAvailability] = useState<"" | "on" | "off">("");
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState<DishFormValue | null>(null);
  const [toDelete, setToDelete] = useState<MenuRow | null>(null);
  const isOwner = role === "owner";

  const filtered = useMemo(
    () =>
      items.filter(
        (i) =>
          `${i.name} ${i.category}`.toLowerCase().includes(q.toLowerCase()) &&
          (!cat || i.category_slug === cat) &&
          (!availability || (availability === "on" ? i.is_available : !i.is_available)),
      ),
    [items, q, cat, availability],
  );
  const soldOut = items.filter((i) => !i.is_available).length;

  const run = (name: OwnerChangeSchemaName, args: Record<string, unknown>, id?: string, after?: () => void) => {
    setBusyId(id ?? null);
    start(async () => {
      const r = await executeOwnerChange(name, args);
      setBusyId(null);
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.data.message);
      after?.();
      router.refresh();
    });
  };

  return (
    <div className="space-y-10">
      <PageHeader
        title="Menu"
        description={`${items.length} dishes · ${soldOut} sold out`}
        actions={
          isOwner && (
            <Button onClick={() => setForm(emptyDish(cat || categories[0]?.slug || ""))} disabled={!categories.length}>
              <Plus /> Add dish
            </Button>
          )
        }
      />

      <section className="overflow-hidden rounded-2xl border bg-card" aria-label="Dishes">
        <div className="flex flex-wrap items-center gap-2 p-4">
          <div className="relative min-w-48 flex-1 sm:max-w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input className="pl-9" placeholder="Search dishes" aria-label="Filter dishes" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select aria-label="Category" className="w-auto" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select aria-label="Availability" className="w-auto" value={availability} onChange={(e) => setAvailability(e.target.value as typeof availability)}>
            <option value="">Any availability</option>
            <option value="on">Available</option>
            <option value="off">Sold out</option>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={SearchX} title={items.length ? "No dishes match" : "Your menu is empty"} description={items.length ? "Try another search or category." : "Add your first dish to start taking orders."} className="mx-4 mb-4">
            {!items.length && isOwner && (
              <Button onClick={() => setForm(emptyDish(categories[0]?.slug ?? ""))}>
                <Plus /> Add dish
              </Button>
            )}
          </EmptyState>
        ) : (
          <ul className="divide-y border-t">
            {filtered.map((i) => {
              const low = i.stock_qty !== null && i.stock_qty <= i.low_stock_threshold;
              return (
                <li
                  key={i.id}
                  data-testid="menu-row"
                  data-dish={i.name}
                  className={cn("grid grid-cols-[56px_1fr_auto] items-center gap-x-4 gap-y-3 px-4 py-3 md:grid-cols-[56px_minmax(0,1.6fr)_110px_130px_150px_auto]", !i.is_available && "bg-destructive/[0.03]")}
                >
                  <DishImage src={i.image_url} alt="" className={cn("size-14 rounded-xl", !i.is_available && "grayscale")} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium">
                      <VegMark veg={i.is_veg} /> <span className="truncate">{i.name}</span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {i.category} · {i.sold_30d} sold in 30d
                    </p>
                  </div>
                  <p className="text-right font-medium tabular-nums md:text-left">{formatINR(i.price_paise)}</p>

                  <div className="col-span-3 flex flex-wrap items-center gap-x-3 gap-y-2 md:contents">
                  <label className="mr-auto inline-flex cursor-pointer items-center gap-2 md:mr-0">
                    <input
                      type="checkbox"
                      role="switch"
                      className="peer sr-only"
                      checked={i.is_available}
                      disabled={pending}
                      onChange={(e) => run("set_item_availability", { item_ref: i.id, is_available: e.target.checked }, i.id)}
                      aria-label={`${i.name} available`}
                    />
                    <span className="relative h-6 w-10 rounded-full bg-muted-foreground/30 transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-card after:shadow after:transition-transform peer-checked:bg-success peer-checked:after:translate-x-4 peer-focus-visible:outline-2 peer-focus-visible:outline-ring" aria-hidden />
                    <span className={cn("text-xs", i.is_available ? "text-success" : "text-destructive")}>{busyId === i.id ? "Saving…" : i.is_available ? "Available" : "Sold out"}</span>
                  </label>

                  <form
                    className="flex items-center gap-1.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const v = new FormData(e.currentTarget).get("stock") as string;
                      run("update_stock", { item_ref: i.id, stock_qty: v === "" ? null : Number(v) }, i.id);
                    }}
                  >
                    <Input
                      name="stock"
                      type="number"
                      min={0}
                      className={cn("h-8 w-20", low && "border-warning")}
                      defaultValue={i.stock_qty ?? ""}
                      placeholder="∞"
                      aria-label={`${i.name} portions left`}
                      title="Portions left (empty = unlimited)"
                    />
                    <Button size="sm" variant="outline" className="h-8" disabled={pending}>
                      Save
                    </Button>
                  </form>

                  {isOwner ? (
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-9"
                        aria-label={`Edit ${i.name}`}
                        onClick={() =>
                          setForm({
                            id: i.id,
                            name: i.name,
                            category: i.category_slug,
                            price_paise: i.price_paise,
                            description: i.description,
                            is_veg: i.is_veg,
                            spice_level: i.spice_level,
                            tags: i.tags,
                            prep_time_min: i.prep_time_min,
                            image_url: i.image_url,
                            is_available: i.is_available,
                          })
                        }
                      >
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Delete ${i.name}`} onClick={() => setToDelete(i)}>
                        <Trash2 />
                      </Button>
                    </div>
                  ) : (
                    <span className="hidden md:block" />
                  )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {isOwner && <p className="-mt-6 text-xs text-muted-foreground">Tip: the AI assistant can do bulk edits — &ldquo;increase all dosa prices by 10%&rdquo; or &ldquo;set pairings for dalma&rdquo;.</p>}

      <section aria-labelledby="inventory">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 id="inventory" className="font-display text-3xl">
              Inventory
            </h2>
            <p className="text-sm text-muted-foreground">Ingredients on hand. Items below their threshold are flagged.</p>
          </div>
        </div>
        {inventory.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {inventory.map((inv) => (
              <form
                key={inv.id}
                className={cn("flex items-center gap-3 rounded-2xl border bg-card p-3.5 text-sm", inv.is_low && "border-warning/50 bg-warning/[0.06]")}
                onSubmit={(e) => {
                  e.preventDefault();
                  run("update_inventory", { inventory_ref: inv.id, qty: Number(new FormData(e.currentTarget).get("qty")) }, inv.id);
                }}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="truncate">{inv.name}</span>
                    {inv.is_low && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] text-warning">Low</span>}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Flag below {inv.low_threshold} {inv.unit}
                  </span>
                </span>
                <Input name="qty" type="number" step="0.1" min={0} className="h-8 w-20" defaultValue={inv.qty} aria-label={`${inv.name} quantity in ${inv.unit}`} />
                <span className="w-6 text-xs text-muted-foreground">{inv.unit}</span>
                <Button size="sm" variant="outline" className="h-8" disabled={pending}>
                  {busyId === inv.id ? <Loader2 className="animate-spin" /> : "Save"}
                </Button>
              </form>
            ))}
          </div>
        ) : (
          <EmptyState icon={Package} title="No ingredients tracked" description="Ask the assistant to start tracking stock for key ingredients." />
        )}
      </section>

      <DishFormDialog
        open={!!form}
        initial={form}
        categories={categories}
        onClose={() => setForm(null)}
        onSaved={() => {
          setForm(null);
          router.refresh();
        }}
      />

      <Dialog open={!!toDelete} onClose={() => setToDelete(null)} title={`Delete ${toDelete?.name ?? ""}?`}>
        <p className="text-sm text-muted-foreground">It disappears from the menu and the AI host stops offering it. Past orders and sales reports keep their history.</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setToDelete(null)}>
            Keep dish
          </Button>
          <Button variant="destructive" disabled={pending} onClick={() => toDelete && run("delete_menu_item", { item_ref: toDelete.id }, toDelete.id, () => setToDelete(null))}>
            {pending && <Loader2 className="animate-spin" />} Delete dish
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
