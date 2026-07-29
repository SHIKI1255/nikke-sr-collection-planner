import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rules = JSON.parse(
  await readFile(new URL("../data/rulesets/2026-07-29.json", import.meta.url), "utf8"),
);

function normalTransition(state, gain, target) {
  let level = state.level;
  let exp = state.exp + gain;
  if (exp >= rules.exp_per_level) {
    exp -= rules.exp_per_level;
    level += 1;
    if (rules.milestones.includes(level)) exp = 0;
  }
  return level >= target ? null : { level, exp };
}

function expectedPhase(material, startLevel, targetLevel) {
  const gain = rules.materials[material].exp_per_action;
  const rates = rules.materials[material].success_rates;
  const memo = new Map();

  function solve(state) {
    if (state.level >= targetLevel) return 0;
    const key = `${state.level}_${state.exp}`;
    if (memo.has(key)) return memo.get(key);
    const next = normalTransition(state, gain, targetLevel);
    const value = 1 + (1 - rates[state.level]) * (next ? solve(next) : 0);
    memo.set(key, value);
    return value;
  }

  return solve({ level: startLevel, exp: 0 });
}

function expectedRoute(material, startLevel = 0) {
  const nodes = rules.milestones.filter((node) => node > startLevel);
  let level = startLevel;
  let total = 0;
  for (const node of nodes) {
    total += expectedPhase(material, level, node);
    level = node;
  }
  return total;
}

function close(actual, expected, tolerance = 1e-10) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${expected}, received ${actual}`,
  );
}

test("ruleset has the expected action and probability dimensions", () => {
  assert.equal(rules.action_size, 10);
  assert.equal(rules.exp_per_level, 3000);
  assert.deepEqual(rules.milestones, [5, 10, 15]);
  for (const material of ["R", "SR", "SSR"]) {
    assert.equal(rules.materials[material].success_rates.length, 15);
  }
});

test("pure-tool 0-to-15 expectations match the audited workbook", () => {
  close(expectedRoute("R"), 86.05720343847467);
  close(expectedRoute("SR"), 26.69876137860031);
  close(expectedRoute("SSR"), 11.724455147379953);
});

test("pure-tool 5-to-15 expectations match the independent audit", () => {
  close(expectedRoute("R", 5), 65.7875730664406);
  close(expectedRoute("SR", 5), 19.841890135739);
  close(expectedRoute("SSR", 5), 8.42346764615925);
});

test("5-to-15 ability ratios remain stable", () => {
  const ssr = expectedRoute("SSR", 5);
  close(expectedRoute("R", 5) / ssr, 7.81003451665622);
  close(expectedRoute("SR", 5) / ssr, 2.35554892227622);
});
