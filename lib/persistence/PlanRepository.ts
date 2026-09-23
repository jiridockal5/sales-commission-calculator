import type { CommissionPlan } from "@/lib/commission-engine/types";

/**
 * Storage abstraction for commission plans. The async signature lets a cloud backend
 * (e.g. Supabase) replace the localStorage implementation without touching callers.
 */
export interface PlanRepository {
  list(): Promise<CommissionPlan[]>;
  get(id: string): Promise<CommissionPlan | null>;
  save(plan: CommissionPlan): Promise<CommissionPlan>;
  delete(id: string): Promise<void>;
  getActivePlanId(): Promise<string | null>;
  setActivePlanId(id: string | null): Promise<void>;
}
