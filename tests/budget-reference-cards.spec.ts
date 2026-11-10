import { test, expect, type Page } from "@playwright/test";
const colors = {
  normal: "rgb(248, 250, 246)",
  pink: "rgb(255, 240, 243)",
  yellow: "rgb(255, 248, 220)",
  unknown: "rgb(244, 245, 242)",
};
async function open(page: Page) {
  await page.goto("/tests/fixtures/budget-reference-cards.html");
  await expect(page.locator(".health-group")).toHaveCount(3);
}
async function tone(
  page: Page,
  id: string,
  expected: keyof typeof colors,
  reference: number,
) {
  const card = page.locator(`[data-group="${id}"]`);
  await expect(card).toHaveClass(`health-group tone-${expected}`);
  await expect(card).toHaveAttribute("data-tone", expected);
  await expect(card.locator("small")).toHaveText(`參考目標 ${reference}%`);
  await expect
    .poll(() => card.evaluate((el) => getComputedStyle(el).backgroundColor))
    .toBe(colors[expected]);
}
test("元件重現68.31／25.85／5.54，其他卡片造成赤字也不覆寫必要支出顏色", async ({
  page,
}) => {
  await open(page);
  await expect(page.getByRole("status")).toHaveAttribute(
    "data-mode",
    "balanced",
  );
  await expect(page.locator('[data-group="needs"] strong')).toHaveText(
    "68.31%",
  );
  await expect(page.locator('[data-group="needs"]')).toContainText(
    "高於參考目標 23.31 個百分點",
  );
  await tone(page, "needs", "pink", 45);
  await tone(page, "wants", "normal", 30);
  await tone(page, "savings", "yellow", 25);
  for (const amount of ["6000", "50000", "5540"]) {
    await page.getByLabel("測試savings金額").fill(amount);
    await tone(page, "needs", "pink", 45);
    await tone(page, "wants", "normal", 30);
  }
});
test("元件：必要44%一般、品質35%粉紅、儲蓄15%一般且低於25%不另變色", async ({
  page,
}) => {
  await open(page);
  await page.getByLabel("測試needs金額").fill("44000");
  await page.getByLabel("測試wants金額").fill("35000");
  await page.getByLabel("測試savings金額").fill("15000");
  await tone(page, "needs", "normal", 45);
  await tone(page, "wants", "pink", 30);
  await tone(page, "savings", "normal", 25);
  await expect(page.locator('[data-group="savings"]')).toContainText(
    "低於 25% 參考目標",
  );
});
test("元件以原始比例判斷，即使顯示四捨五入等於門檻仍正確換色", async ({
  page,
}) => {
  await open(page);
  await page.getByLabel("測試needs金額").fill("45000.001");
  await expect(page.locator('[data-group="needs"] strong')).toHaveText("45%");
  await tone(page, "needs", "pink", 45);
  await page.getByLabel("測試needs金額").fill("45000");
  await tone(page, "needs", "normal", 45);
  await page.getByLabel("測試wants金額").fill("30000.001");
  await expect(page.locator('[data-group="wants"] strong')).toHaveText("30%");
  await tone(page, "wants", "pink", 30);
  await page.getByLabel("測試wants金額").fill("30000");
  await tone(page, "wants", "normal", 30);
  await page.getByLabel("測試savings金額").fill("9999.999");
  await expect(page.locator('[data-group="savings"] strong')).toHaveText("10%");
  await tone(page, "savings", "yellow", 25);
  await page.getByLabel("測試savings金額").fill("10000");
  await tone(page, "savings", "normal", 25);
});
test("元件手動切換參考文字和顏色共用目標，自動模式再依收入立即切換", async ({
  page,
}) => {
  await open(page);
  await page.getByLabel("測試needs金額").fill("47000");
  await tone(page, "needs", "pink", 45);
  await page.getByLabel("測試模式").selectOption("basic");
  await tone(page, "needs", "normal", 55);
  await tone(page, "wants", "pink", 25);
  await page.getByLabel("測試月收入").fill("200000");
  await expect(page.getByRole("status")).toHaveAttribute("data-mode", "basic");
  await tone(page, "needs", "normal", 55);
  await page.getByLabel("測試模式").selectOption("auto");
  await expect(page.getByRole("status")).toHaveAttribute(
    "data-mode",
    "quality",
  );
  await tone(page, "needs", "normal", 35);
  await page.getByLabel("測試月收入").fill("100000");
  await tone(page, "needs", "pink", 45);
  await tone(page, "wants", "normal", 30);
  await page.getByLabel("測試月收入").fill("99000");
  await tone(page, "needs", "normal", 55);
  await tone(page, "wants", "pink", 25);
});
test("元件連續修改收入與支出，不沿用舊class或舊目標", async ({ page }) => {
  await open(page);
  for (const [income, needs, wants, savings, refs, tones] of [
    [
      "100000",
      "68310",
      "25850",
      "5540",
      [45, 30, 25],
      ["pink", "normal", "yellow"],
    ],
    [
      "100000",
      "44000",
      "35000",
      "15000",
      [45, 30, 25],
      ["normal", "pink", "normal"],
    ],
    [
      "99000",
      "60000",
      "20000",
      "10000",
      [55, 25, 20],
      ["pink", "normal", "normal"],
    ],
    [
      "200000",
      "60000",
      "80000",
      "11000",
      [35, 35, 30],
      ["normal", "pink", "yellow"],
    ],
    [
      "100000",
      "45000",
      "30000",
      "10000",
      [45, 30, 25],
      ["normal", "normal", "normal"],
    ],
  ] as const) {
    await page.getByLabel("測試月收入").fill(income);
    await page.getByLabel("測試needs金額").fill(needs);
    await page.getByLabel("測試wants金額").fill(wants);
    await page.getByLabel("測試savings金額").fill(savings);
    for (const [i, id] of ["needs", "wants", "savings"].entries())
      await tone(page, id, tones[i], refs[i]);
  }
});
test("元件收入無效時比例文字與class一起轉未知，恢復有效收入後立即恢復", async ({
  page,
}) => {
  await open(page);
  await page.getByLabel("測試月收入").fill("");
  for (const [id, reference] of [
    ["needs", 50],
    ["wants", 30],
    ["savings", 20],
  ] as const) {
    await tone(page, id, "unknown", reference);
    await expect(page.locator(`[data-group="${id}"] strong`)).toHaveText(
      "收入待確認",
    );
  }
  await page.getByLabel("測試月收入").fill("100000");
  await tone(page, "needs", "pink", 45);
  await tone(page, "savings", "yellow", 25);
});
