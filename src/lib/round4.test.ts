import { describe, it, expect } from "vitest";
import { resolveNumber } from "./numericDraft";
import { portfolioValue, chartDomain } from "./portfolio";
import { budget, forecast, type BudgetInput } from "./budget";
import { livingFields } from "./living";
import { allocations, budgetEntries, healthCheck } from "./health";
const base: BudgetInput = {
  mode: "monthly",
  salary: 100000,
  annualBonus: 0,
  annualIncome: 1200000,
  otherIncome: 0,
  investmentCash: 0,
  cashTreatment: "exclude",
  living: 15000,
  telecom: 0,
  subscriptions: 0,
  loans: [{ payment: 5000, months: 1 }],
  purchasePrice: 120000,
  purchaseFund: 0,
  purchaseMonths: 12,
  purchaseMonthly: 10000,
  purchaseCost: 0,
  travelPrice: 60000,
  travelFund: 0,
  travelMonths: 12,
  etfMonthly: 10000,
  saving: 5000,
  startMonth: "2026-11",
  livingMode: "total",
  necessaryTotal: 20000,
  discretionaryTotal: 10000,
  livingDetails: { food: 18000, medical: 2000, dining: 3000 },
};
describe("全站共用數值草稿", () => {
  it.each(["", "-", "abc", "-1", "10000000000000"])(
    "無效金額 %s 沿用前值，其他資料不需清除",
    (raw) =>
      expect(resolveNumber(raw, 5000, "0", { min: 0, max: 1e12 })).toBe(5000),
  );
  it("0可刪空、千分位貼上及小數正常解析", () => {
    expect(resolveNumber("", 0, "0", { min: 0, max: 1e12 })).toBe(0);
    expect(resolveNumber("5,000.25", 0, "0", { min: 0, max: 1e12 })).toBe(
      5000.25,
    );
  });
  it("年數及比例依共同範圍、整數規則保留最近值", () => {
    expect(
      resolveNumber("", 10, "10", { min: 1, max: 40, integer: true }),
    ).toBe(10);
    expect(
      resolveNumber("1.5", 10, "10", { min: 1, max: 40, integer: true }),
    ).toBe(10);
    expect(resolveNumber("11", 8, "8", { min: 0, max: 10 })).toBe(8);
  });
});
describe("三檔ETF實際股數與縱軸", () => {
  it("三檔不同代號及零股按實際股數加總", () => {
    const p = portfolioValue([
      { code: "0050", shares: 1001, price: 100 },
      { code: "006208", shares: 2, price: 50 },
      { code: "任意代號", shares: 3, price: 200 },
    ]);
    expect(p.rows.map((x) => x.value)).toEqual([100100, 100, 600]);
    expect(p.total).toBe(100800);
  });
  it("一筆及未使用的0股皆可試算", () => {
    expect(portfolioValue([{ code: "", shares: 0, price: 0 }]).total).toBe(0);
    expect(() => portfolioValue([])).toThrow();
    expect(() =>
      portfolioValue(Array(4).fill({ code: "", shares: 0, price: 0 })),
    ).toThrow();
  });
  it("完整從0開始，聚焦包含全部可見曲線並留邊", () => {
    const data = [
      { etf: 1000000, bank: 900000, principal: 800000 },
      { etf: 1200000, bank: 1100000, principal: 1000000 },
    ];
    const full = chartDomain(data, ["etf", "bank", "principal"], "full"),
      focus = chartDomain(data, ["etf", "bank", "principal"], "focused");
    expect(full[0]).toBe(0);
    expect(focus[0]).toBeGreaterThan(0);
    expect(focus[0]).toBeLessThan(800000);
    expect(focus[1]).toBeGreaterThan(1200000);
  });
  it.each([0, 500000])("全部值相同 %s 仍有有限上下界", (value) => {
    const d = chartDomain([{ a: value, b: value }], ["a", "b"], "focused");
    expect(d.every(Number.isFinite)).toBe(true);
    expect(d[1]).toBeGreaterThan(d[0]);
    expect(d[0]).toBeLessThanOrEqual(value);
    expect(d[1]).toBeGreaterThan(value);
  });
});
describe("家庭互斥來源與七類對帳", () => {
  it("快速模式只採兩總額，忽略明細及舊分項", () => {
    const r = budget({ ...base, telecom: 9000, medical: 9000 });
    expect(r.living).toBe(30000);
    expect(r.remaining).toBe(35000);
    expect(forecast(base, 2)[1].remaining).toBe(40000);
  });
  it("明細只採19項，分類影響生活分組但不改總扣款", () => {
    expect(livingFields).toHaveLength(19);
    const p = {
        ...base,
        livingMode: "detail" as const,
        livingCategories: { medical: "wants" as const },
      },
      r = budget(p),
      entries = budgetEntries(p, r),
      items = allocations(entries, r.remaining, { medical: "wants" });
    expect(r.living).toBe(23000);
    expect(items.find((x) => x.name === "必要生活支出")!.value).toBe(18000);
    expect(items.find((x) => x.name === "非必要消費")!.value).toBe(5000);
  });
  it("七類加其他儲蓄對帳，不把其他儲蓄當可花金額或ETF", () => {
    const r = budget(base),
      entries = budgetEntries(base, r),
      items = allocations(entries, r.remaining),
      h = healthCheck(entries, r.income);
    expect(items).toHaveLength(7);
    expect(items.reduce((s, x) => s + x.value, 0) + base.saving).toBe(r.income);
    expect(items.find((x) => x.name === "ETF 投資")!.value).toBe(10000);
    expect(h.groups.find((x) => x.id === "savings")!.value).toBe(15000);
  });
  it("赤字剩餘切片為0，但七類加其他儲蓄等於收入加缺口", () => {
    const p = { ...base, salary: 20000 },
      r = budget(p),
      items = allocations(budgetEntries(p, r), r.remaining);
    expect(r.remaining).toBe(-45000);
    expect(items.find((x) => x.name === "剩餘可支配金額")!.value).toBe(0);
    expect(items.every((x) => x.value >= 0)).toBe(true);
    expect(items.reduce((s, x) => s + x.value, 0) + p.saving).toBe(
      r.income + r.deficit,
    );
  });
  it("CFPB與資金流分組不同：旅遊為非必要，貸款可改儲蓄而切片仍貸款", () => {
    const r = budget(base),
      entries = budgetEntries(base, r),
      categories = { loans: "savings" as const };
    const h = healthCheck(entries, r.income, categories),
      items = allocations(entries, r.remaining, categories);
    expect(items.find((x) => x.name === "貸款")!.value).toBe(5000);
    expect(h.groups.find((x) => x.id === "savings")!.value).toBe(20000);
    expect(h.groups.find((x) => x.id === "wants")!.value).toBe(25000);
  });
});

import { restoreBudget, BUDGET_STORAGE_KEY } from "./budgetStorage";
it("舊家庭暫存轉換另存快速總額，原始明細不覆寫", () => {
  const defaults = {
    living: "15000",
    livingMode: "total",
    necessaryTotal: "15000",
    discretionaryTotal: "0",
    medical: "0",
    telecom: "0",
    clothing: "0",
    dining: "0",
    parentSupport: "0",
    subscriptions: "0",
    education: "0",
  };
  const original = {
    living: "20000",
    medical: "1000",
    telecom: "500",
    clothing: "2000",
    livingMode: "total",
  };
  const restored = restoreBudget(
    {
      getItem: (key) =>
        key === BUDGET_STORAGE_KEY
          ? JSON.stringify({ version: 1, values: original })
          : null,
    },
    defaults,
  );
  expect(restored.values.necessaryTotal).toBe("21500");
  expect(restored.values.discretionaryTotal).toBe("2000");
  expect(restored.values.living).toBe("20000");
  expect(restored.values.medical).toBe("1000");
  expect(restored.values.education).toBe("0");
});
