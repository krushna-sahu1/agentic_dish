/**
 * Bulk email template (HTML + plain text). The offer box is built from the
 * coupon row only — never from AI-written text — so the discount and dates
 * customers see are exactly what the code enforces.
 */
import { describeCoupon, type CouponRow } from "@/lib/coupons";
import { DEFAULT_TZ } from "@/lib/time";

export interface CouponBox {
  code: string;
  headline: string;
  detail: string;
  validity: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const day = (d: Date) => d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: DEFAULT_TZ }).replace(",", "");

export function couponBox(c: Pick<CouponRow, "code" | "type" | "value" | "min_order_paise" | "max_discount_paise" | "valid_from" | "valid_to">, now = new Date()): CouponBox {
  const headline = c.type === "percent" ? `${c.value}% OFF` : `₹${Math.round(c.value / 100)} OFF`;
  const from = c.valid_from ? new Date(c.valid_from) : now;
  // valid_to is exclusive (start of the next IST day); show the last valid day.
  const to = c.valid_to ? new Date(new Date(c.valid_to).getTime() - 1) : null;
  const start = from > now ? day(from) : null;
  const validity = to ? (start && start !== day(to) ? `Valid ${start} – ${day(to)}` : start ? `Valid on ${day(to)}` : `Valid till ${day(to)}`) : start ? `Valid from ${start}` : "No expiry";
  return { code: c.code, headline, detail: `${describeCoupon(c)}. One use per customer.`, validity };
}

export function firstName(fullName: string | null | undefined): string | null {
  const f = (fullName ?? "").trim().split(/\s+/)[0];
  return f && /[a-z]/i.test(f) ? f[0].toUpperCase() + f.slice(1) : null;
}

export interface EmailContent {
  restaurantName: string;
  firstName: string | null;
  message: string;
  coupon: CouponBox | null;
  orderUrl: string;
  unsubscribeUrl: string;
  footer?: string | null;
}

export function renderBulkEmail(c: EmailContent): { html: string; text: string } {
  const hi = `Hi ${c.firstName ?? "there"},`;
  const paras = c.message
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.6">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const coupon = c.coupon
    ? `<div style="margin:22px 0;border:2px dashed #ea580c;border-radius:14px;padding:18px;text-align:center;background:#fff7ed">
        <div style="font-size:26px;font-weight:800;color:#c2410c;letter-spacing:.5px">${esc(c.coupon.headline)}</div>
        <div style="margin:10px auto 6px;display:inline-block;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:20px;font-weight:700;letter-spacing:3px;background:#fff;border:1px solid #fdba74;border-radius:8px;padding:8px 16px;color:#1c1917">${esc(c.coupon.code)}</div>
        <div style="font-size:13px;color:#57534e">${esc(c.coupon.detail)}</div>
        <div style="font-size:13px;color:#57534e;font-weight:600;margin-top:2px">${esc(c.coupon.validity)}</div>
      </div>`
    : "";
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"></head>
<body style="margin:0;background:#faf7f2;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1917">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px">
    <div style="font-size:20px;font-weight:800;color:#c2410c;margin-bottom:16px">${esc(c.restaurantName)}</div>
    <div style="background:#fff;border:1px solid #e7e5e4;border-radius:16px;padding:24px">
      <p style="margin:0 0 14px;font-weight:600">${esc(hi)}</p>
      ${paras}
      ${coupon}
      <div style="text-align:center;margin:24px 0 6px">
        <a href="${esc(c.orderUrl)}" style="display:inline-block;background:#ea580c;color:#fff;text-decoration:none;font-weight:700;padding:13px 28px;border-radius:999px">Order now</a>
      </div>
    </div>
    <p style="font-size:12px;color:#78716c;text-align:center;margin-top:18px;line-height:1.5">
      ${c.footer ? `${esc(c.footer)}<br>` : ""}Sent by ${esc(c.restaurantName)}. Don't want these emails?
      <a href="${esc(c.unsubscribeUrl)}" style="color:#78716c">Unsubscribe</a>
    </p>
  </div>
</body></html>`;
  const text = [
    hi,
    "",
    c.message.trim(),
    ...(c.coupon ? ["", `${c.coupon.headline} — code ${c.coupon.code}`, c.coupon.detail, c.coupon.validity] : []),
    "",
    `Order now: ${c.orderUrl}`,
    "",
    `— ${c.restaurantName}`,
    `Unsubscribe: ${c.unsubscribeUrl}`,
  ].join("\n");
  return { html, text };
}
