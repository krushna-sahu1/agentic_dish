import type { Metadata } from "next";
import { MenuBrowser } from "@/components/site/MenuBrowser";
import { AskAiButton } from "@/components/site/AskAiButton";
import { CouponFromLink } from "@/components/site/CouponFromLink";
import { toCardItem } from "@/components/site/to-card";
import { BUSINESS } from "@/lib/business";
import { getMenu } from "@/lib/services/menu";

export const metadata: Metadata = { title: "Menu", description: BUSINESS.menuDescription };

export default async function MenuPage({ searchParams }: { searchParams: Promise<{ coupon?: string }> }) {
  const [menu, { coupon }] = await Promise.all([getMenu(), searchParams]);
  return (
    <div className="py-6">
      <CouponFromLink code={coupon} />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4 pt-4">
        <div>
          <h1 className="font-display text-5xl sm:text-6xl">Menu</h1>
          <p className="mt-2 text-sm text-muted-foreground">GST is added at checkout. Allergens are listed on every dish.</p>
        </div>
        <AskAiButton variant="outline" size="sm" prompt="What do you recommend today?" label="Help me choose" />
      </div>
      <MenuBrowser categories={menu.categories.map((c) => ({ slug: c.slug, name: c.name }))} items={menu.items.map(toCardItem)} />
    </div>
  );
}
