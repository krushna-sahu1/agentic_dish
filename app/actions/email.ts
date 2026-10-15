"use server";

/**
 * Bulk email buttons on the preview card (owner only). Send is the ONLY path
 * that emails anyone, and it runs only from a human tap — never from an AI tool.
 */
import { revalidatePath } from "next/cache";
import { getSessionUser, type SessionUser } from "@/lib/auth";
import { audit } from "@/lib/agents/guard";
import { ServiceError } from "@/lib/services/errors";
import { cancelDraft, editDraftText, getDraftView, sendDraft } from "@/lib/services/bulk-email";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyUnsubscribe } from "@/lib/bulk-email/unsubscribe";
import type { ActionResult } from "./customer";

async function ownerOnly<T>(tool: string, params: unknown, fn: (u: SessionUser) => Promise<T>, opts: { confirmed?: boolean; summary?: (r: T) => string } = {}): Promise<ActionResult<T>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please log in.", code: "login_required" };
  const ctx = { userId: user.userId, agent: "owner" as const };
  if (user.role !== "owner") {
    await audit({ ctx, tool, params, status: "blocked", summary: "Bulk email is owner-only" });
    return { ok: false, error: "Only the owner can email customers.", code: "forbidden" };
  }
  try {
    const data = await fn(user);
    await audit({ ctx, tool, params, status: "success", summary: opts.summary?.(data), confirmed: opts.confirmed });
    return { ok: true, data };
  } catch (e) {
    await audit({ ctx, tool, params, status: "error", summary: (e as Error).message, confirmed: opts.confirmed });
    if (e instanceof ServiceError) return { ok: false, error: e.message, code: e.code };
    console.error(`[${tool}]`, e);
    return { ok: false, error: "Something went wrong sending the email. Please try again.", code: "internal" };
  }
}

export async function sendEmailDraftAction(draftId: string, version: number) {
  return ownerOnly("send_email", { draft_id: draftId, version }, async (u) => {
    const r = await sendDraft(draftId, version, u.userId);
    revalidatePath("/owner", "layout");
    return r;
  }, { confirmed: true, summary: (r) => `Sent "${r.subject}" to ${r.sent} of ${r.recipient_count}${r.failed ? ` (${r.failed} failed)` : ""}` });
}

export async function editEmailDraftAction(draftId: string, version: number, fields: { subject: string; message: string }) {
  return ownerOnly("edit_email_draft", { draft_id: draftId, version }, () => editDraftText(draftId, version, fields), { summary: () => "Owner edited the draft" });
}

export async function cancelEmailDraftAction(draftId: string) {
  return ownerOnly("cancel_email_draft", { draft_id: draftId }, () => cancelDraft(draftId), { summary: () => "Draft cancelled; draft coupon removed" });
}

export async function getEmailDraftAction(draftId: string) {
  return ownerOnly("get_email_draft", { draft_id: draftId }, () => getDraftView(draftId));
}

// ---------------------------------------------------------------- recipients

/** Footer link confirmation (signed link; no login needed). */
export async function unsubscribeAction(e: string, t: string) {
  const email = verifyUnsubscribe(e, t);
  if (!email) return { ok: false as const, error: "This unsubscribe link isn't valid." };
  await createAdminClient().from("email_unsubscribes").upsert({ email }, { onConflict: "email", ignoreDuplicates: true });
  return { ok: true as const, email };
}

/** Profile toggle: "Email me offers and updates". */
export async function setOfferEmailsAction(on: boolean) {
  const user = await getSessionUser();
  if (!user?.email) return { ok: false as const, error: "Please log in." };
  const email = user.email.toLowerCase();
  const db = createAdminClient();
  if (on) await db.from("email_unsubscribes").delete().eq("email", email);
  else await db.from("email_unsubscribes").upsert({ email }, { onConflict: "email", ignoreDuplicates: true });
  return { ok: true as const, on };
}
