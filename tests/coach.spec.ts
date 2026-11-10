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

test("三種Prompt複製最新家庭資料，快速／明細與原摘要均正確且不發外部請求", async ({
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
    3,
  );
  const safety = await ui
      .getByRole("region", { name: "財務安全檢查" })
      .boundingBox(),
    pos = await coach.boundingBox();
  expect(pos!.y).toBeGreaterThan(safety!.y + safety!.height);
  for (const [title, phrase] of [
    ["財務健康檢查", "兩至三項財務風險"],
    ["消費與預算調整", "建議調整後金額"],
    ["ETF 投資規劃", "一個簡短長期複利例子"],
  ]) {
    await coach
      .getByRole("button", { name: `複製 Prompt｜${title}`, exact: true })
      .click();
    const text = await copied();
    expect(text).toContain(phrase);
    expect(text).toContain("只使用繁體中文純文字");
    expect(text).toContain("不要產生任何表格、Markdown表格或圖表");
    expect(text).toContain("自然組成一段或兩段文字");
    expect(text).toContain("全年收支平衡，不代表每月現金流沒有壓力");
    expect(text).not.toContain("必要時可使用簡短表格");
    expect(text).toContain(
      "每月家庭稅後可支配收入（規劃用月平均）：NT$ 100,000",
    );
    expect(text).toContain("生活費細項：未提供");
    expect(text).toContain("不是個人化證券投資指示");
    await expect(coach.getByRole("status")).toHaveText(`已複製：${title}`);
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
    "一個簡短長期複利例子",
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

test("三種Prompt及完整摘要隨兩個安全勾選即時更新", async ({ page }) => {
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
  const emergency = ui.getByLabel(
      "我已準備 3～6 個月必要生活支出的緊急預備金。",
    ),
    retire = ui.getByLabel("我已開始為退休儲蓄或投資，並定期檢視規劃。");
  for (const [emergencyChecked, retirementChecked] of [
    [false, false],
    [true, false],
    [true, true],
    [false, true],
    [false, false],
  ]) {
    await emergency.setChecked(emergencyChecked);
    await retire.setChecked(retirementChecked);
    for (const button of await coach.getByRole("button").all()) {
      await button.click();
      const text = await page.evaluate(
        () => (window as unknown as { copied: string }).copied,
      );
      expect(text).toContain(
        emergencyChecked
          ? "使用者自我確認已準備緊急預備金"
          : "尚未確認已準備緊急預備金",
      );
      expect(text).toContain(
        retirementChecked
          ? "使用者自我確認已開始為退休儲蓄或投資並定期檢視規劃"
          : "尚未確認已開始為退休儲蓄或投資並定期檢視規劃",
      );
    }
  }
});

test("退休明細僅四欄、耗盡警示與實際提領對帳", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /退休提領/ }).click();
  const ui = page.locator(".workspace:visible");
  await ui.getByLabel("現有資產起始市值", { exact: true }).fill("1000");
  await ui.getByLabel("首年／當期資產提領率", { exact: true }).fill("4");
  await ui.getByLabel("假設年化名目總報酬", { exact: true }).fill("0");
  await ui.getByLabel("年通膨率", { exact: true }).fill("0");
  await ui.getByText("展開詳細分析", { exact: true }).click();
  const table = ui.locator("table").filter({
    has: page.getByRole("columnheader", { name: "年度／年齡", exact: true }),
  });
  await expect(table.getByRole("columnheader")).toHaveText([
    "年度／年齡",
    "年度提領",
    "累積提領",
    "剩餘資產",
  ]);
  await expect(table.locator("tbody tr").first().locator("td")).toHaveText([
    "1年／60歲",
    "40",
    "40",
    "960",
  ]);
  await expect(table.locator("tbody tr").nth(24).locator("td")).toHaveText([
    "25年／84歲",
    "40",
    "1,000",
    "0",
  ]);
  await expect(table.locator("tbody tr").nth(25).locator("td")).toHaveText([
    "26年／85歲",
    "0",
    "1,000",
    "0",
  ]);
  await expect(ui.locator(".retirement-shortfall")).toContainText("資產耗盡");
  // Inflation makes the first shortfall a partial actual payment, not the planned amount.
  await ui.getByLabel("年通膨率", { exact: true }).fill("2");
  await expect(ui.locator(".retirement-shortfall")).toContainText("資產不足");
  await expect(table.locator("tbody tr").nth(20).locator("td")).toHaveText([
    "21年／80歲",
    "28",
    "1,000",
    "0",
  ]);
  const rows = await table.locator("tbody tr").allTextContents();
  expect(rows.join("")).not.toMatch(/NaN|Infinity/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("複製中立即標示主題並鎖定全部按鈕，成功與失敗後可繼續", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const requests: Array<{
      text: string;
      resolve: () => void;
      reject: () => void;
    }> = [];
    (window as unknown as { copyRequests: typeof requests }).copyRequests =
      requests;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text: string) =>
          new Promise<void>((resolve, reject) =>
            requests.push({
              text,
              resolve,
              reject: () => reject(new Error("denied")),
            }),
          ),
      },
    });
  });
  const ui = await enter(page),
    coach = ui.getByRole("region", { name: "AI 個人化理財教練" });
  const health = coach.getByRole("button", {
      name: "複製 Prompt｜財務健康檢查",
      exact: true,
    }),
    etf = coach.getByRole("button", {
      name: "複製 Prompt｜ETF 投資規劃",
      exact: true,
    });
  await health.click();
  await expect(coach.getByRole("status")).toHaveText("正在複製：財務健康檢查");
  for (const button of await coach.getByRole("button").all())
    await expect(button).toBeDisabled();
  // Even a programmatically dispatched second event cannot enqueue another write.
  await etf.dispatchEvent("click");
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { copyRequests: unknown[] }).copyRequests.length,
    ),
  ).toBe(1);
  await page.evaluate(() =>
    (
      window as unknown as { copyRequests: Array<{ resolve: () => void }> }
    ).copyRequests[0].resolve(),
  );
  await expect(coach.getByRole("status")).toHaveText("已複製：財務健康檢查");
  await etf.click();
  await expect(coach.getByRole("status")).toHaveText("正在複製：ETF 投資規劃");
  await expect(coach.getByRole("status")).not.toContainText("已複製");
  await page.evaluate(() =>
    (
      window as unknown as { copyRequests: Array<{ reject: () => void }> }
    ).copyRequests[1].reject(),
  );
  await expect(coach.getByRole("status")).toContainText(
    "無法複製：ETF 投資規劃",
  );
  await coach.getByText("展開待複製文字", { exact: true }).click();
  await expect(coach.getByLabel("待複製文字")).toHaveValue(
    /^【本次分析任務：ETF 投資規劃】/,
  );
  for (const button of await coach.getByRole("button").all())
    await expect(button).toBeEnabled();
  await coach
    .getByRole("button", { name: "複製完整家庭收支摘要", exact: true })
    .click();
  await expect(coach.getByRole("status")).toHaveText(
    "正在複製：完整家庭收支摘要",
  );
  await expect(coach.getByLabel("待複製文字")).toHaveCount(0);
  await page.evaluate(() =>
    (
      window as unknown as { copyRequests: Array<{ resolve: () => void }> }
    ).copyRequests[2].resolve(),
  );
  await expect(coach.getByRole("status")).toHaveText(
    "已複製：完整家庭收支摘要",
  );
});
