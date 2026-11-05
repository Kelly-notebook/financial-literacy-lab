import { describe, it, expect } from "vitest";
import {
  budget,
  forecast,
  annualForecast,
  allocations,
  purchaseGoal,
  switchIncome,
  employmentAnnual,
  periodFor,
  currentTaipeiMonth,
  type BudgetInput,
} from "./budget";
export const base: BudgetInput = {
  mode: "monthly",
  salary: 50000,
  annualBonus: 0,
  annualIncome: 600000,
  otherIncome: 0,
  investmentCash: 0,
  cashTreatment: "exclude",
  living: 15000,
  loans: [{ payment: 5000, months: 24 }],
  purchasePrice: 300000,
  purchaseFund: 0,
  purchaseMonths: 60,
  purchaseMonthly: 5000,
  purchaseCost: 0,
  travelPrice: 60000,
  travelFund: 0,
  travelMonths: 12,
  etfRatio: 0.1,
  saving: 0,
  startMonth: "2026-11",
};
describe("收入模式與年度對帳", () => {
  it("月薪加獎金與相同全年總收入的所有年度計算一致", () => {
    const monthly = { ...base, salary: 100000, annualBonus: 600000 };
    const annual = {
      ...monthly,
      mode: "annual" as const,
      annualIncome: 1800000,
    };
    expect(employmentAnnual(monthly)).toBe(1800000);
    const a = forecast(monthly, 12),
      b = forecast(annual, 12);
    expect(a).toEqual(b);
    expect(a.reduce((s, x) => s + x.income, 0)).toBe(1800000);
    expect(a.reduce((s, x) => s + x.remaining, 0)).toBe(
      b.reduce((s, x) => s + x.remaining, 0),
    );
  });
  it("年薪改變立即更新，不依賴隱藏月薪，也不重加獎金", () => {
    expect(
      budget({
        ...base,
        mode: "annual",
        salary: NaN,
        annualBonus: 600000,
        annualIncome: 1800000,
      }).income,
    ).toBe(150000);
    expect(
      budget({ ...base, mode: "annual", annualIncome: 2400000 }).income,
    ).toBe(200000);
  });
  it("雙向模式切換保留相同全年總額及合理獎金", () => {
    const a = {
      mode: "monthly" as const,
      salary: 100000,
      annualBonus: 600000,
      annualIncome: 0,
    };
    const b = switchIncome(a, "annual");
    expect(b.annualIncome).toBe(1800000);
    const c = switchIncome({ ...b, annualIncome: 1200000 }, "monthly");
    expect(c.salary).toBe(50000);
    expect(c.annualBonus).toBe(600000);
    expect(employmentAnnual(c)).toBe(1200000);
  });
  it("年薪低於保留獎金時切換不產生負薪資", () => {
    const c = switchIncome(
      { ...base, mode: "annual", annualIncome: 100000, annualBonus: 600000 },
      "monthly",
    );
    expect(c.salary).toBe(0);
    expect(c.annualBonus).toBe(100000);
  });
  it("年度結餘逐月合計，貸款及購買期限到期不多扣", () => {
    const p = {
      ...base,
      loans: [{ payment: 5000, months: 6 }],
      purchaseMonths: 6,
      purchasePrice: 60000,
      etfRatio: 0,
    };
    const rows = forecast(p, 12);
    expect(rows[5].loan).toBe(5000);
    expect(rows[6].loan).toBe(0);
    expect(rows[5].purchase).toBe(10000);
    expect(rows[6].purchase).toBe(0);
    expect(rows.reduce((s, x) => s + x.remaining, 0)).toBe(
      12 * 50000 - 12 * 15000 - 6 * 5000 - 60000 - 60000,
    );
  });
});
describe("每期現金流、赤字與日平均", () => {
  it("赤字保留負的月額及每日金額，ETF 不強制投入", () => {
    const r = budget({ ...base, salary: 10000 });
    expect(r.remaining).toBe(-20000);
    expect(r.daily).toBeCloseTo(-20000 / 30);
    expect(r.deficit).toBe(20000);
    expect(r.etf).toBe(0);
  });
  it("第24個月仍扣貸款，第25個月停止並重算每日金額", () => {
    const before = budget(base, 24),
      after = budget(base, 25);
    expect(before.loan).toBe(5000);
    expect(after.loan).toBe(0);
    expect(after.remaining - before.remaining).toBe(5000);
    expect(after.daily).toBeCloseTo(after.remaining / 30);
    expect(before.days).toBe(31);
  });
  it("四項貸款分別到期，0期貸款不扣", () => {
    const p = {
      ...base,
      loans: [
        { payment: 1000, months: 1 },
        { payment: 2000, months: 2 },
        { payment: 3000, months: 3 },
        { payment: 4000, months: 0 },
      ],
    };
    expect([1, 2, 3, 4].map((m) => budget(p, m).loan)).toEqual([
      6000, 5000, 3000, 0,
    ]);
  });
  it("閏年二月29天、一般二月28天", () => {
    expect(periodFor("2028-02", 1).days).toBe(29);
    expect(periodFor("2027-02", 1).days).toBe(28);
    expect(periodFor("2026-12", 2).period).toBe("2027-01");
  });
  it("目前月份使用臺北時區跨日", () =>
    expect(currentTaipeiMonth(new Date("2026-10-31T16:30:00Z"))).toBe(
      "2026-11",
    ));
  it("未來工作收入及支出變動後重新計算結餘、ETF及每日額", () => {
    const p = {
      ...base,
      change: { month: 3, employmentMonthly: 80000, living: 25000 },
    };
    expect(budget(p, 2).income).toBe(50000);
    const r = budget(p, 3);
    expect(r.income).toBe(80000);
    expect(r.living).toBe(25000);
    expect(r.etfTarget).toBe(8000);
    expect(r.daily).toBeCloseTo(r.remaining / 31);
  });
  it("年度摘要區分平均月額、期間總額、實際天數每日平均", () => {
    const rows = forecast(base, 12),
      annual = annualForecast(rows);
    expect(annual.map((x) => x.months)).toEqual([2, 10]);
    expect(annual[0].remaining).toBeCloseTo(
      (rows[0].remaining + rows[1].remaining) / 2,
    );
    expect(annual[0].daily).toBeCloseTo(annual[0].annualRemaining / 61);
    expect(annual.reduce((s, x) => s + x.annualRemaining, 0)).toBe(
      rows.reduce((s, x) => s + x.remaining, 0),
    );
  });
  it("旅行初始基金僅用於首個週期", () => {
    const p = { ...base, travelFund: 60000 };
    expect(budget(p, 12).travel).toBe(0);
    expect(budget(p, 13).travel).toBe(5000);
  });
});
describe("ETF 比例及可負擔性", () => {
  it.each([0, 0.1, 0.15, 0.2])("自行設定 %s 比例", (ratio) => {
    const r = budget({ ...base, etfRatio: ratio });
    expect(r.etfTarget).toBe(50000 * ratio);
    expect(r.etf).toBe(r.etfTarget);
    expect(r.etfDaily).toBeCloseTo(r.etfTarget / 30);
  });
  it("超過負擔能力明示差額，規劃投入以可負擔額上限", () => {
    const r = budget({ ...base, etfRatio: 1 });
    expect(r.etfAffordable).toBe(20000);
    expect(r.etf).toBe(20000);
    expect(r.etfGap).toBe(30000);
    expect(r.remaining).toBe(0);
  });
  it("零收入沒有最低投入標準", () => {
    const r = budget({ ...base, salary: 0 });
    expect(r.etf).toBe(0);
    expect(r.remaining).toBeLessThan(0);
  });
  it("拒絕超過100%比例", () =>
    expect(() => budget({ ...base, etfRatio: 1.01 })).toThrow());
});
describe("大型購買與分類", () => {
  it("基金抵減、必要月存及固定存款達標時間", () =>
    expect(purchaseGoal(300000, 60000, 24, 8000)).toEqual({
      gap: 240000,
      required: 10000,
      monthsToGoal: 30,
    }));
  it("固定比較金額不重複扣款", () => {
    expect(budget({ ...base, purchaseMonthly: 50000 }).remaining).toBe(
      budget({ ...base, purchaseMonthly: 5000 }).remaining,
    );
  });
  it("基金足夠與無固定儲蓄均合理處理", () => {
    expect(purchaseGoal(100, 200, 12, 0)).toEqual({
      gap: 0,
      required: 0,
      monthsToGoal: 0,
    });
    expect(purchaseGoal(100, 0, 12, 0).monthsToGoal).toBeNull();
  });
  it("期限後停止目標儲蓄，開始扣選填持有成本", () => {
    const p = { ...base, purchaseCost: 3000 };
    expect(budget(p, 60).purchase).toBe(5000);
    expect(budget(p, 61).purchase).toBe(0);
    expect(budget(p, 61).purchaseCost).toBe(3000);
  });
  it("生活費總額不虛構育兒與交通分類，環圈各項合計對帳", () => {
    const row = budget(base),
      items = allocations(base, row);
    expect(items.map((x) => x.name)).not.toContain("育兒與家庭支出");
    expect(items.find((x) => x.name === "其他生活支出（總額）")?.value).toBe(
      15000,
    );
    expect(items.reduce((s, x) => s + x.value, 0)).toBe(row.income);
  });
  it("赤字不放入環圈負值切片，總分配可大於收入", () => {
    const p = { ...base, salary: 10000 },
      row = budget(p),
      items = allocations(p, row);
    expect(items.every((x) => x.value > 0)).toBe(true);
    expect(items.reduce((s, x) => s + x.value, 0)).toBe(
      row.income + row.deficit,
    );
  });
});
describe("投資現金收入不重複計算", () => {
  it.each(["exclude", "reinvest"] as const)(
    "%s 不列可支配現金",
    (cashTreatment) =>
      expect(
        budget({ ...base, investmentCash: 120000, cashTreatment }).income,
      ).toBe(50000),
  );
  it("納入時每年12萬只加每月1萬", () => {
    const r = budget({
      ...base,
      investmentCash: 120000,
      cashTreatment: "spend",
    });
    expect(r.cashMonthly).toBe(10000);
    expect(r.income).toBe(60000);
    expect(
      forecast(
        { ...base, investmentCash: 120000, cashTreatment: "spend" },
        12,
      ).reduce((s, x) => s + x.income, 0),
    ).toBe(720000);
  });
  it("沒有資本利得或再投入報酬暗中增加收入", () => {
    expect(budget(base).income).toBe(50000);
    expect(
      budget({ ...base, investmentCash: 1e9, cashTreatment: "reinvest" })
        .cashMonthly,
    ).toBe(0);
  });
});
it.each([
  { salary: NaN },
  { living: -1 },
  { startMonth: "2026-13" },
  { purchaseMonths: 0 },
  { loans: [{ payment: 1, months: 1.5 }] },
])("無效欄位拒絕試算 %j", (patch) =>
  expect(() => budget({ ...base, ...patch })).toThrow(),
);

it("任意大型購買的持有成本不被虛構成房貸", () => {
  const p = { ...base, purchaseCost: 1000 };
  const row = budget(p, 61),
    items = allocations(p, row);
  expect(
    items.find((x) => x.name === "其他必要支出（購入後成本）")?.value,
  ).toBe(1000);
  expect(items.find((x) => x.name === "居住與貸款")).toBeUndefined();
  expect(items.reduce((sum, x) => sum + x.value, 0)).toBe(row.income);
});
