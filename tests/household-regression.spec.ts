import { test, expect } from "@playwright/test";
async function enter(page: import("@playwright/test").Page, detail = true) {
  await page.goto("/");
  await page.getByRole("button", { name: /家庭預算/ }).click();
  const ui = page.locator(".workspace:visible");
  if (
    detail &&
    (await ui
      .getByRole("button", { name: "展開生活費明細", exact: true })
      .isVisible())
  )
    await ui
      .getByRole("button", { name: "展開生活費明細", exact: true })
      .click();
  return ui;
}
test("ETF 0 → 刪空 → 5000 → 完成，保留欄位、圖表與其他資料，重整可恢復", async ({
  page,
}) => {
  const ui = await enter(page);
  await ui.getByLabel("每月固定實領薪資").fill("100000");
  await ui.getByLabel("電信費", { exact: true }).fill("1000");
  await ui.getByText("家庭收支健檢與投資規劃", { exact: true }).click();
  const etf = ui.getByLabel("每月預計投入 ETF 金額");
  await expect(etf).toHaveValue("0");
  await etf.fill("");
  await expect(etf).toBeVisible();
  await expect(etf).toHaveValue("");
  await expect(ui.getByRole("alert")).toHaveCount(0);
  await expect(
    ui.getByRole("img", { name: /家庭每月分配環圈圖/ }),
  ).toBeVisible();
  await expect(ui.getByLabel("每月固定實領薪資")).toHaveValue("100,000");
  await etf.pressSequentially("5000");
  await etf.press("Enter");
  await expect(etf).toHaveValue("5,000");
  await expect(
    ui.getByText("每月剩餘可支配金額", { exact: true }).first().locator(".."),
  ).toContainText("69,000");
  await page.reload();
  await page.getByRole("button", { name: /家庭預算/ }).click();
  await expect(ui.getByLabel("每月固定實領薪資")).toHaveValue("100,000");
  await expect(ui.getByLabel("電信費", { exact: true })).toHaveValue("1,000");
  await ui.getByText("家庭收支健檢與投資規劃", { exact: true }).click();
  await expect(etf).toHaveValue("5,000");
});
test("ETF 超界完成編輯只在欄位旁提示，修正與清除本機資料均不需重新整理", async ({
  page,
}) => {
  const ui = await enter(page);
  await ui.getByLabel("每月固定實領薪資").fill("100000");
  await ui.getByText("家庭收支健檢與投資規劃", { exact: true }).click();
  const etf = ui.getByLabel("每月預計投入 ETF 金額");
  await etf.fill("10000000000000");
  await expect(ui.getByRole("alert")).toHaveCount(0);
  await etf.press("Enter");
  await expect(etf).toBeVisible();
  await expect(ui.getByRole("alert")).toContainText("保留有效結果");
  await expect(
    ui.getByRole("img", { name: /家庭每月分配環圈圖/ }),
  ).toBeVisible();
  await etf.fill("");
  await expect(etf).toHaveValue("");
  await etf.press("Tab");
  await expect(etf).toHaveValue("");
  await expect(ui.getByRole("alert")).toBeVisible();
  await etf.fill("0");
  await etf.press("Tab");
  await expect(ui.getByRole("alert")).toHaveCount(0);
  await ui.getByRole("button", { name: "清除已儲存資料", exact: true }).click();
  await expect(ui.getByLabel("每月固定實領薪資")).toHaveValue("");
  await expect(ui.locator(".hero-result")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("financial-literacy-lab:household:v1"),
    ),
  ).toBeNull();
  await page.reload();
  await page.getByRole("button", { name: /家庭預算/ }).click();
  await expect(ui.getByLabel("每月固定實領薪資")).toHaveValue("");
});

test("雙向購買模式、目的分類與購物／旅行切片分開", async ({ page }) => {
  const ui = await enter(page);
  await ui.getByLabel("每月固定實領薪資").fill("100000");
  await ui.getByText("大型購買與旅行目標", { exact: true }).click();
  await ui.getByLabel("預計購買總金額").fill("1000");
  await ui.getByLabel("已準備的購買基金").fill("0");
  await ui.getByLabel("預計幾個月後購買").fill("3");
  await expect(
    ui.getByText("每月需要儲蓄", { exact: true }).locator(".."),
  ).toContainText("334");
  await ui.getByLabel("大型購買規劃模式").selectOption("monthly");
  await ui.getByLabel("預計購買總金額").fill("300000");
  await ui.getByLabel("已準備的購買基金").fill("60000");
  await ui.getByLabel("每月能存多少錢").fill("8000");
  await expect(
    ui.getByText("預計 2 年 6 個月後達標", { exact: true }),
  ).toBeVisible();
  await ui.getByText("家庭收支健檢與投資規劃", { exact: true }).click();
  await expect(
    ui.locator(".allocation-legend li").filter({ hasText: "大型購物儲蓄" }),
  ).toContainText("8,000");
  await expect(
    ui.locator(".allocation-legend li").filter({ hasText: "旅遊基金" }),
  ).toContainText("5,000");
  const before = await ui
    .getByText("每月剩餘可支配金額", { exact: true })
    .first()
    .locator("..")
    .textContent();
  await ui.getByLabel("大型購物目標用途").selectOption("savings");
  await expect(
    ui.getByText("每月剩餘可支配金額", { exact: true }).first().locator(".."),
  ).toHaveText(before!);
  await expect(ui.locator('[data-group="savings"]')).toContainText("8%");
  await ui.getByLabel("每月能存多少錢").fill("0");
  await expect(ui.getByText("無法估算達標時間", { exact: true })).toBeVisible();
  await ui.getByLabel("已準備的購買基金").fill("300000");
  await expect(ui.getByText("目前資金已達標", { exact: true })).toBeVisible();
});
test("新增支出預設分類、生活費順序與CFPB顏色／文字邊界", async ({ page }) => {
  const ui = await enter(page);
  await ui.getByLabel("每月固定實領薪資").fill("100000");
  await ui.getByLabel("參考預算模式").selectOption("classic");

  const necessary = ui.getByRole("group", {
    name: "必要生活支出",
    exact: true,
  });
  expect(
    await necessary.locator("input").last().getAttribute("aria-label"),
  ).toBe("其他生活支出");
  for (const name of ["治裝費", "餐廳與日常娛樂", "孝親費", "醫藥費"])
    await ui.getByLabel(name, { exact: true }).fill("1000");
  await expect(
    ui.getByText("每月剩餘可支配金額", { exact: true }).first().locator(".."),
  ).toContainText("71,000");
  await ui.getByText("家庭收支健檢與投資規劃", { exact: true }).click();
  await expect(ui.locator('[data-group="savings"]')).toHaveAttribute(
    "data-tone",
    "yellow",
  );
  await ui.getByRole("button", { name: "必要生活支出 ▾", exact: true }).click();
  await expect(ui.locator(".living-breakdown")).toContainText("醫藥費");
  await ui.getByLabel("每月預計投入 ETF 金額").fill("10000");
  await expect(ui.locator('[data-group="savings"]')).toHaveAttribute(
    "data-tone",
    "watch",
  );
  await ui.getByLabel("每月預計投入 ETF 金額").fill("20000");
  await expect(ui.locator('[data-group="savings"]')).toHaveAttribute(
    "data-tone",
    "green",
  );
  await ui.getByLabel("伙食", { exact: true }).fill("46000");
  await expect(ui.locator('[data-group="needs"]')).toHaveAttribute(
    "data-tone",
    "watch",
  );
  await expect(ui.locator('[data-group="needs"]')).toContainText(
    "高於參考目標 6 個百分點",
  );
  await ui.getByLabel("餐廳與日常娛樂", { exact: true }).fill("35000");
  await expect(ui.locator('[data-group="wants"]')).toHaveAttribute(
    "data-tone",
    "pink",
  );
  await expect(ui.locator('[data-group="savings"]')).toHaveAttribute(
    "data-tone",
    "normal",
  );
  await expect(ui.locator('[data-group="savings"]')).toContainText("赤字");
  await ui.getByText("調整支出分類與參考上限", { exact: true }).click();
  await expect(ui.getByLabel("孝親費的健檢分類")).toHaveValue("wants");
  await ui.getByLabel("孝親費的健檢分類").selectOption("needs");
  await expect(ui.getByLabel("醫藥費的健檢分類")).toHaveValue("needs");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("兩項財務安全自評預設未勾、金額不變、恢復與第四單元連結", async ({
  page,
}) => {
  const ui = await enter(page);
  await ui.getByLabel("每月固定實領薪資").fill("100000");
  const emergency = ui.getByLabel(
      "我已準備 3～6 個月必要生活支出的緊急預備金。",
    ),
    retire = ui.getByLabel("我已開始為退休儲蓄或投資，並定期檢視規劃。");
  await expect(emergency).not.toBeChecked();
  await expect(retire).not.toBeChecked();
  const before = await ui
    .getByText("每月剩餘可支配金額", { exact: true })
    .first()
    .locator("..")
    .textContent();
  await emergency.check();
  await retire.check();
  await expect(
    ui.getByText("每月剩餘可支配金額", { exact: true }).first().locator(".."),
  ).toHaveText(before!);
  await expect(
    ui.getByText("退休儲蓄與投資現金流說明", { exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: /家庭預算/ }).click();
  await expect(emergency).toBeChecked();
  await expect(retire).toBeChecked();
  await retire.uncheck();
  await expect(
    ui.getByText("每月剩餘可支配金額", { exact: true }).first().locator(".."),
  ).toHaveText(before!);
  await ui
    .getByRole("link", { name: "前往第四單元：退休提領模擬器", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "退休提領", exact: true }),
  ).toBeVisible();
});

test("暫存損毀或瀏覽器拒絕寫入時，仍可輸入並試算", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("financial-literacy-lab:household:v1", "broken JSON"),
  );
  const ui = await enter(page, false);
  await expect(
    ui.getByText("無法讀取本機暫存，仍可繼續試算。", { exact: true }),
  ).toBeVisible();
  await ui.getByLabel("每月固定實領薪資").fill("100000");
  await expect(
    ui.getByText("每月剩餘可支配金額", { exact: true }).first().locator(".."),
  ).toContainText("75,000");
  await page.evaluate(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
  });
  await ui.getByLabel("其他每月固定收入").fill("2000");
  await expect(ui.getByText(/此瀏覽器無法儲存資料/)).toBeVisible();
  await expect(
    ui.getByText("每月剩餘可支配金額", { exact: true }).first().locator(".."),
  ).toContainText("77,000");
});
