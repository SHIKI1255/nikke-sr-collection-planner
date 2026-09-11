import { MATERIALS } from "./types";
import type { Oracle, Ruleset, State } from "./types";
import { transitions } from "./rules";

/** Immutable transition graph, built once per engine, shared by all price queries. */
export function createOracle(rules: Ruleset): Oracle {
  const steps = rules.exp_per_level / rules.exp_step;
  const length = rules.milestones.at(-1)! * steps;
  const index = (state: State) => state.level * steps + state.exp / rules.exp_step;
  const normal = MATERIALS.map(() => new Int32Array(length));
  const big = new Int32Array(length);
  const rates = MATERIALS.map(() => new Float64Array(length));
  const move = transitions(rules);
  for (let i = 0; i < length; i++) {
    const state = { level: Math.floor(i / steps), exp: (i % steps) * rules.exp_step };
    const success = move.successTransition(state, rules.milestones.at(-1)!);
    big[i] = success ? index(success) : length;
    MATERIALS.forEach((material, action) => {
      const next = move.normalTransition(state, material, rules.milestones.at(-1)!);
      normal[action][i] = next ? index(next) : length;
      rates[action][i] = rules.materials[material].success_rates[state.level];
    });
  }
  return {
    index,
    build(target, startIndex, allowed, costs, order) {
      const count = target * steps;
      const values = new Float64Array(count);
      const usage = MATERIALS.map(() => new Float64Array(count));
      const actions = new Uint8Array(count);
      const rank = [0, 0, 0];
      order.forEach((action, position) => { rank[action] = position; });
      let tied = false;
      // States below this start cannot be reached, so do not solve them.
      for (let i = count - 1; i >= startIndex; i--) {
        const success = big[i];
        let best = allowed[0];
        let value = Infinity;
        for (const action of allowed) {
          const p = rates[action][i];
          const next = normal[action][i];
          const candidate = costs[action] + (1 - p) * (next < count ? values[next] : 0) + p * (success < count ? values[success] : 0);
          const tie = Math.abs(candidate - value) <= 1e-12 * Math.max(1, Math.abs(candidate));
          if (tie) tied = true;
          if (candidate < value && !tie || tie && rank[action] < rank[best]) {
            best = action;
            value = candidate;
          }
        }
        actions[i] = best;
        values[i] = value;
        const p = rates[best][i];
        const next = normal[best][i];
        for (let m = 0; m < MATERIALS.length; m++) {
          usage[m][i] = Number(m === best) + (1 - p) * (next < count ? usage[m][next] : 0) + p * (success < count ? usage[m][success] : 0);
        }
      }
      return { values, usage, actions, tied };
    },
  };
}
