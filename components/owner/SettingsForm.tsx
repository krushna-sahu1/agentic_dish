"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import type { Settings } from "@/lib/types";
import { ChangeDialog } from "./ChangeDialog";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const toText = (slots?: { open: string; close: string }[]) => (slots ?? []).map((s) => `${s.open}-${s.close}`).join(", ");
const parse = (t: string) =>
  t
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const [open, close] = x.split("-").map((y) => y.trim());
      return { open, close };
    });

export function SettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [f, setF] = useState({
    is_open_override: settings.is_open_override,
    accepting_orders: settings.accepting_orders,
    announcement: settings.announcement ?? "",
    delivery_fee: settings.delivery_fee_paise / 100,
    free_delivery_above: settings.free_delivery_above_paise / 100,
    packaging_fee: settings.packaging_fee_paise / 100,
    gst_percent: settings.gst_percent,
    min_order: settings.min_order_paise / 100,
    avg_prep_minutes: settings.avg_prep_minutes,
    delivery_radius_km: settings.delivery_radius_km,
    hours: Object.fromEntries(DAYS.map((d) => [d, toText(settings.opening_hours[d])])) as Record<string, string>,
  });
  const [change, setChange] = useState<{ name: "update_settings"; args: Record<string, unknown>; title: string } | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setChange({
      name: "update_settings",
      title: "Review settings changes",
      args: {
        is_open_override: f.is_open_override,
        accepting_orders: f.accepting_orders,
        announcement: f.announcement || null,
        delivery_fee_paise: Math.round(f.delivery_fee * 100),
        free_delivery_above_paise: Math.round(f.free_delivery_above * 100),
        packaging_fee_paise: Math.round(f.packaging_fee * 100),
        gst_percent: Number(f.gst_percent),
        min_order_paise: Math.round(f.min_order * 100),
        avg_prep_minutes: Number(f.avg_prep_minutes),
        delivery_radius_km: Number(f.delivery_radius_km),
        opening_hours: Object.fromEntries(DAYS.map((d) => [d, parse(f.hours[d])])),
      },
    });
  };

  const num = (k: keyof typeof f, label: string, step = "1") => (
    <div>
      <Label htmlFor={k}>{label}</Label>
      <Input id={k} type="number" step={step} min={0} value={f[k] as number} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} />
    </div>
  );

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <div>
        <h1 className="font-display text-4xl leading-none sm:text-5xl">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">Hours, fees and ordering. Changes are previewed before they apply.</p>
      </div>
      <section className="grid gap-4 rounded-2xl border bg-card p-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="override">Open / closed</Label>
          <Select id="override" value={f.is_open_override} onChange={(e) => setF({ ...f, is_open_override: e.target.value as Settings["is_open_override"] })}>
            <option value="auto">Follow opening hours</option>
            <option value="force_open">Force open</option>
            <option value="force_closed">Closed today</option>
          </Select>
        </div>
        <label className="flex items-center gap-2 self-end text-sm">
          <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={f.accepting_orders} onChange={(e) => setF({ ...f, accepting_orders: e.target.checked })} /> Accepting online orders
        </label>
        <div className="sm:col-span-2">
          <Label htmlFor="ann">Announcement banner</Label>
          <Textarea id="ann" maxLength={200} value={f.announcement} onChange={(e) => setF({ ...f, announcement: e.target.value })} className="min-h-14" />
        </div>
      </section>
      <section className="grid gap-4 rounded-2xl border bg-card p-5 sm:grid-cols-3">
        {num("delivery_fee", "Delivery fee (₹)")}
        {num("free_delivery_above", "Free delivery above (₹)")}
        {num("packaging_fee", "Packaging fee (₹)")}
        {num("gst_percent", "GST %", "0.5")}
        {num("min_order", "Minimum order (₹)")}
        {num("avg_prep_minutes", "Avg prep (min)")}
        {num("delivery_radius_km", "Delivery radius (km)", "0.5")}
      </section>
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="mb-2 text-sm font-semibold">Opening hours <span className="font-normal text-muted-foreground">(e.g. 07:00-15:30, 17:30-23:00; empty = closed)</span></h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {DAYS.map((d) => (
            <label key={d} className="flex items-center gap-2 text-sm">
              <span className="w-10 capitalize text-muted-foreground">{d}</span>
              <Input value={f.hours[d]} onChange={(e) => setF({ ...f, hours: { ...f.hours, [d]: e.target.value } })} />
            </label>
          ))}
        </div>
      </section>
      <Button type="submit" size="lg">Review changes</Button>
      <ChangeDialog change={change} onClose={(applied) => { setChange(null); if (applied) router.refresh(); }} />
    </form>
  );
}
