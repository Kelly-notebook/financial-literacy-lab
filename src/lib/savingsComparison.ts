import {
  bounded,
  investment,
  MAX_MONEY,
  type InvestmentInput,
} from "./finance";
import { parseNumericInput } from "./numberInput";
import { validNumber, type NumericRule } from "./numericDraft";
export interface MonthlyTransfer {
  monthly: number;
}
export interface RetirementTransfer {
  assets: number;
  years: number;
  scenario: string;
}
type DraftField = [key: string, label: string, rule?: NumericRule];
export function draftIssue(
  values: Record<string, string>,
  fields: DraftField[],
) {
  for (const [key, label, rule = { min: 0, max: MAX_MONEY }] of fields)
    if (!validNumber(parseNumericInput(values[key]), rule))
      return `請先完成或修正「${label}」，不可帶入暫存的舊結果。`;
  return undefined;
}
export function compoundDraftIssue(values: Record<string, string>) {
  const fields: DraftField[] = [
    ["monthly", "每月投入金額"],
    ["annual", "假設年化總報酬率", { min: 0, max: 10 }],
    ["bank", "假設銀行年利率", { min: 0, max: 10 }],
    ["years", "投資年數", { min: 1, max: 40, integer: true }],
  ];
  if (values.assetMode === "shares") {
    for (let i = 1; i <= Number(values.holdingCount); i++)
      fields.push(
        [
          `shares${i}`,
          `第${i}檔持有股數`,
          { min: 0, max: MAX_MONEY, integer: true },
        ],
        [`price${i}`, `第${i}檔每股參考價格`],
      );
  } else fields.push(["initial", "現有資產起始市值"]);
  if (values.change === "yes")
    fields.push(
      ["changeYear", "從第幾年開始調整", { min: 2, max: 30, integer: true }],
      ["nextMonthly", "調整後每月投入"],
    );
  return draftIssue(values, fields);
}
export function retirementTransferIssue(assets: number | undefined) {
  return assets !== undefined &&
    Number.isFinite(assets) &&
    assets >= 0 &&
    assets <= MAX_MONEY
    ? undefined
    : "期末資產無效或超過退休起始市值上限 NT$ 1,000,000,000,000，無法帶入。";
}
/** Reuse the existing monthly compounding, including any mid-course change. */
export function savingsComparison(input: InvestmentInput, extra: number) {
  bounded(extra, "每月額外投入");
  const enhancedInput = {
    ...input,
    monthly: bounded(input.monthly + extra, "增加後每月投入"),
    ...(input.changeMonth !== undefined
      ? {
          nextMonthly: bounded(
            (input.nextMonthly ?? input.monthly) + extra,
            "增加後中途投入",
          ),
        }
      : {}),
  };
  const base = investment(input).at(-1)!,
    enhanced = investment(enhancedInput).at(-1)!;
  const additionalAssets = enhanced.value - base.value;
  return {
    base,
    enhanced,
    baseMonthly: input.monthly,
    enhancedMonthly: enhancedInput.monthly,
    additionalAssets,
    additionalMonthlyWithdrawal: (additionalAssets * 0.04) / 12,
  };
}
