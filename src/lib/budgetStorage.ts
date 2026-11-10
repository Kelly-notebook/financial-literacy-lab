import { budgetModeOptions } from "./budgetModes";
import { parseNumericInput } from "./numberInput";
import { MAX_MONEY } from "./finance";
import { livingFields } from "./health";
import type { Values } from "../components/ui";
export const BUDGET_STORAGE_KEY = "financial-literacy-lab:household:v1";
const groups = new Set([
  ...livingFields.map((x) => x.id),
  "loans",
  "purchaseCost",
  "purchase",
  "travel",
  "saving",
  "etf",
]);
const choices: Record<string, string[]> = {
  mode: ["monthly", "annual"],
  budgetMode: budgetModeOptions.map(([id]) => id),
  livingMode: ["total", "detail"],
  cashTreatment: ["exclude", "spend", "reinvest"],
  view: ["monthly", "annual"],
  purchaseMode: ["deadline", "monthly"],
  emergencyConfirmed: ["no", "yes"],
  retirementConfirmed: ["no", "yes"],
  change: ["no", "yes"],
};
export function draftAmount(text: string, lastValid: number) {
  const n = parseNumericInput(text);
  return Number.isFinite(n) && n >= 0 && n <= MAX_MONEY ? n : lastValid;
}
/** Only persist recognised fields and valid values. An unfinished edit keeps its last valid saved value. */
export function sanitiseBudgetValues(
  candidate: unknown,
  defaults: Values,
  previous: Values = defaults,
): Values {
  const source =
    candidate && typeof candidate === "object" && !Array.isArray(candidate)
      ? (candidate as Record<string, unknown>)
      : {};
  const result: Values = { ...defaults };
  const keys = new Set([
    ...Object.keys(defaults),
    ...[...groups].map((id) => `group_${id}`),
  ]);
  for (const key of keys) {
    const raw = source[key],
      fallback = previous[key] ?? defaults[key];
    if (fallback !== undefined) result[key] = fallback;
    if (typeof raw !== "string" || raw.length > 100) continue;
    if (key.startsWith("group_")) {
      if (["needs", "wants", "savings"].includes(raw)) result[key] = raw;
      continue;
    }
    if (choices[key]) {
      if (choices[key].includes(raw)) result[key] = raw;
      continue;
    }
    if (key === "startMonth") {
      if (/^(19\d{2}|20\d{2}|21\d{2}|2200)-(0[1-9]|1[0-2])$/.test(raw))
        result[key] = raw;
      continue;
    }
    if (key === "purchaseName") {
      if (raw.length <= 50) result[key] = raw;
      continue;
    }
    const n = parseNumericInput(raw);
    let min = 0,
      max = MAX_MONEY,
      integer = false;
    if (key.startsWith("limit_")) max = 100;
    if (key === "forecastYears") {
      min = 1;
      max = 50;
      integer = true;
    }
    if (key.endsWith("Months") || key === "changeMonth") {
      min = [
        "mortgageMonths",
        "carLoanMonths",
        "creditMonths",
        "otherMonths",
      ].includes(key)
        ? 0
        : 1;
      max = 600;
      integer = true;
    }
    if (
      Number.isFinite(n) &&
      n >= min &&
      n <= max &&
      (!integer || Number.isInteger(n))
    )
      result[key] = String(n);
  }
  return result;
}
export function restoreBudget(
  storage: Pick<Storage, "getItem">,
  defaults: Values,
) {
  try {
    const raw = storage.getItem(BUDGET_STORAGE_KEY);
    if (!raw) return { values: defaults, restored: false, error: false };
    if (raw.length > 50000) throw new Error("Too large");
    const data = JSON.parse(raw);
    if (
      data?.version !== 1 ||
      !data.values ||
      typeof data.values !== "object" ||
      Array.isArray(data.values)
    )
      throw new Error("Invalid snapshot");
    const values = sanitiseBudgetValues(data.values, defaults);
    const migrated =
      !("necessaryTotal" in data.values) && "necessaryTotal" in defaults;
    if (migrated) {
      let needs = 0,
        wants = 0;
      const oldBase = Number(values.living) || 0;
      if (values.group_otherLiving === "wants") wants += oldBase;
      else needs += oldBase;
      for (const key of [
        "medical",
        "telecom",
        "clothing",
        "dining",
        "parentSupport",
        "subscriptions",
      ]) {
        const value = Number(values[key]) || 0;
        const d = livingFields.find((x) => x.id === key)!;
        const group = values[`group_${key}`] ?? d.group;
        if (group === "wants") wants += value;
        else needs += value;
      }
      values.necessaryTotal = String(needs);
      values.discretionaryTotal = String(wants);
    }
    return { values, restored: true, error: false, migrated };
  } catch {
    return { values: defaults, restored: false, error: true };
  }
}
