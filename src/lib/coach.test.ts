import { describe, it, expect } from "vitest";
import { householdSummary } from "./householdSummary";
import { coachTopics, coachPrompt } from "./coachPrompts";
import { budget, type BudgetInput } from "./budget";
import { allocations, budgetEntries } from "./health";
const input: BudgetInput = {
  mode: "monthly",
  salary: 100000,
  annualBonus: 120000,
  annualIncome: 1320000,
  otherIncome: 2000,
  investmentCash: 12000,
  cashTreatment: "spend",
  living: 30000,
  livingMode: "total",
  necessaryTotal: 20000,
  discretionaryTotal: 10000,
  livingDetails: { food: 18000, medical: 2000, dining: 3000 },
  loans: [
    { payment: 10000, months: 12 },
    { payment: 2000, months: 6 },
    { payment: 1000, months: 3 },
    { payment: 0, months: 0 },
  ],
  purchasePrice: 120000,
  purchaseFund: 0,
  purchaseMonths: 12,
  purchaseMonthly: 5000,
  purchaseMode: "deadline",
  purchaseCost: 0,
  travelPrice: 60000,
  travelFund: 0,
  travelMonths: 12,
  etfMonthly: 5000,
  telecom: 0,
  subscriptions: 0,
  saving: 3000,
  startMonth: "2026-11",
};
const values: Record<string, string> = {
  mode: "monthly",
  salary: "100000",
  annualBonus: "120000",
  annualIncome: "1320000",
  otherIncome: "2000",
  investmentCash: "12000",
  cashTreatment: "spend",
  livingMode: "total",
  necessaryTotal: "20000",
  discretionaryTotal: "10000",
  food: "18000",
  medical: "2000",
  dining: "3000",
  mortgage: "10000",
  mortgageMonths: "12",
  carLoan: "2000",
  carLoanMonths: "6",
  credit: "1000",
  creditMonths: "3",
  otherLoan: "0",
  otherMonths: "0",
  etfMonthly: "5000",
  saving: "3000",
  purchaseMode: "deadline",
  purchasePrice: "120000",
  purchaseFund: "0",
  purchaseMonths: "12",
  purchaseMonthly: "5000",
  purchaseCost: "0",
  travelPrice: "60000",
  travelFund: "0",
  travelMonths: "12",
  emergencyConfirmed: "no",
  retirementConfirmed: "yes",
  forecastYears: "10",
};
function snapshot(p = input) {
  const current = budget(p),
    entries = budgetEntries(p, current);
  return {
    input: p,
    current,
    entries,
    items: allocations(entries, current.remaining),
  };
}
describe("家庭資料摘要與AI主題", () => {
  it("快速模式只輸出有效雙總額，不帶入另存明細；每筆現金流與既有結果一致", () => {
    const s = householdSummary(values, snapshot());
    expect(s).toContain("每月家庭稅後可支配收入（規劃用月平均）：NT$ 113,000");
    expect(s).toContain(
      "每月總分配／總支出（含目標儲蓄與 ETF 現金流出）：NT$ 66,000",
    );
    expect(s).toContain("每月實際結餘或赤字：NT$ 47,000（結餘）");
    expect(s).toContain("每日平均可支配金額：NT$ 1,566.67");
    expect(s).toContain("生活費細項：未提供");
    expect(s).not.toContain("伙食：NT$ 18,000");
    expect(s).toContain("其他每月儲蓄目標：NT$ 3,000");
    expect(s).toContain("儲蓄與財務目標：NT$ 8,000");
  });
  it("明細與用途分類沿用計算，不多加快速總額；無自由文字個資", () => {
    const p = {
      ...input,
      livingMode: "detail" as const,
      livingCategories: { medical: "wants" as const },
    };
    const s = householdSummary(
      {
        ...values,
        livingMode: "detail",
        group_medical: "wants",
        purchaseName: "私密目標姓名地址",
      },
      snapshot(p),
    );
    expect(s).toContain("每月必要生活支出總額：NT$ 18,000");
    expect(s).toContain("每月非必要消費總額：NT$ 5,000");
    expect(s).toContain("醫藥費：NT$ 2,000；用途分類：非必要消費");
    expect(s).not.toContain("私密目標姓名地址");
    expect(s).toContain("每月實際結餘或赤字：NT$ 54,000");
  });
  it("新值即時反映，負結餘不歸零", () => {
    const p = { ...input, salary: 10000, annualBonus: 0 };
    const s = householdSummary(
      { ...values, salary: "10000", annualBonus: "0" },
      snapshot(p),
    );
    expect(s).toContain("每月實際結餘或赤字：NT$ -53,000（赤字）");
  });
  it("年薪不再加獎金，股息再投入不計現金收入", () => {
    const p = {
      ...input,
      mode: "annual" as const,
      cashTreatment: "reinvest" as const,
    };
    const s = householdSummary(
      { ...values, mode: "annual", cashTreatment: "reinvest" },
      snapshot(p),
    );
    expect(s).toContain("全年稅後工作總收入：NT$ 1,320,000");
    expect(s).not.toContain("固定月薪（");
    expect(s).toContain("本月計入的投資現金收入（月平均）：NT$ 0");
    expect(s).toContain("每月家庭稅後可支配收入（規劃用月平均）：NT$ 112,000");
  });
  it("未知資料、空白、未勾選與暫用有效值均不捏造事實", () => {
    const empty = householdSummary({ mode: "monthly", salary: "" });
    expect(empty).toContain("固定月薪（使用者輸入的實際每月實領）：未提供");
    expect(empty).toContain("每月家庭稅後可支配收入（規劃用月平均）：未提供");
    expect(empty).toContain("退休理財規劃並定期檢視：未提供");
    const s = householdSummary({ ...values, etfMonthly: "" }, snapshot());
    expect(s).toContain(
      "ETF 投資：未提供或待修正（畫面暫用最近有效值 NT$ 5,000）",
    );
    expect(s).toContain("未勾選（未知是否實際完成）");
    expect(s).toContain("使用者已自行勾選（未經驗證）");
    expect(s).toContain("利率、餘額、用途與本金／利息拆分：未提供");
  });
  it.each(coachTopics)("$title包含最新資料、對應任務及共同限制", (topic) => {
    const s = householdSummary(values, snapshot()),
      prompt = coachPrompt(s, topic.id);
    expect(prompt.startsWith(s)).toBe(true);
    expect(prompt).toContain(topic.prompt);
    expect(prompt).toContain("接下來 30 天的三項行動");
    expect(prompt).toContain("不得羞辱使用者或批評家庭成員");
    expect(prompt).toContain("不是保證收益或個人化證券投資指示");
  });
});
