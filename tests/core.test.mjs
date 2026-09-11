import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadModule } from "../scripts/load-module.mjs";

const { createEngine } = await loadModule("src/core/engine.ts");
const rules = JSON.parse(await readFile(new URL("../data/rulesets/2026-07-29.json", import.meta.url)));
const engine = createEngine(rules);
const materials = ["R", "SR", "SSR"];
const close = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);

test("production engine preserves all pure-tool audited totals", () => {
  for (const [level, expected] of [[0, [86.05720343847467, 26.69876137860031, 11.724455147379953]], [5, [65.7875730664406, 19.841890135739, 8.42346764615925]]]) {
    materials.forEach((material, i) => {
      const stock = { R: 0, SR: 0, SSR: 0, [material]: 100 };
      const result = engine.solveMaxUnits({ level, exp: 0 }, 15, stock);
      close(result.perUnit[material], expected[i]);
      assert.equal(result.raw.converged, true);
    });
  }
});

test("production optimizer preserves both audited mixed baselines", () => {
  for (const values of [[27.10472217509205, 8.4090869871621, 3.6927541998417297], [50.36831173851833, 5.24788751975503, 1.9394366920833799]]) {
    const available = Object.fromEntries(materials.map((m, i) => [m, values[i]]));
    const result = engine.solveMaxUnits({ level: 0, exp: 0 }, 15, available);
    materials.forEach((m, i) => close(result.perUnit[m], values[i]));
    assert.equal(result.raw.converged, true);
  }
});

test("inventory scaling is invariant and solutions remain feasible over deterministic varied inputs", () => {
  let seed = 5183;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const cases = [{ start: { level: 6, exp: 1200 }, target: 10, stock: { R: 53, SR: 262, SSR: 141 } }];
  for (let i = 0; i < 60; i++) {
    const target = [5, 10, 15][i % 3];
    cases.push({ start: { level: Math.floor(random() * target), exp: Math.floor(random() * 30) * 100 }, target,
      stock: Object.fromEntries(materials.map((m, j) => [m, (i + j) % 4 ? Math.max(1, Math.floor(random() * 99999)) : 0])) });
  }
  for (const { start, target, stock } of cases) {
    const a = engine.solveMaxUnits(start, target, stock);
    const b = engine.solveMaxUnits(start, target, Object.fromEntries(materials.map((m) => [m, stock[m] * 100])));
    assert.equal(a.raw.feasible, true);
    assert.equal(a.raw.converged, true, JSON.stringify({ start, target, stock, raw: a.raw }));
    assert.ok(Math.abs(a.unit * 100 - b.unit) / Math.max(1, b.unit) <= 1e-7);
    close(Object.values(a.probabilities).reduce((x, y) => x + y), 1, 1e-8);
    for (const m of materials) assert.ok(a.usage[m] <= stock[m] + 1e-8 * Math.max(1, stock[m]));
  }
});

test("edge states, zero budgets and reference fallback are explicit", () => {
  for (const target of [5, 10, 15]) {
    assert.equal(engine.solveMaxUnits({ level: target, exp: 0 }, target, { R: 0, SR: 0, SSR: 0 }).unit, Infinity);
    assert.equal(engine.normalTransition({ level: target - 1, exp: 2900 }, "R", 15)?.exp ?? 0, 0);
  }
  assert.equal(engine.solveMaxUnits({ level: 0, exp: 0 }, 15, { R: 0, SR: 0, SSR: 0 }).unit, 0);
  assert.equal(engine.solve({ start: { level: 0, exp: 0 }, target: 15, availableAttempts: { R: 0, SR: 0, SSR: 0 } }).raw.reference, true);
});

test("invalid or unsupported rules and requests are rejected", () => {
  for (const mutate of [r => r.materials.R.success_rates.pop(), r => r.milestones.reverse(), r => r.exp_step = 101,
    r => r.materials.SR.exp_per_action = 3001, r => r.materials.SSR.success_rates[0] = 2, r => r.materials.UR = r.materials.R]) {
    const invalid = structuredClone(rules);
    mutate(invalid);
    assert.throws(() => createEngine(invalid));
  }
  for (const start of [{ level: -1, exp: 0 }, { level: 1, exp: 123 }, { level: 15, exp: 100 }]) {
    assert.throws(() => engine.solveMaxUnits(start, 15, { R: 1, SR: 2, SSR: 3 }));
  }
  assert.throws(() => engine.solveMaxUnits({ level: 0, exp: 0 }, 7, { R: 1, SR: 2, SSR: 3 }));
  assert.throws(() => engine.solveMaxUnits({ level: 0, exp: 0 }, 15, { R: NaN, SR: 2, SSR: 3 }));
});

test("result cache is exact, bounded and insulated from API caller mutations", () => {
  const start = { level: 14, exp: 2000 };
  const request = { R: 100, SR: 10, SSR: 1 };
  const first = engine.solveMaxUnits(start, 15, request);
  const value = first.unit;
  first.unit = -1;
  close(engine.solveMaxUnits(start, 15, request).unit, value);
  assert.ok(engine.cacheInfo().hits > 0);
  for (let i = 1; i < 80; i++) engine.solveMaxUnits(start, 15, { R: i, SR: 0, SSR: 0 });
  assert.equal(engine.cacheInfo().size, 64);
});

test("test-only rules and algorithm injection prove the extension boundary", () => {
  const alternate = structuredClone(rules);
  alternate.action_size = 5;
  alternate.exp_per_level = 200;
  alternate.exp_step = 100;
  alternate.milestones = [1, 2];
  for (const m of materials) alternate.materials[m] = { exp_per_action: 100, success_rates: [0.5, 0.5] };
  const extended = createEngine(alternate);
  close(extended.solveMaxUnits({ level: 0, exp: 0 }, 2, { R: 30, SR: 0, SSR: 0 }).perUnit.R, 3);
  let received;
  const alternateAlgorithm = createEngine(alternate, { optimizer: (_oracle, request) => {
    received = request;
    return extended.solveMaxUnits(request.start, request.target, request.availableAttempts);
  } });
  alternateAlgorithm.solve({ start: { level: 0, exp: 0 }, target: 2, availableAttempts: { R: 30, SR: 0, SSR: 0 } });
  assert.equal(received.target, 2);
});
