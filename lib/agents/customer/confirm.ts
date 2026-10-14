/**
 * Customer actions that need an explicit confirm click (human-in-the-loop):
 * clear_cart, cancel_order, create_reservation, cancel_reservation.
 * Same pattern as owner changes: preview computed server-side, execute only
 * from the Confirm button's server action.
 */
import { z } from "zod";
import { CUSTOMER_CONFIRM_SCHEMAS as S } from "./confirm-schemas";
import { formatINR, STATUS_LABEL } from "@/lib/format";
import { formatDateTime } from "@/lib/time";
import { clearCart, viewCart } from "@/lib/services/cart";
import { cancelOrderAsCustomer, getOrderForUser } from "@/lib/services/orders";
import { cancelReservation, checkReservationAvailability, createReservation, listMyReservations } from "@/lib/services/account";
import { ServiceError } from "@/lib/services/errors";
import type { ChangePreview } from "../owner/changes";

export interface CustomerConfirm<S extends z.ZodTypeAny = z.ZodTypeAny> {
  description: string;
  schema: S;
  preview: (userId: string, args: z.infer<S>) => Promise<ChangePreview & { alternatives?: string[] }>;
  execute: (userId: string, args: z.infer<S>, email: string | null) => Promise<{ message: string; data?: unknown }>;
}
const define = <S extends z.ZodTypeAny>(c: CustomerConfirm<S>) => c;

export const CUSTOMER_CONFIRMS = {
  clear_cart: define({
    ...S.clear_cart,
    async preview(userId) {
      const cart = await viewCart(userId);
      return {
        title: "Clear your cart?",
        destructive: true,
        changes: [{ label: "Items", before: `${cart.item_count} item(s) · ${formatINR(cart.totals.totalPaise)}`, after: "Empty" }],
        table: { columns: ["Dish", "Qty"], rows: cart.lines.map((l) => [l.name, l.qty]) },
      };
    },
    async execute(userId) {
      await clearCart(userId);
      return { message: "Your cart is now empty." };
    },
  }),

  cancel_order: define({
    ...S.cancel_order,
    async preview(userId, a) {
      const d = await getOrderForUser(userId, a.order_id);
      const warnings: string[] = [];
      if (!d.can_cancel) warnings.push("This order has already been accepted by the kitchen and can't be cancelled online — please call the restaurant.");
      if (d.order.status === "paid") warnings.push(`You paid ${formatINR(d.order.total_paise)}. The restaurant will process a refund after cancelling.`);
      return {
        title: `Cancel order ${d.order.order_number}?`,
        destructive: true,
        changes: [
          { label: "Status", before: STATUS_LABEL[d.order.status], after: "Cancelled" },
          { label: "Reason", before: null, after: a.reason },
        ],
        warnings,
      };
    },
    async execute(userId, a) {
      const r = await cancelOrderAsCustomer(userId, a.order_id, a.reason);
      return { message: `Order ${r.order_number} cancelled.${r.refund ? ` ${r.refund}` : ""}`, data: r };
    },
  }),

  create_reservation: define({
    ...S.create_reservation,
    async preview(_userId, a) {
      const avail = await checkReservationAvailability(a.party_size, a.datetime);
      return {
        title: "Book this table?",
        changes: [
          { label: "Party", before: null, after: `${a.party_size} ${a.party_size === 1 ? "person" : "people"}` },
          { label: "When", before: null, after: formatDateTime(a.datetime) },
          ...(a.notes ? [{ label: "Notes", before: null, after: a.notes }] : []),
          ...(avail.available ? [{ label: "Table", before: null, after: `Table ${avail.table_number} (seats ${avail.capacity})` }] : []),
        ],
        warnings: avail.available ? [] : [avail.reason ?? "Not available"],
        alternatives: avail.available ? undefined : avail.alternatives,
      };
    },
    async execute(userId, a, email) {
      const r = await createReservation(userId, a, email);
      return { message: `Booked! Table ${r.table_number} for ${r.party_size} on ${formatDateTime(r.reserved_for)}.`, data: r };
    },
  }),

  cancel_reservation: define({
    ...S.cancel_reservation,
    async preview(userId, a) {
      const r = (await listMyReservations(userId)).find((x) => x.id === a.id);
      if (!r) throw new ServiceError("Reservation not found.", "not_found");
      return {
        title: "Cancel this reservation?",
        destructive: true,
        changes: [{ label: `${r.party_size} people · ${formatDateTime(r.reserved_for)}`, before: r.status, after: "cancelled" }],
      };
    },
    async execute(userId, a) {
      await cancelReservation(userId, a.id);
      return { message: "Reservation cancelled." };
    },
  }),
} satisfies Record<string, CustomerConfirm>;

export type CustomerConfirmName = keyof typeof CUSTOMER_CONFIRMS;
