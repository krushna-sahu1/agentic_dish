"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Textarea } from "@/components/ui/input";
import { checkReservationAction, executeCustomerConfirmAction } from "@/app/actions/customer";
import type { Reservation } from "@/lib/types";
import { formatDateTime } from "@/lib/time";

/** Manual booking UI — uses the same create/cancel actions as the chat's confirm cards. */
export function ReservationsClient({ reservations }: { reservations: Reservation[] }) {
  const router = useRouter();
  const [party, setParty] = useState(2);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("20:00");
  const [notes, setNotes] = useState("");
  const [check, setCheck] = useState<{ available: boolean; reason?: string; table_number?: number; alternatives?: string[] } | null>(null);
  const [pending, start] = useTransition();
  const iso = date ? `${date}T${time}:00+05:30` : "";

  const doCheck = (dt = iso) =>
    start(async () => {
      const r = await checkReservationAction(party, dt);
      if (!r.ok) return void toast.error(r.error);
      setCheck(r.data);
    });

  const book = (dt = iso) =>
    start(async () => {
      const r = await executeCustomerConfirmAction("create_reservation", { party_size: party, datetime: dt, notes: notes || undefined });
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.data.message);
      setCheck(null);
      router.refresh();
    });

  const upcoming = reservations.filter((r) => new Date(r.reserved_for) > new Date() && ["requested", "confirmed"].includes(r.status));
  const past = reservations.filter((r) => !upcoming.includes(r));

  return (
    <div className="space-y-8">
      <form
        className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          doCheck();
        }}
      >
        <div>
          <Label htmlFor="party">Guests</Label>
          <Input id="party" type="number" min={1} max={20} value={party} onChange={(e) => { setParty(Number(e.target.value)); setCheck(null); }} />
        </div>
        <div>
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" required min={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => { setDate(e.target.value); setCheck(null); }} />
        </div>
        <div>
          <Label htmlFor="time">Time</Label>
          <Input id="time" type="time" required step={900} value={time} onChange={(e) => { setTime(e.target.value); setCheck(null); }} />
        </div>
        <div className="sm:col-span-3">
          <Label htmlFor="rnotes">Notes (optional)</Label>
          <Textarea id="rnotes" className="min-h-14" maxLength={300} placeholder="Birthday, high chair, window seat…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
          <Button type="submit" variant="outline" disabled={pending || !date}>
            {pending && <Loader2 className="animate-spin" />} Check availability
          </Button>
          {check?.available && (
            <Button type="button" onClick={() => book()} disabled={pending}>
              <CalendarCheck /> Book table {check.table_number}
            </Button>
          )}
          {check && !check.available && <p className="text-sm text-destructive">{check.reason}</p>}
        </div>
        {check && !check.available && check.alternatives?.length ? (
          <div className="flex flex-wrap gap-2 sm:col-span-3">
            {check.alternatives.map((a) => (
              <Button key={a} type="button" size="sm" variant="secondary" onClick={() => book(a)}>
                Book {formatDateTime(a)}
              </Button>
            ))}
          </div>
        ) : null}
      </form>

      <section>
        <h2 className="mb-2 font-semibold">Upcoming</h2>
        {upcoming.length === 0 ? <p className="text-sm text-muted-foreground">No upcoming reservations.</p> : (
          <ul className="space-y-2">
            {upcoming.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3 text-sm">
                <span>{formatDateTime(r.reserved_for)} · {r.party_size} guests{r.table_number ? ` · Table ${r.table_number}` : ""}</span>
                <span className="flex items-center gap-2">
                  <Badge variant="success">{r.status}</Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={pending}
                    onClick={() =>
                      confirm("Cancel this reservation?") &&
                      start(async () => {
                        const res = await executeCustomerConfirmAction("cancel_reservation", { id: r.id });
                        if (!res.ok) return void toast.error(res.error);
                        toast.success("Reservation cancelled");
                        router.refresh();
                      })
                    }
                  >
                    Cancel
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {past.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Past & cancelled</h2>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {past.map((r) => (
              <li key={r.id}>{formatDateTime(r.reserved_for)} · {r.party_size} guests · {r.status}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
