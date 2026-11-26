import type { Metadata } from "next";
import { MenuBrowser } from "@/components/site/MenuBrowser";
import { AskAiButton } from "@/components/site/AskAiButton";
import { CouponFromLink } from "@/components/site/CouponFromLink";
import { toCardItem } from "@/components/site/to-card";
import { BUSINESS } from "@/lib/business";
import { getMenu } from "@/lib/services/menu";
import { SpiceLevel, VegMark } from "@/components/site/Markers";

export const metadata: Metadata = { title: "Menu", description: BUSINESS.menuDescription };

export default async function MenuPage({ searchParams }: { searchParams: Promise<{ coupon?: string }> }) {
  const [menu, { coupon }] = await Promise.all([getMenu(), searchParams]);
  return (
    <div className="pb-6 pt-10 sm:pt-14">
      <CouponFromLink code={coupon} />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{menu.items.length} dishes · cooked to order</p>
          <h1 className="mt-3 font-display text-5xl leading-[0.95] sm:text-7xl">The menu</h1>
          <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><VegMark veg /> Veg</span>
            <span className="inline-flex items-center gap-1.5"><VegMark veg={false} /> Non-veg</span>
            <span className="inline-flex items-center gap-1.5"><SpiceLevel level={3} /> Spice level</span>
            <span>GST is shown at checkout — no hidden charges.</span>
          </p>
        </div>
        <AskAiButton size="sm" prompt="What do you recommend today?" label="Not sure? Ask our AI" />
      </div>
      <MenuBrowser categories={menu.categories.map((c) => ({ slug: c.slug, name: c.name }))} items={menu.items.map(toCardItem)} />
    </div>
  );
}
