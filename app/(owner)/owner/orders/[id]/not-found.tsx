import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { DashboardPage } from "@/components/owner/Page";

export default function OrderNotFound() {
  return (
    <DashboardPage>
      <EmptyState icon={SearchX} title="Order not found" description="It may have been mistyped, or the link is out of date.">
        <Link href="/owner/orders" className={buttonVariants()}>
          See all orders
        </Link>
      </EmptyState>
    </DashboardPage>
  );
}
