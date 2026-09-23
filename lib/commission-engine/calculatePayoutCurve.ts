import { simulateAtAttainment } from "./calculateOTE";
import type { CommissionPlan, PayoutCurvePoint } from "./types";

export const PAYOUT_CURVE_HIGHLIGHTS = [50, 75, 100, 125, 150, 200];

export interface PayoutCurveOptions {
  fromPct?: number;
  toPct?: number;
  stepPct?: number;
}

/** Variable payout across an attainment sweep (default 0–200% in 2.5% steps). */
export function calculatePayoutCurve(plan: CommissionPlan, options: PayoutCurveOptions = {}): PayoutCurvePoint[] {
  const from = options.fromPct ?? 0;
  const to = options.toPct ?? 200;
  const step = options.stepPct ?? 2.5;
  const points = new Set<number>();
  for (let i = 0; from + i * step <= to + 1e-9; i++) points.add(Math.round((from + i * step) * 1000) / 1000);
  for (const h of PAYOUT_CURVE_HIGHLIGHTS) if (h >= from && h <= to) points.add(h);
  return [...points]
    .sort((a, b) => a - b)
    .map((attainmentPct) => ({ attainmentPct, payout: simulateAtAttainment(plan, attainmentPct).variable }));
}
