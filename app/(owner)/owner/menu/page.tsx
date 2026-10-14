import { MenuManager } from "@/components/owner/MenuManager";
import { requireRole } from "@/lib/auth";
import { findMenuItems, listInventory } from "@/lib/services/owner";

export const metadata = { title: "Menu & stock" };

export default async function OwnerMenuPage() {
  const user = await requireRole(["owner", "staff"]);
  const [items, inventory] = await Promise.all([findMenuItems({ include_unavailable: true }), listInventory()]);
  return <MenuManager items={items} inventory={inventory as never} role={user.role === "owner" ? "owner" : "staff"} />;
}
