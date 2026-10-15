/**
 * Signed unsubscribe links (server-only). The token is an HMAC of the address,
 * so links work for customers and plain addresses alike and can't be forged.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  const s = process.env.EMAIL_UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.CRON_SECRET;
  if (!s) throw new Error("Set EMAIL_UNSUBSCRIBE_SECRET to sign unsubscribe links.");
  return s;
}

const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64url");

export function unsubscribeToken(email: string): string {
  return createHmac("sha256", secret()).update(`unsubscribe:${email.trim().toLowerCase()}`).digest("base64url").slice(0, 32);
}

const site = () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

function query(email: string) {
  return `e=${b64url(email.trim().toLowerCase())}&t=${unsubscribeToken(email)}`;
}

/** Footer link → confirmation page. */
export const unsubscribePageUrl = (email: string) => `${site()}/unsubscribe?${query(email)}`;
/** RFC 8058 one-click target (List-Unsubscribe-Post). */
export const unsubscribeOneClickUrl = (email: string) => `${site()}/api/unsubscribe?${query(email)}`;

export function unsubscribeHeaders(email: string): Record<string, string> {
  return { "List-Unsubscribe": `<${unsubscribeOneClickUrl(email)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
}

/** Returns the address if the link is genuine, else null. */
export function verifyUnsubscribe(e: string | null | undefined, t: string | null | undefined): string | null {
  if (!e || !t) return null;
  let email: string;
  try {
    email = Buffer.from(e, "base64url").toString("utf8").trim().toLowerCase();
  } catch {
    return null;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  const want = Buffer.from(unsubscribeToken(email));
  const got = Buffer.from(t);
  return want.length === got.length && timingSafeEqual(want, got) ? email : null;
}
