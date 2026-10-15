import { MenuManager, type MenuRow } from "@/components/owner/MenuManager";
import { DashboardPage } from "@/components/owner/Page";
import { ErrorState } from "@/components/ui/states";
import { requireRole } from "@/lib/auth";
import { getMenu } from "@/lib/services/menu";
import { listInventory } from "@/lib/services/owner";

export const metadata = { title: "Menu" };

export default async function OwnerMenuPage() {
  const user = await requireRole(["owner", "staff"]);
  let data;
  try {
    const [menu, inventory] = await Promise.all([getMenu(), listInventory()]);
    const items: MenuRow[] = menu.items.map((i) => ({
      id: i.id,
      name: i.name,
      slug: i.slug,
      category: i.category_name,
      category_slug: i.category_slug,
      description: i.description,
      image_url: i.image_url && !i.image_url.endsWith("/placeholder.svg") ? i.image_url : null,
      price_paise: i.price_paise,
      is_veg: i.is_veg,
      spice_level: i.spice_level,
      tags: i.tags,
      prep_time_min: i.prep_time_min,
      is_available: i.is_available,
      stock_qty: i.stock_qty,
      low_stock_threshold: i.low_stock_threshold,
      sold_30d: i.sold_30d,
    }));
    data = { items, inventory, categories: menu.categories.map((c) => ({ slug: c.slug, name: c.name })) };
  } catch {
    data = null;
  }
  return (
    <DashboardPage>
      {data ? (
        <MenuManager items={data.items} inventory={data.inventory as never} categories={data.categories} role={user.role === "owner" ? "owner" : "staff"} />
      ) : (
        <ErrorState title="We couldn’t load the menu" description="The database didn’t respond. Refresh the page to try again." />
      )}
    </DashboardPage>
  );
}
