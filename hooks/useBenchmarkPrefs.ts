"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_BENCHMARK_PREFS,
  readBenchmarkPrefs,
  writeBenchmarkPrefs,
  type BenchmarkPrefs,
  type FxCurrency,
} from "@/lib/persistence/benchmarkPrefs";

/** FX rates shared by every plan. Loaded after mount so server HTML matches the first client render. */
export function useBenchmarkPrefs(): {
  prefs: BenchmarkPrefs | null;
  setFxRate: (currency: FxCurrency, rate: number | null) => void;
} {
  const [prefs, setPrefs] = useState<BenchmarkPrefs | null>(null);

  useEffect(() => {
    setPrefs(readBenchmarkPrefs(window.localStorage));
  }, []);

  useEffect(() => {
    if (!prefs) return;
    writeBenchmarkPrefs(window.localStorage, prefs);
  }, [prefs]);

  const setFxRate = (currency: FxCurrency, rate: number | null) => {
    setPrefs((current) => {
      const base = current ?? DEFAULT_BENCHMARK_PREFS;
      const fx = { ...base.fx };
      if (rate === null || !Number.isFinite(rate) || rate <= 0) delete fx[currency];
      else fx[currency] = rate;
      return { ...base, fx };
    });
  };

  return { prefs, setFxRate };
}
