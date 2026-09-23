"use client";

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CurrencyCode, PeriodResult } from "@/lib/commission-engine/types";
import { formatCurrency } from "@/lib/format/currency";

export function PerformanceChart({ periods, currency, height = 320 }: { periods: PeriodResult[]; currency: CurrencyCode; height?: number }) {
  const data = periods.map((p) => ({ label: p.label, quota: p.quota, actual: p.actual, commission: p.netEarned }));
  const compact = (v: number) => formatCurrency(v, currency, { compact: true });
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} stroke="#cbd5e1" />
          <YAxis yAxisId="rev" tickFormatter={compact} tick={{ fontSize: 11, fill: "#64748b" }} stroke="#cbd5e1" width={64} />
          <YAxis yAxisId="comm" orientation="right" tickFormatter={compact} tick={{ fontSize: 11, fill: "#64748b" }} stroke="#cbd5e1" width={64} />
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
