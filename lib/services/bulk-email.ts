/**
 * Owner bulk email. draftEmail() (the AI's only tool) creates or revises a
 * draft and a DRAFT coupon — it never sends. sendDraft() runs only from the
 * owner's Send tap (app/actions/email.ts): it re-resolves recipients, activates
 * the coupon and sends through Resend's batch API in throttled batches.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { formatINR, maskEmail } from "@/lib/format";
import { describeCoupon, type CouponRow } from "@/lib/coupons";
import { addDays, startOfZonedDay, zonedDateString } from "@/lib/time";
import { getSettings } from "@/lib/services/settings";
import { resolveItem } from "@/lib/services/menu";
import { ServiceError } from "@/lib/services/errors";
import { GROUP_DEFAULTS, type DraftEmailInput, type EmailDraftView, type EmailOffer, type EmailTo } from "@/lib/bulk-email/schema";
import { couponBox, firstName, renderBulkEmail } from "@/lib/bulk-email/template";
import { unsubscribeHeaders, unsubscribePageUrl } from "@/lib/bulk-email/unsubscribe";

const db = () => createAdminClient();

export const MAX_RECIPIENTS = 2000;
export const BATCH_SIZE = 100; // Resend batch API limit per call
const BATCH_PAUSE_MS = 550; // stay under Resend's default 2 requests/second

interface Recipient {
  user_id: string | null;
  email: string;
  full_name: string | null;
}

interface DraftRow {
  id: string;
  status: EmailDraftView["status"];
  version: number;
  goal: string | null;
  audience: EmailTo & { dish_id?: string; dish_name?: string };
  audience_label: string;
  recipient_count: number;
  subject: string;
  message: string;
  coupon_id: string | null;
}

const site = () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
export const resendConfigured = () => Boolean(process.env.RESEND_API_KEY);

// ---------------------------------------------------------------- audience
type ResolvedTo = EmailTo & { dish_id?: string; dish_name?: string };

async function normalizeTo(to: EmailTo): Promise<ResolvedTo> {
  if (to.emails?.length) return { emails: [...new Set(to.emails.map((e) => e.trim().toLowerCase()))] };
  if (!to.group) throw new ServiceError("Who should get this email? Say specific addresses or a group (all, inactive, new, loyal, big spenders, or people who ordered a dish).", "invalid_input");
  if (to.group === "ordered_dish") {
    if (!to.dish) throw new ServiceError("Which dish? e.g. “customers who ordered masala dosa”.", "invalid_input");
    const item = await resolveItem(to.dish);
    return { group: "ordered_dish", dish: to.dish, dish_id: item.id, dish_name: item.name };
  }
  return { group: to.group, days: to.days, min_orders: to.min_orders, min_spend_rupees: to.min_spend_rupees };
}

export function audienceLabel(to: ResolvedTo): string {
  if (to.emails?.length) return to.emails.length === 1 ? to.emails[0] : `${to.emails.length} addresses: ${to.emails.slice(0, 2).join(", ")}${to.emails.length > 2 ? "…" : ""}`;
  const days = to.days ?? GROUP_DEFAULTS.days;
  switch (to.group) {
    case "all":
      return "All customers";
    case "inactive":
      return `Customers with no order in the last ${days} days`;
    case "new":
      return `New customers (first order in the last ${days} days)`;
    case "loyal":
      return `Loyal customers (${to.min_orders ?? GROUP_DEFAULTS.min_orders}+ orders)`;
    case "big_spenders":
      return `Big spenders (${formatINR((to.min_spend_rupees ?? GROUP_DEFAULTS.min_spend_rupees) * 100)}+ spent)`;
    case "ordered_dish":
      return `Customers who ordered ${to.dish_name ?? to.dish}`;
    default:
      return "Customers";
  }
}

export async function resolveRecipients(to: ResolvedTo): Promise<Recipient[]> {
  const { data, error } = await db().rpc("email_audience", {
    p_group: to.emails?.length ? "emails" : to.group,
    p_days: to.days ?? GROUP_DEFAULTS.days,
    p_min_orders: to.min_orders ?? GROUP_DEFAULTS.min_orders,
    p_min_spend_paise: (to.min_spend_rupees ?? GROUP_DEFAULTS.min_spend_rupees) * 100,
    p_dish_id: to.dish_id ?? null,
    p_emails: to.emails ?? null,
  });
  if (error) throw new Error(`email_audience: ${error.message}`);
  return (data ?? []) as Recipient[];
}

// ---------------------------------------------------------------- coupon
function couponCode(subject: string, offer: EmailOffer): string {
  const word = (subject.toUpperCase().match(/[A-Z]{3,}/g) ?? ["OFFER"]).find((w) => !["THE", "AND", "FOR", "YOU", "OUR", "WITH"].includes(w)) ?? "OFFER";
  const amount = offer.percent_off ?? offer.flat_off_rupees ?? "";
  const rand = Math.random().toString(36).slice(2, 4).toUpperCase().replace(/[^A-Z0-9]/g, "X");
  return `${word.slice(0, 8)}${amount}${rand}`;
}

export function offerToCoupon(offer: EmailOffer, subject: string, now = new Date()) {
  if ((offer.percent_off == null) === (offer.flat_off_rupees == null)) throw new ServiceError("An offer needs either a percent off or a flat rupee amount (not both).", "invalid_input");
  const today = zonedDateString(now);
  const starts = offer.starts_on && offer.starts_on > today ? offer.starts_on : today;
  if (offer.ends_on < starts) throw new ServiceError(`The offer would end (${offer.ends_on}) before it starts (${starts}).`, "invalid_input");
  const percent = offer.percent_off != null;
  return {
    code: couponCode(subject, offer),
    type: percent ? ("percent" as const) : ("flat" as const),
    value: percent ? offer.percent_off! : offer.flat_off_rupees! * 100,
    min_order_paise: (offer.min_order_rupees ?? 0) * 100,
    max_discount_paise: percent && offer.max_discount_rupees ? offer.max_discount_rupees * 100 : null,
    valid_from: startOfZonedDay(starts).toISOString(),
    valid_to: startOfZonedDay(addDays(offer.ends_on, 1)).toISOString(),
    usage_limit: null,
    per_user_limit: 1,
    is_active: false,
    is_draft: true,
  };
}

async function createDraftCoupon(offer: EmailOffer, subject: string): Promise<CouponRow> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = offerToCoupon(offer, subject);
    const { data, error } = await db()
      .from("coupons")
      .insert({ ...row, description: describeCoupon(row) })
      .select("*")
      .single();
    if (!error) return data as CouponRow;
    if (error.code !== "23505") throw new ServiceError(`Couldn't create the coupon: ${error.message}`, "create_failed");
  }
  throw new ServiceError("Couldn't create a unique coupon code. Try again.", "create_failed");
}

/** Only an unused draft coupon is ever deleted. */
async function dropDraftCoupon(couponId: string | null) {
  if (couponId) await db().from("coupons").delete().eq("id", couponId).eq("is_draft", true);
}

// ---------------------------------------------------------------- views
async function loadDraft(id: string): Promise<DraftRow> {
  const { data } = await db().from("email_drafts").select("*").eq("id", id).maybeSingle();
  if (!data) throw new ServiceError("That email draft doesn't exist.", "not_found");
  return data as DraftRow;
}

async function toView(d: DraftRow): Promise<EmailDraftView> {
  let coupon: EmailDraftView["coupon"] = null;
  if (d.coupon_id) {
    const { data } = await db().from("coupons").select("*").eq("id", d.coupon_id).maybeSingle();
    if (data) coupon = couponBox(data as CouponRow);
  }
  const recipients = d.status === "draft" ? await resolveRecipients(d.audience) : [];
  const count = d.status === "draft" ? Math.min(recipients.length, MAX_RECIPIENTS) : d.recipient_count;
  const warnings: string[] = [];
  if (d.status === "draft" && recipients.length === 0) warnings.push("Nobody matches this audience (or they've all unsubscribed).");
  if (recipients.length > MAX_RECIPIENTS) warnings.push(`${recipients.length} people match; only the first ${MAX_RECIPIENTS} will be emailed.`);
  if (!resendConfigured()) warnings.push("Email isn't set up yet (RESEND_API_KEY), so Send will fail.");
  const people = count === 1 ? "1 person" : `${count} people`;
  return {
    draft_id: d.id,
    version: d.version,
    status: d.status,
    audience_label: d.audience_label,
    recipient_count: count,
    sample: recipients.slice(0, 3).map((r) => maskEmail(r.email) ?? r.email),
    subject: d.subject,
    message: d.message,
    coupon,
    warnings,
    next_step:
      d.status !== "draft"
        ? `This email is ${d.status}.`
        : count === 0
          ? "Nothing to send: no one matches. Suggest a different group."
          : `NOTHING HAS BEEN SENT. Tell the owner briefly: "Ready to email ${people}. Tap Send to confirm." Never say it was sent.`,
  };
}

export async function getDraftView(id: string) {
  return toView(await loadDraft(id));
}

// ---------------------------------------------------------------- draft (AI tool)
export async function draftEmail(userId: string | null, input: DraftEmailInput): Promise<EmailDraftView> {
  if (input.offer && input.remove_offer) throw new ServiceError("Either add an offer or remove it, not both.", "invalid_input");

  if (!input.draft_id) {
    if (!input.to) throw new ServiceError("Who should get this email?", "invalid_input");
    if (!input.subject || !input.message) throw new ServiceError("Write a subject and message from the owner's goal.", "invalid_input");
    const to = await normalizeTo(input.to);
    const coupon = input.offer ? await createDraftCoupon(input.offer, input.subject) : null;
    const recipients = await resolveRecipients(to);
    const { data, error } = await db()
      .from("email_drafts")
      .insert({
        created_by: userId,
        goal: input.goal ?? null,
        audience: to,
        audience_label: audienceLabel(to),
        recipient_count: Math.min(recipients.length, MAX_RECIPIENTS),
        subject: input.subject,
        message: input.message,
        coupon_id: coupon?.id ?? null,
      })
      .select("*")
      .single();
    if (error) {
      await dropDraftCoupon(coupon?.id ?? null);
      throw new ServiceError(`Couldn't save the draft: ${error.message}`, "create_failed");
    }
    return toView(data as DraftRow);
  }

  const cur = await loadDraft(input.draft_id);
  if (cur.status !== "draft") throw new ServiceError(`That email was already ${cur.status}. Start a new draft.`, "invalid_state");
  const patch: Record<string, unknown> = { version: cur.version + 1, updated_at: new Date().toISOString() };
  if (input.to) {
    const to = await normalizeTo(input.to);
    patch.audience = to;
    patch.audience_label = audienceLabel(to);
    patch.recipient_count = Math.min((await resolveRecipients(to)).length, MAX_RECIPIENTS);
  }
  if (input.subject) patch.subject = input.subject;
  if (input.message) patch.message = input.message;
  if (input.goal) patch.goal = input.goal;
  let oldCoupon: string | null = null;
  if (input.offer) {
    patch.coupon_id = (await createDraftCoupon(input.offer, input.subject ?? cur.subject)).id;
    oldCoupon = cur.coupon_id;
  } else if (input.remove_offer) {
    patch.coupon_id = null;
    oldCoupon = cur.coupon_id;
  }
  const { data, error } = await db().from("email_drafts").update(patch).eq("id", cur.id).eq("version", cur.version).eq("status", "draft").select("*").maybeSingle();
  if (error || !data) {
    if (input.offer) await dropDraftCoupon(patch.coupon_id as string);
    throw new ServiceError("The draft changed at the same time — try again.", "conflict");
  }
  await dropDraftCoupon(oldCoupon);
  return toView(data as DraftRow);
}

/** Owner typing on the card's Edit form. */
export async function editDraftText(id: string, version: number, fields: { subject: string; message: string }) {
  const subject = fields.subject.trim();
  const message = fields.message.trim();
  if (subject.length < 3 || subject.length > 120) throw new ServiceError("Subject should be 3–120 characters.", "invalid_input");
  if (message.length < 10 || message.length > 2000) throw new ServiceError("Message should be 10–2000 characters.", "invalid_input");
  const { data } = await db()
    .from("email_drafts")
    .update({ subject, message, version: version + 1, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("version", version)
    .eq("status", "draft")
    .select("*")
    .maybeSingle();
  if (!data) throw new ServiceError("This draft was changed or already sent. Use the latest preview.", "conflict");
  return toView(data as DraftRow);
}

export async function cancelDraft(id: string) {
  const { data } = await db().from("email_drafts").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", id).eq("status", "draft").select("*").maybeSingle();
  if (!data) throw new ServiceError("Only an unsent draft can be cancelled.", "invalid_state");
  await dropDraftCoupon((data as DraftRow).coupon_id);
  return toView({ ...(data as DraftRow), coupon_id: null });
}

// ---------------------------------------------------------------- send (owner tap only)
type ResendEmail = { from: string; to: string[]; subject: string; html: string; text: string; headers: Record<string, string>; reply_to?: string };

async function postBatch(emails: ResendEmail[], idempotencyKey: string): Promise<{ ids: string[] } | { error: string }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    let res: Response;
    try {
      res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(emails),
      });
    } catch (e) {
      if (attempt === 3) return { error: (e as Error).message };
      await sleep(1000 * (attempt + 1));
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      if (attempt === 3) return { error: `Resend ${res.status}` };
      const wait = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(wait) && wait > 0 ? wait * 1000 : 1000 * (attempt + 1));
      continue;
    }
    const body = (await res.json().catch(() => ({}))) as { data?: { id: string }[]; message?: string };
    if (!res.ok) return { error: body.message ?? `Resend ${res.status}` };
    return { ids: (body.data ?? []).map((d) => d.id) };
  }
  return { error: "Resend unavailable" };
}

const sleep = (ms: number) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

export async function sendDraft(id: string, version: number, actorUserId: string, opts: { pauseMs?: number } = {}) {
  if (!resendConfigured()) throw new ServiceError("Email isn't set up yet — add RESEND_API_KEY to .env.local.", "not_configured");
  const d = await loadDraft(id);
  if (d.status !== "draft") throw new ServiceError(`This email was already ${d.status}.`, "invalid_state");
  if (d.version !== version) throw new ServiceError("This draft changed since you saw it. Check the latest preview, then tap Send there.", "conflict");

  const recipients = (await resolveRecipients(d.audience)).slice(0, MAX_RECIPIENTS);
  if (!recipients.length) throw new ServiceError("Nobody to email — no one matches (or they've all unsubscribed).", "empty_audience");

  // Claim it: exactly one Send tap wins.
  const { data: claimed } = await db()
    .from("email_drafts")
    .update({ status: "sending", sent_by: actorUserId, recipient_count: recipients.length, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("version", version)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (!claimed) throw new ServiceError("This email is already being sent or was changed.", "conflict");

  let sent = 0;
  let failed = 0;
  try {
    let coupon: CouponRow | null = null;
    if (d.coupon_id) {
      const { data, error } = await db().from("coupons").update({ is_draft: false, is_active: true }).eq("id", d.coupon_id).select("*").single();
      if (error) throw new Error(`Couldn't activate the coupon: ${error.message}`);
      coupon = data as CouponRow;
    }
    const settings = await getSettings();
    const box = coupon ? couponBox(coupon) : null;
    const orderUrl = `${site()}/menu${coupon ? `?coupon=${encodeURIComponent(coupon.code)}` : ""}`;
    const from = process.env.EMAIL_FROM || `${settings.name} <onboarding@resend.dev>`;
    const footer = [settings.address, settings.phone].filter(Boolean).join(" · ") || null;

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const chunk = recipients.slice(i, i + BATCH_SIZE);
      const emails: ResendEmail[] = chunk.map((r) => {
        const { html, text } = renderBulkEmail({ restaurantName: settings.name, firstName: firstName(r.full_name), message: d.message, coupon: box, orderUrl, unsubscribeUrl: unsubscribePageUrl(r.email), footer });
        return { from, to: [r.email], subject: d.subject, html, text, headers: unsubscribeHeaders(r.email), ...(settings.email ? { reply_to: settings.email } : {}) };
      });
      const res = await postBatch(emails, `email-${id}-v${version}-b${i / BATCH_SIZE}`);
      const rows = chunk.map((r, j) =>
        "ids" in res ? { draft_id: id, email: r.email, user_id: r.user_id, resend_id: res.ids[j] ?? null, status: "sent" } : { draft_id: id, email: r.email, user_id: r.user_id, status: "failed", error: res.error.slice(0, 300) },
      );
      await db().from("email_sends").upsert(rows, { onConflict: "draft_id,email", ignoreDuplicates: true });
      if ("ids" in res) sent += chunk.length;
      else failed += chunk.length;
      if (i + BATCH_SIZE < recipients.length) await sleep(opts.pauseMs ?? BATCH_PAUSE_MS);
    }
  } catch (e) {
    await db().from("email_drafts").update({ status: "failed", sent_count: sent, failed_count: failed, error: (e as Error).message.slice(0, 500), updated_at: new Date().toISOString() }).eq("id", id);
    throw e;
  }

  const status = sent ? "sent" : "failed";
  await db()
    .from("email_drafts")
    .update({ status, sent_count: sent, failed_count: failed, sent_at: sent ? new Date().toISOString() : null, error: failed ? `${failed} failed` : null, updated_at: new Date().toISOString() })
    .eq("id", id);
  return { status, sent, failed, recipient_count: recipients.length, subject: d.subject };
}
