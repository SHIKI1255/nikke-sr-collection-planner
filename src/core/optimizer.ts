import { amounts, MATERIALS, zeroAmounts } from "./types";
import type { Optimizer, PolicyRecord, Solution } from "./types";
import { bestPolicyMix, dotActive, dualMaster } from "./master";

export function emptySolution(complete: boolean): Solution {
  return { raw: { feasible: true, converged: true, iterations: 0, relativeGap: 0 },
    unit: complete ? Infinity : 0, usage: zeroAmounts(), perUnit: zeroAmounts(),
    probabilities: zeroAmounts(), shortage: zeroAmounts(), mode: complete ? "complete" : "capacity" };
}

/** Dual column generation for the existing expected-inventory model, three materials only. */
export const optimizeCapacity: Optimizer = (oracle, { start, target, availableAttempts }) => {
  if (start.level >= target) return emptySolution(true);
  const active = MATERIALS.map((m, i) => availableAttempts[m] > 0 ? i : -1).filter((i) => i >= 0);
  if (!active.length) return emptySolution(false);
  // Keep the optimization scale independent of inventory magnitude.
  const scale = Math.max(...Object.values(availableAttempts));
  const available = MATERIALS.map((m) => availableAttempts[m] / scale);
  if (active.some((i) => !(available[i] > 0) || !Number.isFinite(1 / available[i]))) {
    throw new Error("Attempt budget ratio exceeds numeric precision");
  }
  const policies: PolicyRecord[] = [];
  const signatures = new Set<string>();
  const index = oracle.index(start);
  const query = (lambda: number[]) => {
    const costs = [0, 0, 0];
    for (const i of active) costs[i] = lambda[i] / available[i];
    let minimum = Infinity;
    for (let offset = 0; offset < active.length; offset++) {
      const order = [...active.slice(offset), ...active.slice(0, offset)];
      const policy = oracle.build(target, index, active, costs, order);
      const expected = MATERIALS.map((_, m) => policy.usage[m][index]);
      const ratios = expected.map((value, m) => active.includes(m) ? value / available[m] : 0);
      minimum = Math.min(minimum, dotActive(lambda, ratios, active));
      const signature = policy.actions.subarray(index).join("");
      if (!signatures.has(signature)) {
        signatures.add(signature);
        policies.push({ ...policy, expected, ratios });
      }
      // Different tie orders cannot change a policy with no tied choices.
      if (!policy.tied) break;
    }
    return minimum;
  };
  for (const i of active) {
    const lambda = [0, 0, 0];
    lambda[i] = 1;
    query(lambda);
  }
  const uniform = [0, 0, 0];
  for (const i of active) uniform[i] = 1 / active.length;
  query(uniform);
  let lowerBound = 0;
  let iterations = 0;
  let converged = false;
  for (; iterations < 100; iterations++) {
    const master = dualMaster(policies, active);
    lowerBound = Math.max(lowerBound, query(master.lambda));
    if (master.value - lowerBound <= 1e-10 + 1e-10 * Math.abs(master.value)) {
      converged = true;
      iterations++;
      break;
    }
  }
  const master = dualMaster(policies, active);
  for (const i of active) {
    const perturbed = [...master.lambda];
    const epsilon = 1e-6;
    const donor = active.find((candidate) => candidate !== i && perturbed[candidate] > epsilon);
    if (donor !== undefined) {
      perturbed[i] += epsilon;
      perturbed[donor] -= epsilon;
      lowerBound = Math.max(lowerBound, query(perturbed));
    }
  }
  const mix = bestPolicyMix(policies, active);
  if (!mix || !(mix.value > 0) || !Number.isFinite(mix.value)) throw new Error("No feasible strategy");
  const unit = scale / mix.value;
  const perUnit = amounts((_, m) => mix.indices.reduce((sum, p, j) => sum + mix.weights[j] * policies[p].expected[m], 0));
  const usage = amounts((m) => perUnit[m] * unit);
  const probabilities = zeroAmounts();
  mix.indices.forEach((p, j) => { probabilities[MATERIALS[policies[p].actions[index]]] += mix.weights[j]; });
  const relativeGap = Math.max(0, (mix.value - lowerBound) / mix.value);
  const feasible = MATERIALS.every((m) => Number.isFinite(usage[m]) && usage[m] >= 0 &&
    usage[m] <= availableAttempts[m] + 1e-10 + availableAttempts[m] * 1e-9) &&
    Math.abs(Object.values(probabilities).reduce((a, b) => a + b, 0) - 1) < 1e-9;
  if (!feasible || !Number.isFinite(unit)) throw new Error("Invalid numerical solution");
  return {
    raw: { feasible, converged: converged && relativeGap <= 1e-8, iterations,
      dualValue: master.value / scale, policies: policies.length, relativeGap },
    unit, usage, perUnit, probabilities,
    shortage: amounts((m) => Math.max(0, perUnit[m] - availableAttempts[m])), mode: "capacity",
  };
};
