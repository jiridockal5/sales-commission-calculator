import type { AspBandId } from "@/lib/benchmarks/saasAeBenchmark";
import { DEFAULT_ASP_BAND } from "@/lib/benchmarks/saasAeBenchmark";
import type { CurrencyCode } from "@/lib/commission-engine/types";

/** Separate from plan storage so benchmark settings never rewrite scc.plans.v1. */
export const BENCHMARK_PREFS_KEY = "scc.benchmark.v1";

export type FxCurrency = Exclude<CurrencyCode, "USD">;

/** Plan-currency units per 1 USD. Absent means the user has not entered a rate. */
export interface BenchmarkPrefs {
  band: AspBandId;
  fx: Partial<Record<FxCurrency, number>>;
}

export const DEFAULT_BENCHMARK_PREFS: BenchmarkPrefs = { band: DEFAULT_ASP_BAND, fx: {} };

const FX_CURRENCIES: readonly FxCurrency[] = ["EUR", "GBP", "CZK"];

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isBand(value: unknown): value is AspBandId {
  return value === "small" || value === "typical" || value === "large";
}

export function readBenchmarkPrefs(storage: StorageLike | null): BenchmarkPrefs {
  if (!storage) return DEFAULT_BENCHMARK_PREFS;
  try {
    const raw = storage.getItem(BENCHMARK_PREFS_KEY);
    if (!raw) return DEFAULT_BENCHMARK_PREFS;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return DEFAULT_BENCHMARK_PREFS;
    const record = data as { band?: unknown; fx?: unknown };
    const fx: BenchmarkPrefs["fx"] = {};
    if (record.fx && typeof record.fx === "object") {
      for (const code of FX_CURRENCIES) {
        const value = (record.fx as Record<string, unknown>)[code];
        if (typeof value === "number" && Number.isFinite(value) && value > 0) fx[code] = value;
      }
    }
    return { band: isBand(record.band) ? record.band : DEFAULT_ASP_BAND, fx };
  } catch {
    return DEFAULT_BENCHMARK_PREFS;
  }
}

export function writeBenchmarkPrefs(storage: StorageLike | null, prefs: BenchmarkPrefs): void {
  if (!storage) return;
  const fx: BenchmarkPrefs["fx"] = {};
  for (const code of FX_CURRENCIES) {
    const value = prefs.fx[code];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) fx[code] = value;
  }
  storage.setItem(BENCHMARK_PREFS_KEY, JSON.stringify({ band: isBand(prefs.band) ? prefs.band : DEFAULT_ASP_BAND, fx }));
}
