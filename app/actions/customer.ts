"use server";

/**
 * Server actions for the customer UI AND the chat cards' buttons. They call the
 * same service functions the customer agent's tools call, so state is identical
 * whichever path the user takes.
 */
import { revalidatePath } from "next/cache";
import { getSessionUser, type SessionUser } from "@/lib/auth";
import { ServiceError } from "@/lib/services/errors";
import * as cart from "@/lib/services/cart";
import * as orders from "@/lib/services/orders";
import * as account from "@/lib/services/account";
import { CUSTOMER_CONFIRMS, type CustomerConfirmName } from "@/lib/agents/customer/confirm";
import { audit } from "@/lib/agents/guard";
import { getMenu } from "@/lib/services/menu";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: string; data?: Record<string, unknown> };

async function run<T>(fn: (u: SessionUser) => Promise<T>): Promise<ActionResult<T>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please log in to continue.", code: "login_required" };
  try {
    return { ok: true, data: await fn(user) };
  } catch (e) {
    if (e instanceof ServiceError) return { ok: false, error: e.message, code: e.code, data: e.data };
    console.error(e);
    return { ok: false, error: "Something went wrong. Please try again.", code: "internal" };
  }
}

// ---------------------------------------------------------------- menu (public)
export async function getItemOptionsAction(itemId: string) {
  try {
    const menu = await getMenu();
    const i = menu.byId.get(itemId);
    if (!i) return { ok: false as const, error: "Dish not found." };
    return {
      ok: true as const,
      data: {
        id: i.id,
        name: i.name,
        price_paise: i.price_paise,
        allergens: i.allergens,
        variants: i.variants.map((v) => ({ id: v.id, name: v.name, price_delta_paise: v.price_delta_paise })),
        addons: i.addons.filter((a) => a.is_available).map((a) => ({ id: a.id, name: a.name, price_paise: a.price_paise })),
      },
    };
  } catch {
    return { ok: false as const, error: "Couldn't load options." };
  }
}

// ---------------------------------------------------------------- cart
export async function getCartAction() {
  return run((u) => cart.viewCart(u.userId));
}

export async function addToCartAction(input: cart.AddToCartInput) {
  return run(async (u) => {
    const r = await cart.addToCart(u.userId, input);
    return r;
  });
}

export async function addManyToCartAction(lines: { item_id: string; qty: number }[], acknowledgeConflicts = false) {
  return run((u) => cart.addManyToCart(u.userId, lines, { acknowledgeConflicts }));
}

export async function updateCartItemAction(input: cart.UpdateCartItemInput) {
  return run((u) => cart.updateCartItem(u.userId, input));
}

export async function removeFromCartAction(cartItemId: string) {
  return run((u) => cart.removeFromCart(u.userId, cartItemId));
}

export async function setOrderOptionsAction(input: cart.OrderOptionsInput) {
  return run((u) => cart.setOrderOptions(u.userId, input));
}

export async function applyCouponAction(code: string) {
  return run((u) => cart.applyCoupon(u.userId, code));
}

export async function removeCouponAction() {
  return run((u) => cart.removeCoupon(u.userId));
}

export async function listCouponsAction() {
  return run((u) => cart.listAvailableCoupons(u.userId));
}

export async function validateCheckoutAction() {
  return run(async (u) => {
    const v = await orders.validateCheckout(u.userId);
    return { ok: v.ok, errors: v.errors };
  });
}

// ---------------------------------------------------------------- orders
export async function reorderAction(orderId: string) {
  return run((u) => orders.reorder(u.userId, orderId));
}

export async function getOrderAction(orderId: string) {
  return run((u) => orders.getOrderForUser(u.userId, orderId));
}

// ---------------------------------------------------------------- account
export async function toggleFavoriteAction(itemId: string) {
  return run(async (u) => {
    const r = await account.toggleFavorite(u.userId, itemId);
    revalidatePath("/favorites");
    return r;
  });
}

export async function updateProfileAction(input: account.PreferencesInput) {
  return run(async (u) => {
    const r = await account.updatePreferences(u.userId, input);
    revalidatePath("/profile");
    return r;
  });
}

export async function addAddressAction(input: account.AddressInput) {
  return run(async (u) => {
    const r = await account.addAddress(u.userId, input);
    revalidatePath("/profile");
    revalidatePath("/checkout");
    return r;
  });
}

export async function deleteAddressAction(id: string) {
  return run(async (u) => {
    await account.deleteAddress(u.userId, id);
    revalidatePath("/profile");
    return true;
  });
}

export async function checkReservationAction(partySize: number, datetime: string) {
  return run(() => account.checkReservationAvailability(partySize, datetime));
}

export async function submitReviewAction(input: { order_id: string; rating: number; comment?: string; item_id?: string }) {
  return run(async (u) => {
    const r = await account.submitReview(u.userId, input);
    revalidatePath(`/orders/${input.order_id}`);
    return r;
  });
}

// ---------------------------------------------------------------- confirm-gated actions (human click)
export async function previewCustomerConfirmAction(name: CustomerConfirmName, args: unknown) {
  return run(async (u) => {
    const def = CUSTOMER_CONFIRMS[name];
    if (!def) throw new ServiceError("Unknown action.", "unknown");
    const parsed = def.schema.safeParse(args ?? {});
    if (!parsed.success) throw new ServiceError(parsed.error.issues.map((i) => i.message).join("; "), "invalid_input");
    return def.preview(u.userId, parsed.data as never);
  });
}

/** Executed only by a Confirm button click — never by the model. */
export async function executeCustomerConfirmAction(name: CustomerConfirmName, args: unknown) {
  return run(async (u) => {
    const def = CUSTOMER_CONFIRMS[name];
    if (!def) throw new ServiceError("Unknown action.", "unknown");
    const parsed = def.schema.safeParse(args ?? {});
    if (!parsed.success) throw new ServiceError(parsed.error.issues.map((i) => i.message).join("; "), "invalid_input");
    try {
      const r = await def.execute(u.userId, parsed.data as never, u.email);
      await audit({ ctx: { userId: u.userId, agent: "customer" }, tool: name, params: parsed.data, status: "success", summary: r.message, confirmed: true });
      revalidatePath("/orders");
      revalidatePath("/reservations");
      revalidatePath("/cart");
      return r;
    } catch (e) {
      await audit({ ctx: { userId: u.userId, agent: "customer" }, tool: name, params: parsed.data, status: "error", summary: (e as Error).message, confirmed: true });
      throw e;
    }
  });
}

export async function rejectCustomerConfirmAction(name: CustomerConfirmName, args: unknown) {
  const user = await getSessionUser();
  await audit({ ctx: { userId: user?.userId ?? null, agent: "customer" }, tool: name, params: args, status: "rejected_by_user", summary: "User cancelled" });
  return { ok: true as const, data: null };
}
