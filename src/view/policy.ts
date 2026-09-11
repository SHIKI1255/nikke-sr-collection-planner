import { MATERIALS } from "../core/types";
import type { Amounts, Ruleset } from "../core/types";
import { TEXT } from "../runtime/config";
import { byId, element } from "./dom";
import { formatProbability, message } from "./format";
import { createMark } from "./icons";
import type { Mark } from "./icons";

const markFromProbabilities = (probabilities: Amounts, material: keyof Amounts): Mark => {
  const max = Math.max(...Object.values(probabilities));
  const value = probabilities[material];
  if (max <= 1e-8 || value <= 0.002) return "cross";
  return Math.abs(value - max) < 1e-5 ? "circle" : "triangle";
};
export function renderPolicy(entries: [string, Amounts][], rules: Ruleset, target: number) {
  const policyMap = new Map(entries);
  const container = byId("policy-tables");
  const fragment = document.createDocumentFragment();
  const stages = rules.milestones.filter((goal) => goal <= target);
  container.dataset.stageCount = String(stages.length);
  stages.forEach((goal, stageIndex) => {
    const start = stages[stageIndex - 1] ?? 0;
    const end = goal - 1;
    const wrapper = element("div", "table-wrap");
    const table = element("table", "policy-table");
    table.setAttribute("aria-label", message("policyAria", { start, end }));
    const caption = table.createCaption();
    caption.append(element("span", "", message("stageRange", { start, end })), element("small", "", message("stageGoal", { goal })));
    const header = table.createTHead().insertRow();
    [TEXT.levelHeader, TEXT.expHeader, ...MATERIALS].forEach((text, i) => {
      const th = element("th", i >= 2 ? `${MATERIALS[i - 2].toLowerCase()}-head` : "", text);
      th.scope = "col";
      header.append(th);
    });
    const body = table.createTBody();
    for (let level = start; level <= end; level++) {
      [0, rules.exp_per_level / 3, rules.exp_per_level * 2 / 3].forEach((exp, i) => {
        const row = body.insertRow();
        if (!i) {
          const th = element("th", "level-cell", String(level));
          th.scope = "rowgroup";
          th.rowSpan = 3;
          row.append(th);
        }
        row.append(element("td", "exp-cell", String(exp)));
        const probabilities = policyMap.get(`${level}_${exp}`)!;
        for (const material of MATERIALS) {
          const mark = markFromProbabilities(probabilities, material);
          const label = mark === "circle" ? TEXT.markPrimary : mark === "triangle" ? TEXT.markMixed : TEXT.markAvoid;
          const title = probabilities[material] > 0.002 ? `${label}${TEXT.listSeparator}${message("strategyShare", { value: formatProbability(probabilities[material]) })}` : label;
          const cell = element("td", "mark-cell");
          cell.append(createMark(mark, title));
          row.append(cell);
        }
      });
    }
    wrapper.append(table);
    fragment.append(wrapper);
  });
  container.replaceChildren(fragment);
}
