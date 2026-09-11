import type { Ruleset } from "../core/types";
import { deriveInputs, normalizeSnapshot, recordOutcome } from "./inputs";
import type { HistoryItem, Snapshot } from "./inputs";

/** One owner for inputs/history/revision. DOM and asynchronous jobs hold snapshots only. */
export function createStore(defaults: Snapshot, rules: Ruleset, initial = defaults, initialHistory: HistoryItem[] = []) {
  let snapshot = normalizeSnapshot(initial, defaults, rules);
  let history = structuredClone(initialHistory.slice(-20));
  let revision = 0;
  const replace = (value: unknown) => { snapshot = normalizeSnapshot(value, defaults, rules); revision++; };
  return {
    inputs: () => deriveInputs(snapshot, rules),
    snapshot: () => structuredClone(snapshot),
    history: () => structuredClone(history),
    revision: () => revision,
    replace,
    record(material: HistoryItem["material"], outcome: HistoryItem["outcome"]) {
      const result = recordOutcome(snapshot, material, outcome, rules);
      if ("error" in result) return result.error;
      replace(result.after);
      history.push(result.item);
      history = history.slice(-20);
      return null;
    },
    undo() {
      const item = history.pop();
      if (!item) return false;
      replace(item.before);
      return true;
    },
    example() { history = []; replace(defaults); },
  };
}
