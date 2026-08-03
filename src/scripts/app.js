/* Exact dynamic programming and dual column generation are embedded below. */
(() => {
    "use strict";

    const MATERIALS = ["R", "SR", "SSR"];
    const POLICY_STAGES = [
      { start: 0, end: 4, goal: 5 },
      { start: 5, end: 9, goal: 10 },
      { start: 10, end: 14, goal: 15 },
    ];
    const GAINS = { R: 200, SR: 500, SSR: 1000 };
    const SUCCESS = {
      R:   [0.036, 0.059, 0.078, 0.113, 0.150, 0.022, 0.033, 0.049, 0.076, 0.125, 0.012, 0.022, 0.031, 0.047, 0.100],
      SR:  [0.110, 0.198, 0.287, 0.413, 0.550, 0.080, 0.120, 0.180, 0.280, 0.500, 0.054, 0.099, 0.144, 0.216, 0.450],
      SSR: [0.250, 0.400, 0.550, 0.750, 1.000, 0.200, 0.300, 0.450, 0.700, 1.000, 0.150, 0.275, 0.400, 0.600, 1.000],
    };
    const STORAGE_KEY = "nikke-sr-inventory-calculator-v1";
    const THEME_STORAGE_KEY = "nikke-sr-theme-v1";
    const THEME_MODES = new Set(["auto", "light", "dark"]);
    const themeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const EPS = 1e-8;
    const els = {};
    let calculationToken = 0;
    let currentSolution = null;
    let history = [];
    let toastTimer = null;

    function byId(id) { return document.getElementById(id); }

    function effectiveTheme(mode) {
      if (mode === "dark" || mode === "light") return mode;
      return themeMediaQuery.matches ? "dark" : "light";
    }

    function applyThemeMode(requestedMode, { persist = false } = {}) {
      const mode = THEME_MODES.has(requestedMode) ? requestedMode : "auto";
      document.documentElement.dataset.themeMode = mode;
      document.documentElement.dataset.theme = effectiveTheme(mode);
      els.themeButtons?.forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.themeMode === mode));
      });
      if (persist) {
        try {
          localStorage.setItem(THEME_STORAGE_KEY, mode);
        } catch { /* Keep the selected theme for this page when storage is unavailable. */ }
      }
    }

    function handleSystemThemeChange() {
      if (document.documentElement.dataset.themeMode === "auto") {
        applyThemeMode("auto");
      }
    }

    function clamp(value, min, max) {
      const n = Number(value);
      if (!Number.isFinite(n)) return min;
      return Math.min(max, Math.max(min, n));
    }

    function roundExp(value) {
      return Math.round(clamp(value, 0, 2900) / 100) * 100;
    }

    function stateKey(state) { return `${state.level}_${state.exp}`; }
    function flowName(state) { return `f_${state.level}_${state.exp}`; }
    function variableName(state, material) { return `x_${state.level}_${state.exp}_${material}`; }

    function nextNode(level) {
      if (level < 5) return 5;
      if (level < 10) return 10;
      return 15;
    }

    function normalTransition(state, material, target) {
      let level = state.level;
      let exp = state.exp + GAINS[material];
      if (exp >= 3000) {
        exp -= 3000;
        level += 1;
        if (level === 5 || level === 10 || level === 15) exp = 0;
      }
      if (level >= target) return null;
      return { level, exp };
    }

    function successTransition(state, target) {
      const level = nextNode(state.level);
      if (level >= target) return null;
      return { level, exp: 0 };
    }

    function addCoefficient(variable, name, value) {
      variable[name] = (variable[name] || 0) + value;
    }

    function makeStates(startLevel, target) {
      const states = [];
      for (let level = startLevel; level < target; level += 1) {
        for (let exp = 0; exp <= 2900; exp += 100) states.push({ level, exp });
      }
      return states;
    }

    function stateIndex(state) {
      return state.level * 30 + Math.round(state.exp / 100);
    }

    function solveLinear3(matrix, vector) {
      const rows = matrix.map((row, index) => [...row, vector[index]]);
      for (let column = 0; column < 3; column += 1) {
        let pivot = column;
        for (let row = column + 1; row < 3; row += 1) {
          if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
        }
        if (Math.abs(rows[pivot][column]) < 1e-11) return null;
        [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
        const divisor = rows[column][column];
        for (let cell = column; cell < 4; cell += 1) rows[column][cell] /= divisor;
        for (let row = 0; row < 3; row += 1) {
          if (row === column) continue;
          const factor = rows[row][column];
          for (let cell = column; cell < 4; cell += 1) rows[row][cell] -= factor * rows[column][cell];
        }
      }
      return rows.map((row) => row[3]);
    }

    function dotActive(left, right, active) {
      return active.reduce((sum, index) => sum + left[index] * right[index], 0);
    }

    function buildPricePolicy(target, allowed, costs, tieOrder) {
      const length = target * 30;
      const values = new Float64Array(length);
      const usage = MATERIALS.map(() => new Float64Array(length));
      const actions = new Uint8Array(length);
      const rank = new Map(tieOrder.map((index, position) => [index, position]));

      for (let level = target - 1; level >= 0; level -= 1) {
        for (let exp = 2900; exp >= 0; exp -= 100) {
          const state = { level, exp };
          const index = stateIndex(state);
          let bestAction = allowed[0];
          let bestValue = Infinity;
          for (const action of allowed) {
            const material = MATERIALS[action];
            const probability = SUCCESS[material][level];
            const normal = normalTransition(state, material, target);
            const big = successTransition(state, target);
            const normalValue = normal ? values[stateIndex(normal)] : 0;
            const bigValue = big ? values[stateIndex(big)] : 0;
            const candidate = costs[action] + (1 - probability) * normalValue + probability * bigValue;
            if (candidate < bestValue - 1e-10 ||
                (Math.abs(candidate - bestValue) <= 1e-10 && rank.get(action) < rank.get(bestAction))) {
              bestValue = candidate;
              bestAction = action;
            }
          }
          actions[index] = bestAction;
          values[index] = bestValue;
          const chosen = MATERIALS[bestAction];
          const probability = SUCCESS[chosen][level];
          const normal = normalTransition(state, chosen, target);
          const big = successTransition(state, target);
          for (let materialIndex = 0; materialIndex < 3; materialIndex += 1) {
            usage[materialIndex][index] = (materialIndex === bestAction ? 1 : 0)
              + (1 - probability) * (normal ? usage[materialIndex][stateIndex(normal)] : 0)
              + probability * (big ? usage[materialIndex][stateIndex(big)] : 0);
          }
        }
      }
      return { values, usage, actions };
    }

    function policySignature(policy, target) {
      return Array.from(policy.actions.subarray(0, target * 30)).join("");
    }

    function makePolicyRecord(policy, start, available, active) {
      const index = stateIndex(start);
      const expected = MATERIALS.map((_, materialIndex) => policy.usage[materialIndex][index]);
      const ratios = expected.map((value, materialIndex) =>
        active.includes(materialIndex) ? value / available[MATERIALS[materialIndex]] : 0);
      return { ...policy, expected, ratios };
    }

    function dualMaster(policies, active) {
      if (active.length === 1) {
        const lambda = [0, 0, 0];
        lambda[active[0]] = 1;
        return { lambda, value: Math.min(...policies.map((policy) => policy.ratios[active[0]])) };
      }

      const candidates = [];
      const seen = new Set();
      const add = (lambda) => {
        const cleaned = lambda.map((value) => Math.abs(value) < 1e-10 ? 0 : value);
        if (cleaned.some((value) => value < -1e-8) || Math.abs(cleaned.reduce((a, b) => a + b, 0) - 1) > 1e-7) return;
        const key = cleaned.map((value) => value.toFixed(9)).join("|");
        if (!seen.has(key)) {
          seen.add(key);
          candidates.push(cleaned);
        }
      };

      for (const index of active) {
        const lambda = [0, 0, 0];
        lambda[index] = 1;
        add(lambda);
      }

      for (let edgeA = 0; edgeA < active.length; edgeA += 1) {
        for (let edgeB = edgeA + 1; edgeB < active.length; edgeB += 1) {
          const a = active[edgeA];
          const b = active[edgeB];
          for (let first = 0; first < policies.length; first += 1) {
            for (let second = first + 1; second < policies.length; second += 1) {
              const da = policies[first].ratios[a] - policies[second].ratios[a];
              const db = policies[first].ratios[b] - policies[second].ratios[b];
              const denominator = da - db;
              if (Math.abs(denominator) < 1e-11) continue;
              const weightA = -db / denominator;
              if (weightA >= -1e-9 && weightA <= 1 + 1e-9) {
                const lambda = [0, 0, 0];
                lambda[a] = Math.max(0, Math.min(1, weightA));
                lambda[b] = 1 - lambda[a];
                add(lambda);
              }
            }
          }
        }
      }

      if (active.length === 3) {
        for (let first = 0; first < policies.length; first += 1) {
          for (let second = first + 1; second < policies.length; second += 1) {
            for (let third = second + 1; third < policies.length; third += 1) {
              const matrix = [
                [1, 1, 1],
                active.map((index) => policies[first].ratios[index] - policies[third].ratios[index]),
                active.map((index) => policies[second].ratios[index] - policies[third].ratios[index]),
              ];
              const solved = solveLinear3(matrix, [1, 0, 0]);
              if (!solved) continue;
              const lambda = [0, 0, 0];
              active.forEach((index, position) => { lambda[index] = solved[position]; });
              add(lambda);
            }
          }
        }
      }

      let best = { lambda: candidates[0], value: -Infinity };
      for (const lambda of candidates) {
        const value = Math.min(...policies.map((policy) => dotActive(lambda, policy.ratios, active)));
        const balance = active.reduce((sum, index) => sum + lambda[index] * lambda[index], 0);
        const bestBalance = active.reduce((sum, index) => sum + best.lambda[index] * best.lambda[index], 0);
        if (value > best.value + 1e-10 || (Math.abs(value - best.value) <= 1e-10 && balance < bestBalance)) {
          best = { lambda, value };
        }
      }
      return best;
    }

    function bestPolicyMix(policies, active) {
      let best = null;
      const consider = (indices, weights) => {
        if (weights.some((weight) => weight < -1e-8)) return;
        const sum = weights.reduce((a, b) => a + b, 0);
        if (Math.abs(sum - 1) > 1e-6) return;
        const ratios = [0, 0, 0];
        indices.forEach((policyIndex, position) => {
          for (const materialIndex of active) {
            ratios[materialIndex] += weights[position] * policies[policyIndex].ratios[materialIndex];
          }
        });
        const value = Math.max(...active.map((index) => ratios[index]));
        if (!best || value < best.value - 1e-9) {
          best = { indices: [...indices], weights: [...weights], value, ratios };
        }
      };

      for (let index = 0; index < policies.length; index += 1) consider([index], [1]);

      for (let first = 0; first < policies.length; first += 1) {
        for (let second = first + 1; second < policies.length; second += 1) {
          const candidateWeights = [0, 1];
          for (let a = 0; a < active.length; a += 1) {
            for (let b = a + 1; b < active.length; b += 1) {
              const materialA = active[a];
              const materialB = active[b];
              const deltaFirst = policies[first].ratios[materialA] - policies[first].ratios[materialB];
              const deltaSecond = policies[second].ratios[materialA] - policies[second].ratios[materialB];
              const denominator = deltaFirst - deltaSecond;
              if (Math.abs(denominator) < 1e-11) continue;
              const weight = -deltaSecond / denominator;
              if (weight >= -1e-9 && weight <= 1 + 1e-9) candidateWeights.push(Math.max(0, Math.min(1, weight)));
            }
          }
          for (const weight of candidateWeights) consider([first, second], [weight, 1 - weight]);
        }
      }

      if (active.length === 3) {
        for (let first = 0; first < policies.length; first += 1) {
          for (let second = first + 1; second < policies.length; second += 1) {
            for (let third = second + 1; third < policies.length; third += 1) {
              const [a, b, c] = active;
              const matrix = [
                [1, 1, 1],
                [
                  policies[first].ratios[a] - policies[first].ratios[c],
                  policies[second].ratios[a] - policies[second].ratios[c],
                  policies[third].ratios[a] - policies[third].ratios[c],
                ],
                [
                  policies[first].ratios[b] - policies[first].ratios[c],
                  policies[second].ratios[b] - policies[second].ratios[c],
                  policies[third].ratios[b] - policies[third].ratios[c],
                ],
              ];
              const weights = solveLinear3(matrix, [1, 0, 0]);
              if (weights) consider([first, second, third], weights);
            }
          }
        }
      }
      return best;
    }

    function probabilitiesFromMix(mix, policies, state) {
      const probabilities = { R: 0, SR: 0, SSR: 0 };
      if (!mix) return probabilities;
      const index = stateIndex(state);
      mix.indices.forEach((policyIndex, position) => {
        const material = MATERIALS[policies[policyIndex].actions[index]];
        probabilities[material] += mix.weights[position];
      });
      return probabilities;
    }

    function solveMaxUnits(start, target, available) {
      if (start.level >= target) {
        return {
          raw: { feasible: true },
          unit: Infinity,
          usage: { R: 0, SR: 0, SSR: 0 },
          perUnit: { R: 0, SR: 0, SSR: 0 },
          probabilities: { R: 0, SR: 0, SSR: 0 },
          shortage: { R: 0, SR: 0, SSR: 0 },
          mode: "complete",
        };
      }

      const active = MATERIALS.map((material, index) => available[material] > EPS ? index : -1).filter((index) => index >= 0);
      if (!active.length) {
        return {
          raw: { feasible: true },
          unit: 0,
          usage: { R: 0, SR: 0, SSR: 0 },
          perUnit: { R: 0, SR: 0, SSR: 0 },
          probabilities: { R: 0, SR: 0, SSR: 0 },
          shortage: { R: 0, SR: 0, SSR: 0 },
          mode: "capacity",
        };
      }

      const policies = [];
      const signatures = new Set();
      const query = (lambda) => {
        const costs = [0, 0, 0];
        for (const index of active) costs[index] = lambda[index] / available[MATERIALS[index]];
        let minimum = Infinity;
        for (let offset = 0; offset < active.length; offset += 1) {
          const order = [...active.slice(offset), ...active.slice(0, offset)];
          const policy = buildPricePolicy(target, active, costs, order);
          const record = makePolicyRecord(policy, start, available, active);
          minimum = Math.min(minimum, dotActive(lambda, record.ratios, active));
          const signature = policySignature(policy, target);
          if (!signatures.has(signature)) {
            signatures.add(signature);
            policies.push(record);
          }
        }
        return minimum;
      };

      for (const index of active) {
        const lambda = [0, 0, 0];
        lambda[index] = 1;
        query(lambda);
      }
      const uniform = [0, 0, 0];
      for (const index of active) uniform[index] = 1 / active.length;
      query(uniform);

      for (let iteration = 0; iteration < 30; iteration += 1) {
        const master = dualMaster(policies, active);
        const lower = query(master.lambda);
        if (master.value - lower <= 1e-8) break;
      }

      const master = dualMaster(policies, active);
      for (const index of active) {
        const perturbed = [...master.lambda];
        const epsilon = 1e-6;
        const donor = active.find((candidate) => candidate !== index && perturbed[candidate] > epsilon);
        if (donor) {
          perturbed[index] += epsilon;
          perturbed[donor] -= epsilon;
          query(perturbed);
        }
      }

      const mix = bestPolicyMix(policies, active);
      if (!mix || !(mix.value > EPS)) throw new Error("库存优化未能形成有效策略");
      const unit = 1 / mix.value;
      const perUnitValues = [0, 0, 0];
      mix.indices.forEach((policyIndex, position) => {
        for (let materialIndex = 0; materialIndex < 3; materialIndex += 1) {
          perUnitValues[materialIndex] += mix.weights[position] * policies[policyIndex].expected[materialIndex];
        }
      });
      const perUnit = Object.fromEntries(MATERIALS.map((material, index) => [material, perUnitValues[index]]));
      const usage = Object.fromEntries(MATERIALS.map((material, index) => [material, perUnitValues[index] * unit]));
      const shortage = Object.fromEntries(MATERIALS.map((material, index) =>
        [material, Math.max(0, perUnitValues[index] - available[material])]));
      return {
        raw: { feasible: true, dualValue: master.value, policies: policies.length },
        unit,
        usage,
        perUnit,
        probabilities: probabilitiesFromMix(mix, policies, start),
        shortage,
        mode: "capacity",
      };
    }

    function solveMinShortage(start, target, available) {
      const allowed = [0, 1, 2];
      const costs = [1, 1.01, 1.04];
      const policy = buildPricePolicy(target, allowed, costs, allowed);
      const index = stateIndex(start);
      const values = MATERIALS.map((_, materialIndex) => policy.usage[materialIndex][index]);
      const perUnit = Object.fromEntries(MATERIALS.map((material, materialIndex) => [material, values[materialIndex]]));
      const shortage = Object.fromEntries(MATERIALS.map((material, materialIndex) =>
        [material, Math.max(0, values[materialIndex] - available[material])]));
      const probabilities = { R: 0, SR: 0, SSR: 0 };
      probabilities[MATERIALS[policy.actions[index]]] = 1;
      return {
        raw: { feasible: true },
        unit: 0,
        usage: { ...perUnit },
        perUnit,
        probabilities,
        shortage,
        mode: "shortage",
      };
    }

    function solveScenario(start, target, available) {
      const capacity = solveMaxUnits(start, target, available);
      if (capacity.unit > EPS || capacity.unit === Infinity) return capacity;
      return solveMinShortage(start, target, available);
    }

    function getInputs() {
      const stock = {
        R: Math.floor(clamp(els.stockR.value, 0, 999999)),
        SR: Math.floor(clamp(els.stockSR.value, 0, 999999)),
        SSR: Math.floor(clamp(els.stockSSR.value, 0, 999999)),
      };
      const reserve = {
        R: Math.floor(clamp(els.reserveR.value, 0, stock.R)),
        SR: Math.floor(clamp(els.reserveSR.value, 0, stock.SR)),
        SSR: Math.floor(clamp(els.reserveSSR.value, 0, stock.SSR)),
      };
      let level = Math.floor(clamp(els.currentLevel.value, 0, 15));
      const exp = level >= 15 ? 0 : roundExp(els.currentExp.value);
      let target = Number(els.targetLevel.value);
      if (target <= level && level < 15) {
        target = level < 10 ? 10 : 15;
        els.targetLevel.value = String(target);
      }
      const usableItems = {};
      const available = {};
      const remainder = {};
      for (const material of MATERIALS) {
        usableItems[material] = Math.max(0, stock[material] - reserve[material]);
        available[material] = Math.floor(usableItems[material] / 10);
        remainder[material] = usableItems[material] % 10;
      }
      return { stock, reserve, usableItems, available, remainder, start: { level, exp }, target };
    }

    function syncNormalizedInputs(inputs) {
      els.stockR.value = inputs.stock.R;
      els.stockSR.value = inputs.stock.SR;
      els.stockSSR.value = inputs.stock.SSR;
      els.reserveR.value = inputs.reserve.R;
      els.reserveSR.value = inputs.reserve.SR;
      els.reserveSSR.value = inputs.reserve.SSR;
      els.currentLevel.value = inputs.start.level;
      els.currentExp.value = inputs.start.exp;
      els.groupsR.textContent = `${Math.floor(inputs.stock.R / 10)}组＋${inputs.stock.R % 10}个`;
      els.groupsSR.textContent = `${Math.floor(inputs.stock.SR / 10)}组＋${inputs.stock.SR % 10}个`;
      els.groupsSSR.textContent = `${Math.floor(inputs.stock.SSR / 10)}组＋${inputs.stock.SSR % 10}个`;
    }

    function formatNumber(value, digits = 2) {
      if (value === Infinity) return "已完成";
      if (!Number.isFinite(value)) return "—";
      return value.toLocaleString("zh-CN", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
    }

    function formatProbability(value) {
      return `${(value * 100).toFixed(value >= 0.1 ? 1 : 2)}%`;
    }

    function mainMaterials(probabilities) {
      const max = Math.max(...MATERIALS.map((m) => probabilities[m]));
      if (max <= EPS) return [];
      return MATERIALS.filter((m) => Math.abs(probabilities[m] - max) < 1e-5);
    }

    function renderCurrentResult(inputs, solution) {
      currentSolution = { inputs, solution };
      els.printCurrentState.textContent = `${inputs.start.level}级 / ${inputs.start.exp}经验`;
      els.printTargetLevel.textContent = `${inputs.target}级`;
      els.printStock.textContent = MATERIALS.map((material) => `${material} ${inputs.stock[material]}个`).join(" / ");
      els.printReserve.textContent = MATERIALS.map((material) => `${material} ${inputs.reserve[material]}个`).join(" / ");
      const capacity = solution.unit;
      if (capacity === Infinity) {
        els.capacityValue.textContent = "已达成";
        els.capacityUnit.textContent = "";
        els.capacityNote.textContent = `当前等级已达到所选目标（${inputs.target}级）。`;
        els.recommendMaterial.textContent = "无需强化";
        els.recommendDetail.textContent = "可以调整目标等级或当前状态";
      } else {
        els.capacityValue.textContent = formatNumber(capacity, 2);
        els.capacityUnit.textContent = "次";
        const whole = Math.floor(capacity + 1e-7);
        els.capacityNote.textContent = capacity >= 1
          ? `当前可用库存预计可支持${whole}次达到目标；实际结果需逐次重算。`
          : "当前可用库存预计不足以完成1次目标，下方显示预计最小缺口。";
        const mains = mainMaterials(solution.probabilities);
        els.recommendMaterial.textContent = mains.length ? mains.join(" / ") : "可用库存不足";
        const probabilityText = MATERIALS
          .filter((m) => solution.probabilities[m] > 0.001)
          .map((m) => `${m} ${formatProbability(solution.probabilities[m])}`)
          .join(" · ");
        els.recommendDetail.textContent = probabilityText || "请补充至少1组可用保养工具";
        if (mains[0]) els.actualMaterial.value = mains[0];
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
        usageEl.textContent = `${formatNumber(consumption, 2)}组`;
        const expectedItems = consumption * 10;
        const remaining = inputs.stock[material] - expectedItems;
        metaEl.textContent = remaining >= -0.005
          ? `预计消耗${formatNumber(expectedItems, 1)}个｜完成后预计剩余${formatNumber(Math.max(0, remaining), 1)}个`
          : `预计消耗${formatNumber(expectedItems, 1)}个｜仍预计缺少${formatNumber(-remaining, 1)}个`;
        const percentage = inputs.available[material] > 0
          ? Math.min(100, consumption / inputs.available[material] * 100)
          : consumption > 0 ? 100 : 0;
        meterEl.style.width = `${percentage}%`;
      }

      els.bottleneckValue.textContent = bottleneck === "—"
        ? "当前无需保养工具"
        : `${bottleneck}｜预计可完成${formatNumber(bottleneckCoverage, 2)}次`;
      els.wholeCompletions.textContent = capacity === Infinity
        ? "可完整完成：已达成"
        : `可完整完成：${Math.max(0, Math.floor(capacity + 1e-7))}次`;

      const shortages = MATERIALS
        .filter((m) => solution.shortage[m] > 1e-6)
        .map((m) => `${m}约缺${formatNumber(solution.shortage[m] * 10, 1)}个`);
      if (shortages.length) {
        els.shortageAlert.classList.add("active");
        els.shortageAlert.innerHTML = `<b>按当前策略完成1次仍预计缺少：</b>${shortages.join("；")}。这是概率平均值，建议额外预留随机波动空间。`;
      } else {
        els.shortageAlert.classList.remove("active");
        els.shortageAlert.textContent = "";
      }
    }

    function markFromProbabilities(probabilities, material) {
      const max = Math.max(...MATERIALS.map((m) => probabilities[m]));
      const value = probabilities[material];
      if (max <= EPS || value <= 0.002) return "cross";
      if (Math.abs(value - max) < 1e-5) return "circle";
      return "triangle";
    }

    function markHtml(mark, probability = 0) {
      const label = mark === "circle" ? "主用" : mark === "triangle" ? "混合/次选" : "不建议";
      const title = probability > 0.002 ? `${label}，策略占比${formatProbability(probability)}` : label;
      const shape = mark === "circle"
        ? '<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="3"/>'
        : mark === "triangle"
          ? '<path d="M12 2.5L22 21H2Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>'
          : '<path d="M4 4L20 20M20 4L4 20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>';
      return `<span class="mark ${mark}" role="img" aria-label="${title}" title="${title}"><svg class="print-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${shape}</svg></span>`;
    }

    function renderPolicyTable(policyMap, stage, target) {
      const { start: startLevel, end: endLevel, goal } = stage;
      const rows = [];
      for (let level = startLevel; level <= endLevel && level < target; level += 1) {
        [0, 1000, 2000].forEach((exp, index) => {
          const key = `${level}_${exp}`;
          const probabilities = policyMap.get(key) || { R: 0, SR: 0, SSR: 0 };
          const marks = MATERIALS.map((material) => {
            const mark = markFromProbabilities(probabilities, material);
            return `<td class="mark-cell">${markHtml(mark, probabilities[material])}</td>`;
          }).join("");
          rows.push(`<tr>
            ${index === 0 ? `<th class="level-cell" scope="rowgroup" rowspan="3">${level}</th>` : ""}
            <td class="exp-cell">${exp}</td>${marks}
          </tr>`);
        });
      }
      if (!rows.length) {
        return '<div class="table-empty">所选目标等级没有可展示的阶段</div>';
      }
      return `<table class="policy-table" aria-label="${startLevel}至${endLevel}级强化工具建议">
        <caption><span>${startLevel}–${endLevel}级</span><small>强化至${goal}级</small></caption>
        <thead><tr><th scope="col">等级</th><th scope="col">经验</th><th class="r-head" scope="col">R</th><th class="sr-head" scope="col">SR</th><th class="ssr-head" scope="col">SSR</th></tr></thead>
        <tbody>${rows.join("")}</tbody>
      </table>`;
    }

    async function buildPolicyMap(inputs, token) {
      const policyMap = new Map();
      const anchors = [];
      for (let level = 0; level < inputs.target; level += 1) {
        for (const exp of [0, 1000, 2000]) anchors.push({ level, exp });
      }
      for (let index = 0; index < anchors.length; index += 1) {
        if (token !== calculationToken) return null;
        const start = anchors[index];
        let solution = solveMaxUnits(start, inputs.target, inputs.available);
        if (!(solution.unit > EPS) && solution.unit !== Infinity) {
          solution = solveMinShortage(start, inputs.target, inputs.available);
        }
        policyMap.set(stateKey(start), solution.probabilities);
        if (index % 4 === 0) {
          els.progressText.textContent = `正在生成分阶段工具建议：${index + 1}/${anchors.length}`;
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      return policyMap;
    }

    async function calculate() {
      const token = ++calculationToken;
      const inputs = getInputs();
      syncNormalizedInputs(inputs);
      setBusy(true, "正在计算当前强化规划……");
      await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

      try {
        let solution = solveMaxUnits(inputs.start, inputs.target, inputs.available);
        if (!(solution.unit > EPS) && solution.unit !== Infinity) {
          solution = solveMinShortage(inputs.start, inputs.target, inputs.available);
        }
        if (token !== calculationToken) return;
        renderCurrentResult(inputs, solution);

        const policyMap = await buildPolicyMap(inputs, token);
        if (!policyMap || token !== calculationToken) return;
        const visibleStages = POLICY_STAGES.filter((stage) => stage.start < inputs.target);
        els.policyTables.dataset.stageCount = String(visibleStages.length);
        els.policyTables.innerHTML = visibleStages
          .map((stage) => `<div class="table-wrap">${renderPolicyTable(policyMap, stage, inputs.target)}</div>`)
          .join("");
        els.progressText.textContent = "分阶段工具建议已生成";
        saveState(inputs);
        document.documentElement.dataset.status = "ready";
      } catch (error) {
        console.error(error);
        showToast(`计算失败：${error.message || error}`);
        document.documentElement.dataset.status = "error";
      } finally {
        if (token === calculationToken) setBusy(false);
      }
    }

    function setBusy(busy, text = "") {
      els.calculate.disabled = busy;
      els.calculate.setAttribute("aria-busy", String(busy));
      els.progressLine.classList.toggle("active", busy);
      if (text) els.progressText.textContent = text;
    }

    function saveState(inputs) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          stock: inputs.stock,
          reserve: inputs.reserve,
          start: inputs.start,
          target: inputs.target,
          history: history.slice(-20),
        }));
      } catch { /* File-mode storage can be unavailable in hardened browsers. */ }
    }

    function loadState() {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        if (!saved) return;
        els.stockR.value = saved.stock?.R ?? 6000;
        els.stockSR.value = saved.stock?.SR ?? 2000;
        els.stockSSR.value = saved.stock?.SSR ?? 1000;
        els.reserveR.value = saved.reserve?.R ?? 0;
        els.reserveSR.value = saved.reserve?.SR ?? 0;
        els.reserveSSR.value = saved.reserve?.SSR ?? 0;
        els.currentLevel.value = saved.start?.level ?? 0;
        els.currentExp.value = saved.start?.exp ?? 0;
        els.targetLevel.value = String(saved.target ?? 15);
        history = Array.isArray(saved.history) ? saved.history : [];
      } catch { /* Ignore damaged local state and keep safe defaults. */ }
    }

    function captureInputState() {
      const inputs = getInputs();
      return {
        stock: { ...inputs.stock },
        reserve: { ...inputs.reserve },
        start: { ...inputs.start },
        target: inputs.target,
      };
    }

    function restoreInputState(snapshot) {
      els.stockR.value = snapshot.stock.R;
      els.stockSR.value = snapshot.stock.SR;
      els.stockSSR.value = snapshot.stock.SSR;
      els.reserveR.value = snapshot.reserve.R;
      els.reserveSR.value = snapshot.reserve.SR;
      els.reserveSSR.value = snapshot.reserve.SSR;
      els.currentLevel.value = snapshot.start.level;
      els.currentExp.value = snapshot.start.exp;
      els.targetLevel.value = String(snapshot.target);
    }

    async function applyOutcome(outcome) {
      const before = captureInputState();
      const material = els.actualMaterial.value;
      const stockInput = material === "R" ? els.stockR : material === "SR" ? els.stockSR : els.stockSSR;
      const reserveInput = material === "R" ? els.reserveR : material === "SR" ? els.reserveSR : els.reserveSSR;
      const stock = Math.floor(clamp(stockInput.value, 0, 999999));
      const reserve = Math.floor(clamp(reserveInput.value, 0, stock));
      if (stock - reserve < 10) {
        showToast(`${material}可用数量不足10个（已扣除保留库存），无法记录本次强化`);
        return;
      }
      const inputs = getInputs();
      if (inputs.start.level >= inputs.target) {
        showToast("当前等级已达到所选目标，请调整目标等级或当前状态");
        return;
      }
      stockInput.value = stock - 10;
      const next = outcome === "success"
        ? successTransition(inputs.start, inputs.target)
        : normalTransition(inputs.start, material, inputs.target);
      const afterState = next || { level: inputs.target, exp: 0 };
      els.currentLevel.value = afterState.level;
      els.currentExp.value = afterState.exp;
      history.push({
        before,
        material,
        outcome,
        from: { ...inputs.start },
        to: { ...afterState },
      });
      renderHistory();
      await calculate();
    }

    function renderHistory() {
      els.undo.disabled = history.length === 0;
      if (!history.length) {
        els.historyList.innerHTML = '<div class="history-empty">尚无强化记录</div>';
        return;
      }
      els.historyList.innerHTML = history.slice(-5).reverse().map((item) => {
        const resultText = item.outcome === "success" ? "大成功" : "普通结果";
        return `<div class="history-item">
          <span>${item.material} · ${resultText}</span>
          <span>${item.from.level}级/${item.from.exp}经验 → ${item.to.level}级/${item.to.exp}经验</span>
        </div>`;
      }).join("");
    }

    function showToast(message) {
      els.toast.textContent = message;
      els.toast.classList.add("active");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => els.toast.classList.remove("active"), 2600);
    }

    function setExample() {
      els.stockR.value = 6000;
      els.stockSR.value = 2000;
      els.stockSSR.value = 1000;
      els.currentLevel.value = 0;
      els.currentExp.value = 0;
      els.targetLevel.value = "15";
      els.reserveR.value = 0;
      els.reserveSR.value = 0;
      els.reserveSSR.value = 0;
      history = [];
      renderHistory();
      calculate();
    }

    function bindElements() {
      Object.assign(els, {
        stockR: byId("stock-r"), stockSR: byId("stock-sr"), stockSSR: byId("stock-ssr"),
        reserveR: byId("reserve-r"), reserveSR: byId("reserve-sr"), reserveSSR: byId("reserve-ssr"),
        currentLevel: byId("current-level"), currentExp: byId("current-exp"), targetLevel: byId("target-level"),
        groupsR: byId("groups-r"), groupsSR: byId("groups-sr"), groupsSSR: byId("groups-ssr"),
        calculate: byId("calculate"), progressLine: byId("progress-line"), progressText: byId("progress-text"),
        capacityValue: byId("capacity-value"), capacityUnit: byId("capacity-unit"), capacityNote: byId("capacity-note"),
        recommendMaterial: byId("recommend-material"), recommendDetail: byId("recommend-detail"),
        actualMaterial: byId("actual-material"), policyTables: byId("policy-tables"),
        printCurrentState: byId("print-current-state"), printTargetLevel: byId("print-target-level"),
        printStock: byId("print-stock"), printReserve: byId("print-reserve"),
        bottleneckValue: byId("bottleneck-value"), wholeCompletions: byId("whole-completions"),
        shortageAlert: byId("shortage-alert"), historyList: byId("history-list"),
        undo: byId("undo"), toast: byId("toast"),
        themeButtons: Array.from(document.querySelectorAll(".theme-option[data-theme-mode]")),
      });
    }

    function attachEvents() {
      els.themeButtons.forEach((button) => {
        button.addEventListener("click", () => applyThemeMode(button.dataset.themeMode, { persist: true }));
      });
      if (typeof themeMediaQuery.addEventListener === "function") {
        themeMediaQuery.addEventListener("change", handleSystemThemeChange);
      } else if (typeof themeMediaQuery.addListener === "function") {
        themeMediaQuery.addListener(handleSystemThemeChange);
      }
      els.calculate.addEventListener("click", calculate);
      byId("load-example").addEventListener("click", setExample);
      byId("clear-stock").addEventListener("click", () => {
        els.stockR.value = 0;
        els.stockSR.value = 0;
        els.stockSSR.value = 0;
        calculate();
      });
      byId("record-normal").addEventListener("click", () => applyOutcome("normal"));
      byId("record-success").addEventListener("click", () => applyOutcome("success"));
      els.undo.addEventListener("click", async () => {
        const item = history.pop();
        if (!item) return;
        restoreInputState(item.before);
        renderHistory();
        await calculate();
      });
      byId("print-page").addEventListener("click", () => window.print());
      [els.stockR, els.stockSR, els.stockSSR].forEach((input) => {
        input.addEventListener("input", () => {
          const inputs = getInputs();
          syncNormalizedInputs(inputs);
        });
      });
    }

    bindElements();
    applyThemeMode(document.documentElement.dataset.themeMode || "auto");
    loadState();
    renderHistory();
    attachEvents();
    syncNormalizedInputs(getInputs());
    window.__SR_CALCULATOR__ = {
      solveMaxUnits,
      solveMinShortage,
      solveScenario,
      normalTransition,
      successTransition,
      constants: { MATERIALS, GAINS, SUCCESS },
      getInputs,
      calculate,
    };
    calculate();
  })();
