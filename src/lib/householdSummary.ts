import { selectedBudgetMode } from "./budgetModes";
import type { BudgetInput, BudgetRow } from "./budget";
import {
  healthCheck,
  entryGroup,
  groupNames,
  type BudgetEntry,
  type Group,
  type Allocation,
} from "./health";
import { livingFields } from "./living";
import { money } from "./finance";
import { parseNumericInput } from "./numberInput";
export interface HouseholdSnapshot {
  input: BudgetInput;
  current: BudgetRow;
  entries: BudgetEntry[];
  items: Allocation[];
}
const amount = (n: number | undefined) =>
  n !== undefined && Number.isFinite(n) ? `NT$ ${money(n, 2)}` : "未提供";
const ratio = (n: number | null) =>
  n === null
    ? "無法計算（無正收入）"
    : `${new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 }).format(n)}%`;
/** Format the existing calculation snapshot; do not run an independent budget model. */
export function householdSummary(
  values: Record<string, string>,
  snapshot?: HouseholdSnapshot,
) {
  const p = snapshot?.input,
    c = snapshot?.current,
    entries = snapshot?.entries ?? [];
  const categories = Object.fromEntries(
    entries.map((e) => [e.id, values[`group_${e.id}`] ?? e.group]),
  ) as Record<string, Group>;
  const mode = selectedBudgetMode(values, c?.income);
  const known = (key: string, n?: number) => {
    const draft = parseNumericInput(values[key]);
    if (!Number.isFinite(draft) || draft < 0 || draft > 1e12)
      return `未提供或待修正${n !== undefined ? `（畫面暫用最近有效值 ${amount(n)}）` : ""}`;
    return amount(n ?? draft);
  };
  const state = (key: string, subject: string) =>
    values[key] === "yes"
      ? `使用者自我確認${subject}（僅自我確認，未經驗證）`
      : values[key] === "no"
        ? `尚未確認${subject}（未勾選不代表一定沒有準備）`
        : "未提供";
  const lifeGroup = (group: Group) =>
    snapshot?.items.find(
      (x) => x.name === (group === "needs" ? "必要生活支出" : "非必要消費"),
    )?.value;
  const lines = [
    "【完整家庭收支摘要｜新臺幣】",
    "資料為使用者輸入與教育試算，不是經查證的帳戶紀錄。以下總額與月現金流直接沿用網站有效試算；輸入未完成時可能沿用最近有效值，不代表最新草稿已驗證。標示未提供的資料不得自行補為 0。",
    `試算月份：${c?.period ?? "未提供"}；每日基準：${c ? `${c.days} 天` : "未提供"}`,
    "\n【收入：實際固定金額與平均月額分列】",
    `薪資模式：${values.mode === "annual" ? "年薪總額（含獎金，不另加）" : "固定月薪＋年度獎金"}`,
    ...(values.mode === "annual"
      ? [`全年稅後工作總收入：${known("annualIncome", p?.annualIncome)}`]
      : [
          `固定月薪（使用者輸入的實際每月實領）：${known("salary", p?.salary)}`,
          `年度獎金：${known("annualBonus", p?.annualBonus)}`,
        ]),
    `全年工作收入：${amount(c?.annualEmployment)}`,
    `工作收入月平均（年收入含獎金 ÷ 12，不代表每月實收）：${amount(c?.employmentMonthly)}`,
    `其他每月固定收入：${known("otherIncome", p?.otherIncome)}`,
    `每年預估投資現金收入：${known("investmentCash", p?.investmentCash)}`,
    `投資現金收入處理：${({ spend: "納入家庭預算", exclude: "不納入家庭預算", reinvest: "再投入，不計入可支配現金" } as Record<string, string>)[values.cashTreatment] ?? "未提供"}`,
    `投資現金收入的年額換算月平均：${p ? amount(p.investmentCash / 12) : "未提供"}；實際配息月份未提供，股息不保證。`,
    `本月計入的投資現金收入（月平均）：${amount(c?.cashMonthly)}；不含未實現資本利得。`,
    `每月家庭稅後可支配收入（規劃用月平均）：${amount(c?.income)}；若輸入稅前收入，需先改為稅後金額。`,
    "\n【生活費：僅採目前有效來源】",
    `有效輸入模式：${values.livingMode === "detail" ? "19 項明細" : "快速輸入總額"}`,
    `每月必要生活支出總額：${amount(lifeGroup("needs"))}`,
    `每月非必要消費總額：${amount(lifeGroup("wants"))}`,
  ];
  if (values.livingMode === "detail") {
    for (const field of livingFields) {
      const e = entries.find((x) => x.id === field.id);
      lines.push(
        `${field.name}：${known(field.id, p?.livingDetails?.[field.id])}；用途分類：${e ? groupNames[entryGroup(e, categories)] : "未提供"}`,
      );
    }
  } else {
    lines.push(
      `快速必要總額：${known("necessaryTotal", p?.necessaryTotal)}`,
      `快速非必要總額：${known("discretionaryTotal", p?.discretionaryTotal)}`,
      "生活費細項：未提供（快速模式，不輸出另存但未採用的明細）。",
    );
  }
  lines.push("\n【貸款：月付與剩餘期數】");
  for (const [i, [key, months, name]] of (
    [
      ["mortgage", "mortgageMonths", "房貸"],
      ["carLoan", "carLoanMonths", "車貸"],
      ["credit", "creditMonths", "信貸"],
      ["otherLoan", "otherMonths", "其他貸款"],
    ] as const
  ).entries()) {
    const loan = p?.loans[i],
      draft = parseNumericInput(values[months]);
    lines.push(
      `${name}每月約定付款：${known(key, loan?.payment)}；剩餘期數：${Number.isInteger(draft) && draft >= 0 && draft <= 600 ? `${loan?.months ?? draft} 個月` : "未提供或待修正"}；利率、餘額、用途與本金／利息拆分：未提供。`,
    );
  }
  lines.push(
    `當期貸款付款總額：${amount(c?.loan)}（期數已結束的貸款不扣款；約定月付僅供對照，不再另加總）。`,
    "\n【每月規劃金額：各扣一次】",
    `ETF 投資：${known("etfMonthly", c?.etf)}；占月收入 ${ratio(c?.etfRatio ?? null)}。0050 僅教育案例，ETF 是有風險資產，不是一般消費或保本存款。`,
    `大型購物儲蓄（當期實際採用月存）：${amount(c?.purchase)}`,
    `旅遊基金儲蓄（當期月存）：${amount(c?.travel)}`,
    `其他每月儲蓄目標：${known("saving", p?.saving)}（獨立扣款，非 ETF、購物或旅遊；未包含於七類環圈切片）。`,
    `大型購買模式：${values.purchaseMode === "monthly" ? "指定每月儲蓄" : "指定購買時間"}；目標總額 ${known("purchasePrice", p?.purchasePrice)}；已備基金 ${known("purchaseFund", p?.purchaseFund)}`,
    `大型購物指定期限：${p ? `${p.purchaseMonths} 個月` : "未提供"}；指定月存：${known("purchaseMonthly", p?.purchaseMonthly)}；實際採用單一模式，不將兩者相加。`,
    `預計達標月數：${c?.goal.monthsToGoal === null ? "無法估算" : c ? `${c.goal.monthsToGoal} 個月` : "未提供"}`,
    `購買後每月持有成本設定：${known("purchaseCost", p?.purchaseCost)}；當期已生效 ${amount(c?.purchaseCost)}（已納入生活費分組，依使用者用途分類，僅計一次）。`,
    `旅行每次預算：${known("travelPrice", p?.travelPrice)}；現有基金：${known("travelFund", p?.travelFund)}；間隔：${p ? `${p.travelMonths} 個月` : "未提供"}`,
    "\n【月現金流與對帳】",
    `每月生活支出與貸款（不含儲蓄投資）：${c ? amount(c.income - c.available) : "未提供"}`,
    `每月目標儲蓄及 ETF 投資合計：${amount(c?.goals)}`,
    `每月總分配／總支出（含目標儲蓄與 ETF 現金流出）：${c ? amount(c.income - c.remaining) : "未提供"}；ETF 與儲蓄為資產轉換，不全是消費。`,
    `每月實際結餘或赤字：${amount(c?.remaining)}${c ? (c.remaining < 0 ? "（赤字）" : c.remaining === 0 ? "（無結餘）" : "（結餘）") : ""}`,
    `每日平均可支配金額：${amount(c?.daily)}（當月天數換算，非銀行餘額）。`,
    `對帳：月收入 − 生活支出與貸款 − 目標儲蓄及 ETF ＝ 月結餘。上述子項、CFPB 與環圈是同筆資金的不同呈現，不可再相加扣款。`,
    "\n【參考預算模式：依用途，不同於環圈資金流向】",
    `模式選擇：${mode.selection === "auto" ? "依收入自動推薦" : "手動選擇"}；目前採用 ${mode.preset.name}。${mode.note}`,
    `推薦基準家庭全年稅後可支配收入：${amount(mode.annualIncome)}（同一有效家庭月平均 × 12，不重複加計月薪、年薪或獎金）。`,
  );
  if (c) {
    const h = healthCheck(entries, c.income, categories, undefined, mode.mode);
    for (const g of h.groups)
      lines.push(
        `${g.name}：${amount(g.value)}；占同一稅後月收入 ${ratio(g.ratio)}；參考目標 ${g.reference}%；每月參考金額 ${amount(mode.monthlyIncome === undefined ? undefined : (mode.monthlyIncome * g.reference) / 100)}；${mode.monthlyIncome === undefined ? "目前收入未完成，暫不判定比例狀態。" : g.message}`,
      );
    lines.push(
      "各筆用途分類：" +
        entries
          .filter((e) => e.flow !== "living")
          .map((e) => `${e.name}→${groupNames[entryGroup(e, categories)]}`)
          .join("；"),
    );
  } else lines.push("CFPB 分析結果：未提供（尚無完整有效試算）。");
  lines.push(
    "經典50／30／20為經典參考；其餘比例及收入門檻是本站教育性設計，不是官方統計標準。所有比例是參考目標，不是支出上限、必須花完的額度或強制儲蓄額。低於消費比例或高於儲蓄目標不是異常。儲蓄低於10%僅教育性提示，不證明缺乏合理安排；貸款本金與利息未知時整筆只計一次。",
    "每月預算結餘是尚未分配的現金流，不是實際累積現金資產；不能只憑結餘大就認定現金過多或強迫投資。缺少現金存量、用途與緊急預備金資料時不得判定資產配置失衡。",
    "\n【財務安全自我確認，非驗證結果】",
    `緊急預備金 3～6 個月：${state("emergencyConfirmed", "已準備緊急預備金")}`,
    `已開始退休儲蓄或投資並定期檢視（不代表退休資金足夠）：${state("retirementConfirmed", "已開始為退休儲蓄或投資並定期檢視規劃")}`,
    "年齡、預計退休年齡、目前投資與退休資產、流動儲蓄金額、退休後生活費、風險承受能力、勞保勞退資格及預期給付：未提供。不可當作 0 或自行判定達標。",
    "\n【未來現金流設定】",
    `預測期間：${values.forecastYears ?? "未提供"} 年。${p?.change ? `自第 ${p.change.month} 個月起工作收入月平均 ${amount(p.change.employmentMonthly)}；必要生活費 ${amount(p.change.necessaryLiving ?? p.change.living)}；非必要消費 ${amount(p.change.discretionaryLiving)}。` : "未設定額外收入／生活費變動，不代表未來不會變化。"}`,
    "現金流不是累積資產；未自動納入年齡、調薪與通膨。購物與旅行月存不假設利息及價格變動。收入與股息月平均不代表實際入帳月份。",
    "資料僅包含預算欄位，未輸出姓名、地址、電話、帳號或自由文字目標名稱。",
  );
  return lines.join("\n");
}
