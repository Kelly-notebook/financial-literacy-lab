import { describe, it, expect } from "vitest";
import { householdSummary } from "./householdSummary";
import {
  coachTopics,
  coachPrompt,
  commonCoachRequirements,
} from "./coachPrompts";
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
    expect(empty).toContain(
      "已開始退休儲蓄或投資並定期檢視（不代表退休資金足夠）：未提供",
    );
    const s = householdSummary({ ...values, etfMonthly: "" }, snapshot());
    expect(s).toContain(
      "ETF 投資：未提供或待修正（畫面暫用最近有效值 NT$ 5,000）",
    );
    expect(s).toContain("尚未確認已準備緊急預備金");
    expect(s).toContain("使用者自我確認已開始為退休儲蓄或投資並定期檢視規劃");
    expect(s).toContain("利率、餘額、用途與本金／利息拆分：未提供");
  });
  it.each(coachTopics)("$title包含最新資料、對應任務及共同限制", (topic) => {
    const s = householdSummary(values, snapshot()),
      prompt = coachPrompt(s, topic.id);
    expect(prompt.startsWith(`【本次分析任務：${topic.title}】`)).toBe(true);
    expect(prompt.split(s)).toHaveLength(2);
    expect(prompt.indexOf(topic.prompt)).toBeLessThan(prompt.indexOf(s));
    expect(prompt.indexOf(s)).toBeLessThan(prompt.indexOf("【共同輸出要求】"));
    expect(prompt).toContain(topic.prompt);
    expect(prompt).toContain("150～250");
    expect(prompt).toContain("嚴格、務實但尊重使用者");
    expect(prompt).toContain("不是個人化證券投資指示");
  });
  it.each(coachTopics)("$title勾選與取消即時反映兩項安全資訊", (topic) => {
    for (const checked of ["yes", "no"]) {
      const text = coachPrompt(
        householdSummary(
          {
            ...values,
            emergencyConfirmed: checked,
            retirementConfirmed: checked,
          },
          snapshot(),
        ),
        topic.id,
      );
      expect(text).toContain(
        checked === "yes"
          ? "使用者自我確認已準備緊急預備金"
          : "尚未確認已準備緊急預備金",
      );
      expect(text).toContain(
        checked === "yes"
          ? "使用者自我確認已開始為退休儲蓄或投資並定期檢視規劃"
          : "尚未確認已開始為退休儲蓄或投資並定期檢視規劃",
      );
      expect(text).toContain(
        checked === "yes" ? "僅自我確認，未經驗證" : "未勾選不代表",
      );
    }
    expect(topic.prompt.length).toBeLessThan(650);
    expect(coachPrompt("資料", topic.id)).not.toMatch(
      /三種方案|三種投資情境|5、10、20 年/,
    );
  });
  it("預算主動檢視孝親負擔且不預設取消", () => {
    for (const topic of coachTopics.filter((x) => x.id === "spending")) {
      expect(topic.prompt).toContain("而非不可調整的固定義務");
      expect(topic.prompt).toContain("調整後的支援上限");
      expect(topic.prompt).toContain("不要預設必須完全取消");
      expect(topic.prompt).toContain("法定扶養義務");
    }
  });
  it("共同規則不再強制所有主題減支，三主題結構明確不同", () => {
    expect(commonCoachRequirements).not.toMatch(
      /請優先回答|每月具體建議調整|本月.*兩項行動|哪些支出/,
    );
    expect(
      new Set(coachTopics.map((t) => coachPrompt("完整原始資料", t.id))).size,
    ).toBe(3);
    const [health, spending, etf] = coachTopics;
    expect(health.prompt).toContain("不要硬找問題");
    expect(spending.prompt).toContain("不必強迫削減支出");
    expect(etf.prompt).toContain("目前每月 ETF 投入金額及占收入比例");
    expect(etf.prompt).toContain("不需要強制提出消費減支建議");
  });
});
