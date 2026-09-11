import { TEXT } from "../runtime/config";
export function message(key: keyof typeof TEXT, values: Record<string, string | number> = {}) {
  return TEXT[key].replace(/\{([A-Za-z0-9]+)\}/g, (token, name: string) => Object.hasOwn(values, name) ? String(values[name]) : token);
}
export function formatNumber(value: number, digits = 2) {
  if (value === Infinity) return TEXT.completed;
  return Number.isFinite(value) ? value.toLocaleString(TEXT.numberLocale, { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "—";
}
export const formatProbability = (value: number) => `${(value * 100).toFixed(value >= 0.1 ? 1 : 2)}%`;
