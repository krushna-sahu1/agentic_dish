/** Row shapes for the tables the app reads. Money is integer paise. */

export type Role = "customer" | "staff" | "owner";
export type OrderType = "delivery" | "pickup" | "dine_in";
export type OrderStatus =
  | "awaiting_payment"
  | "paid"
  | "accepted"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "completed"
  | "cancelled"
  | "refunded"
  | "payment_failed";

export const ALLERGENS = ["dairy", "gluten", "nuts", "peanut", "soy", "sesame", "egg", "shellfish"] as const;
export type Allergen = (typeof ALLERGENS)[number];
export const DIETARY_PREFS = ["veg", "vegan", "jain", "gluten_free", "no_onion_garlic"] as const;
export type DietaryPref = (typeof DIETARY_PREFS)[number];
export const ITEM_TAGS = ["bestseller", "chef_special", "new", "healthy", "kids"] as const;
export type ItemTag = (typeof ITEM_TAGS)[number];

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  role: Role;
  dietary_prefs: DietaryPref[];
  spice_tolerance: number;
  allergies: string[];
  default_address_id: string | null;
}

export interface Address {
  id: string;
  user_id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  pincode: string;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string;
  price_paise: number;
  image_url: string | null;
  is_veg: boolean;
  is_vegan: boolean;
  is_jain: boolean;
  spice_level: number;
  allergens: Allergen[];
  tags: ItemTag[];
  calories: number | null;
  prep_time_min: number;
  portion: string | null;
  is_available: boolean;
  is_deleted: boolean;
  stock_qty: number | null;
  low_stock_threshold: number;
  sort_order: number;
}

export interface ItemVariant {
  id: string;
  menu_item_id: string;
  name: string;
  price_delta_paise: number;
  sort_order: number;
}

export interface ItemAddon {
  id: string;
  menu_item_id: string;
  name: string;
  price_paise: number;
  is_available: boolean;
}

export interface Settings {
  id: string;
  name: string;
  tagline: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  timezone: string;
  opening_hours: Record<string, { open: string; close: string }[]>;
  is_open_override: "auto" | "force_open" | "force_closed";
  delivery_radius_km: number;
  serviceable_pincodes: string[];
  delivery_fee_paise: number;
  free_delivery_above_paise: number;
  packaging_fee_paise: number;
  gst_percent: number;
  min_order_paise: number;
  avg_prep_minutes: number;
  accepting_orders: boolean;
  announcement: string | null;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  status: OrderStatus;
  order_type: OrderType;
  address_snapshot: Record<string, unknown> | null;
  table_number: number | null;
  scheduled_for: string | null;
  subtotal_paise: number;
  discount_paise: number;
  tax_paise: number;
  delivery_fee_paise: number;
  packaging_fee_paise: number;
  tip_paise: number;
  total_paise: number;
  coupon_code: string | null;
  notes: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  paid_at: string | null;
  cancelled_reason: string | null;
  estimated_ready_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  name_snapshot: string;
  unit_price_paise: number;
  variant_snapshot: { id: string; name: string; price_delta_paise: number } | null;
  addons_snapshot: { id: string; name: string; price_paise: number }[];
  qty: number;
  line_total_paise: number;
  special_instructions: string | null;
}

export interface OrderStatusEvent {
  id: string;
  order_id: string;
  status: OrderStatus;
  note: string | null;
  created_at: string;
}

export interface Reservation {
  id: string;
  user_id: string;
  party_size: number;
  reserved_for: string;
  status: "requested" | "confirmed" | "seated" | "completed" | "cancelled" | "no_show";
  table_number: number | null;
  notes: string | null;
  phone: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  order_id: string;
  user_id: string;
  menu_item_id: string | null;
  rating: number;
  comment: string | null;
  sentiment: "positive" | "neutral" | "negative" | null;
  owner_reply: string | null;
  created_at: string;
}
