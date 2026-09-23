"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CurrencyCode } from "@/lib/commission-engine/types";
import { formatCurrency } from "@/lib/format/currency";
import { SERIES_COLORS, useCompactChart, type CurveSeries } from "./PayoutCurveChart";

export function GroupedBarChart({
  data,
  series,
  currency,
  height = 280,
}: {
  data: Array<Record<string, string | number>>;
  series: CurveSeries[];
  currency: CurrencyCode;
  height?: number;
}) {
  const narrow = useCompactChart();
  return (
    <div style={{ height }} className="chart-frame w-full min-w-0 max-w-full overflow-hidden">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} margin={{ top: 10, right: narrow ? 4 : 8, bottom: 4, left: narrow ? 0 : 8 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: narrow ? 10 : 11, fill: "#64748b" }} stroke="#cbd5e1" interval="preserveStartEnd" />
          <YAxis
            tickFormatter={(v: number) => formatCurrency(v, currency, { compact: true })}
            tick={{ fontSize: narrow ? 10 : 11, fill: "#64748b" }}
            stroke="#cbd5e1"
            width={narrow ? 48 : 64}
          />
          <Tooltip
            formatter={(value, name) => [formatCurrency(Number(value), currency), name]}
            contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "#e2e8f0" }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              fill={s.color ?? SERIES_COLORS[i % SERIES_COLORS.length]}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
