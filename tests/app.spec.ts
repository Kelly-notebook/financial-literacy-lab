import { test, expect } from "@playwright/test";
async function openTool(page: import("@playwright/test").Page, title: string) {
  await page.goto("/");
  await page.getByRole("button", { name: new RegExp(title) }).click();
}
test("首頁與四工具在手機及桌機皆無水平溢出", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /未來的生活/ })).toBeVisible();
  for (const title of ["目標倒推", "長期複利", "家庭預算", "退休提領"]) {
    await page.getByRole("button", { name: new RegExp(title) }).click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "所有工具", exact: true }).click();
  }
});
test("零報酬目標即時更新、展開不重設、切頁保留資料", async ({ page }) => {
  await openTool(page, "目標倒推");
  await page
    .locator(".workspace:visible")
    .getByLabel("目標資產", { exact: true })
    .fill("120000");
  await page
    .locator(".workspace:visible")
    .getByLabel("假設年化總報酬率", { exact: true })
    .fill("0");
  const results = page.getByRole("region", { name: "目標倒推結果" });
  await expect(results.getByText("1,000元", { exact: true })).toBeVisible();
  await page
    .locator(".workspace:visible")
    .getByText("展開詳細分析", { exact: true })
    .click();
  await expect(
    page.locator(".workspace:visible").getByLabel("目標資產", { exact: true }),
  ).toHaveValue("120000");
  await expect(
    page.locator(".workspace:visible").getByRole("table").first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "長期複利", exact: true }).click();
  await page.getByRole("button", { name: "目標倒推", exact: true }).click();
  await expect(
    page.locator(".workspace:visible").getByLabel("目標資產", { exact: true }),
  ).toHaveValue("120000");
});
test("非法與空值顯示錯誤，不出現 NaN/Infinity", async ({ page }) => {
  await openTool(page, "目標倒推");
  await page
    .locator(".workspace:visible")
    .getByLabel("目標資產", { exact: true })
    .fill("");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/NaN|Infinity/);
  await page
    .locator(".workspace:visible")
    .getByLabel("目標資產", { exact: true })
    .fill("100000000000000");
  await expect(page.getByRole("alert")).toBeVisible();
  await page
    .locator(".workspace:visible")
    .getByRole("button", { name: "重設示範值", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
test("家庭獎金分列、赤字與貸款到期", async ({ page }) => {
  await openTool(page, "家庭預算");
  await page
    .locator(".workspace:visible")
    .getByLabel("每月固定實領薪資", { exact: true })
    .fill("10000");
  await expect(
    page
      .locator(".workspace:visible")
      .getByText("每月預算缺口", { exact: true }),
  ).toBeVisible();
  await page
    .locator(".workspace:visible")
    .getByLabel("收入模式")
    .selectOption("annual");
  await page
    .locator(".workspace:visible")
    .getByLabel("每月固定實領薪資", { exact: true })
    .fill("100000");
  await expect(
    page
      .locator(".workspace:visible")
      .getByText("年度非固定收入", { exact: true }),
  ).toBeVisible();
  await page
    .locator(".workspace:visible")
    .getByText("房貸與其他貸款", { exact: true })
    .click();
  await page
    .locator(".workspace:visible")
    .getByLabel("信貸／軍貸月付額")
    .fill("5000");
  await page
    .locator(".workspace:visible")
    .getByText("展開詳細分析", { exact: true })
    .click();
  await expect(
    page
      .locator(".workspace:visible")
      .getByText("第 25 個月起", { exact: true }),
  ).toBeVisible();
});
test("退休策略切換、圖表與明細", async ({ page }) => {
  await openTool(page, "退休提領");
  await expect(
    page.locator(".workspace:visible").getByText("400,000元", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("提領策略", { exact: true })
    .selectOption("proportional");
  await expect(
    page.locator(".workspace:visible").getByText(/不套用通膨增額/),
  ).toBeVisible();
  await page
    .locator(".workspace:visible")
    .getByText("展開詳細分析", { exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "報酬順序風險", exact: true }),
  ).toBeVisible();
  await page
    .locator(".workspace:visible")
    .getByLabel("資產圖表金額")
    .selectOption("real");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("輸入財務資料不發出外部請求或寫入儲存", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (r) => {
    if (
      !r.url().startsWith("http://127.0.0.1:4173") &&
      !r.url().startsWith("ws://127.0.0.1:4173")
    )
      external.push(r.url());
  });
  await openTool(page, "家庭預算");
  await page
    .locator(".workspace:visible")
    .getByLabel("每月固定實領薪資", { exact: true })
    .fill("98765");
  await page
    .locator(".workspace:visible")
    .getByText("展開詳細分析", { exact: true })
    .click();
  await page.waitForTimeout(300);
  expect(external).toEqual([]);
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
      query: location.search,
    })),
  ).toEqual({ local: 0, session: 0, query: "" });
});
