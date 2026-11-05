import { describe, it, expect } from "vitest";
import { budget, forecast, type BudgetInput } from "./budget";
import {
  budgetEntries,
  allocations,
  healthCheck,
  detailComparison,
  detailLimits,
  investmentCheck,
  type BudgetEntry,
} from "./health";
const input: BudgetInput = {
  mode: "monthly",
  salary: 100000,
  annualBonus: 0,
  annualIncome: 1200000,
  otherIncome: 0,
  investmentCash: 0,
  cashTreatment: "exclude",
  living: 18000,
  telecom: 3000,
  subscriptions: 5000,
  loans: [],
  purchasePrice: 0,
  purchaseFund: 0,
  purchaseMonths: 12,
  purchaseMonthly: 0,
  purchaseCost: 0,
  travelPrice: 0,
  travelFund: 0,
  travelMonths: 12,
  etfMonthly: 0,
  saving: 0,
  startMonth: "2026-11",
};
const food: BudgetEntry = {
  id: "food",
  name: "伙食",
  value: 18000,
  color: "#000",
  group: "needs",
};
describe("細項教育上限與超額試算", () => {
  it("收入10萬伙食18000，18%、3百分點、3000／36000", () =>
    expect(detailComparison(100000, 18000, 15)).toEqual({
      actual: 18,
      excessPoints: 3,
      target: 15000,
      excess: 3000,
      annual: 36000,
    }));
  it.each(Object.entries(detailLimits))(
    "預設 %s 只使用指定的教育值 %s",
    (_id, limit) => {
      const c = detailComparison(100000, limit * 1000 + 1000, limit);
      expect(c.excess).toBe(1000);
      expect(c.annual).toBe(12000);
      expect(c.excessPoints).toBeCloseTo(1);
    },
  );
  it("剛好達上限與低於上限，不產生正超額", () => {
    expect(detailComparison(100000, 15000, 15).excess).toBe(0);
    expect(detailComparison(100000, 10000, 15).excess).toBe(0);
  });
  it("自訂上限與0%上限", () => {
    expect(
      healthCheck([food], 100000, {}, { ...detailLimits, food: 20 }).advice,
    ).toEqual([]);
    expect(detailComparison(100000, 18000, 0).annual).toBe(216000);
  });
  it("零收入不回傳 Infinity 或誤判0%", () => {
    const r = detailComparison(0, 18000, 15);
    expect(r.actual).toBeNull();
    expect(r.excess).toBeNull();
    expect(healthCheck([food], 0).advice).toEqual([]);
  });
  it("僅列最多4個超額最大項目，不為育兒或貸款設定統一上限", () => {
    const ids = Object.keys(detailLimits);
    const entries = ids.map((id, i) => ({
      ...food,
      id,
      value: 20000 + i * 10000,
    }));
    entries.push(
      { ...food, id: "child", value: 1e6 },
      { ...food, id: "loans", value: 1e6 },
      { ...food, id: "purchase", value: 1e6 },
    );
    const advice = healthCheck(entries, 100000).advice;
    expect(advice).toHaveLength(4);
    expect(advice.map((x) => x.id)).not.toContain("child");
    expect(advice[0].excess).toBeGreaterThanOrEqual(advice[1].excess!);
  });
  it("負金額及超過100%的參考上限拒絕比較", () => {
    expect(() => detailComparison(100, -1, 15)).toThrow();
    expect(() =>
      healthCheck([food], 100, {}, { ...detailLimits, food: 101 }),
    ).toThrow();
  });
});
describe("共用單一分類帳與50／30／20", () => {
  it("各項只屬一類，參考值50／30／20不與Fidelity15相加", () => {
    const entries = [
      food,
      { ...food, id: "subscriptions", value: 10000, group: "wants" as const },
      { ...food, id: "etf", value: 20000, group: "savings" as const },
    ];
    const h = healthCheck(entries, 100000);
    expect(h.groups.map((g) => g.reference)).toEqual([50, 30, 20]);
    expect(h.groups.map((g) => g.ratio)).toEqual([18, 10, 20]);
    expect(h.total).toBe(48000);
  });
  it("調整分類只移動金額，不改總支出、不重複計貸款本金", () => {
    const entries = [food, { ...food, id: "loans", value: 10000 }];
    const a = healthCheck(entries, 100000),
      b = healthCheck(entries, 100000, { loans: "savings", food: "wants" });
    expect(a.total).toBe(b.total);
    expect(b.groups.map((g) => g.value)).toEqual([0, 18000, 10000]);
  });
  it("防止同一項目重複計入", () =>
    expect(() => healthCheck([food, food], 100000)).toThrow());
  it("剩餘未分配金錢不自動算儲蓄，圖表對帳含每筆ETF一次", () => {
    const p = { ...input, etfMonthly: 10000, saving: 5000 },
      row = budget(p),
      entries = budgetEntries(p, row),
      items = allocations(entries, row.remaining),
      h = healthCheck(entries, row.income);
    expect(h.groups.find((g) => g.id === "savings")!.value).toBe(15000);
    expect(h.total + row.remaining).toBe(row.income);
    expect(items.reduce((s, x) => s + x.value, 0)).toBe(row.income);
    expect(items.find((x) => x.name === "ETF 投資")!.value).toBe(10000);
  });
  it("逐項對應伙食等明細，電信／訂閱與未來月額均只加一次", () => {
    const parts = {
      food: 18000,
      child: 5000,
      insurance: 3000,
      transport: 2000,
      utilities: 1000,
      otherLiving: 4000,
    };
    const p = { ...input, living: 33000 },
      row = budget(p),
      entries = budgetEntries(p, row, parts);
    expect(entries.find((x) => x.id === "food")!.value).toBe(18000);
    expect(entries.reduce((s, x) => s + x.value, 0)).toBe(
      row.income - row.remaining,
    );
    const rows = forecast(p, 2);
    expect(rows[0].living).toBe(41000);
    expect(rows[1].living).toBe(41000);
    expect(allocations(entries, row.remaining).map((x) => x.name)).toEqual(
      expect.arrayContaining([
        "伙食",
        "育兒與家庭",
        "保險",
        "交通",
        "水電",
        "電信費",
        "工具與娛樂訂閱",
        "其他生活支出",
      ]),
    );
  });
  it("未拆生活費總額時不虛構伙食分類或細項超額", () => {
    const row = budget(input),
      entries = budgetEntries(input, row);
    expect(entries.find((x) => x.id === "food")).toBeUndefined();
    expect(healthCheck(entries, row.income).advice).toEqual([]);
  });
  it("零收入與赤字圖表不出現負切片，真實負結餘仍保留", () => {
    const p = { ...input, salary: 0, etfMonthly: 5000 },
      row = budget(p);
    const items = allocations(budgetEntries(p, row), row.remaining);
    expect(row.remaining).toBe(-31000);
    expect(items.every((x) => x.value > 0)).toBe(true);
    expect(items.find((x) => x.name === "剩餘金錢")).toBeUndefined();
  });
  it("浮點小額生活費不因扣除已加總項目產生負分類", () => {
    const p = { ...input, living: 0, telecom: 0.7, subscriptions: 0.1 };
    const row = budget(p);
    expect(() => healthCheck(budgetEntries(p, row), row.income)).not.toThrow();
  });
});
describe("ETF健檢優先順序與緊急預備金", () => {
  it("現金流赤字優先，其次超出負擔能力，再提醒預備金", () => {
    const row = budget({ ...input, etfMonthly: 100000 });
    expect(investmentCheck(row, false).map((x) => x.kind)).toEqual([
      "deficit",
      "affordability",
      "emergency",
    ]);
    expect(row.etf).toBe(100000);
    expect(row.remaining).toBe(-26000);
  });
  it("0元預設不判定不足；確認預備金後不因高於20%自動判過多", () => {
    expect(investmentCheck(budget(input), true).map((x) => x.kind)).toEqual([
      "planning",
    ]);
    expect(
      investmentCheck(budget({ ...input, etfMonthly: 30000 }), true).map(
        (x) => x.kind,
      ),
    ).toEqual(["planning"]);
  });
  it("無流動資產資料只提醒，不能判定已達標", () =>
    expect(investmentCheck(budget(input), false)[0].kind).toBe("emergency"));
  it("預備金參考依使用者必要支出分類，3～6個月而非6～12", () => {
    const h = healthCheck([food], 100000);
    expect(h.emergencyMin).toBe(54000);
    expect(h.emergencyMax).toBe(108000);
    const changed = healthCheck([food], 100000, { food: "wants" });
    expect(changed.emergencyMin).toBe(0);
  });
});
