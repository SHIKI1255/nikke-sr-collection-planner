import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "../scripts/load-module.mjs";
const { createEngine } = await loadModule("src/core/engine.ts");

// Independent reference: enumerate EVERY deterministic policy on three EXP states,
// then every basic feasible solution of the resource-allocation primal LP.
// No production transitions, price oracle, mix/master or numerical helpers are reused.
const materials = ["R", "SR", "SSR"];
const gains = [100, 100, 200], success = [0.1, 0.4, 0.2];
const rules = { schema_version: 1, ruleset_id: "test-exhaustive", verified_at: "2026-09-11", action_size: 10,
  exp_per_level: 300, exp_step: 100, milestones: [1],
  materials: Object.fromEntries(materials.map((m, i) => [m, { exp_per_action: gains[i], success_rates: [success[i]] }])) };

function allUsagePolicies() {
  const vectors = [];
  for (let encoded = 0; encoded < 27; encoded++) {
    const actions = [encoded % 3, Math.floor(encoded / 3) % 3, Math.floor(encoded / 9)];
    function expected(exp) {
      if (exp >= 300) return [0, 0, 0];
      const a = actions[exp / 100];
      const future = expected(exp + gains[a]);
      return future.map((count, m) => Number(a === m) + (1 - success[a]) * count);
    }
    vectors.push(expected(0));
  }
  return vectors;
}
function combinations(items, length) {
  if (!length) return [[]];
  return items.flatMap((item, index) => combinations(items.slice(index + 1), length - 1).map((rest) => [item, ...rest]));
}
function solve(matrix, rhs) {
  const rows = matrix.map((row, i) => [...row, rhs[i]]), n = rows.length;
  for (let i = 0; i < n; i++) {
    const pivot = rows.findIndex((row, j) => j >= i && Math.abs(row[i]) > 1e-12);
    if (pivot < 0) return null;
    [rows[i], rows[pivot]] = [rows[pivot], rows[i]];
    const divisor = rows[i][i];
    rows[i] = rows[i].map((v) => v / divisor);
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const coefficient = rows[j][i];
      rows[j] = rows[j].map((v, k) => v - coefficient * rows[i][k]);
    }
  }
  return rows.map((row) => row[n]);
}
function exhaustiveCapacity(budgets) {
  const policies = allUsagePolicies();
  let best = 0;
  for (const size of [1, 2, 3]) {
    for (const selected of combinations(policies, size)) {
      for (const binding of combinations([0, 1, 2], size)) {
        const count = solve(binding.map((m) => selected.map((usage) => usage[m])), binding.map((m) => budgets[m]));
        if (!count || count.some((n) => n < -1e-9)) continue;
        if ([0, 1, 2].some((m) => selected.reduce((sum, usage, i) => sum + usage[m] * count[i], 0) > budgets[m] + 1e-9)) continue;
        best = Math.max(best, count.reduce((a, b) => a + b, 0));
      }
    }
  }
  return best;
}

test("production optimizer agrees with independent exhaustive primal solutions", () => {
  const engine = createEngine(rules);
  for (const budgets of [[10, 3, 1], [1, 1, 1], [2, 7, 3], [0, 3, 1], [7, 0, 0], [0, 0, 0], [100, 1, 0.01]]) {
    const actual = engine.solveMaxUnits({ level: 0, exp: 0 }, 1, Object.fromEntries(materials.map((m, i) => [m, budgets[i]])));
    assert.ok(Math.abs(actual.unit - exhaustiveCapacity(budgets)) < 1e-8, JSON.stringify({ budgets, actual: actual.unit }));
    assert.equal(actual.raw.converged, true);
  }
});
