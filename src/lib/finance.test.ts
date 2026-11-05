import { describe, expect, it } from "vitest";
import {
  investment,
  goalMonthly,
  retirement,
  requiredRetirement,
  monthlyRate,
  sequenceReturns,
  settleWithdrawal,
} from "./finance";
const last = <T>(a: T[]) => a.at(-1)!;
const retire = {
  initial: 1000000,
  rate: 0.04,
  annual: 0,
  inflation: 0,
  years: 30,
  age: 60,
  strategy: "real" as const,
};
describe("投資與倒推", () => {
  it("零報酬目標每月 1000，本金 120000", () => {
    expect(goalMonthly(120000, 0, 0, 120)).toBe(1000);
    expect(
      last(investment({ initial: 0, monthly: 1000, annual: 0, months: 120 })),
    ).toMatchObject({ value: 120000, principal: 120000, gain: 0 });
  });
  it("現有資產與新投入分開計入", () =>
    expect(
      last(
        investment({ initial: 100000, monthly: 1000, annual: 0, months: 120 }),
      ).value,
    ).toBe(220000));
  it("已達標或自然增值足夠時無需投入", () => {
    expect(goalMonthly(100000, 100000, 0, 120)).toBe(0);
    expect(goalMonthly(120000, 100000, 0.1, 120)).toBe(0);
  });
  it.each([0, 0.005, 0.04, 0.1])("倒推整元回填達標 R=%s", (r) => {
    const monthly = goalMonthly(1000000, 12345, r, 120);
    expect(
      last(investment({ initial: 12345, monthly, annual: r, months: 120 }))
        .value,
    ).toBeGreaterThanOrEqual(1000000 - 1e-6);
  });
  it("兩階段第25月才變更", () =>
    expect(
      last(
        investment({
          initial: 10000,
          monthly: 3000,
          annual: 0.04,
          months: 120,
          changeMonth: 25,
          nextMonthly: 8000,
        }),
      ).principal,
    ).toBe(10000 + 24 * 3000 + 96 * 8000));
  it("兩階段倒推回填達標", () => {
    const second = goalMonthly(1000000, 0, 0.04, 120, {
      months: 24,
      monthly: 3000,
    });
    expect(
      last(
        investment({
          initial: 0,
          monthly: 3000,
          annual: 0.04,
          months: 120,
          changeMonth: 25,
          nextMonthly: second,
        }),
      ).value,
    ).toBeGreaterThanOrEqual(1e6 - 1e-6);
  });
  it("第一階段足夠則第二階段為零", () =>
    expect(goalMonthly(10000, 0, 0, 120, { months: 24, monthly: 3000 })).toBe(
      0,
    ));
  it("銀行與 ETF 同條件曲線重合", () => {
    const p = { initial: 0, monthly: 5000, annual: 0, months: 360 };
    expect(investment(p)).toEqual(investment({ ...p, annual: 0 }));
  });
  it("晚10年只有20年投入，起始資產仍持續增值", () => {
    const r = last(
      investment({
        initial: 100000,
        monthly: 5000,
        annual: 0.04,
        months: 360,
        delayMonths: 120,
      }),
    );
    expect(r.principal).toBe(1300000);
    expect(r.value).toBeGreaterThan(r.principal);
  });
  it("有效年化換算正確", () =>
    expect((1 + monthlyRate(0.04)) ** 12).toBeCloseTo(1.04, 12));
  it.each([NaN, Infinity, -1, 1e15])("拒絕非法金額 %s", (v) =>
    expect(() =>
      investment({ initial: v, monthly: 1, annual: 0, months: 12 }),
    ).toThrow(),
  );
  it("拒絕零月數、超界報酬及無效兩階段", () => {
    expect(() =>
      investment({ initial: 0, monthly: 1, annual: 0, months: 0 }),
    ).toThrow();
    expect(() => monthlyRate(0.11)).toThrow();
    expect(() =>
      goalMonthly(1000, 0, 0, 12, { months: 12, monthly: 1 }),
    ).toThrow();
  });
});
describe("退休提領", () => {
  it("千萬4%首年40萬，第二年通膨增加至408000", () => {
    const r = retirement({ ...retire, initial: 1e7, inflation: 0.02 });
    expect(r[0].withdrawal).toBe(400000);
    expect(r[0].withdrawal / 12).toBeCloseTo(33333.333);
    expect(r[1].demand).toBe(408000);
  });
  it("固定名目零報酬第10年歸零且不負值", () => {
    const r = retirement({ ...retire, rate: 0.1, strategy: "nominal" });
    expect(r[9].balance).toBe(0);
    expect(r.every((x) => x.balance >= 0)).toBe(true);
    expect(r[9].exhausted).toBe(true);
  });
  it("提領不足僅領實有資產", () => {
    const r = retirement({
      ...retire,
      initial: 100000,
      rate: 0.1,
      returns: [-1, ...Array(29).fill(0)],
    });
    expect(r[0].withdrawal).toBe(10000);
    expect(r[1].unmet).toBe(true);
    expect(r[1].withdrawal).toBe(0);
  });
  it("當期比例第二年領38400，不套通膨", () => {
    const r = retirement({
      ...retire,
      strategy: "proportional",
      inflation: 0.02,
    });
    expect(r[0].withdrawal).toBe(40000);
    expect(r[0].balance).toBe(960000);
    expect(r[1].withdrawal).toBe(38400);
  });
  it("同報酬集合反轉順序有不同結果", () => {
    const returns = sequenceReturns(30);
    const a = retirement({ ...retire, returns }),
      b = retirement({ ...retire, returns: [...returns].reverse() });
    expect(a[9].balance).not.toBe(b[9].balance);
    expect(a.find((x) => x.unmet)?.year).not.toBe(b.find((x) => x.unmet)?.year);
  });
  it("每月缺口30000、4%需要900萬", () =>
    expect(requiredRetirement(30000, 0.04)).toBe(9000000));
  it("拒絕零提領率反推", () =>
    expect(() => requiredRetirement(30000, 0)).toThrow());
  it("實質價值102萬折現為100萬", () =>
    expect(
      retirement({
        ...retire,
        initial: 1e6,
        rate: 0,
        annual: 0.02,
        inflation: 0.02,
      })[0].realBalance,
    ).toBeCloseTo(1e6));
  it("拒絕低於-100%的年度報酬", () =>
    expect(() =>
      retirement({ ...retire, returns: Array(30).fill(-1.1) }),
    ).toThrow());
});

it("首年需求12萬但僅10萬資產，只能提領10萬並標示不足", () => {
  expect(settleWithdrawal(100000, 120000)).toEqual({
    withdrawal: 100000,
    unmet: true,
  });
});
