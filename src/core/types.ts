export const MATERIALS = ["R", "SR", "SSR"] as const;
export type Material = typeof MATERIALS[number];
/** Engine budgets/usage are enhancement attempts, NOT individual kits. */
export type Amounts = Record<Material, number>;
export interface State { level: number; exp: number }
export interface Ruleset {
  schema_version: 1;
  ruleset_id: string;
  verified_at: string;
  action_size: number;
  exp_per_level: number;
  exp_step: number;
  milestones: number[];
  materials: Record<Material, { exp_per_action: number; success_rates: number[] }>;
}
export interface SolveRequest { start: State; target: number; availableAttempts: Amounts }
export interface Diagnostics {
  feasible: boolean;
  converged?: boolean;
  iterations?: number;
  dualValue?: number;
  policies?: number;
  relativeGap?: number;
  reference?: boolean;
}
export interface Solution {
  raw: Diagnostics;
  unit: number;
  usage: Amounts;
  perUnit: Amounts;
  probabilities: Amounts;
  shortage: Amounts;
  mode: "capacity" | "complete" | "shortage";
}
export interface Policy {
  values: Float64Array;
  usage: Float64Array[];
  actions: Uint8Array;
  tied: boolean;
}
export interface PolicyRecord extends Policy { expected: number[]; ratios: number[] }
export interface PolicyMix { indices: number[]; weights: number[]; value: number; ratios: number[] }
export interface Oracle {
  build(target: number, startIndex: number, allowed: number[], costs: number[], order: number[]): Policy;
  index(state: State): number;
}
export type Optimizer = (oracle: Oracle, request: SolveRequest) => Solution;
export const zeroAmounts = (): Amounts => ({ R: 0, SR: 0, SSR: 0 });
export const amounts = (get: (material: Material, index: number) => number): Amounts => ({
  R: get("R", 0), SR: get("SR", 1), SSR: get("SSR", 2),
});
