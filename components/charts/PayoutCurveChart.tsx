"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CurrencyCode } from "@/lib/commission-engine/types";
import { formatCurrency } from "@/lib/format/currency";

export const SERIES_COLORS = ["#2557e8", "#0f766e", "#b45309", "#7c3aed", "#be123c", "#475569"];

/** Phone and tablet widths, where axis labels need to stay inside the card. */
export function useCompactChart() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => setCompact(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return compact;
}

export interface CurveSeries {
  key: string;
  name: string;
  color?: string;
}

export function PayoutCurveChart({
  data,
  series,
  currency,
  highlights = [50, 75, 100, 125, 150, 200],
  currentAttainment,
  height = 320,
  showLegend,
  yLabel = "Payout",
}: {
  data: Array<Record<string, number>>;
  series: CurveSeries[];
  currency: CurrencyCode;
  highlights?: number[];
  currentAttainment?: number | null;
  height?: number;
  showLegend?: boolean;
  yLabel?: string;
}) {
  const compact = useCompactChart();
  const maxX = data.length ? data[data.length - 1].attainmentPct : 200;
  const step = compact ? 50 : 25;
  const ticks = Array.from({ length: Math.floor(maxX / step) + 1 }, (_, i) => i * step);
  const primary = series[0];
  return (
    <div style={{ height }} className="chart-frame w-full min-w-0 max-w-full overflow-hidden">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={data} margin={{ top: 10, right: compact ? 4 : 16, bottom: 4, left: compact ? 0 : 8 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
          <XAxis
            dataKey="attainmentPct"
            type="number"
            domain={[0, maxX]}
            ticks={ticks}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: compact ? 10 : 11, fill: "#64748b" }}
            stroke="#cbd5e1"
          />
          <YAxis
            tickFormatter={(v: number) => formatCurrency(v, currency, { compact: true })}
            tick={{ fontSize: compact ? 10 : 11, fill: "#64748b" }}
            stroke="#cbd5e1"
            width={compact ? 48 : 64}
          />
          <Tooltip
            formatter={(value, name) => [formatCurrency(Number(value), currency), name]}
            labelFormatter={(label) => `Attainment ${label}%`}
            contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "#e2e8f0" }}
          />
          {showLegend && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {highlights.map((h) => (
            <ReferenceLine key={h} x={h} stroke="#cbd5e1" strokeDasharray="2 4" />
          ))}
          {currentAttainment !== undefined && currentAttainment !== null && currentAttainment <= maxX && (
            <ReferenceLine
              x={currentAttainment}
              stroke="#0f172a"
              strokeWidth={1}
              label={{ value: `Actual ${currentAttainment.toFixed(0)}%`, position: "insideTopRight", fontSize: compact ? 10 : 11, fill: "#0f172a" }}
            />
          )}
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="linear"
              dataKey={s.key}
              name={s.name}
              stroke={s.color ?? SERIES_COLORS[i % SERIES_COLORS.length]}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          ))}
          {primary &&
            series.length === 1 &&
            highlights.map((h) => {
              const point = data.find((d) => d.attainmentPct === h);
              if (!point) return null;
              return (
                <ReferenceDot
                  key={`dot-${h}`}
                  x={h}
                  y={point[primary.key]}
                  r={3.5}
                  fill="#fff"
                  stroke={primary.color ?? SERIES_COLORS[0]}
                  strokeWidth={2}
                />
              );
            })}
        </LineChart>
      </ResponsiveContainer>
      <span className="sr-only">{yLabel} by quota attainment</span>
    </div>
  );
}
