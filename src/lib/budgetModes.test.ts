import { describe, it, expect } from "vitest";
import {
  budgetModes,
  recommendBudgetMode,
  selectedBudgetMode,
} from "./budgetModes";
import { groupState, healthCheck, detailLimits } from "./health";
import { sanitiseBudgetValues } from "./budgetStorage";
import { householdSummary } from "./householdSummary";
import {
  coachPrompt,
  commonCoachRequirements,
  coachTopics,
} from "./coachPrompts";
const annual = (income: string) => ({
  budgetMode: "auto",
  mode: "annual",
  annualIncome: income,
  salary: "999999",
  annualBonus: "999999",
  otherIncome: "0",
  cashTreatment: "exclude",
  investmentCash: "0",
});
describe("收入自動預算模式", () => {
  it.each([
    [1199999.99, "basic"],
    [1200000, "balanced"],
    [2399999.99, "balanced"],
    [2400000, "quality"],
    [3000000, "quality"],
  ] as const)("年收入%s套用%s，邊界無重疊", (n, mode) => {
    expect(recommendBudgetMode(n)).toBe(mode);
    const r = selectedBudgetMode(annual(String(n)), n / 12);
    expect(r.mode).toBe(mode);
    expect(r.annualIncome).toBeCloseTo(n);
    expect(r.preset).toEqual(budgetModes[mode]);
  });
  it("月薪加獎金、其他收入及可花股息沿用一次，年薪不另加隱藏月薪與獎金", () => {
    const v = {
      ...annual("0"),
      mode: "monthly",
      salary: "80000",
      annualBonus: "120000",
      otherIncome: "10000",
      cashTreatment: "spend",
      investmentCash: "120000",
    };
    expect(selectedBudgetMode(v, 110000).annualIncome).toBe(1320000);
    expect(
      selectedBudgetMode({ ...v, cashTreatment: "reinvest" }, 100000)
        .annualIncome,
    ).toBe(1200000);
    expect(
      selectedBudgetMode(
        {
          ...v,
          mode: "annual",
          annualIncome: "2400000",
          otherIncome: "0",
          cashTreatment: "exclude",
        },
        200000,
      ).annualIncome,
    ).toBe(2400000);
  });
  it("手動模式不被收入跨門檻覆寫，自動再選才變；參考金額獨立更新", () => {
    for (const budgetMode of Object.keys(budgetModes))
      for (const n of [600000, 1200000, 3000000]) {
        const r = selectedBudgetMode(
          { ...annual(String(n)), budgetMode },
          n / 12,
        );
        expect(r.mode).toBe(budgetMode);
        expect(r.monthlyIncome).toBe(n / 12);
      }
    expect(
      selectedBudgetMode({ ...annual("3000000"), budgetMode: "auto" }, 250000)
        .mode,
    ).toBe("quality");
  });
  it.each(["", "abc", "-1", "1,000,000,000,001"])(
    "無效草稿%s即使有舊收入也回經典，手動選擇仍保留",
    (annualIncome) => {
      const v = annual(annualIncome);
      expect(selectedBudgetMode(v, 250000).mode).toBe("classic");
      expect(selectedBudgetMode(v, 250000).annualIncome).toBeUndefined();
      expect(
        selectedBudgetMode({ ...v, budgetMode: "quality" }, 250000).mode,
      ).toBe("quality");
    },
  );
  it("零收入、缺結果及收入和舊快照不一致不使用舊推薦", () => {
    expect(selectedBudgetMode(annual("0"), 0).mode).toBe("classic");
    expect(selectedBudgetMode(annual("3000000"), undefined).mode).toBe(
      "classic",
    );
    expect(selectedBudgetMode(annual("3000000"), 100000).mode).toBe("classic");
  });
  it("只有活躍收入草稿參與驗證，未納入股息及隱藏月薪不影響", () => {
    const v = {
      ...annual("2400000"),
      salary: "bad",
      annualBonus: "",
      investmentCash: "bad",
    };
    expect(selectedBudgetMode(v, 200000).mode).toBe("quality");
    expect(
      selectedBudgetMode({ ...v, cashTreatment: "spend" }, 200000).mode,
    ).toBe("classic");
  });
  it("每個模式三類比例加總100，金額分母一致，不改分類或扣款", () => {
    for (const mode of Object.keys(
      budgetModes,
    ) as (keyof typeof budgetModes)[]) {
      const p = budgetModes[mode];
      expect(p.needs + p.wants + p.savings).toBe(100);
      const r = healthCheck(
        [{ id: "food", name: "伙食", value: 40000, color: "", group: "needs" }],
        250000,
        {},
        detailLimits,
        mode,
      );
      expect(r.groups.map((g) => g.reference)).toEqual([
        p.needs,
        p.wants,
        p.savings,
      ]);
      expect(r.groups.reduce((a, g) => a + g.referenceAmount, 0)).toBe(250000);
      expect(r.total).toBe(40000);
    }
  });
  it("低於消費或高於儲蓄無異常，比例差本身不是減支理由；赤字優先", () => {
    expect(groupState("wants", 10, false, "quality").tone).toBe("normal");
    expect(groupState("savings", 60, false, "quality").tone).toBe("green");
    expect(groupState("wants", 40, false, "quality").tone).toBe("watch");
    expect(groupState("wants", 40, false, "quality").message).toContain(
      "不是財務風險或減支理由",
    );
    expect(groupState("wants", 40, true, "quality").tone).toBe("pink");
    expect(groupState("savings", 60, true, "quality").tone).toBe("normal");
  });
  it("模式可以安全暫存，舊資料預設auto，非法選項不能污染", () => {
    const defaults = { ...annual("3000000"), budgetMode: "auto" };
    expect(
      sanitiseBudgetValues({ ...defaults, budgetMode: "quality" }, defaults)
        .budgetMode,
    ).toBe("quality");
    expect(
      sanitiseBudgetValues({ annualIncome: "3000000" }, defaults).budgetMode,
    ).toBe("auto");
    expect(
      sanitiseBudgetValues({ ...defaults, budgetMode: "intruder" }, defaults)
        .budgetMode,
    ).toBe("auto");
  });
  it("完整摘要及各主題都保留模式與健康優先原則，不把結餘當現金資產", () => {
    const s = householdSummary(annual("3000000"));
    expect(s).toContain("暫用經典");
    for (const t of coachTopics) {
      const prompt = coachPrompt(s, t.id);
      expect(prompt.split(s)).toHaveLength(2);
      expect(prompt).toContain("生活品質與消費偏好");
      expect(prompt).toContain("不是實際累積現金資產");
      expect(prompt).toContain("沒有其他財務問題時機械式要求削減1,500元");
      expect(prompt.endsWith(commonCoachRequirements)).toBe(true);
    }
  });
});
