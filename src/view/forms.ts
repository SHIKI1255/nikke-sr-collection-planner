import { MATERIALS } from "../core/types";
import type { Ruleset } from "../core/types";
import type { Snapshot } from "../state/inputs";
import { input, setText } from "./dom";
import { message } from "./format";

export function readForm(): Snapshot {
  return {
    stock: { R: Number(input("stock-r").value), SR: Number(input("stock-sr").value), SSR: Number(input("stock-ssr").value) },
    reserve: { R: Number(input("reserve-r").value), SR: Number(input("reserve-sr").value), SSR: Number(input("reserve-ssr").value) },
    start: { level: Number(input("current-level").value), exp: Number(input("current-exp").value) },
    target: Number(input("target-level").value),
  };
}
export function renderHints(snapshot: Snapshot, rules: Ruleset) {
  for (const m of MATERIALS) setText(`groups-${m.toLowerCase()}`, message("groupRemainder", {
    groups: Math.floor(snapshot.stock[m] / rules.action_size), items: snapshot.stock[m] % rules.action_size,
  }));
}
export function renderForm(snapshot: Snapshot, rules: Ruleset) {
  for (const m of MATERIALS) {
    input(`stock-${m.toLowerCase()}`).value = String(snapshot.stock[m]);
    input(`reserve-${m.toLowerCase()}`).value = String(snapshot.reserve[m]);
  }
  input("current-level").value = String(snapshot.start.level);
  input("current-exp").value = String(snapshot.start.exp);
  input("target-level").value = String(snapshot.target);
  renderHints(snapshot, rules);
}
