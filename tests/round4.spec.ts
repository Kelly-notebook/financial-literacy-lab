import { test, expect } from "@playwright/test";
for (const [tool, label] of [
  ["目標倒推", "目標資產"],
  ["長期複利", "每月投入金額"],
  ["家庭預算", "其他每月固定收入"],
  ["退休提領", "現有資產起始市值"],
]) {
  test(`${tool}：清空、切頁、取代、千分位貼上及超界均保留畫面`, async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: new RegExp(tool) }).click();
    const ui = page.locator(".workspace:visible");
    if (tool === "家庭預算")
      await ui.getByLabel("每月固定實領薪資").fill("100000");
    const input = ui.getByLabel(label, { exact: true });
    await input.fill("0");
    await input.fill("");
    await expect(input).toHaveValue("");
    await expect(ui.locator(".results")).toBeVisible();
    const other = tool === "長期複利" ? "目標倒推" : "長期複利";
    await page.getByRole("button", { name: other, exact: true }).click();
    await page.getByRole("button", { name: tool, exact: true }).click();
    await expect(input).toHaveValue("");
    await input.fill("5000");
    await input.press("Tab");
    await expect(input).toHaveValue("5,000");
    await input.press("ControlOrMeta+A");
    await input.pressSequentially("6000");
    await expect(input).toHaveValue("6,000");
    await input.fill("1,000,000.25");
    await input.press("Tab");
    await expect(input).toHaveValue("1,000,000.25");
    for (const bad of ["10000000000000", "-1", "abc"]) {
      await input.fill(bad);
      await input.press("Tab");
      await expect(input).toHaveAttribute("aria-invalid", "true");
      await expect(ui.locator(".results")).toBeVisible();
      await expect(ui.locator(".hero-result")).toBeVisible();
      await expect(ui).not.toContainText(/NaN|Infinity/);
    }
  });
}
test("三檔ETF互斥市值及聚焦縱軸", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /長期複利/ }).click();
  const ui = page.locator(".workspace:visible");
  await ui.getByLabel("現有資產起始市值", { exact: true }).fill("9000000");
  await ui.getByLabel("現有資產輸入方式").selectOption("shares");
  for (let i = 1; i <= 3; i++) {
    if (i > 1)
      await ui.getByRole("button", { name: "新增 ETF", exact: true }).click();
    await ui.getByLabel(`第${i}檔ETF代號`).fill(`自由${i}`);
    await ui.getByLabel(`第${i}檔持有股數`).fill(String(i));
    await ui.getByLabel(`第${i}檔每股參考價格`).fill("100");
  }
  await expect(ui.getByText(/ETF 持股合計市值/)).toContainText("600");
  await expect(
    ui.getByRole("button", { name: "新增 ETF", exact: true }),
  ).toBeDisabled();
  await ui.getByText("展開詳細分析", { exact: true }).click();
  const chart = ui.locator("[data-axis-mode]");
  await expect(chart).toHaveAttribute("data-axis-min", "0");
  await ui.getByLabel("Y 軸顯示模式").selectOption("focused");
  await expect(chart).toHaveAttribute("data-axis-mode", "focused");
  await expect(ui.getByText(/視覺差距可能因此放大/)).toBeVisible();
  await ui.getByRole("button", { name: "刪除第 2 檔", exact: true }).click();
  await expect(ui.getByText(/ETF 持股合計市值/)).toContainText("400");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("生活費雙來源保留、19明細、七類與其他儲蓄對帳", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /家庭預算/ }).click();
  const ui = page.locator(".workspace:visible"),
    living = ui.locator(".living-inputs");
  await ui.getByLabel("每月固定實領薪資").fill("100000");
  await expect(living.locator("input")).toHaveCount(2);
  await ui.getByLabel("每月必要生活費總額").fill("20000");
  await ui.getByLabel("每月非必要消費總額").fill("10000");
  await ui.getByRole("button", { name: "展開生活費明細", exact: true }).click();
  await expect(living.locator("input")).toHaveCount(19);
  await ui.getByLabel("教育與學習", { exact: true }).fill("1234");
  await ui.getByRole("button", { name: "切換快速輸入", exact: true }).click();
  await expect(ui.getByLabel("每月必要生活費總額")).toHaveValue("20,000");
  await expect(living.locator("input")).toHaveCount(2);
  await ui.getByRole("button", { name: "展開生活費明細", exact: true }).click();
  await expect(ui.getByLabel("教育與學習", { exact: true })).toHaveValue(
    "1,234",
  );
  await ui.getByText("家庭收支健檢與投資規劃", { exact: true }).click();
  await expect(ui.locator(".allocation-legend li")).toHaveCount(7);
  await expect(ui.locator(".ring-reconciliation")).toContainText(
    "其他每月儲蓄目標 NT$",
  );
  await expect(ui.locator(".ring-reconciliation")).toContainText("已從可支配");
  await ui.getByLabel("每月固定實領薪資").fill("1000");
  await expect(ui.locator(".monthly-deficit")).toContainText("每月赤字");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("四單元已顯示的比例、年數與金額均可清空再恢復", async ({ page }) => {
  test.setTimeout(90000);
  await page.goto("/");
  for (const tool of ["目標倒推", "長期複利", "家庭預算", "退休提領"]) {
    await page.getByRole("button", { name: new RegExp(tool) }).click();
    const ui = page.locator(".workspace:visible");
    if (tool === "家庭預算")
      await ui.getByLabel("每月固定實領薪資").fill("100000");
    const inputs = ui.locator("input[inputmode]");
    for (let i = 0; i < (await inputs.count()); i++) {
      const input = inputs.nth(i);
      if (!(await input.isVisible())) continue;
      const value = await input.inputValue();
      await input.fill("");
      await expect(input).toHaveValue("");
      await expect(ui.locator(".results")).toBeVisible();
      await expect(ui.locator(".hero-result")).toBeVisible();
      await input.fill(value);
      await input.press("Tab");
    }
    await page.getByRole("button", { name: "所有工具", exact: true }).click();
  }
});
