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
    <div className="mx-auto max-w-3xl pb-10 pt-10 sm:pt-14">
      <h1 className="mb-8 font-display text-[2.6rem] leading-[1] sm:text-6xl">Book a table</h1>
      <ReservationsClient reservations={reservations} />
    </div>
  );
}
