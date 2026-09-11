import type { PolicyMix, PolicyRecord } from "./types";

function solveLinear3(matrix: number[][], vector: number[]): number[] | null {
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

export function dotActive(left: number[], right: number[], active: number[]) {
  return active.reduce((sum, index) => sum + left[index] * right[index], 0);
}

export function dualMaster(policies: PolicyRecord[], active: number[]) {
  if (active.length === 1) {
    const lambda = [0, 0, 0];
    lambda[active[0]] = 1;
    return { lambda, value: Math.min(...policies.map((policy) => policy.ratios[active[0]])) };
  }

  const candidates: number[][] = [];
  const seen = new Set<string>();
  const add = (lambda: number[]) => {
    if (lambda.some((value) => !Number.isFinite(value) || value < -1e-8)) return;
    const sum = lambda.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1) > 1e-7) return;
    // Price vectors must be on the simplex before they can certify a dual bound.
    const positive = lambda.map((value) => Math.max(0, value));
    const total = positive.reduce((a, b) => a + b, 0);
    const cleaned = positive.map((value) => value / total);
    const key = cleaned.join("|");
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
export function bestPolicyMix(policies: PolicyRecord[], active: number[]): PolicyMix | null {
  let best: PolicyMix | null = null;
  const consider = (indices: number[], weights: number[]) => {
    if (weights.some((weight) => weight < -1e-8)) return;
    const sum = weights.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1) > 1e-6) return;
    weights = weights.map((weight) => Math.max(0, weight));
    const total = weights.reduce((a, b) => a + b, 0);
    weights = weights.map((weight) => weight / total);
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
