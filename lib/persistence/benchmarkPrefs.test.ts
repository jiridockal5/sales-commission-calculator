import { describe, expect, it } from "vitest";
import { BENCHMARK_PREFS_KEY, readBenchmarkPrefs, writeBenchmarkPrefs } from "./benchmarkPrefs";

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

describe("benchmark preferences", () => {
  it("defaults to an empty FX map", () => {
    expect(readBenchmarkPrefs(new MemoryStorage())).toEqual({ fx: {} });
  });

  it("persists positive rates under a new key without touching plans", () => {
    const storage = new MemoryStorage();
    storage.setItem("scc.plans.v1", "[{\"id\":\"keep\"}]");
    writeBenchmarkPrefs(storage, { fx: { CZK: 23.5, EUR: 0, GBP: -2 } });
    expect(storage.getItem("scc.plans.v1")).toBe("[{\"id\":\"keep\"}]");
    expect(readBenchmarkPrefs(storage)).toEqual({ fx: { CZK: 23.5 } });
  });

  it("ignores a stored deal-size band and drops non-positive rates", () => {
    const storage = new MemoryStorage();
    storage.setItem(BENCHMARK_PREFS_KEY, JSON.stringify({ band: "large", fx: { EUR: null, GBP: 0.78, USD: 1 } }));
    expect(readBenchmarkPrefs(storage)).toEqual({ fx: { GBP: 0.78 } });
  });
});
