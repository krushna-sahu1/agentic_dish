"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { ALLERGENS, ITEM_TAGS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DishCard, type DishCardItem } from "./DishCard";
import { openChat } from "./chat-events";

export interface MenuBrowserItem extends DishCardItem {
  category_slug: string;
  is_vegan: boolean;
  is_jain: boolean;
}

interface Filters {
  q: string;
  veg: boolean;
  vegan: boolean;
  jain: boolean;
  maxSpice: number;
  allergenFree: string[];
  maxPrice: number;
  tag: string;
}

const DEFAULT: Filters = { q: "", veg: false, vegan: false, jain: false, maxSpice: 5, allergenFree: [], maxPrice: 0, tag: "" };

export function MenuBrowser({ categories, items: initial }: { categories: { slug: string; name: string }[]; items: MenuBrowserItem[] }) {
  const [items, setItems] = useState(initial);
  const [f, setF] = useState<Filters>(DEFAULT);
  const [showFilters, setShowFilters] = useState(false);
  const [active, setActive] = useState(categories[0]?.slug);

  // Live availability: the owner marking "idli out of stock" shows Sold out instantly.
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const supabase = createClient();
    const ch = supabase
      .channel("menu-availability")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "menu_items" }, (payload) => {
        const row = payload.new as { id: string; is_available: boolean; stock_qty: number | null; price_paise: number; is_deleted: boolean };
        setItems((list) =>
          list
            .filter((i) => !(i.id === row.id && row.is_deleted))
            .map((i) => (i.id === row.id ? { ...i, available: row.is_available && (row.stock_qty === null || row.stock_qty > 0), price_paise: row.price_paise } : i)),
        );
      })
      .subscribe();
    return () => void supabase.removeChannel(ch);
  }, []);

  const filtered = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return items.filter((i) => {
      if (q && !`${i.name} ${i.description} ${i.category ?? ""}`.toLowerCase().includes(q)) return false;
      if (f.veg && !i.is_veg) return false;
      if (f.vegan && !i.is_vegan) return false;
      if (f.jain && !i.is_jain) return false;
      if (i.spice_level > f.maxSpice) return false;
      if (f.allergenFree.some((a) => i.allergens.includes(a))) return false;
      if (f.maxPrice && i.price_paise > f.maxPrice * 100) return false;
      if (f.tag && !i.tags.includes(f.tag)) return false;
      return true;
    });
  }, [items, f]);

  const grouped = categories.map((c) => ({ ...c, items: filtered.filter((i) => i.category_slug === c.slug) })).filter((g) => g.items.length);
  const activeCount = Number(f.veg) + Number(f.vegan) + Number(f.jain) + Number(f.maxSpice < 5) + f.allergenFree.length + Number(!!f.maxPrice) + Number(!!f.tag);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActive(vis.target.id.replace("cat-", ""));
      },
      { rootMargin: "-120px 0px -60% 0px" },
    );
    document.querySelectorAll("[data-category-section]").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [grouped.length]);

  return (
    <div>
      <div className="sticky top-16 z-30 -mx-4 border-b bg-background/95 px-4 pb-2 pt-3 backdrop-blur">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              aria-label="Search the menu"
              placeholder="Search dosa, biryani, chhena poda…"
              className="pl-9"
              value={f.q}
              onChange={(e) => setF({ ...f, q: e.target.value })}
            />
          </div>
          <Button variant="outline" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters} aria-controls="menu-filters">
            <SlidersHorizontal /> <span className="hidden sm:inline">Filters</span>
            {activeCount > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{activeCount}</span>}
          </Button>
        </div>
        {showFilters && (
          <div id="menu-filters" className="mt-3 grid gap-3 rounded-xl border bg-card p-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <fieldset className="flex flex-wrap gap-3">
              <legend className="sr-only">Diet</legend>
              {(["veg", "vegan", "jain"] as const).map((k) => (
                <label key={k} className="flex items-center gap-1.5 capitalize">
                  <input type="checkbox" checked={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} className="accent-[var(--primary)]" /> {k === "veg" ? "Veg only" : k}
                </label>
              ))}
            </fieldset>
            <label className="flex items-center gap-2">
              Max spice
              <input type="range" min={0} max={5} value={f.maxSpice} onChange={(e) => setF({ ...f, maxSpice: Number(e.target.value) })} className="flex-1 accent-[var(--primary)]" aria-valuetext={`${f.maxSpice} of 5`} />
              <span className="w-4">{f.maxSpice}</span>
            </label>
            <label className="flex items-center gap-2">
              Max price ₹
              <Input type="number" min={0} step={50} className="h-8" value={f.maxPrice || ""} placeholder="any" onChange={(e) => setF({ ...f, maxPrice: Number(e.target.value) })} />
            </label>
            <label className="flex items-center gap-2">
              Tag
              <Select className="h-8" value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })}>
                <option value="">Any</option>
                {ITEM_TAGS.map((t) => (
                  <option key={t} value={t}>
                    {t.replace("_", " ")}
                  </option>
                ))}
              </Select>
            </label>
            <fieldset className="flex flex-wrap gap-x-3 gap-y-1 sm:col-span-2 lg:col-span-4">
              <legend className="mb-1 text-muted-foreground">Free from</legend>
              {ALLERGENS.map((a) => (
                <label key={a} className="flex items-center gap-1.5 capitalize">
                  <input
                    type="checkbox"
                    className="accent-[var(--primary)]"
                    checked={f.allergenFree.includes(a)}
                    onChange={(e) => setF({ ...f, allergenFree: e.target.checked ? [...f.allergenFree, a] : f.allergenFree.filter((x) => x !== a) })}
                  />
                  {a}
                </label>
              ))}
            </fieldset>
            <div className="sm:col-span-2 lg:col-span-4">
              <Button variant="ghost" size="sm" onClick={() => setF(DEFAULT)}>
                Reset filters
              </Button>
            </div>
          </div>
        )}
        <nav aria-label="Categories" className="mt-2 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none]">
          {categories.map((c) => (
            <a
              key={c.slug}
              href={`#cat-${c.slug}`}
              className={cn(
                "whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors",
                active === c.slug ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent",
              )}
            >
              {c.name}
            </a>
          ))}
        </nav>
      </div>

      {grouped.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-muted-foreground">No dishes match those filters.</p>
          <Button variant="link" onClick={() => openChat(f.q ? `Do you have anything like "${f.q}"?` : undefined)}>
            <Sparkles /> Ask our AI instead
          </Button>
        </div>
      ) : (
        grouped.map((g) => (
          <section key={g.slug} id={`cat-${g.slug}`} data-category-section className="pt-8">
            <h2 className="mb-3 font-display text-2xl">{g.name}</h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {g.items.map((i) => (
                <DishCard key={i.id} item={i} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
