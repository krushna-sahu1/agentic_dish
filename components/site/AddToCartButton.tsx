"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { useCart } from "@/components/providers/CartProvider";
import { useSession } from "@/components/providers/SessionProvider";
import { addToCartAction, getItemOptionsAction } from "@/app/actions/customer";
import type { AddToCartInput } from "@/lib/services/cart";
import { formatINR } from "@/lib/format";

interface Options {
  variants: { id: string; name: string; price_delta_paise: number }[];
  addons: { id: string; name: string; price_paise: number }[];
  price_paise: number;
}

export interface AddableItem {
  id: string;
  name: string;
  price_paise: number;
  available: boolean;
  has_options?: boolean;
}

/**
 * The single "Add" flow used by menu cards, dish pages and chat cards:
 * login check → options picker (variants/add-ons) → allergen/diet warning → add.
 */
export function AddToCartButton({
  item,
  label = "Add",
  qty: initialQty = 1,
  onAdded,
  ...btn
}: { item: AddableItem; label?: string; qty?: number; onAdded?: (name: string) => void } & Omit<ButtonProps, "onClick">) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { setCart } = useCart();
  const [pending, start] = useTransition();
  const [options, setOptions] = useState<Options | null>(null);
  const [optOpen, setOptOpen] = useState(false);
  const [warning, setWarning] = useState<{ message: string; pending: AddToCartInput } | null>(null);
  const [variant, setVariant] = useState<string | null>(null);
  const [addons, setAddons] = useState<string[]>([]);
  const [qty, setQty] = useState(initialQty);
  const [notes, setNotes] = useState("");

  const submit = (input: AddToCartInput) =>
    start(async () => {
      const r = await addToCartAction(input);
      if (!r.ok) {
        if (r.code === "login_required") router.push(`/login?next=${encodeURIComponent(pathname)}`);
        else toast.error(r.error);
        return;
      }
      if (r.data.status === "needs_confirmation") {
        setOptOpen(false);
        setWarning({ message: r.data.message, pending: r.data.pending });
        return;
      }
      setCart(r.data.cart);
      setOptOpen(false);
      setWarning(null);
      toast.success(`Added ${input.qty} × ${item.name}`);
      onAdded?.(item.name);
    });

  const onClick = () => {
    if (!session) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (item.has_options) {
      start(async () => {
        const r = await getItemOptionsAction(item.id);
        if (!r.ok) return void toast.error(r.error);
        setOptions(r.data);
        setVariant(r.data.variants[0]?.id ?? null);
        setAddons([]);
        setQty(initialQty);
        setNotes("");
        setOptOpen(true);
      });
      return;
    }
    submit({ item_id: item.id, qty: initialQty });
  };

  const unit =
    (options?.price_paise ?? item.price_paise) +
    (options?.variants.find((v) => v.id === variant)?.price_delta_paise ?? 0) +
    (options?.addons.filter((a) => addons.includes(a.id)).reduce((s, a) => s + a.price_paise, 0) ?? 0);

  return (
    <>
      <Button size="sm" {...btn} disabled={!item.available || pending || btn.disabled} onClick={onClick} aria-label={`${label} ${item.name}`}>
        {!item.available ? "Sold out" : pending ? "Adding…" : label}
      </Button>

      <Dialog open={optOpen} onClose={() => setOptOpen(false)} title={item.name}>
        {options && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit({ item_id: item.id, qty, variant_id: variant, addon_ids: addons, instructions: notes || null });
            }}
          >
            {options.variants.length > 0 && (
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Size</legend>
                <div className="flex flex-wrap gap-2">
                  {options.variants.map((v) => (
                    <label key={v.id} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                      <input type="radio" name="variant" className="accent-[var(--primary)]" checked={variant === v.id} onChange={() => setVariant(v.id)} />
                      {v.name}
                      {v.price_delta_paise !== 0 && <span className="text-muted-foreground">{v.price_delta_paise > 0 ? "+" : "−"}{formatINR(Math.abs(v.price_delta_paise))}</span>}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {options.addons.length > 0 && (
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Add-ons</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {options.addons.map((a) => (
                    <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                      <input
                        type="checkbox"
                        className="accent-[var(--primary)]"
                        checked={addons.includes(a.id)}
                        onChange={(e) => setAddons((s) => (e.target.checked ? [...s, a.id] : s.filter((x) => x !== a.id)))}
                      />
                      <span className="flex-1">{a.name}</span>
                      <span className="text-muted-foreground">+{formatINR(a.price_paise)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <div>
              <label htmlFor={`notes-${item.id}`} className="mb-2 block text-sm font-medium">
                Special instructions
              </label>
              <Textarea id={`notes-${item.id}`} maxLength={300} placeholder="e.g. less spicy, no onion" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-14" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2" role="group" aria-label="Quantity">
                <Button type="button" variant="outline" size="icon" aria-label="Decrease" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                  <Minus />
                </Button>
                <span className="w-6 text-center font-medium" aria-live="polite">{qty}</span>
                <Button type="button" variant="outline" size="icon" aria-label="Increase" onClick={() => setQty((q) => Math.min(20, q + 1))}>
                  <Plus />
                </Button>
              </div>
              <Button type="submit" disabled={pending}>
                Add · {formatINR(unit * qty)}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      <Dialog open={!!warning} onClose={() => setWarning(null)} title="Please check before adding">
        <div className="flex gap-3 rounded-lg bg-destructive/10 p-3 text-sm">
          <AlertTriangle className="size-5 shrink-0 text-destructive" aria-hidden />
          <p>{warning?.message}</p>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setWarning(null)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={pending} onClick={() => warning && submit({ ...warning.pending, acknowledge_conflicts: true })}>
            Add anyway
          </Button>
        </div>
      </Dialog>
    </>
  );
}
