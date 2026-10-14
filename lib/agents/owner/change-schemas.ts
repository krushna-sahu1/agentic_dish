/**
 * Zod schemas + descriptions for owner write tools. Client-safe (no server
 * imports): used by the Confirm-card tool registrations in the browser AND by
 * the server, which re-validates on preview and on execute.
 */
import { z } from "zod";
import { ALLERGENS, ITEM_TAGS } from "@/lib/types";

const orderRef = z.string().min(1).max(60).describe('Order number like "42", "0042" or "ORD-20261015-0042"');
const itemRef = z.string().min(1).max(120).describe("Menu item id, slug or name");
const statusEnum = z.enum(["accepted", "preparing", "ready", "out_for_delivery", "completed"]);

const menuItemFields = {
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(400).optional(),
  price_paise: z.number().int().min(0).max(1_000_000).optional().describe("Price in paise (₹1 = 100)"),
  is_veg: z.boolean().optional(),
  is_vegan: z.boolean().optional(),
  is_jain: z.boolean().optional(),
  spice_level: z.number().int().min(0).max(5).optional(),
  allergens: z.array(z.enum(ALLERGENS)).optional(),
  tags: z.array(z.enum(ITEM_TAGS)).optional(),
  calories: z.number().int().min(0).max(5000).optional(),
  prep_time_min: z.number().int().min(1).max(180).optional(),
  portion: z.string().max(60).optional(),
  is_available: z.boolean().optional(),
  image_url: z.string().max(500).optional(),
  low_stock_threshold: z.number().int().min(0).max(1000).optional(),
};

export const OWNER_CHANGE_SCHEMAS = {
  update_order_status: {
    description: "Move an order to its next kitchen status (accept, preparing, ready, out for delivery, completed) and optionally set an ETA in minutes.",
    schema: z.object({ order_ref: orderRef, status: statusEnum, eta_minutes: z.number().int().min(1).max(240).optional(), note: z.string().max(200).optional() }),
  },
  cancel_order: {
    description: "Cancel an order (before it's completed). For paid orders, follow up with issue_refund.",
    schema: z.object({ order_ref: orderRef, reason: z.string().min(3).max(200) }),
  },
  issue_refund: {
    description: "Refund a paid order to the customer via Razorpay (full refund by default). Never charges anyone.",
    schema: z.object({ order_ref: orderRef, amount_paise: z.number().int().positive().optional().describe("Partial refund in paise; omit for full"), reason: z.string().min(3).max(200) }),
  },
  set_item_availability: {
    description: "Mark a dish available or sold out (out of stock).",
    schema: z.object({ item_ref: itemRef, is_available: z.boolean() }),
  },
  update_stock: {
    description: "Set how many portions of a dish are left (null = unlimited). 0 marks it sold out.",
    schema: z.object({ item_ref: itemRef, stock_qty: z.number().int().min(0).max(10000).nullable() }),
  },
  update_menu_item: {
    description: "Edit a dish: price, description, tags, spice, allergens, availability, image, etc.",
    schema: z.object({ item_ref: itemRef, ...menuItemFields }),
  },
  create_menu_item: {
    description: "Add a new dish to the menu.",
    schema: z.object({
      category: z.string().min(1).describe("Category name or slug"),
      name: z.string().min(2).max(80),
      description: z.string().max(400).default(""),
      price_paise: z.number().int().min(0).max(1_000_000),
      is_veg: z.boolean().default(true),
      is_vegan: z.boolean().default(false),
      is_jain: z.boolean().default(false),
      spice_level: z.number().int().min(0).max(5).default(1),
      allergens: z.array(z.enum(ALLERGENS)).default([]),
      tags: z.array(z.enum(ITEM_TAGS)).default(["new"]),
      calories: z.number().int().min(0).max(5000).optional(),
      prep_time_min: z.number().int().min(1).max(180).default(15),
      portion: z.string().max(60).optional(),
      image_url: z.string().max(500).optional(),
    }),
  },
  delete_menu_item: {
    description: "Remove a dish from the menu (soft delete — history and analytics are kept).",
    schema: z.object({ item_ref: itemRef }),
  },
  create_category: {
    description: "Create a new menu category.",
    schema: z.object({ name: z.string().min(2).max(40), sort_order: z.number().int().min(0).max(100).optional() }),
  },
  update_category: {
    description: "Rename, reorder, hide or show a category.",
    schema: z.object({ category_ref: z.string().min(1), name: z.string().min(2).max(40).optional(), sort_order: z.number().int().min(0).max(100).optional(), is_active: z.boolean().optional() }),
  },
  set_pairings: {
    description: 'Set the curated "goes well with" pairings for a dish (replaces existing).',
    schema: z.object({ item_ref: itemRef, pairings: z.array(z.object({ item_ref: itemRef, reason: z.string().max(120) })).max(8) }),
  },
  bulk_price_update: {
    description: "Change prices for a whole category or a list of dishes by a percentage and/or flat amount (rounded to ₹5 by default).",
    schema: z.object({
      category: z.string().optional(),
      item_refs: z.array(itemRef).max(80).optional(),
      percent: z.number().min(-50).max(100).optional().describe("e.g. 10 for +10%"),
      flat_paise: z.number().int().min(-100000).max(100000).optional(),
      round_to_paise: z.number().int().min(100).max(10000).optional().describe("Rounding step, default 500 (₹5)"),
    }),
  },
  update_inventory: {
    description: "Set the quantity on hand of an inventory ingredient (e.g. after a delivery).",
    schema: z.object({ inventory_ref: z.string().min(1).describe("Ingredient name or id"), qty: z.number().min(0).max(100000) }),
  },
  create_coupon: {
    description: "Create a discount coupon.",
    schema: z.object({
      code: z.string().min(3).max(20).regex(/^[A-Za-z0-9]+$/),
      type: z.enum(["percent", "flat"]),
      value: z.number().int().positive().describe("Percent (1-100) or flat amount in paise"),
      min_order_paise: z.number().int().min(0).default(0),
      max_discount_paise: z.number().int().positive().optional(),
      valid_from: z.string().optional().describe("ISO datetime"),
      valid_to: z.string().optional().describe("ISO datetime"),
      usage_limit: z.number().int().positive().optional(),
      per_user_limit: z.number().int().positive().default(1),
      description: z.string().max(140).optional(),
    }),
  },
  update_coupon: {
    description: "Edit an existing coupon's value, limits or validity.",
    schema: z.object({
      code: z.string().min(3).max(20),
      value: z.number().int().positive().optional(),
      min_order_paise: z.number().int().min(0).optional(),
      max_discount_paise: z.number().int().positive().nullable().optional(),
      valid_from: z.string().nullable().optional(),
      valid_to: z.string().nullable().optional(),
      usage_limit: z.number().int().positive().nullable().optional(),
      per_user_limit: z.number().int().positive().optional(),
      is_active: z.boolean().optional(),
      description: z.string().max(140).optional(),
    }),
  },
  deactivate_coupon: {
    description: "Turn off a coupon immediately.",
    schema: z.object({ code: z.string().min(3).max(20) }),
  },
  update_reservation: {
    description: "Confirm, seat, complete, cancel or mark a reservation as no-show; optionally assign a table.",
    schema: z.object({ id: z.string().min(1), status: z.enum(["confirmed", "seated", "completed", "cancelled", "no_show"]), table_number: z.number().int().positive().optional() }),
  },
  reply_to_review: {
    description: "Post the owner's public reply to a review. Draft the reply; the owner can edit it on the card before confirming.",
    schema: z.object({ review_id: z.string().min(1), reply: z.string().min(2).max(600) }),
  },
  update_settings: {
    description: "Change restaurant settings: open/closed override, accepting orders, hours, fees, GST, minimum order, prep time, announcement.",
    schema: z.object({
      is_open_override: z.enum(["auto", "force_open", "force_closed"]).optional().describe("force_closed = closed today; auto = follow opening hours"),
      accepting_orders: z.boolean().optional(),
      opening_hours: z.record(z.string(), z.array(z.object({ open: z.string().regex(/^\d{2}:\d{2}$/), close: z.string().regex(/^\d{2}:\d{2}$/) }))).optional(),
      delivery_fee_paise: z.number().int().min(0).max(50000).optional(),
      free_delivery_above_paise: z.number().int().min(0).max(1000000).optional(),
      packaging_fee_paise: z.number().int().min(0).max(20000).optional(),
      gst_percent: z.number().min(0).max(28).optional(),
      min_order_paise: z.number().int().min(0).max(500000).optional(),
      avg_prep_minutes: z.number().int().min(5).max(120).optional(),
      delivery_radius_km: z.number().min(0).max(50).optional(),
      announcement: z.string().max(200).nullable().optional(),
      tagline: z.string().max(120).optional(),
      phone: z.string().max(30).optional(),
    }),
  },
} as const;

export type OwnerChangeSchemaName = keyof typeof OWNER_CHANGE_SCHEMAS;
