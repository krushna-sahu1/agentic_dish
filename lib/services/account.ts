/** Profile, addresses, favorites, reservations and reviews for the signed-in customer. */
import { createAdminClient } from "@/lib/supabase/admin";
import { isWithinHours, type OpeningHours } from "@/lib/time";
import { reservationEmail, sendEmail } from "@/lib/email";
import { ALLERGENS, DIETARY_PREFS, type Address, type Profile, type Reservation } from "@/lib/types";
import { getMenu, itemSummary } from "./menu";
import { getSettings } from "./settings";
import { ServiceError } from "./errors";

const db = () => createAdminClient();

// ---------------------------------------------------------------- profile
export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await db().from("profiles").select("*").eq("user_id", userId).single();
  if (error) throw new Error(error.message);
  return data as Profile;
}

export interface PreferencesInput {
  full_name?: string;
  phone?: string | null;
  dietary_prefs?: string[];
  spice_tolerance?: number;
  allergies?: string[];
}

export async function updatePreferences(userId: string, input: PreferencesInput): Promise<Profile> {
  const patch: Record<string, unknown> = {};
  if (input.full_name !== undefined) patch.full_name = input.full_name.trim().slice(0, 100);
  if (input.phone !== undefined) {
    if (input.phone && !/^\+?[0-9 ]{10,15}$/.test(input.phone)) throw new ServiceError("Please enter a valid phone number.", "invalid_phone");
    patch.phone = input.phone || null;
  }
  if (input.dietary_prefs !== undefined) {
    const bad = input.dietary_prefs.filter((d) => !(DIETARY_PREFS as readonly string[]).includes(d));
    if (bad.length) throw new ServiceError(`Unknown dietary preference: ${bad.join(", ")}`, "invalid");
    patch.dietary_prefs = [...new Set(input.dietary_prefs)];
  }
  if (input.spice_tolerance !== undefined) {
    if (input.spice_tolerance < 0 || input.spice_tolerance > 5) throw new ServiceError("Spice tolerance is 0–5.", "invalid");
    patch.spice_tolerance = Math.round(input.spice_tolerance);
  }
  if (input.allergies !== undefined) {
    const norm = input.allergies.map((a) => a.toLowerCase().trim()).map((a) => (a === "peanuts" ? "peanut" : a === "milk" || a === "lactose" ? "dairy" : a === "wheat" ? "gluten" : a === "prawn" || a === "shrimp" ? "shellfish" : a));
    const bad = norm.filter((a) => !(ALLERGENS as readonly string[]).includes(a));
    if (bad.length) throw new ServiceError(`We track these allergens: ${ALLERGENS.join(", ")}. Unknown: ${bad.join(", ")}`, "invalid");
    patch.allergies = [...new Set(norm)];
  }
  const { data, error } = await db().from("profiles").update(patch).eq("user_id", userId).select("*").single();
  if (error) throw new Error(error.message);
  return data as Profile;
}

// ---------------------------------------------------------------- addresses
export async function listAddresses(userId: string): Promise<Address[]> {
  const { data } = await db().from("addresses").select("*").eq("user_id", userId).order("is_default", { ascending: false }).order("created_at");
  return (data ?? []) as Address[];
}

export interface AddressInput {
  label?: string;
  line1: string;
  line2?: string | null;
  city: string;
  pincode: string;
  lat?: number | null;
  lng?: number | null;
  is_default?: boolean;
}

export async function addAddress(userId: string, input: AddressInput): Promise<Address> {
  if (!/^[0-9]{6}$/.test(input.pincode)) throw new ServiceError("Pincode must be 6 digits.", "invalid_pincode");
  const existing = await listAddresses(userId);
  const makeDefault = input.is_default || existing.length === 0;
  if (makeDefault) await db().from("addresses").update({ is_default: false }).eq("user_id", userId);
  const { data, error } = await db()
    .from("addresses")
    .insert({
      user_id: userId,
      label: input.label?.slice(0, 40) || "Home",
      line1: input.line1.slice(0, 200),
      line2: input.line2?.slice(0, 200) || null,
      city: input.city.slice(0, 80),
      pincode: input.pincode,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      is_default: makeDefault,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  if (makeDefault) await db().from("profiles").update({ default_address_id: data.id }).eq("user_id", userId);
  return data as Address;
}

export async function deleteAddress(userId: string, id: string) {
  await db().from("addresses").delete().eq("id", id).eq("user_id", userId);
}

// ---------------------------------------------------------------- favorites
export async function toggleFavorite(userId: string, itemId: string) {
  const menu = await getMenu();
  const item = menu.byId.get(itemId) ?? menu.items.find((i) => i.slug === itemId);
  if (!item) throw new ServiceError("Dish not found.", "not_found");
  const { data } = await db().from("favorites").select("id").eq("user_id", userId).eq("menu_item_id", item.id).maybeSingle();
  if (data) {
    await db().from("favorites").delete().eq("id", data.id);
    return { item: item.name, favorite: false };
  }
  await db().from("favorites").insert({ user_id: userId, menu_item_id: item.id });
  return { item: item.name, favorite: true };
}

export async function listFavorites(userId: string) {
  const [menu, { data }] = await Promise.all([getMenu(), db().from("favorites").select("menu_item_id").eq("user_id", userId)]);
  return (data ?? []).map((f) => menu.byId.get(f.menu_item_id as string)).filter(Boolean).map((i) => itemSummary(i!));
}

export async function favoriteIds(userId: string): Promise<string[]> {
  const { data } = await db().from("favorites").select("menu_item_id").eq("user_id", userId);
  return (data ?? []).map((f) => f.menu_item_id as string);
}

// ---------------------------------------------------------------- reservations
const SLOT_MINUTES = 90;

async function freeTables(partySize: number, at: Date, excludeId?: string) {
  const [{ data: tables }, { data: overlapping }] = await Promise.all([
    db().from("tables").select("number, capacity").eq("is_active", true).gte("capacity", partySize).order("capacity"),
    db()
      .from("reservations")
      .select("id, table_number")
      .in("status", ["requested", "confirmed", "seated"])
      .gt("reserved_for", new Date(at.getTime() - SLOT_MINUTES * 60_000).toISOString())
      .lt("reserved_for", new Date(at.getTime() + SLOT_MINUTES * 60_000).toISOString()),
  ]);
  const taken = new Set((overlapping ?? []).filter((r) => r.id !== excludeId).map((r) => r.table_number));
  return (tables ?? []).filter((t) => !taken.has(t.number));
}

export async function checkReservationAvailability(partySize: number, datetime: string) {
  const at = new Date(datetime);
  if (Number.isNaN(at.getTime())) throw new ServiceError("I couldn't understand that date/time.", "invalid_time");
  if (partySize < 1 || partySize > 20) throw new ServiceError("Party size must be 1–20.", "invalid");
  if (at.getTime() < Date.now() + 30 * 60_000) throw new ServiceError("Reservations need at least 30 minutes' notice.", "invalid_time");
  if (at.getTime() > Date.now() + 60 * 86_400_000) throw new ServiceError("We take reservations up to 60 days ahead.", "invalid_time");
  const s = await getSettings();
  const hours = s.opening_hours as OpeningHours;
  if (!isWithinHours(hours, at, s.timezone)) {
    return { available: false, reason: "We're closed at that time.", alternatives: await alternatives(partySize, at, hours, s.timezone) };
  }
  const free = await freeTables(partySize, at);
  if (!free.length) {
    if (partySize > 8) return { available: false, reason: "Our largest table seats 8 — please call us for larger groups.", alternatives: [] };
    return { available: false, reason: "We're fully booked for that time.", alternatives: await alternatives(partySize, at, hours, s.timezone) };
  }
  return { available: true, table_number: free[0].number, capacity: free[0].capacity };
}

async function alternatives(partySize: number, at: Date, hours: OpeningHours, tz: string) {
  const out: string[] = [];
  for (const delta of [-30, 30, -60, 60, -90, 90, 120]) {
    const t = new Date(at.getTime() + delta * 60_000);
    if (t.getTime() < Date.now() + 30 * 60_000 || !isWithinHours(hours, t, tz)) continue;
    if ((await freeTables(partySize, t)).length) out.push(t.toISOString());
    if (out.length >= 3) break;
  }
  return out;
}

export async function createReservation(userId: string, input: { party_size: number; datetime: string; notes?: string | null }, email?: string | null) {
  const avail = await checkReservationAvailability(input.party_size, input.datetime);
  if (!avail.available) throw new ServiceError(avail.reason ?? "Not available.", "unavailable", { alternatives: avail.alternatives });
  const profile = await getProfile(userId);
  const { data, error } = await db()
    .from("reservations")
    .insert({
      user_id: userId,
      party_size: input.party_size,
      reserved_for: new Date(input.datetime).toISOString(),
      status: "confirmed",
      table_number: avail.table_number,
      notes: input.notes?.slice(0, 500) || null,
      phone: profile.phone,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  void sendEmail(email, "Your table is booked", reservationEmail(data as Reservation));
  return data as Reservation;
}

export async function listMyReservations(userId: string): Promise<Reservation[]> {
  const { data } = await db().from("reservations").select("*").eq("user_id", userId).order("reserved_for", { ascending: false }).limit(20);
  return (data ?? []) as Reservation[];
}

export async function cancelReservation(userId: string, id: string) {
  const { data: r } = await db().from("reservations").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  if (!r) throw new ServiceError("Reservation not found.", "not_found");
  if (!["requested", "confirmed"].includes(r.status)) throw new ServiceError(`This reservation is ${r.status} and can't be cancelled.`, "invalid");
  await db().from("reservations").update({ status: "cancelled" }).eq("id", id);
  return { id, status: "cancelled" as const };
}

// ---------------------------------------------------------------- reviews
export function sentimentFor(rating: number, comment?: string | null): "positive" | "neutral" | "negative" {
  const c = (comment ?? "").toLowerCase();
  const neg = /(cold|late|soggy|oily|stale|rude|missing|bad|worst|tough|undercooked|raw|hair|never again)/.test(c);
  if (rating <= 2) return "negative";
  if (rating === 3) return neg ? "negative" : "neutral";
  return neg && rating === 4 ? "neutral" : "positive";
}

export async function submitReview(userId: string, input: { order_id: string; rating: number; comment?: string | null; item_id?: string | null }) {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw new ServiceError("Rating must be 1–5 stars.", "invalid");
  const { data: order } = await db()
    .from("orders")
    .select("id, status, order_number, order_items(menu_item_id, name_snapshot)")
    .eq("user_id", userId)
    .or(`id.eq.${/^[0-9a-f-]{36}$/i.test(input.order_id) ? input.order_id : "00000000-0000-0000-0000-000000000000"},order_number.ilike.%${input.order_id.replace(/[^A-Za-z0-9-]/g, "")}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!order) throw new ServiceError("I couldn't find that order on your account.", "not_found");
  if (order.status !== "completed") throw new ServiceError("You can review an order once it's completed.", "invalid");
  let itemId: string | null = null;
  if (input.item_id) {
    const items = order.order_items as { menu_item_id: string; name_snapshot: string }[];
    const m = items.find((i) => i.menu_item_id === input.item_id || i.name_snapshot.toLowerCase() === input.item_id!.toLowerCase());
    if (!m) throw new ServiceError("That dish wasn't in this order.", "invalid");
    itemId = m.menu_item_id;
  }
  const { data, error } = await db()
    .from("reviews")
    .insert({
      order_id: order.id,
      user_id: userId,
      menu_item_id: itemId,
      rating: input.rating,
      comment: input.comment?.slice(0, 1000) || null,
      sentiment: sentimentFor(input.rating, input.comment),
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") throw new ServiceError("You've already reviewed this.", "duplicate");
    throw new Error(error.message);
  }
  if (input.rating <= 2) {
    await db().from("owner_alerts").insert({
      type: "negative_review",
      title: `${input.rating}★ review on ${order.order_number}`,
      body: (input.comment ?? "").slice(0, 300),
      severity: "warning",
      data: { review_id: data.id, order_id: order.id },
    });
  }
  return data;
}
