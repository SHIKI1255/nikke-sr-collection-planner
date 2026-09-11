import { amounts, MATERIALS } from "../core/types";
import type { Amounts, Material, Ruleset, State } from "../core/types";
import { transitions } from "../core/rules";

/** Persisted inventory is individual kits. Only deriveInputs converts to attempts. */
export interface Snapshot { stock: Amounts; reserve: Amounts; start: State; target: number }
export interface Inputs extends Snapshot { usableItems: Amounts; available: Amounts; remainder: Amounts }
export interface HistoryItem { before: Snapshot; material: Material; outcome: "normal" | "success"; from: State; to: State }
export const asRecord = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
const number = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.floor(value))) : fallback;

export function normalizeSnapshot(value: unknown, fallback: Snapshot, rules: Ruleset): Snapshot {
  const raw = asRecord(value);
  const stocks = asRecord(raw.stock);
  const reserves = asRecord(raw.reserve);
  const state = asRecord(raw.start);
  const stock = amounts((m) => number(stocks[m], fallback.stock[m], 0, 999999));
  const reserve = amounts((m) => Math.min(stock[m], number(reserves[m], fallback.reserve[m], 0, stock[m])));
  const max = rules.milestones.at(-1)!;
  const level = number(state.level, fallback.start.level, 0, max);
  const boundedExp = number(state.exp, fallback.start.exp, 0, rules.exp_per_level - rules.exp_step);
  const exp = level === max ? 0 : Math.round(boundedExp / rules.exp_step) * rules.exp_step;
  const target = typeof raw.target === "number" && rules.milestones.includes(raw.target) ? raw.target : fallback.target;
  return { stock, reserve, start: { level, exp }, target };
}

export function deriveInputs(snapshot: Snapshot, rules: Ruleset): Inputs {
  const usableItems = amounts((m) => snapshot.stock[m] - snapshot.reserve[m]);
  return { ...structuredClone(snapshot), usableItems,
    available: amounts((m) => Math.floor(usableItems[m] / rules.action_size)),
    remainder: amounts((m) => usableItems[m] % rules.action_size) };
}

export function recordOutcome(before: Snapshot, material: Material, outcome: HistoryItem["outcome"], rules: Ruleset) {
  if (!MATERIALS.includes(material) || !["normal", "success"].includes(outcome)) throw new Error("Invalid enhancement action");
  if (before.start.level >= before.target) return { error: "alreadyAtTarget" } as const;
  if (before.stock[material] - before.reserve[material] < rules.action_size) return { error: "notEnoughToRecord" } as const;
  const move = transitions(rules);
  const next = outcome === "success" ? move.successTransition(before.start, before.target) : move.normalTransition(before.start, material, before.target);
  const after = structuredClone(before);
  after.stock[material] -= rules.action_size;
  after.start = next ?? { level: before.target, exp: 0 };
  // Reaching a milestone never changes the user's selected target.
  return { after, item: { before: structuredClone(before), material, outcome, from: { ...before.start }, to: { ...after.start } } satisfies HistoryItem };
}
