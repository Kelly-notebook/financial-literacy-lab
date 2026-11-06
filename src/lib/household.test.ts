import { describe, it, expect } from "vitest";
import {
  budget,
  forecast,
  purchaseGoal,
  purchaseDuration,
  type BudgetInput,
} from "./budget";
import { budgetEntries, allocations, healthCheck, groupState } from "./health";
import {
  draftAmount,
  sanitiseBudgetValues,
  restoreBudget,
  BUDGET_STORAGE_KEY,
} from "./budgetStorage";
const base: BudgetInput = {
  mode: "monthly",
  salary: 100000,
  annualBonus: 0,
  annualIncome: 1200000,
  otherIncome: 0,
  investmentCash: 0,
  cashTreatment: "exclude",
  living: 10000,
  telecom: 0,
  subscriptions: 0,
  loans: [],
  purchasePrice: 0,
  purchaseFund: 0,
  purchaseMonths: 12,
  purchaseMonthly: 5000,
  purchaseCost: 0,
  travelPrice: 0,
  travelFund: 0,
  travelMonths: 12,
  etfMonthly: 0,
  saving: 0,
  startMonth: "2026-11",
};
describe("新增支出與共同分類帳", () => {
  it("四個新項目只扣一次，連動各期月額、日額、圖表與健檢", () => {
    const input = {
      ...base,
      clothing: 1000,
      dining: 2000,
      parentSupport: 3000,
      medical: 4000,
    };
    const r = budget(input),
      entries = budgetEntries(input, r),
      items = allocations(entries, r.remaining),
      h = healthCheck(entries, r.income);
    expect(r.remaining).toBe(80000);
    expect(r.daily).toBeCloseTo(80000 / 30);
    expect(forecast(input, 24).every((x) => x.remaining === 80000)).toBe(true);
    expect(h.groups.find((x) => x.id === "needs")!.value).toBe(14000);
    expect(h.groups.find((x) => x.id === "wants")!.value).toBe(6000);
    expect(entries.map((x) => x.name)).toEqual(
      expect.arrayContaining(["治裝費", "餐廳與日常娛樂", "孝親費", "醫藥費"]),
    );
    expect(h.total + r.remaining).toBe(r.income);
  });
  it("治裝與孝親改為必要支出不改實際扣款", () => {
    const p = { ...base, clothing: 1000, parentSupport: 3000 },
      r = budget(p),
      entries = budgetEntries(p, r);
    const a = healthCheck(entries, r.income),
      b = healthCheck(entries, r.income, {
        clothing: "needs",
        parentSupport: "needs",
      });
    expect(a.total).toBe(b.total);
    expect(b.groups.find((x) => x.id === "needs")!.value).toBe(14000);
  });
  it("大型購物與旅行各有獨立切片，依最終用途分類", () => {
    const p = {
        ...base,
        purchasePrice: 120000,
        purchaseMonths: 12,
        travelPrice: 60000,
      },
      r = budget(p),
      entries = budgetEntries(p, r),
      items = allocations(entries, r.remaining);
    expect(items.find((x) => x.name === "大型購物儲蓄")!.value).toBe(10000);
    expect(items.find((x) => x.name === "旅遊基金")!.value).toBe(5000);
    const h = healthCheck(entries, r.income, { purchase: "savings" });
    expect(h.groups.find((x) => x.id === "savings")!.value).toBe(10000);
    expect(h.groups.find((x) => x.id === "wants")!.value).toBe(5000);
    expect(h.total).toBe(25000);
  });
});
describe("CFPB 與本站警示邊界", () => {
  it.each([
    ["needs", 50, "normal"],
    ["needs", 50.01, "pink"],
    ["wants", 30, "normal"],
    ["wants", 30.01, "pink"],
    ["savings", 9.99, "yellow"],
    ["savings", 10, "watch"],
    ["savings", 19.99, "watch"],
    ["savings", 20, "green"],
  ] as const)("%s %s% 狀態 %s", (id, ratio, tone) =>
    expect(groupState(id, ratio).tone).toBe(tone),
  );
  it("必要支出56%指出超過6百分點，不只靠顏色", () =>
    expect(groupState("needs", 56).message).toContain("超出參考值 6 個百分點"));
  it("赤字時，即使儲蓄20%以上也不給整體良好或綠色判定", () => {
    expect(groupState("savings", 30, true).tone).toBe("normal");
    expect(groupState("savings", 30, true).message).toContain("赤字");
    const h = healthCheck(
      [
        { id: "needs", name: "支出", value: 90000, group: "needs", color: "" },
        { id: "etf", name: "ETF", value: 20000, group: "savings", color: "" },
      ],
      100000,
    );
    expect(h.cashDeficit).toBe(10000);
    expect(h.groups.find((g) => g.id === "savings")!.tone).toBe("normal");
  });
  it("零收入不作比例狀態判定", () =>
    expect(groupState("savings", null).tone).toBe("unknown"));
});
describe("大型購買雙向試算", () => {
  it("模式A向上取整且末期不多扣，確保足額", () => {
    const p = {
      ...base,
      purchasePrice: 1000,
      purchaseMonths: 3,
      purchaseMonthly: NaN,
    };
    const rows = forecast(p, 4);
    expect(rows.map((r) => r.purchase)).toEqual([334, 334, 332, 0]);
    expect(purchaseGoal(1000, 0, 3, NaN).required).toBe(334);
  });
  it("模式B以月存推算30個月，忽略未採用期限", () => {
    const p = {
      ...base,
      purchaseMode: "monthly" as const,
      purchasePrice: 300000,
      purchaseFund: 60000,
      purchaseMonthly: 8000,
      purchaseMonths: NaN,
    };
    const r = budget(p);
    expect(r.goal).toEqual({ gap: 240000, required: 8000, monthsToGoal: 30 });
    expect(purchaseDuration(r.goal.monthsToGoal)).toBe(
      "預計 2 年 6 個月後達標",
    );
    expect(budget(p, 31).purchase).toBe(0);
  });
  it.each(["deadline", "monthly"] as const)("%s 已達標不再扣月存", (mode) => {
    const p = {
      ...base,
      purchaseMode: mode,
      purchasePrice: 100,
      purchaseFund: 200,
    };
    expect(budget(p).purchase).toBe(0);
    expect(budget(p).goal.required).toBe(0);
    expect(purchaseDuration(budget(p).goal.monthsToGoal)).toBe(
      "目前資金已達標",
    );
  });
  it("模式B月存0無法估時，也不假設已購買產生持有成本", () => {
    const r = budget({
      ...base,
      purchaseMode: "monthly",
      purchasePrice: 100000,
      purchaseMonthly: 0,
      purchaseCost: 1000,
    });
    expect(r.goal.monthsToGoal).toBeNull();
    expect(purchaseDuration(null)).toBe("無法估算達標時間");
    expect(r.purchase).toBe(0);
    expect(r.purchaseCost).toBe(0);
  });
  it("購物、旅行、ETF與其他儲蓄各扣一次", () => {
    const p = {
      ...base,
      purchaseMode: "monthly" as const,
      purchasePrice: 120000,
      purchaseMonthly: 4000,
      travelPrice: 24000,
      etfMonthly: 5000,
      saving: 3000,
    };
    const r = budget(p);
    expect(r.purchase).toBe(4000);
    expect(r.travel).toBe(2000);
    expect(r.goals).toBe(14000);
    expect(r.remaining).toBe(76000);
  });
});
describe("ETF 草稿及安全本機快照", () => {
  const defaults = {
    salary: "",
    annualIncome: "",
    etfMonthly: "0",
    startMonth: "2026-11",
    purchaseMode: "deadline",
    purchaseMonths: "12",
    emergencyConfirmed: "no",
    retirementConfirmed: "no",
    limit_food: "15",
  };
  it("0→空白→5000，非法或超界草稿沿用最近有效值", () => {
    expect(draftAmount("", 0)).toBe(0);
    expect(draftAmount("5,000", 0)).toBe(5000);
    expect(draftAmount("-1", 5000)).toBe(5000);
    expect(draftAmount("10000000000000", 5000)).toBe(5000);
  });
  it("不將清空、超界或破損值覆蓋已儲存的合理資料", () => {
    const previous = { ...defaults, salary: "100000", etfMonthly: "5000" };
    const r = sanitiseBudgetValues(
      {
        salary: "",
        etfMonthly: "1e99",
        limit_food: "200",
        emergencyConfirmed: "yes",
        retirementConfirmed: "yes",
        group_parentSupport: "needs",
        unknown: "secret",
      },
      defaults,
      previous,
    );
    expect(r.salary).toBe("100000");
    expect(r.etfMonthly).toBe("5000");
    expect(r.limit_food).toBe("15");
    expect(r.emergencyConfirmed).toBe("yes");
    expect(r.retirementConfirmed).toBe("yes");
    expect(r.group_parentSupport).toBe("needs");
    expect(r).not.toHaveProperty("unknown");
  });
  it("版本化資料恢復，保留兩個自評勾選與目的分類", () => {
    const data = {
      version: 1,
      values: {
        salary: "100,000",
        etfMonthly: "5,000",
        emergencyConfirmed: "yes",
        retirementConfirmed: "yes",
        group_purchase: "savings",
      },
    };
    const r = restoreBudget(
      {
        getItem: (key) =>
          key === BUDGET_STORAGE_KEY ? JSON.stringify(data) : null,
      },
      defaults,
    );
    expect(r.restored).toBe(true);
    expect(r.values.salary).toBe("100000");
    expect(r.values.retirementConfirmed).toBe("yes");
    expect(r.values.group_purchase).toBe("savings");
  });
  it.each([
    "bad JSON",
    '{"version":99,"values":{}}',
    '{"version":1,"values":[]}',
  ])("損壞或不支援資料回到安全預設 %s", (raw) => {
    const r = restoreBudget({ getItem: () => raw }, defaults);
    expect(r.error).toBe(true);
    expect(r.values).toEqual(defaults);
  });
  it("瀏覽器拒絕儲存存取時仍能啟用預設表單", () => {
    const r = restoreBudget(
      {
        getItem: () => {
          throw new Error("Denied");
        },
      },
      defaults,
    );
    expect(r.error).toBe(true);
    expect(r.values).toEqual(defaults);
  });
});
