"use client";

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CurrencyCode, PeriodResult } from "@/lib/commission-engine/types";
import { formatCurrency } from "@/lib/format/currency";
import { useCompactChart } from "./PayoutCurveChart";

export function PerformanceChart({ periods, currency, height = 320 }: { periods: PeriodResult[]; currency: CurrencyCode; height?: number }) {
  const narrow = useCompactChart();
  const data = periods.map((p) => ({ label: p.label, quota: p.quota, actual: p.actual, commission: p.netEarned }));
  const compact = (v: number) => formatCurrency(v, currency, { compact: true });
  const axisWidth = narrow ? 44 : 64;
  return (
    <div style={{ height }} className="chart-frame w-full min-w-0 max-w-full overflow-hidden">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart data={data} margin={{ top: 10, right: narrow ? 0 : 8, bottom: 4, left: narrow ? 0 : 8 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: narrow ? 10 : 11, fill: "#64748b" }} stroke="#cbd5e1" interval="preserveStartEnd" />
          <YAxis yAxisId="rev" tickFormatter={compact} tick={{ fontSize: narrow ? 10 : 11, fill: "#64748b" }} stroke="#cbd5e1" width={axisWidth} />
          <YAxis yAxisId="comm" orientation="right" tickFormatter={compact} tick={{ fontSize: narrow ? 10 : 11, fill: "#64748b" }} stroke="#cbd5e1" width={axisWidth} />
          <Tooltip
            formatter={(value, name) => [formatCurrency(Number(value), currency), name]}
            contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "#e2e8f0" }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="rev" dataKey="quota" name="Quota" fill="#cbd5e1" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Bar yAxisId="rev" dataKey="actual" name="Actual" fill="#2557e8" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Line
            yAxisId="comm"
            type="linear"
            dataKey="commission"
            name="Variable earned (right axis)"
            stroke="#0f766e"
            strokeWidth={2}
            dot={{ r: 3 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
