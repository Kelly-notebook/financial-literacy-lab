import { test, expect, type Page } from "@playwright/test";
async function open(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /家庭預算/ }).click();
  return page.locator(".workspace:visible");
}
test("月薪與年薪主要欄位互斥，切換保持相同全年收入並即時更新", async ({
  page,
}) => {
  const ui = await open(page);
  await ui.getByLabel("每月固定實領薪資", { exact: true }).fill("100000");
  await ui.getByLabel("年度獎金（選填）", { exact: true }).fill("600000");
  await expect(
    ui.getByText("每月總收入（月平均）", { exact: true }).locator(".."),
  ).toContainText("150,000");
  const before = await ui
    .getByText("每月剩餘可支配金額", { exact: true })
    .first()
    .locator("..")
    .textContent();
  await ui.getByLabel("收入模式").selectOption("annual");
  await expect(ui.getByLabel("每月固定實領薪資", { exact: true })).toHaveCount(
    0,
  );
  await expect(ui.getByLabel("年度獎金（選填）")).toHaveCount(0);
  await expect(ui.getByLabel("全年實領總收入（已含獎金）")).toHaveValue(
    "1,800,000",
  );
  await expect(
    ui.getByText("每月剩餘可支配金額", { exact: true }).first().locator(".."),
  ).toHaveText(before!);
  await ui.getByLabel("全年實領總收入（已含獎金）").fill("2400000");
  await expect(
    ui.getByText("每月總收入（月平均）", { exact: true }).locator(".."),
  ).toContainText("200,000");
  await ui.getByLabel("收入模式").selectOption("monthly");
  await expect(ui.getByLabel("每月固定實領薪資")).toHaveValue("150,000");
  await expect(ui.getByLabel("年度獎金（選填）")).toHaveValue("600,000");
});
test("金額分組、小數、負號、刪空、中間插入與逗號旁刪除", async ({ page }) => {
  const ui = await open(page),
    amount = ui.getByLabel("每月固定實領薪資");
  await amount.fill("1000000.50");
  await expect(amount).toHaveValue("1,000,000.50");
  await amount.fill("-1000.25");
  await expect(amount).toHaveValue("-1,000.25");
  await expect(amount).toHaveAttribute("aria-invalid", "true");
  await amount.fill("");
  await amount.pressSequentially("123456");
  await expect(amount).toHaveValue("123,456");
  await amount.evaluate((el: HTMLInputElement) => el.setSelectionRange(0, 0));
  await amount.press("9");
  await expect(amount).toHaveValue("9,123,456");
  expect(
    await amount.evaluate((el: HTMLInputElement) => el.selectionStart),
  ).toBe(1);
  await amount.fill("1234");
  await amount.evaluate((el: HTMLInputElement) => el.setSelectionRange(2, 2));
  await amount.press("Backspace");
  await expect(amount).toHaveValue("234");
  await amount.fill("1234");
  await amount.evaluate((el: HTMLInputElement) => el.setSelectionRange(1, 1));
  await amount.press("Delete");
  await expect(amount).toHaveValue("134");
  await amount.fill("1000");
  await amount.press("End");
  await amount.pressSequentially(".25");
  await expect(amount).toHaveValue("1,000.25");
  await amount.fill("");
  await expect(amount).toHaveValue("");
  await expect(ui.getByRole("alert")).toBeVisible();
  await expect(amount).toHaveAttribute("inputmode", "decimal");
});
test("貸款順序、逐月到期、各期每日值及年度單位", async ({ page }) => {
  const ui = await open(page);
  await ui.getByLabel("每月固定實領薪資").fill("100000");
  await ui
    .getByText("貸款設定：房貸、車貸、信貸、其他", { exact: true })
    .click();
  const labels = await ui
    .locator('input[aria-label$="月付額"]')
    .evaluateAll((es) => es.map((e) => e.getAttribute("aria-label")));
  expect(labels).toEqual([
    "房貸月付額",
    "車貸月付額",
    "信貸月付額",
    "其他貸款月付額",
  ]);
  await ui.getByLabel("信貸月付額", { exact: true }).fill("5000");
  await ui.getByLabel("信貸剩餘期數", { exact: true }).fill("1");
  await ui.getByText("未來情境設定", { exact: true }).click();
  await ui.getByLabel("試算起始年月").fill("2026-11");
  await ui.getByText("展開詳細分析", { exact: true }).click();
  await ui.getByText("查看各期精確數據", { exact: true }).click();
  const rows = ui.getByRole("row");
  await expect(rows.filter({ hasText: "2026-11" })).toContainText("5,000");
  await expect(rows.filter({ hasText: "2026-12" })).toContainText("0");
  const november = rows.filter({ hasText: "2026-11" });
  const december = rows.filter({ hasText: "2026-12" });
  await expect(november).toContainText("70,000");
  await expect(december).toContainText("75,000");
  await expect(november).toContainText("2,333");
  await expect(december).toContainText("2,419");
  await ui.locator(".chart circle").first().hover();
  await expect(ui.locator(".budget-tooltip")).toContainText(
    "當期平均每日可支配",
  );
  await expect(ui.locator(".budget-tooltip")).toContainText("貸款月付總額");
  await ui.getByLabel("現金流顯示週期").selectOption("annual");
  await expect(
    ui.getByRole("columnheader", { name: "期間總結餘", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("赤字為負值、圖表紅點與ETF不可負擔警示", async ({ page }) => {
  const ui = await open(page);
  await ui.getByLabel("每月固定實領薪資").fill("10000");
  await expect(
    ui.getByText("每月剩餘可支配金額", { exact: true }).first().locator(".."),
  ).toContainText("-15,000");
  await expect(
    ui.getByText("每日平均可支配金額", { exact: true }).locator(".."),
  ).toContainText("-");
  await ui.getByText("家庭收支健檢與投資規劃", { exact: true }).click();
  await expect(ui.getByLabel("每月預計投入 ETF 金額")).toHaveValue("0");
  await expect(
    ui.locator('.investment-notices [data-kind="deficit"]'),
  ).toBeVisible();
  await ui.getByText("展開詳細分析", { exact: true }).click();
  await expect(ui.locator('circle[fill="#be493c"]').first()).toBeVisible();
  await ui.getByLabel("每月預計投入 ETF 金額").fill("10000");
  await expect(
    ui.getByText("每月剩餘可支配金額", { exact: true }).first().locator(".."),
  ).toContainText("-25,000");
  await expect(
    ui.locator('.investment-notices [data-kind="affordability"]'),
  ).toBeVisible();
});
test("大型購買基金、達標時間與投資現金收入只計入一次", async ({ page }) => {
  const ui = await open(page);
  await ui.getByLabel("每月固定實領薪資").fill("100000");
  await ui.getByText("大型購買與旅行目標", { exact: true }).click();
  await ui.getByLabel("大型購買目標名稱").fill("鋼琴");
  await ui.getByLabel("預計購買總金額").fill("300000");
  await ui.getByLabel("已準備的購買基金").fill("60000");
  await ui.getByLabel("預計幾個月後購買").fill("24");
  await ui.getByLabel("目前固定目標儲蓄（比較用）").fill("8000");
  await expect(
    ui.getByRole("heading", { name: "鋼琴", exact: true }),
  ).toBeVisible();
  await expect(
    ui.getByText("每月需要儲蓄", { exact: true }).locator(".."),
  ).toContainText("10,000");
  await expect(ui.getByText(/不計利息約 30 個月達標/)).toBeVisible();
  await ui.getByText("投資現金收入", { exact: true }).click();
  await ui.getByLabel("每年預估股息／投資現金收入").fill("120000");
  await ui.getByLabel("投資現金收入處理方式").selectOption("spend");
  await expect(
    ui.getByText("每月總收入（月平均）", { exact: true }).locator(".."),
  ).toContainText("110,000");
  await ui.getByLabel("投資現金收入處理方式").selectOption("reinvest");
  await expect(
    ui.getByText("每月總收入（月平均）", { exact: true }).locator(".."),
  ).toContainText("100,000");
  await ui.getByText("家庭收支健檢與投資規劃", { exact: true }).click();
  await ui.getByLabel("每月預計投入 ETF 金額").fill("20000");
  await expect(
    ui
      .getByText("每月 ETF 計畫投入（只扣一次）", { exact: true })
      .locator(".."),
  ).toContainText("20,000");
  await expect(
    ui.getByRole("img", { name: /家庭每月分配環圈圖/ }),
  ).toBeVisible();
  await expect(ui.locator(".allocation-legend")).not.toContainText(
    "育兒與家庭支出",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("8%只適用投資累積預設，不改銀行或退休提領", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /目標倒推/ }).click();
  let ui = page.locator(".workspace:visible");
  await expect(ui.getByLabel("假設年化總報酬率", { exact: true })).toHaveValue(
    "8",
  );
  await expect(ui.getByText(/8% 僅為教育性假設/)).toBeVisible();
  await ui.getByText("進階設定", { exact: true }).click();
  await expect(ui.getByLabel("假設銀行年利率")).toHaveValue("1.5");
  await page.getByRole("button", { name: "長期複利", exact: true }).click();
  ui = page.locator(".workspace:visible");
  await expect(ui.getByLabel("假設年化總報酬率", { exact: true })).toHaveValue(
    "8",
  );
  await page.getByRole("button", { name: "退休提領", exact: true }).click();
  ui = page.locator(".workspace:visible");
  await expect(ui.getByLabel("首年／當期資產提領率")).toHaveValue("4");
  await expect(ui.getByLabel("假設年化名目總報酬")).toHaveValue("4");
});

test("整合ETF金額預設0、10%快捷、環圈更新與取消獨立第五部分", async ({
  page,
}) => {
  const ui = await open(page);
  await ui.getByLabel("每月固定實領薪資").fill("100000");
  await expect(
    ui.getByRole("heading", { name: "設定自己的 ETF 投資目標" }),
  ).toHaveCount(0);
  await ui.getByText("家庭收支健檢與投資規劃", { exact: true }).click();
  const amount = ui.getByLabel("每月預計投入 ETF 金額");
  await expect(amount).toHaveValue("0");
  await expect(ui.locator(".investment-ratio")).toContainText("0%");
  const before = ui
    .getByText("每月剩餘可支配金額", { exact: true })
    .first()
    .locator("..");
  await expect(before).toContainText("75,000");
  await ui
    .getByRole("button", { name: "以月收入 10% 試算", exact: true })
    .click();
  await expect(amount).toHaveValue("10,000");
  await expect(before).toContainText("65,000");
  await expect(ui.locator(".investment-ratio")).toContainText("10%");
  await expect(
    ui.locator(".allocation-legend li").filter({ hasText: "ETF 投資" }),
  ).toContainText("10,000");
  await amount.fill("100000");
  await expect(before).toContainText("-25,000");
  await expect(
    ui.getByText("剩餘金錢：NT$ -25,000", { exact: true }),
  ).toBeVisible();
  await expect(amount).toHaveValue("100,000");
});
test("電信與訂閱同步現金流、健檢明細情境與參考上限可修正", async ({ page }) => {
  const ui = await open(page);
  await ui.getByLabel("每月固定實領薪資").fill("100000");
  await ui.getByLabel("必要生活費輸入方式").selectOption("detail");
  await ui.getByLabel("伙食", { exact: true }).fill("18000");
  await ui.getByLabel("電信費", { exact: true }).fill("4000");
  await ui.getByLabel("工具與娛樂訂閱", { exact: true }).fill("6000");
  await ui.getByText("家庭收支健檢與投資規劃", { exact: true }).click();
  await expect(
    ui.locator(".health-advice li").filter({ hasText: "伙食支出占收入" }),
  ).toContainText("18%");
  await expect(
    ui.locator(".health-advice li").filter({ hasText: "伙食支出占收入" }),
  ).toContainText("3 個百分點");
  await expect(
    ui.locator(".health-advice li").filter({ hasText: "伙食支出占收入" }),
  ).toContainText("36,000");
  await expect(
    ui.locator(".allocation-legend li").filter({ hasText: "電信費" }),
  ).toContainText("4,000");
  await expect(
    ui.locator(".allocation-legend li").filter({ hasText: "工具與娛樂訂閱" }),
  ).toContainText("6,000");
  await ui.getByText("展開詳細分析", { exact: true }).click();
  await ui.getByText("查看各期精確數據", { exact: true }).click();
  const first = ui.getByRole("row").nth(1);
  await expect(first).toContainText("53,000");
  await ui.getByLabel("電信費", { exact: true }).fill("5000");
  await expect(first).toContainText("52,000");
  await ui.getByText("調整支出分類與參考上限", { exact: true }).click();
  await ui.getByLabel("伙食參考上限", { exact: true }).fill("");
  await expect(ui.getByRole("alert")).toBeVisible();
  await ui.getByLabel("伙食參考上限", { exact: true }).fill("20");
  await expect(ui.getByRole("alert")).toHaveCount(0);
  await expect(
    ui.locator(".health-advice li").filter({ hasText: "伙食支出占收入" }),
  ).toHaveCount(0);
  await ui.getByLabel("伙食的健檢分類").selectOption("wants");
  await expect(first).toContainText("52,000");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("健檢提醒依序、緊急預備金不假定達標與四個原始來源", async ({ page }) => {
  const ui = await open(page);
  await ui.getByLabel("每月固定實領薪資").fill("100000");
  await ui.getByText("家庭收支健檢與投資規劃", { exact: true }).click();
  await expect(ui.locator('[data-kind="emergency"]')).toBeVisible();
  await ui.getByLabel("我已自行確認緊急預備金安排").check();
  await expect(ui.locator('[data-kind="planning"]')).toBeVisible();
  await ui.getByLabel("每月預計投入 ETF 金額").fill("100000");
  const kinds = await ui
    .locator(".investment-notices [data-kind]")
    .evaluateAll((es) => es.map((e) => e.getAttribute("data-kind")));
  expect(kinds).toEqual(["deficit", "affordability"]);
  await ui.getByText("退休儲蓄與投資現金流說明", { exact: true }).click();
  await expect(
    ui.getByText(/Fidelity 的退休儲蓄參考目標為每年約稅前收入 15%/),
  ).toBeVisible();
  await expect(ui.getByText(/僅提供教育說明，不判定退休儲蓄/)).toBeVisible();
  await ui.getByText("理財參考依據與資料來源", { exact: true }).click();
  const refs = ui.locator(".reference-list");
  await expect(refs.getByRole("listitem")).toHaveCount(4);
  await expect(
    refs.getByRole("link", { name: "Analyzing Budgets", exact: true }),
  ).toHaveAttribute(
    "href",
    "https://files.consumerfinance.gov/f/documents/cfpb_building_block_activities_analyzing-budgets_guide.pdf",
  );
  await expect(refs).toContainText("消費支出統計僅作背景參考");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
