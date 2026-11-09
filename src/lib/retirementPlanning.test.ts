import { describe, it, expect } from "vitest";
import {
  planningDefaults,
  resolveYear,
  incomeGap,
  planningSummary,
  retirementPrompt,
  retirementSummary,
  budgetPlanningPatch,
  type Benefit,
} from "./retirementPlanning";
import { retirement } from "./finance";
const year = (value: string) => ({ mode: "year" as const, value });
function military() {
  const p = planningDefaults();
  return {
    ...p,
    age: "34",
    leave: { mode: "roc" as const, value: "120" },
    reason: "軍職退伍",
    work: "是，預計繼續工作",
    retireAge: "60",
    living: "40000",
    fixed: "2000",
    spouse: "20000",
    spouseDuration: "ongoing",
    invest: "5000",
    saving: "3000",
    children: "2",
    childAges: "2、5",
    stocks: "1000000",
    loans: [
      { id: "m", name: "房貸", monthly: "15000", end: year("2040") },
      { id: "o", name: "其他貸款", monthly: "0", end: year("") },
    ],
    benefits: [
      {
        id: "p",
        name: "軍職退休俸",
        kind: "monthly" as const,
        amount: "30000",
        start: year("2031"),
        end: year(""),
        ongoing: true,
        status: "pending" as const,
      },
    ],
  };
}
const benefit = (patch: Partial<Benefit> = {}): Benefit => ({
  id: "b",
  name: "年金",
  kind: "monthly",
  amount: "10000",
  start: year("2035"),
  end: year("2040"),
  ongoing: false,
  status: "confirmed",
  ...patch,
});
describe("退休轉職年度缺口：不改原提領模型", () => {
  it("民國120=2031，離職39歲不等於60歲完全退休，未確認給付不抵收入", () => {
    const p = military(),
      g = incomeGap(p, 2026);
    expect(g.leave).toBe(2031);
    expect(g.age).toBe(39);
    expect(g.retireYear).toBe(2052);
    expect(g.basic).toBe(37000);
    expect(g.goals).toBe(45000);
    expect(g.benefitIncome).toBe(0);
    expect(g.excluded.join()).toContain("尚待確認");
  });
  it("給付起訖及貸款最後年份均含當年，配偶持續性明確", () => {
    const p = {
      ...military(),
      benefits: [benefit()],
      spouseDuration: "until",
      spouseEnd: year("2034"),
    };
    expect(incomeGap(p, 2026).income).toBe(20000);
    expect(incomeGap({ ...p, year: "2035" }, 2026).income).toBe(10000);
    expect(incomeGap({ ...p, year: "2040" }, 2026).loan).toBe(15000);
    const g = incomeGap({ ...p, year: "2041" }, 2026);
    expect(g.income).toBe(0);
    expect(g.loan).toBe(0);
    expect(g.basic).toBe(42000);
  });
  it("一次性已確認給付不當月薪或加進資產，股市資產不抵扣工作需求", () => {
    const p = {
      ...military(),
      benefits: [benefit({ kind: "once", amount: "99999999" })],
    };
    expect(incomeGap(p, 2026).basic).toBe(37000);
    expect(
      incomeGap({ ...p, stocks: "9000000", cash: "3000000" }, 2026).basic,
    ).toBe(37000);
  });
  it("0合法，空白／無效／不明配偶持續性不給假精確值，目標可局部缺失", () => {
    const p = military();
    expect(incomeGap({ ...p, spouse: "" }, 2026).basic).toBeUndefined();
    expect(incomeGap({ ...p, spouseDuration: "" }, 2026).basic).toBeUndefined();
    expect(incomeGap({ ...p, invest: "" }, 2026).basic).toBe(37000);
    expect(incomeGap({ ...p, invest: "" }, 2026).goals).toBeUndefined();
    expect(incomeGap({ ...p, spouse: "999999" }, 2026).goals).toBe(0);
    expect(incomeGap({ ...p, living: "bad" }, 2026).basic).toBeUndefined();
  });
  it("不可能的時間、已確認月收入無效時阻止估算，未確認則只列資訊", () => {
    const p = military();
    for (const q of [
      { year: "2030" },
      { retireAge: "35" },
      { age: "abc" },
      { benefits: [benefit({ end: year("2030") })] },
      { benefits: [benefit({ amount: "" })] },
    ])
      expect(incomeGap({ ...p, ...q }, 2026).basic).toBeUndefined();
    expect(
      incomeGap(
        { ...p, benefits: [benefit({ status: "pending", amount: "" })] },
        2026,
      ).basic,
    ).toBe(37000);
  });
  it("年度模式不可把西元120當2031，年齡基準需目前年齡", () => {
    expect(resolveYear({ mode: "roc", value: "120" }, "34", 2026)).toBe(2031);
    expect(resolveYear(year("120"), "34", 2026)).toBeUndefined();
    expect(resolveYear({ mode: "age", value: "39" }, "34", 2026)).toBe(2031);
    expect(resolveYear({ mode: "age", value: "39" }, "", 2026)).toBeUndefined();
  });
  it("進階全空白仍可產生Prompt，未知不假裝0；任務、完整資料、短答依序", () => {
    const s = planningSummary(planningDefaults(), 2026),
      prompt = retirementPrompt(s);
    expect(s).toContain("目前 ETF／股票市值：未提供");
    expect(s).toContain("無法可靠估算");
    expect(prompt.indexOf("【本次分析任務")).toBeLessThan(
      prompt.indexOf("【進階退休"),
    );
    expect(prompt.indexOf("【精簡輸出要求")).toBeGreaterThan(
      prompt.indexOf("【進階退休"),
    );
    expect(prompt).toContain("250～400");
    expect(prompt).toContain("主管機關最新官方資訊");
  });
  it("完整提領參數、逐年有效結果及未來資產來源不相加，草稿無效有標示", () => {
    const input = {
        initial: 2000000,
        rate: 0.04,
        annual: 0.04,
        inflation: 0.02,
        years: 30,
        age: 60,
        strategy: "real" as const,
      },
      rows = retirement(input);
    const s = retirementSummary(
      { mode: "assets", assetMode: "value", initial: "", rate: "4" },
      input,
      rows,
      "起始市值待修正",
      { assets: 2000000, years: 30, scenario: "增加投入方案 B" },
    );
    expect(s).toContain("最近有效試算");
    expect(s).toContain("第 30 年／89 歲");
    expect(s).toContain("不是今天現有資產");
    expect(s).toContain("不另加總");
    expect(s).toContain("不自動混用");
    expect(rows).toEqual(retirement(input));
  });
  it("家庭無有效試算時不能帶入", () =>
    expect(() => budgetPlanningPatch({ values: {}, summary: "" })).toThrow(
      "完整有效",
    ));
});

// Imports must use the active source once, with original loan timing preserved.
describe("家庭預算快照帶入", () => {
  const values: Record<string, string> = {
    mode: "monthly",
    salary: "100000",
    annualBonus: "0",
    otherIncome: "0",
    investmentCash: "0",
    etfMonthly: "5000",
    saving: "3000",
    purchaseMode: "monthly",
    purchasePrice: "10000",
    purchaseFund: "0",
    purchaseMonthly: "1000",
    purchaseCost: "0",
    travelPrice: "12000",
    travelFund: "0",
    travelMonths: "12",
    livingMode: "total",
    necessaryTotal: "30000",
    discretionaryTotal: "10000",
    mortgage: "15000",
    mortgageMonths: "24",
    carLoan: "0",
    carLoanMonths: "0",
    credit: "0",
    creditMonths: "0",
    otherLoan: "0",
    otherMonths: "0",
  };
  const snapshot = {
    input: {
      startMonth: "2026-11",
      saving: 3000,
      loans: [
        { payment: 15000, months: 24 },
        { payment: 0, months: 0 },
        { payment: 0, months: 0 },
        { payment: 0, months: 0 },
      ],
    },
    current: {
      living: 40000,
      purchaseCost: 0,
      etf: 5000,
      purchase: 1000,
      travel: 1000,
    },
  } as unknown as import("./householdSummary").HouseholdSnapshot;
  it("帶目前有效生活費及各目標一次，不帶配偶收入，貸款保留各自結束年", () => {
    const incoming = { values, snapshot, summary: "完整原摘要" },
      r = budgetPlanningPatch(incoming);
    expect(r.living).toBe("40000");
    expect(r.invest).toBe("5000");
    expect(r.saving).toBe("5000");
    expect(r.loans[0].end.value).toBe("2028");
    expect(r).not.toHaveProperty("spouse");
    expect(incoming.values.salary).toBe("100000");
  });
  it("整數期數限制及活躍草稿錯誤拒絕帶入；未使用明細與購物期限不影響", () => {
    const patches: Record<string, string>[] = [
      { etfMonthly: "" },
      { mortgageMonths: "1.5" },
      { mortgageMonths: "601" },
      { travelMonths: "0" },
      { necessaryTotal: "bad" },
    ];
    for (const patch of patches)
      expect(() =>
        budgetPlanningPatch({
          values: { ...values, ...patch },
          snapshot,
          summary: "",
        }),
      ).toThrow("不採用");
    expect(() =>
      budgetPlanningPatch({
        values: { ...values, food: "bad", purchaseMonths: "bad" },
        snapshot,
        summary: "",
      }),
    ).not.toThrow();
  });
});
