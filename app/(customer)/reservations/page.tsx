import type { Metadata } from "next";
import { ReservationsClient } from "@/components/site/ReservationsClient";
import { requireUser } from "@/lib/auth";
import { listMyReservations } from "@/lib/services/account";

export const metadata: Metadata = { title: "Reservations" };
export const dynamic = "force-dynamic";

export default async function ReservationsPage() {
  const user = await requireUser();
  const reservations = await listMyReservations(user.userId);
  return (
    <div className="mx-auto max-w-3xl py-6">
      <h1 className="mb-4 font-display text-3xl font-semibold">Book a table</h1>
      <ReservationsClient reservations={reservations} />
    </div>
  );
}
