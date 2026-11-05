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
export interface BudgetInput extends Income {
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
  etfRatio: number;
  saving: number;
  startMonth: string;
  change?: { month: number; employmentMonthly: number; living: number };
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
) {
  bounded(price, "購買總金額");
  bounded(fund, "已準備基金");
  bounded(fixedMonthly, "固定目標儲蓄");
  monthInteger(months, "購買期限");
  const gap = Math.max(0, price - fund);
  return {
    gap,
    required: gap / months,
    monthsToGoal:
      gap === 0 ? 0 : fixedMonthly > 0 ? Math.ceil(gap / fixedMonthly) : null,
  };
}
export function budget(input: BudgetInput, month = 1) {
  const annualEmployment = employmentAnnual(input);
  for (const [label, v] of Object.entries(input))
    if (
      typeof v === "number" &&
      !["salary", "annualBonus", "annualIncome"].includes(label)
    )
      bounded(v, label);
  bounded(input.etfRatio, "ETF 比例", 0, 1);
  monthInteger(input.purchaseMonths, "購買期限");
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
  const living = changed ? input.change!.living : input.living;
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
  );
  const purchase = month <= input.purchaseMonths ? goal.required : 0;
  const purchaseCost = month > input.purchaseMonths ? input.purchaseCost : 0;
  // The initial travel fund is spent on the first cycle only; later trips need full funding.
  const travel =
    month <= input.travelMonths
      ? Math.max(0, input.travelPrice - input.travelFund) / input.travelMonths
      : input.travelPrice / input.travelMonths;
  const available = income - living - loan - purchaseCost;
  const beforeEtf = available - purchase - travel - input.saving;
  const etfTarget = income * input.etfRatio;
  const etfAffordable = Math.max(0, beforeEtf);
  const etf = Math.min(etfTarget, etfAffordable);
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
    loan,
    purchase,
    purchaseCost,
    travel,
    available,
    beforeEtf,
    etfTarget,
    etfAffordable,
    etf,
    etfGap: Math.max(0, etfTarget - etf),
    etfDaily: etfTarget / days,
    goals: purchase + travel + input.saving + etf,
    remaining,
    daily: remaining / days,
    deficit: Math.max(0, -remaining),
    goal,
    emergencyMin: (living + loan + purchaseCost) * 6,
    emergencyMax: (living + loan + purchaseCost) * 12,
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
export interface Allocation {
  name: string;
  value: number;
  color: string;
}
export function allocations(
  input: BudgetInput,
  row: BudgetRow,
  livingParts?: { basic: number; family: number; transport: number },
): Allocation[] {
  const living = livingParts
    ? [
        { name: "基本生活支出", value: livingParts.basic, color: "#71917a" },
        { name: "育兒與家庭支出", value: livingParts.family, color: "#a7bc94" },
        {
          name: "交通與其他必要支出",
          value: livingParts.transport,
          color: "#789ca4",
        },
      ]
    : [{ name: "其他生活支出（總額）", value: row.living, color: "#71917a" }];
  return [
    {
      name: "居住與貸款",
      value: row.loan,
      color: "#b48958",
    },
    ...living,
    {
      name: "其他必要支出（購入後成本）",
      value: row.purchaseCost,
      color: "#9b9980",
    },
    {
      name: "旅遊及大型購買目標儲蓄",
      value: row.purchase + row.travel,
      color: "#c6ad77",
    },
    { name: "ETF 投資", value: row.etf, color: "#216b53" },
    { name: "其他儲蓄", value: input.saving, color: "#9287a4" },
    {
      name: "剩餘可支配金額",
      value: Math.max(0, row.remaining),
      color: "#c8d9bf",
    },
  ].filter((x) => x.value > 0);
}
