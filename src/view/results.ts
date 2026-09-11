import { MATERIALS } from "../core/types";
import type { Amounts, Ruleset, Solution } from "../core/types";
import type { Inputs } from "../state/inputs";
import { TEXT } from "../runtime/config";
import { byId, element, input, setText } from "./dom";
import { formatNumber, formatProbability, message } from "./format";
const EPS = 1e-8;

function mainMaterials(probabilities: Amounts) {
  const max = Math.max(...MATERIALS.map((m) => probabilities[m]));
  if (max <= EPS) return [];
  return MATERIALS.filter((m) => Math.abs(probabilities[m] - max) < 1e-5);
}

export function renderCurrentResult(inputs: Inputs, solution: Solution, rules: Ruleset) {
  byId("print-current-state").textContent = message("phaseExp", {
    level: inputs.start.level, exp: inputs.start.exp,
  });
  byId("print-target-level").textContent = message("phase", { value: inputs.target });
  byId("print-stock").textContent = MATERIALS
    .map((material) => message("stockItem", { material, value: inputs.stock[material] }))
    .join(" / ");
  byId("print-reserve").textContent = MATERIALS
    .map((material) => message("stockItem", { material, value: inputs.reserve[material] }))
    .join(" / ");
  const capacity = solution.unit;
  if (capacity === Infinity) {
    byId("capacity-value").textContent = TEXT.capacityAchieved;
    byId("capacity-unit").textContent = "";
    byId("capacity-note").textContent = message("capacityAchievedNote", { target: inputs.target });
    byId("recommend-material").textContent = TEXT.noUpgrade;
    byId("recommend-detail").textContent = TEXT.adjustTarget;
  } else {
    byId("capacity-value").textContent = formatNumber(capacity, 2);
    byId("capacity-unit").textContent = TEXT.capacityUnit;
    const whole = Math.floor(capacity + 1e-7);
    byId("capacity-note").textContent = capacity >= 1
      ? message("capacityEnough", { whole })
      : TEXT.capacityInsufficient;
    const mains = mainMaterials(solution.probabilities);
    byId("recommend-material").textContent = mains.length ? mains.join(" / ") : TEXT.stockInsufficient;
    const probabilityText = MATERIALS
      .filter((m) => solution.probabilities[m] > 0.001)
      .map((m) => `${m} ${formatProbability(solution.probabilities[m])}`)
      .join(" · ");
    byId("recommend-detail").textContent = probabilityText || message("addUsableGroup", { actionSize: rules.action_size });
    if (mains[0]) input("actual-material").value = mains[0];
  }

  let bottleneck = "—";
  let bottleneckCoverage = Infinity;
  for (const material of MATERIALS) {
    const consumption = solution.perUnit[material];
    const available = inputs.available[material];
    const coverage = consumption > EPS ? available / consumption : Infinity;
    if (coverage < bottleneckCoverage) {
      bottleneckCoverage = coverage;
      bottleneck = material;
    }
    const usageEl = byId(`usage-${material.toLowerCase()}`);
    const metaEl = byId(`usage-meta-${material.toLowerCase()}`);
    const meterEl = byId(`meter-${material.toLowerCase()}`);
    usageEl.textContent = message("groups", { value: formatNumber(consumption, 2) });
    const expectedItems = consumption * rules.action_size;
    const remaining = inputs.stock[material] - expectedItems;
    metaEl.textContent = remaining >= -0.005
      ? message("consumptionRemaining", {
        used: formatNumber(expectedItems, 1),
        remaining: formatNumber(Math.max(0, remaining), 1),
      })
      : message("consumptionShortage", {
        used: formatNumber(expectedItems, 1),
        shortage: formatNumber(-remaining, 1),
      });
    const percentage = inputs.available[material] > 0
      ? Math.min(100, consumption / inputs.available[material] * 100)
      : consumption > 0 ? 100 : 0;
    meterEl.style.width = `${percentage}%`;
  }

  byId("bottleneck-value").textContent = bottleneck === "—"
    ? TEXT.noKitsNeeded
    : message("coverage", {
      material: bottleneck, value: formatNumber(bottleneckCoverage, 2),
    });
  byId("whole-completions").textContent = capacity === Infinity
    ? TEXT.wholeAchieved
    : message("wholeCount", { value: Math.max(0, Math.floor(capacity + 1e-7)) });

  const shortages = MATERIALS
    .filter((m) => solution.shortage[m] > 1e-6)
    .map((material) => message("shortageItem", {
      material, value: formatNumber(solution.shortage[material] * rules.action_size, 1),
    }));
  if (shortages.length) {
    byId("shortage-alert").classList.add("active");
    byId("shortage-alert").replaceChildren(element("b", "", TEXT.shortagePrefix), document.createTextNode(shortages.join(TEXT.listSeparator) + TEXT.shortageSuffix));
  } else {
    byId("shortage-alert").classList.remove("active");
    byId("shortage-alert").textContent = "";
  }
}


export function renderInvalid(note: string) {
  for (const id of ["capacity-value", "recommend-material", "bottleneck-value", "whole-completions",
    "print-current-state", "print-target-level", "print-stock", "print-reserve"]) setText(id, "—");
  setText("capacity-unit", "");
  setText("capacity-note", note);
  setText("recommend-detail", TEXT.recommendWaiting);
  for (const m of MATERIALS) {
    setText(`usage-${m.toLowerCase()}`, "—");
    setText(`usage-meta-${m.toLowerCase()}`, TEXT.waiting);
    byId(`meter-${m.toLowerCase()}`).style.width = "0%";
  }
  byId("shortage-alert").classList.remove("active");
  byId("shortage-alert").replaceChildren();
  byId("policy-tables").replaceChildren(element("div", "table-empty", note));
}
