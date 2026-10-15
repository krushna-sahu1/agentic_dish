/** Transactional email via Resend. No-ops (logs) when RESEND_API_KEY is unset. */
import { BRAND } from "@/lib/brand";
import { formatINR, STATUS_LABEL } from "@/lib/format";
import { formatDateTime } from "@/lib/time";

const FROM = process.env.EMAIL_FROM || `${BRAND.name} <orders@resend.dev>`;

export async function sendEmail(to: string | null | undefined, subject: string, html: string): Promise<boolean> {
  if (!to) return false;
  if (!process.env.RESEND_API_KEY) {
    console.info(`[email skipped — RESEND_API_KEY unset] to=${to} subject=${subject}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    if (!res.ok) console.error("Resend error", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error("Resend failed", e);
    return false;
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, body: string) {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#faf7f2;padding:24px;color:#1c1917">
  <div style="max-width:560px;margin:auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e7e5e4">
  <h2 style="margin:0 0 12px;color:#c2410c">${esc(title)}</h2>${body}
  <p style="margin-top:24px;font-size:12px;color:#78716c">${BRAND.name} · <a href="${site}">${site}</a></p></div></body></html>`;
}

export interface EmailOrder {
  order_number: string;
  id: string;
  total_paise: number;
  status: string;
  estimated_ready_at?: string | null;
  items?: { name_snapshot: string; qty: number; line_total_paise: number }[];
}

export function orderConfirmationEmail(o: EmailOrder) {
  const rows = (o.items ?? [])
    .map((i) => `<tr><td>${i.qty} × ${esc(i.name_snapshot)}</td><td style="text-align:right">${formatINR(i.line_total_paise)}</td></tr>`)
    .join("");
  return layout(
    `Order ${o.order_number} confirmed`,
    `<p>Thanks! We've received your payment and the kitchen has your order.</p>
     <table style="width:100%;border-collapse:collapse">${rows}
     <tr><td style="padding-top:8px"><b>Total paid</b></td><td style="text-align:right;padding-top:8px"><b>${formatINR(o.total_paise)}</b></td></tr></table>
     <p><a href="${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/orders/${o.id}">Track your order</a></p>`,
  );
}

export function orderStatusEmail(o: EmailOrder) {
  const eta = o.estimated_ready_at ? `<p>Estimated time: ${formatDateTime(o.estimated_ready_at)}</p>` : "";
  return layout(
    `Order ${o.order_number}: ${STATUS_LABEL[o.status] ?? o.status}`,
    `<p>Your order is now <b>${esc(STATUS_LABEL[o.status] ?? o.status)}</b>.</p>${eta}
     <p><a href="${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/orders/${o.id}">Track your order</a></p>`,
  );
}

export function reservationEmail(r: { party_size: number; reserved_for: string; table_number: number | null }) {
  return layout(
    "Your table is booked",
    `<p>Table for <b>${r.party_size}</b> on <b>${formatDateTime(r.reserved_for)}</b>${r.table_number ? ` (table ${r.table_number})` : ""}.</p>
     <p>See you soon! Need to change it? Visit <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/reservations">your reservations</a>.</p>`,
  );
}

export function dailySummaryEmail(title: string, lines: string[]) {
  return layout(title, `<ul>${lines.map((l) => `<li style="margin:4px 0">${esc(l)}</li>`).join("")}</ul>
    <p><a href="${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/owner">Open your assistant</a></p>`);
}
