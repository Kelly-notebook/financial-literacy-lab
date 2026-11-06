import { test, expect, type Page } from "@playwright/test";
async function enter(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /家庭預算/ }).click();
  const ui = page.locator(".workspace:visible");
  await ui.getByLabel("每月固定實領薪資").fill("100000");
  return ui;
}
test("生活費19明細雙欄、窄手機單欄且數值與結果保留", async ({ page }) => {
  const ui = await enter(page);
  await ui.getByRole("button", { name: "展開生活費明細", exact: true }).click();
  const fields = ui.locator(".living-detail-grid .field");
  await expect(fields).toHaveCount(19);
  const one = await fields.nth(0).boundingBox(),
    two = await fields.nth(1).boundingBox();
  expect(Math.abs(one!.y - two!.y)).toBeLessThan(2);
  expect(two!.x).toBeGreaterThan(one!.x);
  await ui.getByLabel("伙食", { exact: true }).fill("12345");
  const before = await ui.locator(".hero-result").textContent();
  await page.setViewportSize({ width: 320, height: 812 });
  const a = await fields.nth(0).boundingBox(),
    b = await fields.nth(1).boundingBox();
  expect(b!.y).toBeGreaterThan(a!.y + a!.height);
  await expect(ui.getByLabel("伙食", { exact: true })).toHaveValue("12,345");
  await expect(ui.locator(".hero-result")).toHaveText(before!);
  for (const field of await fields.all()) {
    const label = await field.locator(":scope > span").boundingBox(),
      input = await field.locator(".input-wrap").boundingBox();
    expect(label!.y + label!.height).toBeLessThanOrEqual(input!.y);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("四種Prompt複製最新家庭資料，快速／明細與原摘要均正確且不發外部請求", async ({
  page,
}) => {
  const external: string[] = [];
  page.on("request", (request) => {
    if (
      !request.url().startsWith("http://127.0.0.1:4173") &&
      !request.url().startsWith("ws://127.0.0.1:4173")
    )
      external.push(request.url());
  });
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as unknown as { copied: string }).copied = text;
        },
      },
    }),
  );
  const ui = await enter(page),
    coach = ui.getByRole("region", { name: "AI 個人化理財教練" });
  const copied = () =>
    page.evaluate(() => (window as unknown as { copied: string }).copied);
  await expect(coach.getByRole("button", { name: /複製 Prompt/ })).toHaveCount(
    4,
  );
  const safety = await ui
      .getByRole("region", { name: "財務安全檢查" })
      .boundingBox(),
    pos = await coach.boundingBox();
  expect(pos!.y).toBeGreaterThan(safety!.y + safety!.height);
  for (const [title, phrase] of [
    ["財務健康檢查", "三項財務風險"],
    ["消費與預算調整", "保守調整"],
    ["ETF 投資規劃", "年化報酬率 4%、6%、8%"],
    ["退休準備分析", "延後五年、十年"],
  ]) {
    await coach
      .getByRole("button", { name: `複製 Prompt｜${title}`, exact: true })
      .click();
    const text = await copied();
    expect(text).toContain(phrase);
    expect(text).toContain(
      "每月家庭稅後可支配收入（規劃用月平均）：NT$ 100,000",
    );
    expect(text).toContain("生活費細項：未提供");
    expect(text).toContain("不是保證收益或個人化證券投資指示");
    await expect(coach.getByRole("status")).toHaveText(
      "已複製，請貼到 ChatGPT 或其他 AI 工具進行分析。",
    );
  }
  await ui.getByRole("button", { name: "展開生活費明細", exact: true }).click();
  await ui.getByLabel("伙食", { exact: true }).fill("18000");
  await ui.getByLabel("每月固定實領薪資").fill("1000");
  await coach
    .getByRole("button", { name: "複製完整家庭收支摘要", exact: true })
    .click();
  const full = await copied();
  expect(full).toContain("伙食：NT$ 18,000");
  expect(full).toContain("每月實際結餘或赤字：NT$ -");
  expect(full).not.toContain("【本次分析任務");
  await ui.getByRole("button", { name: "複製摘要", exact: true }).click();
  expect(await copied()).toBe(full);
  await coach
    .getByRole("button", { name: "複製 Prompt｜財務健康檢查", exact: true })
    .click();
  expect(await copied()).toContain(
    "每月家庭稅後可支配收入（規劃用月平均）：NT$ 1,000",
  );
  expect(await copied()).toContain("每月實際結餘或赤字：NT$ -");
  expect(external).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("剪貼簿失敗時保留表單與圖表，提供完整Prompt手動複製", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("denied");
        },
      },
    }),
  );
  const ui = await enter(page),
    coach = ui.getByRole("region", { name: "AI 個人化理財教練" });
  await coach
    .getByRole("button", { name: "複製 Prompt｜ETF 投資規劃", exact: true })
    .click();
  await expect(coach.getByRole("status")).toContainText("無法複製");
  await coach.getByText("展開待複製文字", { exact: true }).click();
  await expect(coach.getByLabel("待複製文字")).toContainText(
    "以年化報酬率 4%、6%、8%",
  );
  await expect(ui.getByLabel("每月固定實領薪資")).toHaveValue("100,000");
  await expect(ui.locator(".hero-result")).toBeVisible();
  await ui.getByLabel("其他每月固定收入").fill("2000");
  await coach
    .getByRole("button", { name: "複製完整家庭收支摘要", exact: true })
    .click();
  await expect(coach.getByLabel("待複製文字")).toContainText(
    "每月家庭稅後可支配收入（規劃用月平均）：NT$ 102,000",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
