import { employmentAnnual } from "./budget";
import { parseNumericInput } from "./numberInput";
import { MAX_MONEY } from "./finance";
export const budgetModes = {
  classic: { name: "經典 50／30／20", needs: 50, wants: 30, savings: 20 },
  basic: { name: "基礎型 55／25／20", needs: 55, wants: 25, savings: 20 },
  balanced: { name: "平衡型 45／30／25", needs: 45, wants: 30, savings: 25 },
  quality: { name: "品質型 35／35／30", needs: 35, wants: 35, savings: 30 },
} as const;
export type BudgetMode = keyof typeof budgetModes;
export type BudgetSelection = "auto" | BudgetMode;
export const budgetModeOptions: [string, string][] = [
  ["auto", "依收入自動推薦（預設）"],
  ...Object.entries(budgetModes).map(([id, m]): [string, string] => [
    id,
    m.name,
  ]),
];
export function recommendBudgetMode(annual: number): BudgetMode {
  if (!Number.isFinite(annual) || annual <= 0) return "classic";
  return annual < 1200000 ? "basic" : annual < 2400000 ? "balanced" : "quality";
}
/** Same effective household income as the budget, never salary plus annual salary. Validate raw drafts so retained results cannot drive a new recommendation. */
export function selectedBudgetMode(
  values: Record<string, string>,
  monthly?: number,
) {
  const selection: BudgetSelection = budgetModeOptions.some(
    ([id]) => id === values.budgetMode,
  )
    ? (values.budgetMode as BudgetSelection)
    : "auto";
  const keys = [
    ...(values.mode === "annual"
      ? ["annualIncome"]
      : ["salary", "annualBonus"]),
    "otherIncome",
    ...(values.cashTreatment === "spend" ? ["investmentCash"] : []),
  ];
  if (values.change === "yes" && parseNumericInput(values.changeMonth) === 1)
    keys.push("changeIncome");
  const draftsValid =
    monthly !== undefined &&
    Number.isFinite(monthly) &&
    monthly > 0 &&
    keys.every((key) => {
      const n = parseNumericInput(values[key]);
      return Number.isFinite(n) && n >= 0 && n <= MAX_MONEY;
    });
  // Check that the retained calculation belongs to these income drafts.
  // A different invalid budget field may have retained an older entire result.
  const annualEmployment = draftsValid
    ? employmentAnnual({
        mode: values.mode === "annual" ? "annual" : "monthly",
        salary: parseNumericInput(values.salary),
        annualBonus: parseNumericInput(values.annualBonus),
        annualIncome: parseNumericInput(values.annualIncome),
      })
    : undefined;
  const expectedMonthly = draftsValid
    ? (values.change === "yes" && parseNumericInput(values.changeMonth) === 1
        ? parseNumericInput(values.changeIncome)
        : annualEmployment! / 12) +
      parseNumericInput(values.otherIncome) +
      (values.cashTreatment === "spend"
        ? parseNumericInput(values.investmentCash) / 12
        : 0)
    : undefined;
  const valid =
    draftsValid &&
    expectedMonthly !== undefined &&
    Math.abs(monthly! - expectedMonthly) <=
      Math.max(1e-7, expectedMonthly * 1e-12);
  const annualIncome = valid ? monthly! * 12 : undefined;
  const mode =
    selection === "auto" ? recommendBudgetMode(annualIncome ?? NaN) : selection;
  return {
    selection,
    mode,
    preset: budgetModes[mode],
    annualIncome,
    monthlyIncome: valid ? monthly : undefined,
    note: !valid
      ? selection === "auto"
        ? "收入資料不足、無效或非正數，自動模式暫用經典 50／30／20；請完成有效收入。暫留試算不作新推薦依據。"
        : "收入資料不足、無效或非正數，保留手動模式；暫不列參考金額，請先完成收入。"
      : selection === "auto"
        ? "依家庭全年稅後可支配收入自動推薦，可自由改選手動模式。"
        : "已手動選擇；修改收入只更新參考金額，不覆寫模式。",
  };
}
