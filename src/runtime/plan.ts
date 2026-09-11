import type { Engine } from "../core/engine";
import type { Amounts, Solution } from "../core/types";
import type { Inputs } from "../state/inputs";

export type PlanEvent = { kind: "current"; solution: Solution } |
  { kind: "progress"; current: number; total: number } |
  { kind: "complete"; entries: [string, Amounts][] };

/** Same engine and plan sequence in a Worker and the cooperative fallback. */
export function* planEvents(engine: Engine, inputs: Inputs): Generator<PlanEvent> {
  const solve = (start: Inputs["start"]) => {
    const result = engine.solveScenario(start, inputs.target, inputs.available);
    if (result.raw.converged === false) throw new Error("NUMERICAL_CONVERGENCE");
    return result;
  };
  yield { kind: "current", solution: solve(inputs.start) };
  const entries: [string, Amounts][] = [];
  const expAnchors = [0, engine.rules.exp_per_level / 3, engine.rules.exp_per_level * 2 / 3];
  for (let level = 0; level < inputs.target; level++) {
    for (const exp of expAnchors) {
      entries.push([`${level}_${exp}`, solve({ level, exp }).probabilities]);
      yield { kind: "progress", current: entries.length, total: inputs.target * expAnchors.length };
    }
  }
  yield { kind: "complete", entries };
}
