"use client";

import { useMemo } from "react";
import { calculateCommission } from "@/lib/commission-engine/calculateCommission";
import { calculateOTE } from "@/lib/commission-engine/calculateOTE";
import { calculatePayoutCurve } from "@/lib/commission-engine/calculatePayoutCurve";
import type { CommissionPlan, CurrencyCode } from "@/lib/commission-engine/types";
import { formatCurrency } from "@/lib/format/currency";

export function useCalculation(plan: CommissionPlan) {
  return useMemo(() => calculateCommission(plan), [plan]);
}

export function useOTE(plan: CommissionPlan) {
  return useMemo(() => calculateOTE(plan), [plan]);
}

export function usePayoutCurve(plan: CommissionPlan) {
  return useMemo(() => calculatePayoutCurve(plan), [plan]);
}

export function useMoney(currency: CurrencyCode) {
  return useMemo(
    () => ({
      fmt: (v: number | null | undefined) => formatCurrency(v, currency),
      fmt0: (v: number | null | undefined) => formatCurrency(v, currency, { decimals: false }),
      compact: (v: number | null | undefined) => formatCurrency(v, currency, { compact: true }),
    }),
    [currency],
  );
}
