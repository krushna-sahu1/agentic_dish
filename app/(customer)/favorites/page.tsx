import type { Metadata } from "next";
import Link from "next/link";
import { DishCard } from "@/components/site/DishCard";
import { toCardItem } from "@/components/site/to-card";
import { requireUser } from "@/lib/auth";
import { favoriteIds } from "@/lib/services/account";
import { getMenu } from "@/lib/services/menu";

export const metadata: Metadata = { title: "Favourites" };
export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const user = await requireUser();
  const [ids, menu] = await Promise.all([favoriteIds(user.userId), getMenu()]);
  const items = ids.map((id) => menu.byId.get(id)).filter((i) => !!i);
  return (
    <div className="py-6">
      <h1 className="mb-4 font-display text-3xl font-semibold">Your favourites</h1>
      {items.length === 0 ? (
        <p className="text-muted-foreground">
          Nothing saved yet. Tap the heart on any <Link href="/menu" className="text-primary hover:underline">dish</Link>.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {items.map((i) => (
            <DishCard key={i!.id} item={toCardItem(i!)} />
          ))}
        </div>
      )}
    </div>
  );
}
