import type { CommissionPlan } from "@/lib/commission-engine/types";
import type { PlanRepository } from "./PlanRepository";
import { parsePlan } from "./serialization";

const PLANS_KEY = "scc.plans.v1";
const ACTIVE_KEY = "scc.activePlanId.v1";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export class LocalStoragePlanRepository implements PlanRepository {
  constructor(private readonly storage: StorageLike | null = typeof window !== "undefined" ? window.localStorage : null) {}

  private readAll(): CommissionPlan[] {
    if (!this.storage) return [];
    try {
      const raw = this.storage.getItem(PLANS_KEY);
      if (!raw) return [];
      const data: unknown = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data.flatMap((item) => {
        const parsed = parsePlan(item);
        return parsed.ok ? [parsed.plan] : [];
      });
    } catch {
      return [];
    }
  }

  private writeAll(plans: CommissionPlan[]): void {
    this.storage?.setItem(PLANS_KEY, JSON.stringify(plans));
  }

  async list(): Promise<CommissionPlan[]> {
    return this.readAll();
  }

  async get(id: string): Promise<CommissionPlan | null> {
    return this.readAll().find((p) => p.id === id) ?? null;
  }

  async save(plan: CommissionPlan): Promise<CommissionPlan> {
    const plans = this.readAll();
    const index = plans.findIndex((p) => p.id === plan.id);
    if (index >= 0) plans[index] = plan;
    else plans.push(plan);
    this.writeAll(plans);
    return plan;
  }

  async delete(id: string): Promise<void> {
    this.writeAll(this.readAll().filter((p) => p.id !== id));
  }

  async getActivePlanId(): Promise<string | null> {
    return this.storage?.getItem(ACTIVE_KEY) ?? null;
  }

  async setActivePlanId(id: string | null): Promise<void> {
    if (!this.storage) return;
    if (id) this.storage.setItem(ACTIVE_KEY, id);
    else this.storage.removeItem(ACTIVE_KEY);
  }
}
