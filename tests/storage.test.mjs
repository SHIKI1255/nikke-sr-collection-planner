import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "../scripts/load-module.mjs";
import { loadProject } from "../scripts/project-config.mjs";
const { rules, scenario } = await loadProject();
const { createStore } = await loadModule("src/state/store.ts");
const { decodeState, encodeState } = await loadModule("src/state/storage.ts");
const { normalizeSnapshot, deriveInputs } = await loadModule("src/state/inputs.ts");

test("state normalizes kit counts, reserves and EXP without advancing the chosen target", () => {
  const s = normalizeSnapshot({ stock: { R: -1, SR: 1e10 }, reserve: { SR: 1e10 }, start: { level: 5, exp: 1250 }, target: 5 }, scenario, rules);
  assert.equal(s.stock.R, 0); assert.equal(s.stock.SR, 999999); assert.equal(s.reserve.SR, 999999);
  assert.equal(s.start.exp, 1300); assert.equal(s.target, 5);
  const inputs = deriveInputs({ ...scenario, stock: { R: 123, SR: 0, SSR: 0 }, reserve: { R: 4, SR: 0, SSR: 0 } }, rules);
  assert.equal(inputs.available.R, 11); assert.equal(inputs.remainder.R, 9);
});

test("state/history persists before solver work and stays bounded", () => {
  const store = createStore(scenario, rules);
  for (let i = 0; i < 30; i++) {
    store.replace(scenario);
    assert.equal(store.record("R", "normal"), null);
  }
  assert.equal(store.history().length, 20);
  const serialized = encodeState(store.snapshot(), store.history(), "rules-v1");
  const saved = JSON.parse(serialized);
  assert.equal(saved.schemaVersion, 2);
  assert.equal(saved.stock.R, 5990);
  const restored = decodeState(serialized, scenario, rules, "rules-v1");
  assert.equal(restored.history.length, 20);
  assert.equal(restored.snapshot.start.exp, 200);
  assert.equal(store.undo(), true);
  assert.equal(store.snapshot().stock.R, 6000);
});

test("legacy state migrates; invalid history cannot be rendered or undone", () => {
  const store = createStore(scenario, rules);
  store.record("R", "normal");
  const item = store.history()[0];
  const serialized = JSON.stringify({ ...store.snapshot(), history: [item, {}, null, { ...item, material: '<img src=x>' }, { ...item, before: {} }, { ...item, outcome: { toString: "invalid" } }] });
  const saved = decodeState(serialized, scenario, rules, "rules-v1");
  assert.equal(saved.snapshot.stock.R, 5990);
  assert.deepEqual(saved.history, [item]);
  assert.equal(saved.repaired, true);
  assert.equal(saved.writable, true);
  assert.doesNotThrow(() => decodeState("{broken", scenario, rules, "rules-v1"));
});

test("newer storage is not overwritten and changed rules invalidate undo history", () => {
  const store = createStore(scenario, rules);
  store.record("SR", "success");
  const serialized = encodeState(store.snapshot(), store.history(), "old-rules");
  const changed = decodeState(serialized, scenario, rules, "new-rules");
  assert.equal(changed.history.length, 0);
  assert.equal(changed.snapshot.stock.SR, 1990);
  const future = decodeState(JSON.stringify({ schemaVersion: 3 }), scenario, rules, "new-rules");
  assert.equal(future.writable, false);
});
