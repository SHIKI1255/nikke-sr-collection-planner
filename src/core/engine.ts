import { amounts, MATERIALS, zeroAmounts } from "./types";
import type { Amounts, Optimizer, Solution, SolveRequest, State } from "./types";
import { transitions, validateRequest, validateRuleset } from "./rules";
import { createOracle } from "./policy";
import { emptySolution, optimizeCapacity } from "./optimizer";

export function createEngine(input: unknown, options: { optimizer?: Optimizer } = {}) {
  const rules = validateRuleset(input);
  // Identity is the full normalized rule content, not just its mutable display name.
  const rulesIdentity = JSON.stringify({ ...rules, materials: MATERIALS.map((m) => rules.materials[m]) });
  const oracle = createOracle(rules);
  const optimizer = options.optimizer ?? optimizeCapacity;
  const cache = new Map<string, Solution>();
  let cacheHits = 0;
  function solveMaxUnits(start: State, target: number, availableAttempts: Amounts): Solution {
    const request = { start, target, availableAttempts };
    validateRequest(rules, request);
    const key = JSON.stringify([rulesIdentity, start.level, start.exp, target, ...MATERIALS.map((m) => availableAttempts[m])]);
    let solution = cache.get(key);
    if (solution) {
      cache.delete(key);
      cacheHits++;
    } else {
      solution = optimizer(oracle, request);
    }
    cache.set(key, solution);
    if (cache.size > 64) cache.delete(cache.keys().next().value!);
    // Consumers (including the legacy public API) cannot poison the result cache.
    return structuredClone(solution);
  }
  /** Historical name retained; this is a fixed-cost reference, NOT minimum shortage optimization. */
  function solveMinShortage(start: State, target: number, availableAttempts: Amounts): Solution {
    validateRequest(rules, { start, target, availableAttempts });
    if (start.level >= target) return emptySolution(true);
    const index = oracle.index(start);
    const policy = oracle.build(target, index, [0, 1, 2], [1, 1.01, 1.04], [0, 1, 2]);
    const perUnit = amounts((_, m) => policy.usage[m][index]);
    const probabilities = zeroAmounts();
    probabilities[MATERIALS[policy.actions[index]]] = 1;
    return { raw: { feasible: true, reference: true }, unit: 0, usage: { ...perUnit }, perUnit, probabilities,
      shortage: amounts((m) => Math.max(0, perUnit[m] - availableAttempts[m])), mode: "shortage" };
  }
  const solveScenario = (start: State, target: number, available: Amounts): Solution => {
    const solution = solveMaxUnits(start, target, available);
    return solution.unit > 0 ? solution : solveMinShortage(start, target, available);
  };
  return {
    rules: structuredClone(rules), rulesIdentity,
    solve: (request: SolveRequest) => solveScenario(request.start, request.target, request.availableAttempts),
    solveMaxUnits, solveMinShortage, solveScenario,
    ...transitions(rules),
    cacheInfo: () => ({ size: cache.size, hits: cacheHits, limit: 64 }),
    constants: { MATERIALS: [...MATERIALS], GAINS: amounts((m) => rules.materials[m].exp_per_action),
      SUCCESS: Object.fromEntries(MATERIALS.map((m) => [m, [...rules.materials[m].success_rates]])) },
  };
}
export type Engine = ReturnType<typeof createEngine>;
