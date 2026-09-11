import { MATERIALS } from "./types";
import type { Material, Ruleset, SolveRequest, State } from "./types";

export function validateRuleset(input: unknown): Ruleset {
  const fail = (): never => { throw new Error("Unsupported or invalid ruleset"); };
  if (!input || typeof input !== "object") return fail();
  const r = input as Ruleset;
  if (r.schema_version !== 1 || typeof r.ruleset_id !== "string" || !r.ruleset_id ||
      typeof r.verified_at !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.verified_at)) return fail();
  if (![r.action_size, r.exp_per_level, r.exp_step].every((n) => Number.isSafeInteger(n) && n > 0) ||
      r.exp_per_level % r.exp_step !== 0 || !Array.isArray(r.milestones) || !r.milestones.length ||
      !r.milestones.every((n, i) => Number.isSafeInteger(n) && n > (r.milestones[i - 1] ?? 0))) return fail();
  const maxLevel = r.milestones.at(-1)!;
  // Explicit resource boundary for this finite-state, three-material implementation.
  if (maxLevel * r.exp_per_level / r.exp_step > 10000 || !r.materials ||
      Object.keys(r.materials).sort().join() !== [...MATERIALS].sort().join()) return fail();
  for (const material of MATERIALS) {
    const m = r.materials[material];
    if (!m || !Number.isSafeInteger(m.exp_per_action) || m.exp_per_action <= 0 ||
        m.exp_per_action > r.exp_per_level || m.exp_per_action % r.exp_step !== 0 ||
        !Array.isArray(m.success_rates) || m.success_rates.length !== maxLevel ||
        !m.success_rates.every((p) => Number.isFinite(p) && p >= 0 && p <= 1)) return fail();
  }
  return structuredClone({ schema_version: r.schema_version, ruleset_id: r.ruleset_id,
    verified_at: r.verified_at, action_size: r.action_size, exp_per_level: r.exp_per_level,
    exp_step: r.exp_step, milestones: r.milestones, materials: r.materials });
}

export function validateRequest(rules: Ruleset, request: SolveRequest): void {
  const { start, target, availableAttempts } = request;
  if (!start || !Number.isSafeInteger(start.level) || start.level < 0 || start.level > rules.milestones.at(-1)! ||
      !Number.isSafeInteger(start.exp) || start.exp < 0 || start.exp >= rules.exp_per_level || start.exp % rules.exp_step !== 0 ||
      (start.level === rules.milestones.at(-1) && start.exp !== 0) || !rules.milestones.includes(target) ||
      !availableAttempts || MATERIALS.some((m) => !Number.isFinite(availableAttempts[m]) || availableAttempts[m] < 0)) {
    throw new Error("Invalid state, target, or attempt budget");
  }
}

export function transitions(rules: Ruleset) {
  function normalTransition(state: State, material: Material, target: number): State | null {
    if (!MATERIALS.includes(material)) throw new Error("Unsupported material");
    if (state.level >= target) return null;
    let level = state.level;
    let exp = state.exp + rules.materials[material].exp_per_action;
    if (exp >= rules.exp_per_level) {
      exp -= rules.exp_per_level;
      level++;
      if (rules.milestones.includes(level)) exp = 0;
    }
    return level >= target ? null : { level, exp };
  }
  function successTransition(state: State, target: number): State | null {
    const level = rules.milestones.find((node) => node > state.level);
    return level === undefined || level >= target ? null : { level, exp: 0 };
  }
  return { normalTransition, successTransition };
}
