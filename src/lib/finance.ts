/** All amounts are TWD; rates are decimals. No persistence or network access. */
export const MAX_MONEY = 1e12;
export function bounded(value: number, name: string, min = 0, max = MAX_MONEY) {
  if (!Number.isFinite(value) || value < min || value > max)
    throw new Error(
      `${name}需介於 ${min.toLocaleString("zh-TW")}～${max.toLocaleString("zh-TW")}`,
    );
  return value;
}
export function monthlyRate(annual: number) {
  bounded(annual, "年化率", 0, 0.1);
  return Math.expm1(Math.log1p(annual) / 12);
}
function monthsCheck(months: number) {
  bounded(months, "月數", 1, 600);
  if (!Number.isInteger(months)) throw new Error("月數需為整數");
}
export interface InvestmentInput {
  initial: number;
  monthly: number;
  annual: number;
  months: number;
  changeMonth?: number;
  nextMonthly?: number;
  delayMonths?: number;
}
export interface InvestmentRow {
  year: number;
  value: number;
  principal: number;
  gain: number;
}
export function investment(input: InvestmentInput): InvestmentRow[] {
  const {
    initial,
    monthly,
    annual,
    months,
    changeMonth = Infinity,
    nextMonthly = monthly,
    delayMonths = 0,
  } = input;
  bounded(initial, "起始市值");
  bounded(monthly, "每月投入");
  bounded(nextMonthly, "調整後投入");
  monthsCheck(months);
  bounded(delayMonths, "延後月數", 0, months);
  const r = monthlyRate(annual);
  let value = initial,
    principal = initial;
  const rows: InvestmentRow[] = [{ year: 0, value, principal, gain: 0 }];
  for (let m = 1; m <= months; m++) {
    const contribution =
      m <= delayMonths ? 0 : m >= changeMonth ? nextMonthly : monthly;
    value = value * (1 + r) + contribution;
    principal += contribution;
    if (m % 12 === 0 || m === months)
      rows.push({ year: m / 12, value, principal, gain: value - principal });
  }
  return rows;
}
export function goalMonthly(
  target: number,
  initial: number,
  annual: number,
  months: number,
  stage?: { months: number; monthly: number },
) {
  bounded(target, "目標", 1);
  bounded(initial, "起始市值");
  monthsCheck(months);
  const r = monthlyRate(annual);
  let start = initial,
    remaining = months;
  if (stage) {
    monthsCheck(stage.months);
    if (stage.months >= months) throw new Error("第一階段需短於總年限");
    bounded(stage.monthly, "第一階段投入");
    start = investment({
      initial,
      monthly: stage.monthly,
      annual,
      months: stage.months,
    }).at(-1)!.value;
    remaining -= stage.months;
  }
  const growth = (1 + r) ** remaining;
  const factor =
    r === 0 ? remaining : Math.expm1(remaining * Math.log1p(r)) / r;
  const raw = Math.max(0, (target - start * growth) / factor);
  return Math.ceil(raw - Math.min(1e-8, raw));
}
export function settleWithdrawal(balance: number, demand: number) {
  bounded(balance, "可用資產", 0, Number.MAX_VALUE);
  bounded(demand, "預定提領", 0, Number.MAX_VALUE);
  return { withdrawal: Math.min(demand, balance), unmet: demand > balance };
}
export type Strategy = "real" | "proportional" | "nominal";
export interface RetirementInput {
  initial: number;
  rate: number;
  annual: number;
  inflation: number;
  years: number;
  age: number;
  strategy: Strategy;
  returns?: number[];
}
export function retirement(input: RetirementInput) {
  const { initial, rate, annual, inflation, years, age, strategy, returns } =
    input;
  bounded(initial, "退休資產");
  bounded(rate, "提領率", 0, 0.1);
  bounded(annual, "報酬率", 0, 0.1);
  bounded(inflation, "通膨率", 0, 0.05);
  bounded(years, "退休年數", 1, 50);
  bounded(age, "退休年齡", 18, 100);
  if (!Number.isInteger(years)) throw new Error("退休年數需為整數");
  if (returns && returns.length < years) throw new Error("報酬序列長度不足");
  let balance = initial,
    cumulative = 0;
  const rows = [];
  for (let year = 1; year <= years; year++) {
    const demand =
      strategy === "proportional"
        ? balance * rate
        : initial *
          rate *
          (strategy === "real" ? (1 + inflation) ** (year - 1) : 1);
    const { withdrawal, unmet } = settleWithdrawal(balance, demand);
    const r = returns ? returns[year - 1] : annual;
    bounded(r, "年度報酬", -1, 10);
    balance = Math.max(0, balance - withdrawal) * (1 + r);
    cumulative += withdrawal;
    rows.push({
      year,
      age: age + year - 1,
      demand,
      withdrawal,
      balance,
      realBalance: balance / (1 + inflation) ** year,
      cumulative,
      unmet,
      exhausted: balance === 0,
    });
  }
  return rows;
}
export function requiredRetirement(monthlyGap: number, rate: number) {
  bounded(monthlyGap, "每月缺口");
  bounded(rate, "提領率", 0.000001, 0.1);
  return (monthlyGap * 12) / rate;
}
export function sequenceReturns(years: number) {
  return Array.from(
    { length: years },
    (_, i) => [0.15, 0.08, 0.04, -0.05, -0.2][i % 5],
  );
}
export const money = (value: number) =>
  new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 }).format(value);
