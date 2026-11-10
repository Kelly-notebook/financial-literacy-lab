import { describe, it, expect } from "vitest";
import { investment } from "./finance";
import {
  savingsComparison,
  draftIssue,
  compoundDraftIssue,
  retirementTransferIssue,
} from "./savingsComparison";
const input = { initial: 100000, monthly: 5000, annual: 0.08, months: 360 };
describe("多存一點沿用同一複利模型", () => {
  it("A完整沿用原方案，B只加月投入，額外首年4%月額正確", () => {
    const r = savingsComparison(input, 2000);
    expect(r.base).toEqual(investment(input).at(-1));
    expect(r.enhanced).toEqual(investment({ ...input, monthly: 7000 }).at(-1));
    expect(r.enhanced.principal - r.base.principal).toBe(2000 * 360);
    expect(r.enhanced.gain + r.enhanced.principal).toBeCloseTo(
      r.enhanced.value,
    );
    expect(r.additionalAssets).toBeCloseTo(r.enhanced.value - r.base.value);
    expect(r.additionalMonthlyWithdrawal).toBeCloseTo(
      (r.additionalAssets * 0.04) / 12,
    );
    expect(input.monthly).toBe(5000);
  });
  it("0額外、0報酬、0起始與0投入皆正常", () => {
    const same = savingsComparison(input, 0);
    expect(same.additionalAssets).toBe(0);
    const r = savingsComparison(
      { ...input, initial: 0, monthly: 0, annual: 0 },
      2000,
    );
    expect(r.base.value).toBe(0);
    expect(r.enhanced.value).toBe(720000);
    expect(r.enhanced.gain).toBe(0);
  });
  it("中途調整前後每月都增加，不只增加第一段", () => {
    const p = { ...input, changeMonth: 121, nextMonthly: 8000 },
      r = savingsComparison(p, 2000);
    expect(r.enhanced).toEqual(
      investment({ ...p, monthly: 7000, nextMonthly: 10000 }).at(-1),
    );
    expect(r.enhanced.principal - r.base.principal).toBe(720000);
  });
  it.each([-1, NaN, Infinity, 1e13])("無效額外投入 %s 不進入模型", (n) =>
    expect(() => savingsComparison(input, n)).toThrow(),
  );
  it("加總超過輸入上限有可處理錯誤", () =>
    expect(() => savingsComparison({ ...input, monthly: 1e12 }, 1)).toThrow());
});
describe("資料帶入使用有效數值，禁止把舊結果當新輸入", () => {
  it.each(["", "abc", "-1", "1,000,000,000,001"])(
    "無效草稿 %s 顯示原因",
    (value) =>
      expect(draftIssue({ etf: value }, [["etf", "ETF"]])).toContain(
        "請先完成或修正",
      ),
  );
  it("0與千分位有效", () => {
    expect(draftIssue({ etf: "0" }, [["etf", "ETF"]])).toBeUndefined();
    expect(draftIssue({ etf: "5,000" }, [["etf", "ETF"]])).toBeUndefined();
  });
  const values = {
    monthly: "5000",
    annual: "8",
    bank: "1.5",
    years: "30",
    initial: "0",
    assetMode: "value",
    change: "no",
  };
  it("主參數空白、超界及非整數年數不能帶入", () => {
    expect(compoundDraftIssue(values)).toBeUndefined();
    for (const patch of [
      { monthly: "" },
      { annual: "11" },
      { years: "2.5" },
      { initial: "-1" },
    ])
      expect(compoundDraftIssue({ ...values, ...patch })).toBeTruthy();
  });
  it("只驗證有效的直接市值或持股來源及中途設定", () => {
    expect(
      compoundDraftIssue({
        ...values,
        assetMode: "shares",
        initial: "bad",
        holdingCount: "1",
        shares1: "0",
        price1: "100",
      }),
    ).toBeUndefined();
    expect(
      compoundDraftIssue({
        ...values,
        change: "yes",
        changeYear: "",
        nextMonthly: "8000",
      }),
    ).toBeTruthy();
  });
  it.each([undefined, NaN, Infinity, -1, 1e12 + 1])(
    "無效或超大期末資產 %s 禁止帶入",
    (value) => expect(retirementTransferIssue(value)).toBeTruthy(),
  );
  it("零與上限可帶入，來源資產不是單獨收益", () => {
    expect(retirementTransferIssue(0)).toBeUndefined();
    expect(retirementTransferIssue(1e12)).toBeUndefined();
    expect(savingsComparison(input, 2000).base.value).toBeGreaterThan(
      savingsComparison(input, 2000).base.gain,
    );
  });
});
