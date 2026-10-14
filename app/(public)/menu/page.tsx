import type { Metadata } from "next";
import { MenuBrowser } from "@/components/site/MenuBrowser";
import { AskAiButton } from "@/components/site/AskAiButton";
import { toCardItem } from "@/components/site/to-card";
import { getMenu } from "@/lib/services/menu";

export const metadata: Metadata = { title: "Menu", description: "Dosas, idli, uttapam, rice, Odia specials, snacks, drinks and desserts." };

export default async function MenuPage() {
  const menu = await getMenu();
  return (
    <div className="py-6">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Our menu</h1>
          <p className="text-sm text-muted-foreground">Veg 🟩 · Non-veg 🟥 · 🌶 = spice level. Prices include no hidden charges — GST is shown at checkout.</p>
        </div>
        <AskAiButton variant="outline" size="sm" prompt="What do you recommend today?" label="Not sure? Ask our AI" />
      </div>
      <MenuBrowser categories={menu.categories.map((c) => ({ slug: c.slug, name: c.name }))} items={menu.items.map(toCardItem)} />
    </div>
  );
}
