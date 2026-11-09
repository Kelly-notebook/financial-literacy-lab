import { test, expect, type Page } from "@playwright/test";
async function enter(page: Page) {
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
  await page.goto("/");
  await page.getByRole("button", { name: /退休提領/ }).click();
  return page.locator(".workspace:visible");
}
const copied = (page: Page) =>
  page.evaluate(() => (window as unknown as { copied: string }).copied);
test("軍職2031離職與完全退休分開、給付確認起訖及兩種缺口、完整Prompt與手機", async ({
  page,
}) => {
  const ui = await enter(page),
    box = ui.locator(".retirement-planning"),
    details = box.locator("details").first();
  await expect(details).not.toHaveAttribute("open", "");
  const original = await ui.locator(".hero-result").textContent();
  await box.getByText("進階退休與轉職規劃（選填）", { exact: true }).click();
  for (const [label, value] of [
    ["目前年齡", "34"],
    ["希望完全退休的年齡", "60"],
    ["預計離開目前工作時間", "120"],
    ["家庭每月生活費", "40000"],
    ["其他扶養或固定支出月額", "2000"],
    ["配偶每月稅後收入", "20000"],
    ["每月持續投資金額", "5000"],
    ["其他每月儲蓄目標", "3000"],
    ["房貸每月還款", "15000"],
    ["房貸結束時間", "2040"],
    ["其他貸款每月還款", "0"],
    ["目前 ETF／股票市值", "1000000"],
    ["子女人數", "2"],
    ["各子女年齡", "2、5"],
  ])
    await box.getByLabel(label, { exact: true }).fill(value);
  await box
    .getByLabel("預計離開目前工作時間基準", { exact: true })
    .selectOption("roc");
  await box.getByLabel("離職情境", { exact: true }).selectOption("軍職退伍");
  await box
    .getByLabel("離職後是否預計繼續工作", { exact: true })
    .selectOption("是，預計繼續工作");
  await box
    .getByLabel("配偶收入持續方式", { exact: true })
    .selectOption("ongoing");
  await box
    .getByRole("button", { name: "新增給付或收入", exact: true })
    .click();
  await box.getByLabel("第 1 筆收入名稱", { exact: true }).fill("軍職退休俸");
  await box.getByLabel("第 1 筆稅後金額", { exact: true }).fill("30000");
  await box.getByLabel("第 1 筆開始時間", { exact: true }).fill("2031");
  await box.getByLabel("持續領取，未設定結束時間（明確假設）").check();
  await expect(box).toContainText("NT$ 37,000／月（稅後）");
  await expect(box).toContainText("NT$ 45,000／月（稅後）");
  await box
    .getByRole("button", {
      name: "複製 Prompt｜AI 退休與轉職規劃",
      exact: true,
    })
    .click();
  let text = await copied(page);
  expect(text).toContain("西元 2031 年");
  expect(text).toContain("完全退休年份：2052");
  expect(text).toContain("第 30 年／89 歲");
  expect(text).toContain("其他退休投資資產：未提供");
  expect(text).toContain("尚待確認，不得當作確定收入");
  expect(text).toContain("250～400");
  await box.getByLabel("第 1 筆確認狀態").selectOption("confirmed");
  await expect(box).toContainText("NT$ 7,000／月（稅後）");
  await expect(box).toContainText("NT$ 15,000／月（稅後）");
  await box.getByLabel("第 1 筆給付頻率").selectOption("once");
  await expect(box).toContainText("NT$ 37,000／月（稅後）");
  await box.getByLabel("試算年份（西元）", { exact: true }).fill("2041");
  await expect(box).toContainText("NT$ 22,000／月（稅後）");
  await expect(box).toContainText("NT$ 30,000／月（稅後）");
  await box.getByLabel("家庭每月生活費", { exact: true }).fill("");
  await expect(box).not.toContainText("NT$ 22,000／月（稅後）");
  await expect(box).toContainText("基本生活試算缺少或待修正");
  await expect(ui.locator(".hero-result")).toHaveText(original!);
  await ui.getByLabel("現有資產起始市值", { exact: true }).fill("");
  await box
    .getByRole("button", {
      name: "複製 Prompt｜AI 退休與轉職規劃",
      exact: true,
    })
    .click();
  text = await copied(page);
  expect(text).toContain("最近有效試算");
  expect(text).toContain("家庭每月生活費：未提供");
  await page.setViewportSize({ width: 320, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("家庭主動快照取代不自動同步，無效草稿拒絕帶入，複利未來資產不加現有資產", async ({
  page,
}) => {
  let ui = await enter(page);
  await page.getByRole("button", { name: "家庭預算", exact: true }).click();
  ui = page.locator(".workspace:visible");
  await ui.getByLabel("每月固定實領薪資").fill("100000");
  await ui.getByText("家庭收支健檢與投資規劃", { exact: true }).click();
  await ui.getByLabel("每月預計投入 ETF 金額").fill("5000");
  await expect(ui.getByRole("button", { name: /複製 Prompt/ })).toHaveCount(3);
  await expect(ui.getByRole("button", { name: /退休準備分析/ })).toHaveCount(0);
  await page.getByRole("button", { name: "退休提領", exact: true }).click();
  ui = page.locator(".workspace:visible");
  const box = ui.locator(".retirement-planning");
  await box.getByText("進階退休與轉職規劃（選填）", { exact: true }).click();
  await expect(box.getByLabel("家庭每月生活費", { exact: true })).toHaveValue(
    "",
  );
  await box
    .getByRole("button", { name: "帶入家庭預算資料", exact: true })
    .click();
  await expect(box.getByLabel("家庭每月生活費", { exact: true })).toHaveValue(
    "15,000",
  );
  await expect(box.getByLabel("每月持續投資金額", { exact: true })).toHaveValue(
    "5,000",
  );
  await box.getByLabel("家庭每月生活費", { exact: true }).fill("12345");
  await page.getByRole("button", { name: "家庭預算", exact: true }).click();
  await page
    .locator(".workspace:visible")
    .getByLabel("每月預計投入 ETF 金額")
    .fill("");
  await page.getByRole("button", { name: "退休提領", exact: true }).click();
  await expect(box.getByLabel("家庭每月生活費", { exact: true })).toHaveValue(
    "12,345",
  );
  await box
    .getByRole("button", { name: "帶入家庭預算資料", exact: true })
    .click();
  await expect(box).toContainText("不採用暫留舊結果");
  await expect(box.getByLabel("家庭每月生活費", { exact: true })).toHaveValue(
    "12,345",
  );
  await box.getByLabel("目前 ETF／股票市值", { exact: true }).fill("1000000");
  await page.getByRole("button", { name: "長期複利", exact: true }).click();
  ui = page.locator(".workspace:visible");
  await ui.getByLabel("假設年化總報酬率", { exact: true }).fill("0");
  await ui
    .getByRole("button", { name: "將期末資產帶入退休提領", exact: true })
    .click();
  ui = page.locator(".workspace:visible");
  await expect(ui.getByLabel("現有資產起始市值", { exact: true })).toHaveValue(
    "1,800,000",
  );
  await expect(
    box.getByLabel("目前 ETF／股票市值", { exact: true }),
  ).toHaveValue("1,000,000");
  await box
    .getByRole("button", {
      name: "複製 Prompt｜AI 退休與轉職規劃",
      exact: true,
    })
    .click();
  const text = await copied(page);
  expect(text).toContain("未來名目資產 NT$ 1,800,000");
  expect(text).toContain("不另加總");
  expect(text).toContain("家庭預算主動帶入快照");
  expect(text).toContain("每月家庭稅後可支配收入");
});
test("退休Prompt剪貼簿拒絕可手動複製與重試，未填不影響原工具", async ({
  page,
}) => {
  const ui = await enter(page),
    box = ui.locator(".retirement-planning");
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("denied");
        },
      },
    }),
  );
  await box
    .getByRole("button", {
      name: "複製 Prompt｜AI 退休與轉職規劃",
      exact: true,
    })
    .click();
  await expect(box.getByRole("status").last()).toContainText(
    "無法複製：AI 退休與轉職規劃",
  );
  await box.getByText("展開待複製文字", { exact: true }).click();
  await expect(box.getByLabel("待複製文字")).toContainText(
    "基本生活需求無法可靠估算",
  );
  await expect(ui.locator(".hero-result")).toBeVisible();
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => {} },
    }),
  );
  await box
    .getByRole("button", {
      name: "複製 Prompt｜AI 退休與轉職規劃",
      exact: true,
    })
    .click();
  await expect(box.getByRole("status").last()).toHaveText(
    "已複製：AI 退休與轉職規劃",
  );
  await expect(box.getByLabel("待複製文字")).toHaveCount(0);
});
