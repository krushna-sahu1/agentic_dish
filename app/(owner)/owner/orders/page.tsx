import { OrdersBoard } from "@/components/owner/OrdersBoard";
import { requireRole } from "@/lib/auth";
import { listOrders } from "@/lib/services/owner";

export const metadata = { title: "Live orders" };

export default async function OrdersBoardPage() {
  await requireRole(["owner", "staff"]);
  const [active, recent] = await Promise.all([listOrders({ active_only: true, limit: 100 }), listOrders({ status: ["completed", "cancelled"], range: { preset: "today" }, limit: 20 })]);
  return <OrdersBoard initial={{ active: active.orders, recent: recent.orders }} />;
}
