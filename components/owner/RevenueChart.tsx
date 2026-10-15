"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatINR } from "@/lib/format";

const shortINR = (paise: number) => {
  const r = paise / 100;
  if (r >= 100000) return `₹${(r / 100000).toFixed(1)}L`;
  if (r >= 1000) return `₹${(r / 1000).toFixed(1)}k`;
  return `₹${Math.round(r)}`;
};

/** Single-series daily revenue bars (no legend: the panel title names the series). */
export function RevenueChart({ data }: { data: { label: string; revenue_paise: number; orders: number }[] }) {
  return (
    <div className="h-56 w-full" role="img" aria-label={`Daily revenue: ${data.map((d) => `${d.label} ${formatINR(d.revenue_paise)}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <YAxis tickLine={false} axisLine={false} width={52} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={shortINR} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="rounded-xl border bg-popover px-3 py-2 text-xs shadow-md">
                  <p className="text-muted-foreground">{String(label)}</p>
                  <p className="font-semibold tabular-nums">{formatINR(Number(payload[0].value))}</p>
                  <p className="text-muted-foreground">{(payload[0].payload as { orders: number }).orders} orders</p>
                </div>
              ) : null
            }
          />
          <Bar dataKey="revenue_paise" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
