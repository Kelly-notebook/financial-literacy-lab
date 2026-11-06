import { livingFields, type LivingCost, type LivingGroup } from "./living";
import { bounded } from "./finance";
export interface Loan {
  payment: number;
  months: number;
}
export interface Income {
  mode: "monthly" | "annual";
  salary: number;
  annualBonus: number;
  annualIncome: number;
}
export function employmentAnnual(input: Income) {
  return input.mode === "annual"
    ? bounded(input.annualIncome, "全年總收入")
    : bounded(input.salary, "固定月薪") * 12 +
        bounded(input.annualBonus, "年度獎金");
}
export function switchIncome(input: Income, mode: Income["mode"]): Income {
  const annual = employmentAnnual(input);
  if (mode === "annual") return { ...input, mode, annualIncome: annual };
  const bonus = Math.min(
    Math.max(0, Number.isFinite(input.annualBonus) ? input.annualBonus : 0),
    annual,
  );
  return { ...input, mode, annualBonus: bonus, salary: (annual - bonus) / 12 };
}
export const separateExpenseKeys = [
  "telecom",
  "subscriptions",
  "clothing",
  "dining",
  "parentSupport",
  "medical",
] as const;
export interface BudgetInput extends Income {
  livingMode?: "total" | "detail";
  necessaryTotal?: number;
  discretionaryTotal?: number;
  livingDetails?: Record<string, number>;
  livingCategories?: Record<string, LivingGroup>;

  clothing?: number;
  dining?: number;
  parentSupport?: number;
  medical?: number;
  purchaseMode?: "deadline" | "monthly";
  otherIncome: number;
  investmentCash: number;
  cashTreatment: "exclude" | "spend" | "reinvest";
  living: number;
  loans: Loan[];
  purchasePrice: number;
  purchaseFund: number;
  purchaseMonths: number;
  purchaseMonthly: number;
  purchaseCost: number;
  travelPrice: number;
  travelFund: number;
  travelMonths: number;
  etfMonthly: number;
  telecom: number;
  subscriptions: number;
  saving: number;
  startMonth: string;
  change?: {
    month: number;
    employmentMonthly: number;
    living: number;
    necessaryLiving?: number;
    discretionaryLiving?: number;
  };
}
function monthInteger(v: number, label: string, min = 1, max = 600) {
  bounded(v, label, min, max);
  if (!Number.isInteger(v)) throw new Error(`${label}需為整數`);
}
export function periodFor(startMonth: string, month: number) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(startMonth))
    throw new Error("請輸入有效的起始年月");
  const [y, m] = startMonth.split("-").map(Number);
  bounded(y, "起始年份", 1900, 2200);
  monthInteger(month, "預測月份");
  const date = new Date(Date.UTC(y, m + month - 2, 1));
  return {
    period: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
    days: new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
    ).getUTCDate(),
  };
}
export function currentTaipeiMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  return `${parts.find((x) => x.type === "year")!.value}-${parts.find((x) => x.type === "month")!.value}`;
}
export function purchaseGoal(
  price: number,
  fund: number,
  months: number,
  fixedMonthly: number,
  mode: "deadline" | "monthly" = "deadline",
) {
  bounded(price, "購買總金額");
  bounded(fund, "已準備基金");
  if (mode === "deadline") monthInteger(months, "購買期限");
  else bounded(fixedMonthly, "每月購物儲蓄");
  const gap = Math.max(0, price - fund);
  const required =
    gap === 0
      ? 0
      : mode === "deadline"
        ? Math.ceil(gap / months)
        : fixedMonthly;
  const estimated =
    gap === 0 ? 0 : required > 0 ? Math.ceil(gap / required) : null;
  const monthsToGoal =
    estimated !== null && Number.isSafeInteger(estimated) ? estimated : null;
  return { gap, required, monthsToGoal };
}
export function purchaseDuration(months: number | null) {
  return months === null
    ? "無法估算達標時間"
    : months === 0
      ? "目前資金已達標"
      : `預計 ${Math.floor(months / 12)} 年 ${months % 12} 個月後達標`;
}
export function resolveLiving(
  input: BudgetInput,
  changed = false,
): LivingCost[] {
  const quick = (needs: number, wants: number): LivingCost[] => [
    {
      id: "quickNeeds",
      name: "必要生活費總額",
      group: "needs",
      value: bounded(needs, "必要生活費總額"),
      color: "#71917a",
      flow: "living",
    },
    {
      id: "quickWants",
      name: "非必要消費總額",
      group: "wants",
      value: bounded(wants, "非必要消費總額"),
      color: "#bf956e",
      flow: "living",
    },
  ];
  if (input.livingMode) {
    if (changed && input.change)
      return quick(
        input.change.necessaryLiving ?? input.change.living,
        input.change.discretionaryLiving ?? 0,
      );
    if (input.livingMode === "total")
      return quick(input.necessaryTotal!, input.discretionaryTotal!);
    return livingFields.map((field) => ({
      ...field,
      group: input.livingCategories?.[field.id] ?? field.group,
      value: bounded(input.livingDetails?.[field.id] ?? 0, field.name),
      flow: "living",
    }));
  }
  return [];
}
export function budget(input: BudgetInput, month = 1) {
  const annualEmployment = employmentAnnual(input);
  for (const [label, v] of Object.entries(input))
    if (
      typeof v === "number" &&
      ![
        "salary",
        "annualBonus",
        "annualIncome",
        "purchaseMonths",
        "purchaseMonthly",
      ].includes(label)
    ) {
      if (
        input.livingMode &&
        ![
          "otherIncome",
          "investmentCash",
          "purchasePrice",
          "purchaseFund",
          "purchaseCost",
          "travelPrice",
          "travelFund",
          "travelMonths",
          "etfMonthly",
          "saving",
        ].includes(label)
      )
        continue;
      bounded(v, label);
    }

  monthInteger(input.travelMonths, "旅行間隔");
  input.loans.forEach((l) => {
    bounded(l.payment, "貸款月付");
    monthInteger(l.months, "貸款剩餘期數", 0);
  });
  if (input.change) {
    monthInteger(input.change.month, "情境變動月份");
    bounded(input.change.employmentMonthly, "變動後薪資月平均");
    bounded(input.change.living, "變動後生活費");
  }
  const { period, days } = periodFor(input.startMonth, month);
  const changed = input.change && month >= input.change.month;
  const employmentMonthly = changed
    ? input.change!.employmentMonthly
    : annualEmployment / 12;
  const baseLiving = changed ? input.change!.living : input.living;
  const livingEntries = resolveLiving(input, !!changed);
  const living = input.livingMode
    ? livingEntries.reduce((sum, e) => sum + e.value, 0)
    : baseLiving +
      separateExpenseKeys.reduce((sum, key) => sum + (input[key] ?? 0), 0);
  const cashMonthly =
    input.cashTreatment === "spend" ? input.investmentCash / 12 : 0;
  const income = employmentMonthly + input.otherIncome + cashMonthly;
  const loan = input.loans.reduce(
    (sum, l) => sum + (month <= l.months ? l.payment : 0),
    0,
  );
  const goal = purchaseGoal(
    input.purchasePrice,
    input.purchaseFund,
    input.purchaseMonths,
    input.purchaseMonthly,
    input.purchaseMode,
  );
  // Stop when the fund is ready; the final payment cannot exceed the remaining gap.
  const purchase = Math.max(
    0,
    Math.min(goal.required, goal.gap - goal.required * (month - 1)),
  );
  const purchaseAt =
    input.purchaseMode === "monthly" ? goal.monthsToGoal : input.purchaseMonths;
  const purchaseCost =
    purchaseAt !== null && month > purchaseAt ? input.purchaseCost : 0;
  // The initial travel fund is spent on the first cycle only; later trips need full funding.
  const travel =
    month <= input.travelMonths
      ? Math.max(0, input.travelPrice - input.travelFund) / input.travelMonths
      : input.travelPrice / input.travelMonths;
  const available = income - living - loan - purchaseCost;
  const beforeEtf = available - purchase - travel - input.saving;
  const etfTarget = input.etfMonthly;
  const etfAffordable = Math.max(0, beforeEtf);
  // A user-entered plan is deducted exactly once, even when unaffordable. Never hide its deficit.
  const etf = etfTarget;
  const remaining = beforeEtf - etf;
  return {
    month,
    period,
    days,
    income,
    annualEmployment,
    employmentMonthly,
    cashMonthly,
    living,
    baseLiving,
    livingEntries,
    loan,
    purchase,
    purchaseCost,
    purchaseAffordable: Math.max(
      0,
      income - living - loan - purchaseCost - travel - input.saving - etf,
    ),
    travel,
    available,
    beforeEtf,
    etfTarget,
    etfAffordable,
    etf,
    etfGap: Math.max(0, etfTarget - etfAffordable),
    etfDaily: etfTarget / days,
    etfRatio: income > 0 ? (etfTarget / income) * 100 : null,
    goals: purchase + travel + input.saving + etf,
    remaining,
    daily: remaining / days,
    deficit: Math.max(0, -remaining),
    goal,
  };
}
export type BudgetRow = ReturnType<typeof budget>;
export function forecast(input: BudgetInput, months: number): BudgetRow[] {
  monthInteger(months, "預測月數");
  return Array.from({ length: months }, (_, i) => budget(input, i + 1));
}
export function annualForecast(rows: BudgetRow[]) {
  const groups = new Map<string, BudgetRow[]>();
  rows.forEach((row) => {
    const year = row.period.slice(0, 4);
    groups.set(year, [...(groups.get(year) ?? []), row]);
  });
  return [...groups].map(([year, months]) => {
    const annualRemaining = months.reduce((sum, r) => sum + r.remaining, 0);
    const days = months.reduce((sum, r) => sum + r.days, 0);
    return {
      period: `${year}年（${months.length}個月）`,
      months: months.length,
      days,
      remaining: annualRemaining / months.length,
      loan: months.reduce((s, r) => s + r.loan, 0) / months.length,
      income: months.reduce((s, r) => s + r.income, 0) / months.length,
      daily: annualRemaining / days,
      annualRemaining,
    };
  });
}
