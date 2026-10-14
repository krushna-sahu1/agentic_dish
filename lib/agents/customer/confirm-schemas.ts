/** Client-safe schemas for confirm-gated customer actions (see confirm.ts). */
import { z } from "zod";

export const CUSTOMER_CONFIRM_SCHEMAS = {
  clear_cart: {
    description: "Empty the whole cart. Shows a confirm card; only clears if the user clicks Confirm.",
    schema: z.object({}),
  },
  cancel_order: {
    description: "Cancel one of the user's orders (only before the kitchen accepts it). Shows a confirm card.",
    schema: z.object({ order_id: z.string().min(1).max(60), reason: z.string().min(2).max(200) }),
  },
  create_reservation: {
    description: "Book a table. datetime is ISO 8601 with +05:30 (IST). Shows a confirm card; books only on Confirm.",
    schema: z.object({ party_size: z.number().int().min(1).max(20), datetime: z.string().min(10), notes: z.string().max(300).optional() }),
  },
  cancel_reservation: {
    description: "Cancel one of the user's reservations. Shows a confirm card.",
    schema: z.object({ id: z.string().min(1) }),
  },
} as const;

export type CustomerConfirmSchemaName = keyof typeof CUSTOMER_CONFIRM_SCHEMAS;
