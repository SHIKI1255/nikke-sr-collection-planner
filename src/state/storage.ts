import { MATERIALS } from "../core/types";
import type { Ruleset } from "../core/types";
import { asRecord, normalizeSnapshot, recordOutcome } from "./inputs";
import type { HistoryItem, Snapshot } from "./inputs";

export const STORAGE_KEY = "nikke-sr-inventory-calculator-v1";
export const SCHEMA_VERSION = 2;
export interface SavedState extends Snapshot { schemaVersion: 2; rulesIdentity: string; history: HistoryItem[] }

function validHistory(value: unknown, rules: Ruleset, defaults: Snapshot): value is HistoryItem {
  const item = asRecord(value);
  if (!MATERIALS.includes(item.material as HistoryItem["material"]) || (item.outcome !== "normal" && item.outcome !== "success")) return false;
  const before = normalizeSnapshot(item.before, defaults, rules);
  const original = asRecord(item.before);
  // History must be complete, numeric and already normalized; never repair an undo snapshot.
  for (const key of ["stock", "reserve", "start", "target"] as const) {
    const raw = original[key];
    const normalized = before[key];
    if (typeof normalized === "object") {
      if (Object.entries(normalized).some(([field, n]) => asRecord(raw)[field] !== n)) return false;
    } else if (raw !== normalized) return false;
  }
  const result = recordOutcome(before, item.material as HistoryItem["material"], item.outcome as HistoryItem["outcome"], rules);
  if ("error" in result) return false;
  return ["level", "exp"].every((key) =>
    asRecord(item.from)[key] === asRecord(result.item.from)[key] && asRecord(item.to)[key] === asRecord(result.item.to)[key]);
}

export function decodeState(serialized: string | null, defaults: Snapshot, rules: Ruleset, rulesIdentity: string) {
  const fallback = { snapshot: structuredClone(defaults), history: [] as HistoryItem[], writable: true, repaired: false };
  if (!serialized) return fallback;
  try {
    const raw = asRecord(JSON.parse(serialized));
    // Do not downgrade/overwrite an unknown newer storage format.
    if (raw.schemaVersion !== undefined && raw.schemaVersion !== SCHEMA_VERSION) return { ...fallback, writable: false, repaired: true };
    const snapshot = normalizeSnapshot(raw, defaults, rules);
    const list = Array.isArray(raw.history) ? raw.history : [];
    const compatible = raw.rulesIdentity === undefined || raw.rulesIdentity === rulesIdentity;
    const history = compatible ? list.slice(-20).filter((item) => validHistory(item, rules, defaults)) : [];
    return { snapshot, history, writable: true, repaired: !compatible || history.length !== Math.min(20, list.length) };
  } catch {
    return { ...fallback, repaired: true };
  }
}

export function encodeState(snapshot: Snapshot, history: HistoryItem[], rulesIdentity: string): string {
  const state: SavedState = { ...snapshot, schemaVersion: SCHEMA_VERSION, rulesIdentity, history: history.slice(-20) };
  return JSON.stringify(state);
}
