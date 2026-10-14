"use server";

/**
 * Owner/staff server actions. previewOwnerChange computes the before → after
 * diff; executeOwnerChange applies it and is called ONLY from a human Confirm
 * click (Confirm card in chat, or a button on the owner pages). Role is
 * re-checked server-side on every call (guard.canUseTool).
 */
import { revalidatePath } from "next/cache";
import { getSessionUser, type SessionUser } from "@/lib/auth";
import { ServiceError } from "@/lib/services/errors";
import { audit, canUseTool } from "@/lib/agents/guard";
import { OWNER_CHANGES, type ChangePreview, type OwnerChangeName } from "@/lib/agents/owner/changes";
import { getLiveKpis } from "@/lib/agents/owner/analytics";
import { listAlerts, listOrders, markAlertsRead } from "@/lib/services/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "./customer";

async function runOwner<T>(tool: string, fn: (u: SessionUser) => Promise<T>): Promise<ActionResult<T>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please log in.", code: "login_required" };
  const access = canUseTool({ agent: "owner", userId: user.userId, role: user.role }, tool);
  if (!access.ok) {
    await audit({ ctx: { userId: user.userId, agent: "owner" }, tool, params: null, status: "blocked", summary: access.message });
    return { ok: false, error: access.message, code: access.code };
  }
  try {
    return { ok: true, data: await fn(user) };
  } catch (e) {
    if (e instanceof ServiceError) return { ok: false, error: e.message, code: e.code, data: e.data };
    console.error(e);
    return { ok: false, error: (e as Error).message || "Something went wrong.", code: "internal" };
  }
}

function parse(name: OwnerChangeName, args: unknown) {
  const def = OWNER_CHANGES[name];
  if (!def) throw new ServiceError("Unknown change.", "unknown");
  const parsed = def.schema.safeParse(args ?? {});
  if (!parsed.success) throw new ServiceError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), "invalid_input");
  return { def, data: parsed.data };
}

export async function previewOwnerChange(name: OwnerChangeName, args: unknown): Promise<ActionResult<ChangePreview>> {
  return runOwner(name, async () => {
    const { def, data } = parse(name, args);
    return def.preview(data as never);
  });
}

/** Applies a change. Called only by a human click on a Confirm button. */
export async function executeOwnerChange(name: OwnerChangeName, args: unknown) {
  return runOwner(name, async (u) => {
    const { def, data } = parse(name, args);
    try {
      const r = await def.execute(data as never, u.userId);
      await audit({ ctx: { userId: u.userId, agent: "owner" }, tool: name, params: data, status: "success", summary: r.message, confirmed: true });
      revalidatePath("/owner", "layout");
      revalidatePath("/menu");
      return r;
    } catch (e) {
      await audit({ ctx: { userId: u.userId, agent: "owner" }, tool: name, params: data, status: "error", summary: (e as Error).message, confirmed: true });
      throw e;
    }
  });
}

export async function rejectOwnerChange(name: OwnerChangeName, args: unknown) {
  const user = await getSessionUser();
  await audit({ ctx: { userId: user?.userId ?? null, agent: "owner" }, tool: name, params: args, status: "rejected_by_user", summary: "Owner cancelled" });
  return { ok: true as const, data: null };
}

export async function liveKpisAction() {
  return runOwner("get_live_kpis", () => getLiveKpis());
}

export async function liveOrdersAction() {
  return runOwner("list_orders", async () => {
    const [active, done] = await Promise.all([
      listOrders({ active_only: true, limit: 100 }),
      listOrders({ status: ["completed", "cancelled"], range: { preset: "today" }, limit: 20 }),
    ]);
    return { active: active.orders, recent: done.orders };
  });
}

export async function alertsAction() {
  return runOwner("list_alerts", () => listAlerts({ limit: 30 }));
}

export async function markAlertsReadAction(ids?: string[]) {
  return runOwner("list_alerts", async () => {
    await markAlertsRead(ids);
    return true;
  });
}

/** Image upload for menu items (Supabase Storage, public bucket "dishes"). Owner only. */
export async function uploadDishImageAction(form: FormData) {
  return runOwner("update_menu_item", async () => {
    const file = form.get("file");
    if (!(file instanceof File)) throw new ServiceError("No file.", "invalid");
    if (!/^image\/(png|jpe?g|webp|avif)$/.test(file.type)) throw new ServiceError("Use a PNG, JPG, WebP or AVIF image.", "invalid");
    if (file.size > 4 * 1024 * 1024) throw new ServiceError("Image must be under 4 MB.", "invalid");
    const db = createAdminClient();
    await db.storage.createBucket("dishes", { public: true }).catch(() => undefined);
    const ext = file.type.split("/")[1].replace("jpeg", "jpg");
    const path = `menu/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await db.storage.from("dishes").upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (error) throw new ServiceError(`Upload failed: ${error.message}`, "upload_failed");
    return { url: db.storage.from("dishes").getPublicUrl(path).data.publicUrl };
  });
}
