import { NextResponse, type NextRequest } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getSessionUser } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { audit } from "@/lib/agents/guard";
import { getCategoryBreakdown, getOrderTypeSplit, getRatingsSummary, getRevenue, getTopItems } from "@/lib/agents/owner/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rs = (paise: number) => `Rs. ${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Owner-only report download (CSV or PDF) for a date range. */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (user.role !== "owner") return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to") ?? from;
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "csv";
  if (!from || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !to || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return NextResponse.json({ error: "from/to required (YYYY-MM-DD)" }, { status: 400 });
  const range = { preset: "custom" as const, from, to };
  const [rev, top, cats, types, ratings] = await Promise.all([
    getRevenue({ range, granularity: "day" }),
    getTopItems({ range, limit: 10 }),
    getCategoryBreakdown({ range }),
    getOrderTypeSplit({ range }),
    getRatingsSummary({ range }),
  ]);
  await audit({ ctx: { userId: user.userId, agent: "owner" }, tool: "generate_report", params: { from, to, format }, status: "success", summary: rev.range.label });
  const name = `report-${from}-to-${to}`;

  if (format === "csv") {
    const lines: string[] = [];
    const row = (...v: unknown[]) => lines.push(v.map(csvCell).join(","));
    row("Report", rev.range.label);
    row("Revenue (INR)", rev.totals.revenue_paise / 100);
    row("Orders", rev.totals.orders);
    row("Average order (INR)", rev.totals.aov_paise / 100);
    row("Change vs previous period (%)", rev.previous.change_percent ?? "");
    row("Average rating", ratings.overall.avg_rating ?? "");
    row();
    row("Date", "Revenue (INR)", "Orders", "AOV (INR)");
    for (const s of rev.series) row(String(s.bucket).slice(0, 10), s.revenue_paise / 100, s.orders, s.aov_paise / 100);
    row();
    row("Top dishes", "Category", "Qty", "Revenue (INR)");
    for (const i of top.items) row(i.name, i.category, i.qty, i.revenue_paise / 100);
    row();
    row("Category", "Qty", "Revenue (INR)", "Share %");
    for (const c of cats.categories) row(c.category, c.qty, c.revenue_paise / 100, c.share);
    row();
    row("Order type", "Orders", "Revenue (INR)");
    for (const t of types.split) row(t.order_type, t.orders, t.revenue_paise / 100);
    return new NextResponse(lines.join("\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}.csv"` } });
  }

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]);
  let y = 800;
  const text = (t: string, opts: { size?: number; b?: boolean; x?: number; color?: [number, number, number] } = {}) => {
    if (y < 60) {
      page = pdf.addPage([595, 842]);
      y = 800;
    }
    page.drawText(t.replace(/[^\x20-\x7E]/g, "-"), { x: opts.x ?? 48, y, size: opts.size ?? 10, font: opts.b ? bold : font, color: rgb(...(opts.color ?? [0.1, 0.1, 0.1])) });
  };
  const line = (t: string, o?: Parameters<typeof text>[1]) => {
    text(t, o);
    y -= (o?.size ?? 10) + 6;
  };
  line(`${BRAND.name} - Business report`, { size: 18, b: true, color: [0.76, 0.25, 0.05] });
  line(rev.range.label.replace(/–/g, "-"), { size: 11 });
  y -= 6;
  line(`Revenue: ${rs(rev.totals.revenue_paise)}   Orders: ${rev.totals.orders}   AOV: ${rs(rev.totals.aov_paise)}`, { b: true });
  line(`Change vs previous period: ${rev.previous.change_percent ?? "n/a"}%   Avg rating: ${ratings.overall.avg_rating ?? "n/a"} (${ratings.overall.reviews} reviews)`);
  y -= 8;
  line("Daily revenue", { size: 12, b: true });
  for (const s of rev.series) line(`${String(s.bucket).slice(0, 10)}    ${rs(s.revenue_paise).padEnd(14)}  ${s.orders} orders`);
  y -= 8;
  line("Top dishes", { size: 12, b: true });
  top.items.forEach((i, n) => line(`${n + 1}. ${i.name} (${i.category}) - ${i.qty} sold, ${rs(i.revenue_paise)}`));
  y -= 8;
  line("Categories", { size: 12, b: true });
  for (const c of cats.categories) line(`${c.category}: ${rs(c.revenue_paise)} (${c.share}%)`);
  y -= 8;
  line("Order types", { size: 12, b: true });
  for (const t of types.split) line(`${t.order_type.replace("_", "-")}: ${t.orders} orders, ${rs(t.revenue_paise)}`);
  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${name}.pdf"` } });
}
