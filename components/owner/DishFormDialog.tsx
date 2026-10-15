"use client";

import { useEffect, useState, useTransition } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { executeOwnerChange, uploadDishImageAction } from "@/app/actions/owner";
import { ITEM_TAGS } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface DishFormValue {
  id?: string;
  name: string;
  category: string; // category slug
  price_paise: number;
  description: string;
  is_veg: boolean;
  spice_level: number;
  tags: string[];
  prep_time_min: number;
  image_url: string | null;
  is_available: boolean;
}

const TAG_LABEL: Record<string, string> = { bestseller: "Bestseller", chef_special: "Chef's special", new: "New", healthy: "Healthy", kids: "Kids" };
const SPICE = ["Not spicy", "Mild", "Medium", "Spicy", "Very spicy", "Fiery"];

export const emptyDish = (category: string): DishFormValue => ({
  name: "",
  category,
  price_paise: 0,
  description: "",
  is_veg: true,
  spice_level: 1,
  tags: ["new"],
  prep_time_min: 15,
  image_url: null,
  is_available: true,
});

/** Add / edit a dish. Saving is the owner's explicit confirmation; the server re-validates and audits it. */
export function DishFormDialog({
  open,
  initial,
  categories,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: DishFormValue | null;
  categories: { slug: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [v, setV] = useState<DishFormValue | null>(initial);
  const [price, setPrice] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    setV(initial);
    setPrice(initial && initial.price_paise ? String(initial.price_paise / 100) : "");
    setError(null);
  }, [initial]);

  if (!v) return null;
  const editing = !!v.id;
  const set = (patch: Partial<DishFormValue>) => setV({ ...v, ...patch });

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    const r = await uploadDishImageAction(fd);
    setUploading(false);
    if (r.ok) set({ image_url: r.data.url });
    else setError(r.error);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const rupees = Number(price);
    if (!Number.isFinite(rupees) || rupees <= 0) return setError("Enter a price above ₹0.");
    const common = {
      name: v.name.trim(),
      description: v.description.trim(),
      price_paise: Math.round(rupees * 100),
      is_veg: v.is_veg,
      spice_level: v.spice_level,
      tags: v.tags,
      prep_time_min: v.prep_time_min,
      // A removed photo falls back to the menu's illustrated placeholder.
      ...(v.image_url ? { image_url: v.image_url } : editing ? { image_url: "/dishes/placeholder.svg" } : {}),
    };
    setError(null);
    start(async () => {
      const r = editing
        ? await executeOwnerChange("update_menu_item", { item_ref: v.id, ...common, is_available: v.is_available })
        : await executeOwnerChange("create_menu_item", { category: v.category, ...common });
      if (!r.ok) return setError(r.error);
      toast.success(r.data.message);
      onSaved();
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title={editing ? `Edit ${initial?.name}` : "Add a dish"} className="max-w-2xl">
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
          {/* Photo */}
          <div>
            <Label>Photo</Label>
            <label
              className={cn(
                "group relative mt-1.5 flex aspect-square cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed bg-muted/50 text-center text-xs text-muted-foreground transition-colors hover:border-foreground/30",
                uploading && "pointer-events-none",
              )}
            >
              {v.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.image_url} alt="Dish preview" className="absolute inset-0 size-full object-cover" />
              ) : (
                <>
                  <ImagePlus className="mb-2 size-6" aria-hidden />
                  Upload a photo
                  <span className="mt-0.5 opacity-70">PNG, JPG, WebP · max 4 MB</span>
                </>
              )}
              {v.image_url && <span className="absolute inset-x-2 bottom-2 rounded-full bg-black/60 py-1 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100">Replace photo</span>}
              {uploading && (
                <span className="absolute inset-0 flex items-center justify-center bg-background/70">
                  <Loader2 className="size-5 animate-spin" aria-label="Uploading" />
                </span>
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                  e.target.value = "";
                }}
              />
            </label>
            {v.image_url && (
              <button type="button" className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive" onClick={() => set({ image_url: null })}>
                <Trash2 className="size-3" aria-hidden /> Remove photo
              </button>
            )}
          </div>

          {/* Details */}
          <div className="grid content-start gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="dish-name">Name</Label>
              <Input id="dish-name" required minLength={2} maxLength={80} value={v.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Ghee roast dosa" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dish-cat">Category</Label>
              <Select id="dish-cat" value={v.category} disabled={editing} onChange={(e) => set({ category: e.target.value })}>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dish-price">Price (₹)</Label>
              <Input id="dish-price" type="number" inputMode="decimal" min={1} step="0.5" required value={price} onChange={(e) => setPrice(e.target.value)} placeholder="180" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="dish-desc">Description</Label>
              <Textarea id="dish-desc" maxLength={400} value={v.description} onChange={(e) => set({ description: e.target.value })} placeholder="What makes it special? Mention key ingredients." className="min-h-20" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Diet</Label>
            <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1 text-sm" role="radiogroup" aria-label="Diet">
              {[
                [true, "Veg"],
                [false, "Non-veg"],
              ].map(([val, label]) => (
                <button
                  type="button"
                  key={String(val)}
                  role="radio"
                  aria-checked={v.is_veg === val}
                  onClick={() => set({ is_veg: val as boolean })}
                  className={cn("rounded-full py-1.5 transition-colors", v.is_veg === val ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}
                >
                  {label as string}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dish-spice">Spice</Label>
            <Select id="dish-spice" value={v.spice_level} onChange={(e) => set({ spice_level: Number(e.target.value) })}>
              {SPICE.map((s, i) => (
                <option key={s} value={i}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dish-prep">Prep time (min)</Label>
            <Input id="dish-prep" type="number" min={1} max={180} value={v.prep_time_min} onChange={(e) => set({ prep_time_min: Number(e.target.value) || 1 })} />
          </div>
        </div>

        <fieldset>
          <legend className="text-sm font-medium">Tags</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {ITEM_TAGS.map((t) => {
              const on = v.tags.includes(t);
              return (
                <button
                  type="button"
                  key={t}
                  aria-pressed={on}
                  onClick={() => set({ tags: on ? v.tags.filter((x) => x !== t) : [...v.tags, t] })}
                  className={cn("rounded-full border px-3 py-1.5 text-xs transition-colors", on ? "border-foreground bg-foreground text-background" : "hover:border-foreground/40")}
                >
                  {TAG_LABEL[t] ?? t}
                </button>
              );
            })}
          </div>
        </fieldset>

        {editing && (
          <label className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm">
            <input type="checkbox" role="switch" className="size-4 accent-[var(--primary)]" checked={v.is_available} onChange={(e) => set({ is_available: e.target.checked })} />
            <span className="flex-1">Available to order</span>
            <span className={cn("text-xs", v.is_available ? "text-success" : "text-destructive")}>{v.is_available ? "On the menu" : "Sold out"}</span>
          </label>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || uploading}>
            {pending && <Loader2 className="animate-spin" />}
            {editing ? "Save changes" : "Add to menu"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
