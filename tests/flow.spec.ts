import { test, expect, type Page } from "@playwright/test";
async function open(page: Page, title: string) {
  await page.goto("/");
  await page.getByRole("button", { name: new RegExp(title) }).click();
  return page.locator(".workspace:visible");
}
async function nav(page: Page, title: string) {
  await page.getByRole("button", { name: title, exact: true }).click();
  return page.locator(".workspace:visible");
}
test("家庭ETF取代複利月投入、設30年，保留其他參數且不自動同步", async ({
  page,
}) => {
  let ui = await open(page, "長期複利");
  await ui.getByLabel("假設年化總報酬率", { exact: true }).fill("6");
  await ui.getByLabel("現有資產起始市值", { exact: true }).fill("100000");
  await ui.getByLabel("投資年數", { exact: true }).fill("10");
  await ui.getByText("進階設定", { exact: true }).click();
  await ui.getByLabel("中途調整每月投入").check();
  await ui.getByLabel("調整後每月投入", { exact: true }).fill("8000");
  ui = await nav(page, "家庭預算");
  await ui.getByLabel("每月固定實領薪資").fill("100000");
  await ui.getByText("家庭收支健檢與投資規劃", { exact: true }).click();
  await ui.getByLabel("每月預計投入 ETF 金額").fill("5000");
  await ui
    .getByRole("button", { name: "帶入長期複利試算", exact: true })
    .click();
  ui = page.locator(".workspace:visible");
  await expect(
    page.getByRole("heading", { name: "長期複利", exact: true }),
  ).toBeVisible();
  await expect(ui.getByLabel("每月投入金額", { exact: true })).toHaveValue(
    "5,000",
  );
  await expect(ui.getByLabel("投資年數", { exact: true })).toHaveValue("30");
  await expect(ui.getByLabel("假設年化總報酬率", { exact: true })).toHaveValue(
    "6",
  );
  await expect(ui.getByLabel("現有資產起始市值", { exact: true })).toHaveValue(
    "100,000",
  );
  await expect(ui.getByLabel("中途調整每月投入")).not.toBeChecked();
  await expect(
    ui.getByRole("status").filter({ hasText: "取代原月投入" }),
  ).toBeVisible();
  await ui.getByLabel("每月投入金額", { exact: true }).fill("6000");
  ui = await nav(page, "家庭預算");
  await ui.getByLabel("每月預計投入 ETF 金額").fill("7000");
  ui = await nav(page, "長期複利");
  await expect(ui.getByLabel("每月投入金額", { exact: true })).toHaveValue(
    "6,000",
  );
  ui = await nav(page, "家庭預算");
  await ui
    .getByRole("button", { name: "帶入長期複利試算", exact: true })
    .click();
  await expect(
    page
      .locator(".workspace:visible")
      .getByLabel("每月投入金額", { exact: true }),
  ).toHaveValue("7,000");
});
test("完整A/B期末資產分別帶入退休，其他提領參數保留", async ({ page }) => {
  let ui = await open(page, "退休提領");
  await ui.getByLabel("首年／當期資產提領率", { exact: true }).fill("3");
  await ui.getByLabel("假設年化名目總報酬", { exact: true }).fill("1");
  await ui.getByText("進階設定", { exact: true }).click();
  await ui.getByLabel("模擬期間", { exact: true }).fill("20");
  await ui.getByLabel("試算方向", { exact: true }).selectOption("need");
  ui = await nav(page, "長期複利");
  await ui.getByLabel("現有資產起始市值", { exact: true }).fill("100000");
  await ui.getByLabel("假設年化總報酬率", { exact: true }).fill("0");
  await expect(
    ui.getByText("多存一點，未來差多少？", { exact: true }).locator(".."),
  ).not.toHaveAttribute("open", "");
  await ui
    .getByRole("button", { name: "將期末資產帶入退休提領", exact: true })
    .click();
  ui = page.locator(".workspace:visible");
  await expect(ui.getByLabel("現有資產起始市值", { exact: true })).toHaveValue(
    "1,900,000",
  );
  await expect(ui.getByLabel("試算方向", { exact: true })).toHaveValue(
    "assets",
  );
  await expect(
    ui.getByLabel("首年／當期資產提領率", { exact: true }),
  ).toHaveValue("3");
  await expect(
    ui.getByLabel("假設年化名目總報酬", { exact: true }),
  ).toHaveValue("1");
  await expect(ui.getByLabel("模擬期間", { exact: true })).toHaveValue("20");
  await expect(ui.locator(".retirement-source")).toContainText(
    "已帶入長期複利的期末資產，作為退休起始市值。",
  );
  ui = await nav(page, "長期複利");
  await ui.getByText("多存一點，未來差多少？", { exact: true }).click();
  await expect(ui.getByLabel("每月額外增加投入金額")).toHaveValue("2,000");
  const rows = ui.locator(".savings-comparison tbody tr");
  await expect(rows.nth(0).locator("td")).toHaveText([
    "原方案 A",
    "5,000",
    "1,900,000",
    "1,900,000",
    "0",
  ]);
  await expect(rows.nth(1).locator("td")).toHaveText([
    "增加投入 B",
    "7,000",
    "2,620,000",
    "2,620,000",
    "0",
  ]);
  await expect(
    ui.getByText("額外資產首年 4% 提領的月平均", { exact: true }).locator(".."),
  ).toContainText("2,400");
  await ui
    .getByRole("button", { name: "以增加投入方案試算退休", exact: true })
    .click();
  ui = page.locator(".workspace:visible");
  await expect(ui.getByLabel("現有資產起始市值", { exact: true })).toHaveValue(
    "2,620,000",
  );
  await expect(ui.locator(".retirement-source")).toContainText(
    "增加投入方案 B",
  );
  await ui.getByLabel("現有資產起始市值", { exact: true }).fill("123456");
  ui = await nav(page, "長期複利");
  await ui.getByLabel("每月額外增加投入金額").fill("3000");
  ui = await nav(page, "退休提領");
  await expect(ui.getByLabel("現有資產起始市值", { exact: true })).toHaveValue(
    "123,456",
  );
  ui = await nav(page, "長期複利");
  await ui
    .getByRole("button", { name: "以原方案試算退休", exact: true })
    .click();
  await expect(
    page
      .locator(".workspace:visible")
      .getByLabel("現有資產起始市值", { exact: true }),
  ).toHaveValue("1,900,000");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("0元可帶入，空白無效及大額禁止帶入但保留圖表與表單", async ({ page }) => {
  let ui = await open(page, "家庭預算");
  await ui.getByLabel("每月固定實領薪資").fill("100000");
  await ui.getByText("家庭收支健檢與投資規劃", { exact: true }).click();
  const etf = ui.getByLabel("每月預計投入 ETF 金額"),
    button = ui.getByRole("button", { name: "帶入長期複利試算", exact: true });
  for (const value of ["", "-1", "abc", "1000000000001"]) {
    await etf.fill(value);
    await expect(button).toBeDisabled();
    await expect(ui.locator(".hero-result")).toBeVisible();
  }
  await etf.fill("0");
  await button.click();
  ui = page.locator(".workspace:visible");
  await expect(ui.getByLabel("每月投入金額", { exact: true })).toHaveValue("0");
  await ui
    .getByRole("button", { name: "將期末資產帶入退休提領", exact: true })
    .click();
  await expect(
    page
      .locator(".workspace:visible")
      .getByLabel("現有資產起始市值", { exact: true }),
  ).toHaveValue("0");
  ui = await nav(page, "長期複利");
  await ui.getByText("展開詳細分析", { exact: true }).click();
  const transfer = ui.getByRole("button", {
    name: "將期末資產帶入退休提領",
    exact: true,
  });
  await ui.getByLabel("每月投入金額", { exact: true }).fill("");
  await expect(transfer).toBeDisabled();
  await expect(ui.getByLabel("每月投入金額", { exact: true })).toBeVisible();
  await expect(ui.locator("[data-axis-mode]")).toBeVisible();
  await ui.getByLabel("每月投入金額", { exact: true }).fill("1000000000000");
  await expect(transfer).toBeDisabled();
  await expect(
    ui.getByText(/期末資產無效或超過退休起始市值上限/).first(),
  ).toBeVisible();
  await ui.getByText("多存一點，未來差多少？", { exact: true }).click();
  await expect(
    ui.getByRole("button", { name: "以增加投入方案試算退休", exact: true }),
  ).toHaveCount(0);
  await expect(ui.locator(".hero-result")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
