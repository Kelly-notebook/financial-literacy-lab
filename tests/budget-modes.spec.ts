import { test, expect, type Page } from "@playwright/test";
async function open(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /家庭預算/ }).click();
  return page.locator(".workspace:visible");
}
test("自動模式精確跨120／240萬、月薪年薪等價、手動保留及重新自動、暫存", async ({
  page,
}) => {
  let ui = await open(page);
  const control = ui.getByLabel("參考預算模式", { exact: true }),
    notice = ui.locator(".budget-mode");
  await expect(control).toHaveValue("auto");
  await expect(control.locator("option")).toHaveCount(5);
  await expect(notice).toHaveAttribute("data-mode", "classic");
  await expect(notice).toContainText("資料不足");
  await ui.getByLabel("收入模式", { exact: true }).selectOption("annual");
  const income = ui.getByLabel("全年實領總收入（已含獎金）", { exact: true });
  await income.fill("1199999");
  await ui.getByText("家庭收支健檢與投資規劃", { exact: true }).click();
  for (const [amount, mode, ratios, target] of [
    ["1199999", "basic", [55, 25, 20], "54,999.95"],
    ["1200000", "balanced", [45, 30, 25], "45,000"],
    ["2399999", "balanced", [45, 30, 25], "89,999.96"],
    ["2400000", "quality", [35, 35, 30], "70,000"],
    ["3000000", "quality", [35, 35, 30], "87,500"],
  ] as const) {
    await income.fill(amount);
    await expect(notice).toHaveAttribute("data-mode", mode);
    for (const [i, id] of ["needs", "wants", "savings"].entries())
      await expect(ui.locator(`[data-group="${id}"]`)).toContainText(
        `參考目標 ${ratios[i]}%`,
      );
    await expect(ui.locator('[data-group="needs"]')).toContainText(
      `每月參考金額：NT$ ${target}`,
    );
  }
  for (const manual of ["classic", "basic", "balanced", "quality"]) {
    await control.selectOption(manual);
    await income.fill("600000");
    await expect(notice).toHaveAttribute("data-mode", manual);
    await income.fill("3000000");
    await expect(notice).toHaveAttribute("data-mode", manual);
    await expect(control).toHaveValue(manual);
  }
  await control.selectOption("balanced");
  await page.reload();
  ui = page.locator(".workspace:visible");
  await page.getByRole("button", { name: /家庭預算/ }).click();
  await expect(
    page.locator(".workspace:visible").getByLabel("參考預算模式"),
  ).toHaveValue("balanced");
  ui = page.locator(".workspace:visible");
  await ui.getByLabel("參考預算模式").selectOption("auto");
  await expect(ui.locator(".budget-mode")).toHaveAttribute(
    "data-mode",
    "quality",
  );
  await ui.getByLabel("收入模式").selectOption("monthly");
  await expect(ui.getByLabel("每月固定實領薪資")).toHaveValue("250,000");
  await expect(ui.locator(".budget-mode")).toHaveAttribute(
    "data-mode",
    "quality",
  );
  await ui.getByLabel("每月固定實領薪資").fill("90000");
  await ui.getByLabel("年度獎金（選填）").fill("120000");
  await expect(ui.locator(".budget-mode")).toHaveAttribute(
    "data-mode",
    "balanced",
  );
  await expect(ui.locator(".budget-mode")).toContainText("1,200,000");
  await ui.getByLabel("每月固定實領薪資").fill("");
  await expect(ui.locator(".budget-mode")).toHaveAttribute(
    "data-mode",
    "classic",
  );
  await expect(ui.locator(".budget-mode")).toContainText("暫用經典");
  await ui.getByLabel("參考預算模式").selectOption("quality");
  await expect(ui.locator(".budget-mode")).toHaveAttribute(
    "data-mode",
    "quality",
  );
  await expect(ui.locator(".budget-mode")).toContainText("保留手動模式");
  await ui.getByLabel("參考預算模式").selectOption("auto");
  await ui.getByLabel("年度獎金（選填）").fill("0");
  for (const [salary, mode] of [
    ["200000", "quality"],
    ["199999", "balanced"],
    ["99999", "basic"],
  ]) {
    await ui.getByLabel("每月固定實領薪資").fill(salary);
    await expect(ui.locator(".budget-mode")).toHaveAttribute("data-mode", mode);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("300萬家庭品質消費不機械減支，三份Prompt完整保留資料與模式並區分現金流及資產", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (t: string) => {
          (window as unknown as { copied: string }).copied = t;
        },
      },
    }),
  );
  const ui = await open(page);
  await ui.getByLabel("收入模式").selectOption("annual");
  await ui.getByLabel("全年實領總收入（已含獎金）").fill("3000000");
  await ui.getByRole("button", { name: "展開生活費明細", exact: true }).click();
  await ui.getByLabel("治裝費", { exact: true }).fill("8000");
  await ui.getByLabel("餐廳與日常娛樂", { exact: true }).fill("10000");
  await ui.getByLabel("我已準備 3～6 個月必要生活支出的緊急預備金。").check();
  await ui.getByLabel("我已開始為退休儲蓄或投資，並定期檢視規劃。").check();
  await ui.getByText("家庭收支健檢與投資規劃", { exact: true }).click();
  await ui.getByLabel("每月預計投入 ETF 金額").fill("80000");
  await expect(ui.locator(".budget-mode")).toHaveAttribute(
    "data-mode",
    "quality",
  );
  await expect(ui.locator(".health-advice li")).toHaveCount(0);
  await expect(ui.locator('[data-group="savings"]')).toHaveAttribute(
    "data-tone",
    "normal",
  );
  await expect(ui.locator('[data-group="wants"]')).toHaveAttribute(
    "data-tone",
    "normal",
  );
  await expect(ui).toContainText("不因細項比例或非必要分類要求減支");
  for (const title of ["財務健康檢查", "消費與預算調整", "ETF 投資規劃"]) {
    await ui
      .getByRole("button", { name: `複製 Prompt｜${title}`, exact: true })
      .click();
    const t = await page.evaluate(
      () => (window as unknown as { copied: string }).copied,
    );
    expect(t).toContain("品質型 35／35／30");
    expect(t).toContain("治裝費：NT$ 8,000");
    expect(t).toContain("餐廳與日常娛樂：NT$ 10,000");
    expect(t).toContain("全年稅後工作總收入：NT$ 3,000,000");
    expect(t).toContain("每月參考金額 NT$ 87,500");
    expect(t).toContain("不是實際累積現金資產");
    expect(t).toContain("沒有其他財務問題時機械式要求削減1,500元");
    expect(t).toContain("150～250");
    expect(t.split("【完整家庭收支摘要｜新臺幣】")).toHaveLength(2);
  }
  await ui.getByLabel("參考預算模式").selectOption("classic");
  await ui.getByLabel("每月預計投入 ETF 金額").fill("200000");
  await ui
    .getByRole("button", { name: "複製 Prompt｜財務健康檢查", exact: true })
    .click();
  const t = await page.evaluate(
    () => (window as unknown as { copied: string }).copied,
  );
  expect(t).toContain("手動選擇；目前採用 經典 50／30／20");
  expect(t).toContain("ETF 投資：NT$ 200,000");
  await expect(ui.locator('[data-group="savings"]')).toHaveAttribute(
    "data-tone",
    "normal",
  );
});
test("其他收入與現金股息只計一次，股息再投入不推高推薦級距", async ({
  page,
}) => {
  const ui = await open(page);
  await ui.getByLabel("每月固定實領薪資").fill("90000");
  await ui.getByLabel("其他每月固定收入").fill("5000");
  await expect(ui.locator(".budget-mode")).toHaveAttribute(
    "data-mode",
    "basic",
  );
  await ui.getByText("投資現金收入", { exact: true }).click();
  await ui.getByLabel("每年預估股息／投資現金收入").fill("60000");
  await ui.getByLabel("投資現金收入處理方式").selectOption("spend");
  await expect(ui.locator(".budget-mode")).toHaveAttribute(
    "data-mode",
    "balanced",
  );
  await expect(ui.locator(".budget-mode")).toContainText("1,200,000");
  await ui.getByLabel("投資現金收入處理方式").selectOption("reinvest");
  await expect(ui.locator(".budget-mode")).toHaveAttribute(
    "data-mode",
    "basic",
  );
  await expect(ui.locator(".budget-mode")).toContainText("1,140,000");
});

test("參考卡片整張粉紅／黃色樣式及手動、自動切換立即更新", async ({ page }) => {
  const ui = await open(page);
  await ui.getByLabel("每月固定實領薪資").fill("100000");
  await ui.getByLabel("每月必要生活費總額", { exact: true }).fill("47630");
  await ui.getByLabel("每月非必要消費總額", { exact: true }).fill("25650");
  await ui.getByText("大型購買與旅行目標", { exact: true }).click();
  await ui.getByLabel("預計購買總金額", { exact: true }).fill("0");
  await ui.getByLabel("每次旅行預算", { exact: true }).fill("0");
  await ui.getByText("家庭收支健檢與投資規劃", { exact: true }).click();
  await ui.getByLabel("每月預計投入 ETF 金額").fill("5500");
  const needs = ui.locator('[data-group="needs"]'),
    wants = ui.locator('[data-group="wants"]'),
    savings = ui.locator('[data-group="savings"]');
  await expect(ui.locator(".budget-mode")).toHaveAttribute(
    "data-mode",
    "balanced",
  );
  await expect(needs).toContainText("47.63%");
  await expect(wants).toContainText("25.65%");
  await expect(savings).toContainText("5.5%");
  await expect(needs).toHaveAttribute("data-tone", "pink");
  await expect(wants).toHaveAttribute("data-tone", "normal");
  await expect(savings).toHaveAttribute("data-tone", "yellow");
  expect(
    await needs.evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(255, 240, 243)");
  expect(
    await savings.evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(255, 248, 220)");
  // Integrate the reported case through the real Budget -> HouseholdHealth wiring.
  await ui.getByLabel("每月必要生活費總額", { exact: true }).fill("68310");
  await ui.getByLabel("每月非必要消費總額", { exact: true }).fill("25850");
  await ui.getByLabel("每月預計投入 ETF 金額").fill("5540");
  await expect(needs.locator("strong")).toHaveText("68.31%");
  await expect(wants.locator("strong")).toHaveText("25.85%");
  await expect(savings.locator("strong")).toHaveText("5.54%");
  await expect(needs).toHaveAttribute("data-tone", "pink");
  await expect(wants).toHaveAttribute("data-tone", "normal");
  await expect(savings).toHaveAttribute("data-tone", "yellow");
  await ui.getByLabel("每月預計投入 ETF 金額").fill("6000");
  await expect(needs).toHaveAttribute("data-tone", "pink");
  await ui.getByLabel("每月必要生活費總額", { exact: true }).fill("47630");
  await ui.getByLabel("每月非必要消費總額", { exact: true }).fill("25650");
  await ui.getByLabel("每月預計投入 ETF 金額").fill("5500");
  await ui.getByLabel("參考預算模式").selectOption("basic");
  await expect(needs).toHaveAttribute("data-tone", "normal");
  await expect(wants).toHaveAttribute("data-tone", "pink");
  expect(
    await wants.evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(255, 240, 243)");
  await ui.getByLabel("參考預算模式").selectOption("auto");
  await expect(needs).toHaveAttribute("data-tone", "pink");
  await expect(wants).toHaveAttribute("data-tone", "normal");
  await ui.getByLabel("每月固定實領薪資").fill("99000");
  await expect(ui.locator(".budget-mode")).toHaveAttribute(
    "data-mode",
    "basic",
  );
  await expect(needs).toHaveAttribute("data-tone", "normal");
  await expect(wants).toHaveAttribute("data-tone", "pink");
  await ui.getByLabel("每月固定實領薪資").fill("100000");
  for (const [amount, tone] of [
    ["9990", "yellow"],
    ["10000", "normal"],
    ["25000", "normal"],
  ]) {
    await ui.getByLabel("每月預計投入 ETF 金額").fill(amount);
    await expect(savings).toHaveAttribute("data-tone", tone);
  }
  await ui.getByLabel("每月必要生活費總額", { exact: true }).fill("45000");
  await expect(needs).toHaveAttribute("data-tone", "normal");
  await ui.getByLabel("每月非必要消費總額", { exact: true }).fill("30000");
  await expect(wants).toHaveAttribute("data-tone", "normal");
});
