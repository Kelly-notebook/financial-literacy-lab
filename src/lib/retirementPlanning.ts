import { parseNumericInput } from "./numberInput";
import { money, MAX_MONEY, type RetirementInput, retirement } from "./finance";
import { currentTaipeiMonth, periodFor } from "./budget";
import { livingFields } from "./living";
import type { HouseholdSnapshot } from "./householdSummary";
import type { RetirementTransfer } from "./savingsComparison";
export type Time = { mode: "year" | "roc" | "age"; value: string };
export const emptyTime = (): Time => ({ mode: "year", value: "" });
export interface LoanPlan {
  id: string;
  name: string;
  monthly: string;
  end: Time;
}
export interface Benefit {
  id: string;
  name: string;
  kind: "monthly" | "once";
  amount: string;
  start: Time;
  end: Time;
  ongoing: boolean;
  status: "pending" | "confirmed";
}
export interface Planning {
  age: string;
  leave: Time;
  reason: string;
  work: string;
  retireAge: string;
  stocks: string;
  cash: string;
  otherAssets: string;
  invest: string;
  saving: string;
  spouse: string;
  spouseDuration: string;
  spouseEnd: Time;
  children: string;
  childAges: string;
  living: string;
  ownHome: string;
  responsibility: string;
  fixed: string;
  retirementLiving: string;
  year: string;
  loans: LoanPlan[];
  benefits: Benefit[];
}
export const planningDefaults = (): Planning => ({
  age: "",
  leave: emptyTime(),
  reason: "",
  work: "",
  retireAge: "",
  stocks: "",
  cash: "",
  otherAssets: "",
  invest: "",
  saving: "",
  spouse: "",
  spouseDuration: "",
  spouseEnd: emptyTime(),
  children: "",
  childAges: "",
  living: "",
  ownHome: "",
  responsibility: "",
  fixed: "",
  retirementLiving: "",
  year: "",
  loans: [
    { id: "mortgage", name: "房貸", monthly: "", end: emptyTime() },
    { id: "other", name: "其他貸款", monthly: "", end: emptyTime() },
  ],
  benefits: [],
});
export function optionalNumber(text: string, max = MAX_MONEY, integer = false) {
  const n = parseNumericInput(text);
  return Number.isFinite(n) &&
    n >= 0 &&
    n <= max &&
    (!integer || Number.isInteger(n))
    ? n
    : undefined;
}
export function resolveYear(
  t: Time,
  age: string,
  baseYear: number,
): number | undefined {
  const n = optionalNumber(t.value, t.mode === "age" ? 120 : 3000, true);
  if (n === undefined) return;
  const a = optionalNumber(age, 120, true);
  const y =
    t.mode === "roc"
      ? n + 1911
      : t.mode === "age"
        ? a === undefined
          ? NaN
          : baseYear + n - a
        : n;
  return Number.isInteger(y) && y >= 1900 && y <= 2200 ? y : undefined;
}
export const planningLabels = {
  age: "目前年齡",
  reason: "離職情境",
  work: "離職後是否預計繼續工作",
  retireAge: "希望完全退休的年齡",
  stocks: "目前 ETF／股票市值",
  cash: "現金及銀行存款",
  otherAssets: "其他退休投資資產",
  invest: "每月持續投資金額",
  saving: "其他每月儲蓄目標",
  spouse: "配偶每月稅後收入",
  spouseDuration: "配偶收入持續方式",
  children: "子女人數",
  childAges: "各子女年齡",
  living: "家庭每月生活費",
  ownHome: "是否擁有自住房產",
  responsibility: "其他扶養責任說明",
  fixed: "其他扶養或固定支出月額",
  retirementLiving: "完全退休後每月生活費",
  year: "試算年份（西元）",
} as const;
export type BudgetTransfer = {
  values: Record<string, string>;
  snapshot?: HouseholdSnapshot;
  summary: string;
};
/** Validate active raw drafts before importing; fallback calculation values are never passed off as new inputs. */
export function budgetPlanningPatch(t: BudgetTransfer) {
  const p = t.snapshot?.input,
    c = t.snapshot?.current,
    v = t.values;
  if (!p || !c) throw new Error("家庭預算尚無完整有效試算，請先完成家庭資料。");
  const keys = [
    ...(v.mode === "annual" ? ["annualIncome"] : ["salary", "annualBonus"]),
    "otherIncome",
    "investmentCash",
    "etfMonthly",
    "saving",
    "purchasePrice",
    "purchaseFund",
    ...(v.purchaseMode === "monthly"
      ? ["purchaseMonthly"]
      : ["purchaseMonths"]),
    "purchaseCost",
    "travelPrice",
    "travelFund",
    "travelMonths",
    ...(v.livingMode === "detail"
      ? livingFields.map((f) => f.id)
      : ["necessaryTotal", "discretionaryTotal"]),
    "mortgage",
    "mortgageMonths",
    "carLoan",
    "carLoanMonths",
    "credit",
    "creditMonths",
    "otherLoan",
    "otherMonths",
  ];
  const periodKeys = new Set([
    "mortgageMonths",
    "carLoanMonths",
    "creditMonths",
    "otherMonths",
    "travelMonths",
    "purchaseMonths",
  ]);
  if (
    keys.some((k) => {
      if (!periodKeys.has(k)) return optionalNumber(v[k] ?? "") === undefined;
      const n = optionalNumber(v[k] ?? "", 600, true);
      return (
        n === undefined ||
        ((k === "travelMonths" || k === "purchaseMonths") && n < 1)
      );
    })
  )
    throw new Error(
      "家庭資料有空白或無效草稿，請先修正再帶入；不採用暫留舊結果。",
    );
  const names = ["房貸", "車貸", "信貸", "其他貸款"];
  const loans = p.loans.map((l, i) => ({
    id: `budget-${i}`,
    name: names[i],
    monthly: String(l.months === 0 ? 0 : l.payment),
    end: {
      mode: "year" as const,
      value:
        l.months > 0
          ? periodFor(p.startMonth, l.months).period.slice(0, 4)
          : "",
    },
  }));
  return {
    living: String(c.living + c.purchaseCost),
    invest: String(c.etf),
    saving: String(c.purchase + c.travel + p.saving),
    loans,
  };
}
export function incomeGap(p: Planning, baseYear: number) {
  const missing: string[] = [];
  const need = (s: string, label: string, max = MAX_MONEY, integer = false) => {
    const n = optionalNumber(s, max, integer);
    if (n === undefined) missing.push(label);
    return n ?? 0;
  };
  const leave = resolveYear(p.leave, p.age, baseYear);
  if (leave === undefined)
    missing.push("離開原工作的年份／年齡（以年齡填寫時需目前年齡）");
  const year = p.year.trim() ? optionalNumber(p.year, 2200, true) : leave;
  if (year === undefined || year < baseYear || year > 2200)
    missing.push("有效試算年份（不得早於今年）");
  if (leave !== undefined && leave < baseYear)
    missing.push("離職年份不得早於今年");
  if (year !== undefined && leave !== undefined && year < leave)
    missing.push("試算年份不得早於離職年份");
  const age = optionalNumber(p.age, 120, true),
    retireAge = optionalNumber(p.retireAge, 120, true);
  if (p.age.trim() && age === undefined) missing.push("有效目前年齡");
  if (
    p.retireAge.trim() &&
    (retireAge === undefined || age === undefined || retireAge < age)
  )
    missing.push("有效完全退休年齡及目前年齡");
  if (
    age !== undefined &&
    retireAge !== undefined &&
    leave !== undefined &&
    baseYear + retireAge - age < leave
  )
    missing.push("完全退休時間不得早於離開原工作");
  const living = need(p.living, "家庭每月生活費"),
    fixed = need(p.fixed, "其他扶養或固定支出月額（無則填 0）");
  let loan = 0;
  p.loans.forEach((l) => {
    const n = need(l.monthly, `${l.name}月付額（無則填 0）`);
    if (n > 0) {
      const end = resolveYear(l.end, p.age, baseYear);
      if (end === undefined) missing.push(`${l.name}結束年份`);
      else if (year !== undefined && year <= end) loan += n;
    }
  });
  const spouse = need(p.spouse, "配偶稅後收入（無則填 0）");
  let spouseIncome = 0;
  if (spouse > 0) {
    if (p.spouseDuration === "ongoing") spouseIncome = spouse;
    else if (p.spouseDuration === "until") {
      const end = resolveYear(p.spouseEnd, p.age, baseYear);
      if (end === undefined) missing.push("配偶收入結束時間");
      else if (year !== undefined && year <= end) spouseIncome = spouse;
    } else missing.push("配偶收入是否持續");
  }
  let benefitIncome = 0;
  const excluded: string[] = [];
  for (const [i, b] of p.benefits.entries()) {
    const name = b.name.trim() || `第 ${i + 1} 筆收入`;
    if (b.status !== "confirmed") {
      excluded.push(`${name}：尚待確認，不列入確定收入`);
      continue;
    }
    if (b.kind === "once") {
      excluded.push(`${name}：一次性給付，不列每月收入，也未自動加入資產`);
      continue;
    }
    const n = need(b.amount, `${name}有效月額`),
      start = resolveYear(b.start, p.age, baseYear),
      end = b.ongoing ? undefined : resolveYear(b.end, p.age, baseYear);
    if (
      start === undefined ||
      (!b.ongoing && end === undefined) ||
      (start !== undefined && end !== undefined && end < start)
    )
      missing.push(`${name}有效起訖時間`);
    else if (
      year !== undefined &&
      start !== undefined &&
      year >= start &&
      (end === undefined || year <= end)
    )
      benefitIncome += n;
  }
  const expenses = living + fixed + loan,
    income = spouseIncome + benefitIncome;
  const invest = optionalNumber(p.invest),
    saving = optionalNumber(p.saving);
  const goalsMissing = [
    ...(invest === undefined ? ["每月持續投資金額（無則填 0）"] : []),
    ...(saving === undefined ? ["其他每月儲蓄目標（無則填 0）"] : []),
  ];
  const basic = missing.length ? undefined : Math.max(0, expenses - income);
  const goals =
    basic === undefined || goalsMissing.length
      ? undefined
      : Math.max(0, expenses + (invest ?? 0) + (saving ?? 0) - income);
  return {
    year,
    leave,
    age:
      age === undefined || year === undefined
        ? undefined
        : age + year - baseYear,
    retireYear:
      age === undefined || retireAge === undefined
        ? undefined
        : baseYear + retireAge - age,
    expenses,
    income,
    loan,
    spouseIncome,
    benefitIncome,
    basic,
    goals,
    missing,
    goalsMissing,
    excluded,
  };
}
export function timeDescription(t: Time, p: Planning, baseYear: number) {
  const y = resolveYear(t, p.age, baseYear);
  return t.value.trim()
    ? `${t.mode === "roc" ? "民國" : t.mode === "age" ? "年齡" : "西元"} ${t.value}（${y === undefined ? "待修正／缺目前年齡" : `西元 ${y} 年`}）`
    : "未提供";
}
export function planningSummary(
  p: Planning,
  baseYear: number,
  budget?: BudgetTransfer,
) {
  const gap = incomeGap(p, baseYear);
  return [
    "【進階退休與轉職資料】",
    `時間基準：西元 ${baseYear} 年；年齡換算為年度近似，未取得生日。離開原工作不等於完全退休。`,
    ...Object.entries(planningLabels).map(([key, label]) => {
      const text = p[key as keyof typeof planningLabels].trim();
      const textFields = [
        "reason",
        "work",
        "spouseDuration",
        "childAges",
        "ownHome",
        "responsibility",
      ];
      if (!text) return `${label}：未提供`;
      if (key === "spouseDuration")
        return `${label}：${text === "ongoing" ? "使用者假設持續" : text === "until" ? "至指定結束時間" : "未確認"}`;
      const integer = ["age", "retireAge", "children", "year"].includes(key);
      const invalid =
        !textFields.includes(key) &&
        optionalNumber(
          text,
          integer ? (key === "year" ? 2200 : 120) : MAX_MONEY,
          integer,
        ) === undefined;
      return `${label}：${invalid ? `待修正（原始輸入 ${text}，不得用於數值估算）` : text}`;
    }),
    `預計離開原工作：${timeDescription(p.leave, p, baseYear)}`,
    `配偶收入結束：${p.spouseDuration === "ongoing" ? "使用者假設持續" : timeDescription(p.spouseEnd, p, baseYear)}`,
    ...p.loans.map(
      (l) =>
        `${l.name}：每月 ${l.monthly || "未提供"}；最後還款年份 ${timeDescription(l.end, p, baseYear)}`,
    ),
    p.benefits.length
      ? "【給付與其他收入：使用者自述，未查證制度資格】"
      : "給付／其他收入：未提供（不是已確認為 0）",
    ...p.benefits.map(
      (b, i) =>
        `${i + 1}. ${b.name || "名稱未提供"}；${b.kind === "once" ? "一次性" : "每月"} NT$ ${b.amount || "未提供"}；開始 ${timeDescription(b.start, p, baseYear)}；結束 ${b.kind === "once" ? "一次性，不適用" : b.ongoing ? "使用者設定持續" : timeDescription(b.end, p, baseYear)}；${b.status === "confirmed" ? "使用者自述已確認，非網站查證" : "尚待確認，不得當作確定收入"}`,
    ),
    "【指定年份簡化收入缺口】",
    `試算年份：${gap.year ?? "未提供"}；離職年份：${gap.leave ?? "未提供"}；完全退休年份：${gap.retireYear ?? "未提供"}`,
    gap.basic === undefined
      ? `基本生活需求無法可靠估算，缺少／待修正：${gap.missing.join("、")}`
      : `基本生活最低稅後工作月收入 NT$ ${money(Math.ceil(gap.basic))}（向上取整至元）＝ceil(max(0, 當期支出 ${money(gap.expenses, 2)}－配偶 ${money(gap.spouseIncome, 2)}－已確認月收入 ${money(gap.benefitIncome, 2)}))`,
    gap.goals === undefined
      ? `維持儲蓄需求無法可靠估算：${[...gap.missing, ...gap.goalsMissing].join("、")}`
      : `維持儲蓄目標最低稅後工作月收入 NT$ ${money(Math.ceil(gap.goals))}（向上取整至元；另加投資 ${p.invest}、其他目標 ${p.saving}，只計一次）`,
    ...gap.excluded,
    "本試算是指定年份的月平均缺口，沿用輸入生活費與目標的名目金額，不自動調通膨或子女教育費；起訖年份整年視為有效，貸款結束年整年仍扣款。不能代表年內空窗或完整逐年現金流。即使已完全退休，有缺口仍是需補足的收入，不代表應工作或可安全退休。",
    "今天資產各類須互斥；不將現有資產、未來期末資產、一次性給付、自住房屋或原提領試算相加或抵扣此工作收入需求。相同資產的股息與含息報酬不得重複使用。未確認及未填的其他收入不扣抵；結果是僅採已確認收入的條件情境，不表示未提供收入為 0。",
    budget
      ? `【家庭預算主動帶入快照，非自動同步】\n${budget.summary}\n快照僅供來源參考，現行進階欄位是本次缺口唯一計算來源，不可把快照支出／收入再次相加。家庭配偶收入是否包含在原收入及其他收入是否持續，需使用者確認；帶入的目標及生活費不會自動隨年份變動。`
      : "家庭預算資料：尚未主動帶入。",
    "尚需確認：給付資格及可否併領、實際入帳月份、未確認金額、未填資產、配偶收入持續性、子女教育與扶養變動、資產時間是否對齊；空白不得當成 0。",
  ].join("\n");
}
export function retirementSummary(
  values: Record<string, string>,
  input: RetirementInput | undefined,
  rows: ReturnType<typeof retirement> | undefined,
  issue: string | undefined,
  source?: RetirementTransfer,
  comparisons?: {
    gap: number;
    strategies: { strategy: string; rows: ReturnType<typeof retirement> }[];
    returns: number[];
    forward: ReturnType<typeof retirement>;
    reverse: ReturnType<typeof retirement>;
  },
) {
  const activeKeys = [
    "mode",
    "rate",
    "strategy",
    "annual",
    "inflation",
    "age",
    "years",
    "label",
    ...(values.label === "custom" ? ["customLabel"] : []),
    ...(values.mode === "need"
      ? [
          "gapMode",
          ...(values.gapMode === "direct" ? ["gap"] : ["expenses", "income"]),
        ]
      : values.assetMode === "shares"
        ? [
            "assetMode",
            "holdingCount",
            ...Array.from({ length: Number(values.holdingCount) }, (_, i) => [
              `code${i + 1}`,
              `shares${i + 1}`,
              `price${i + 1}`,
            ]).flat(),
          ]
        : ["assetMode", "initial"]),
  ];
  return [
    "【原退休提領試算：有效結果與目前輸入狀態】",
    `目前有效來源的輸入草稿（annual／inflation／rate 單位為 %；金額為 NT$；age 為歲，years 為年）：${activeKeys.map((k) => `${k}=${values[k] || "未提供"}`).join("；")}`,
    issue
      ? `目前草稿待修正：${issue}；下列是最近有效試算，不得冒充最新輸入的結果。`
      : "目前草稿有效。",
    input
      ? `有效計算參數：起始資產 NT$ ${money(input.initial, 2)}；退休起始年齡 ${input.age}；期間 ${input.years} 年；提領率 ${input.rate * 100}%；策略 ${input.strategy}；年化名目總報酬 ${input.annual * 100}%；通膨 ${input.inflation * 100}%。`
      : "有效試算：未提供",
    ...(rows?.map(
      (r) =>
        `第 ${r.year} 年／${r.age} 歲：預定提領 ${money(r.demand, 2)}；實際提領 ${money(r.withdrawal, 2)}；累積實領 ${money(r.cumulative, 2)}；期末名目資產 ${money(r.balance, 2)}；起始年購買力資產 ${money(r.realBalance, 2)}；需求不足 ${r.unmet ? "是" : "否"}；耗盡 ${r.exhausted ? "是" : "否"}`,
    ) ?? []),
    ...(comparisons
      ? [
          `有效投資月缺口參數：NT$ ${money(comparisons.gap, 2)}（僅在需求倒推方向使用）`,
          ...comparisons.strategies.map(
            (s) =>
              `同條件策略比較 ${s.strategy}：累積實領 ${money(s.rows.at(-1)!.cumulative, 2)}；期末資產 ${money(s.rows.at(-1)!.balance, 2)}；首次不足／耗盡 ${s.rows.find((x) => x.unmet || x.exhausted)?.year ?? "未發生"}`,
          ),
          "報酬順序人工示範（非歷史資料）：",
          ...comparisons.forward.map(
            (x, i) =>
              `第 ${x.year} 年：原序報酬 ${comparisons.returns[i] * 100}%；反序報酬 ${comparisons.returns[comparisons.returns.length - 1 - i] * 100}%；原序餘額 ${money(x.balance, 2)}；反序餘額 ${money(comparisons.reverse[i].balance, 2)}`,
          ),
        ]
      : []),
    source
      ? `長期複利帶入來源紀錄：${source.scenario}、累積 ${source.years} 年、未來名目資產 NT$ ${money(source.assets, 2)}。此為未來退休起始市值，不是今天現有資產；帶入後可能已手動修改，以有效參數為準，不另加總。${source.baseYear === undefined ? "未指定絕對退休年份" : `累積時間基準 ${source.baseYear} 年起，約 ${source.baseYear + source.years} 年期末`}，不得自動當成離職年份的資金。`
      : "未有長期複利帶入來源；原模擬起始市值的現有／未來時間基準需使用者確認。",
    "原退休模擬按年初提領、年末報酬，總報酬含股息；提領率不是保證結果，與進階轉職缺口分別試算，不自動混用或重算。",
  ].join("\n");
}
export const retirementTask = `請扮演熟悉臺灣家庭理財、退休規劃與職涯轉換的財務教育顧問。
請依序分析：1. 離職或退伍時家庭財務最重要的風險。2. 轉職至少需要多少稅後月薪維持基本生活。3. 維持儲蓄或投資目標建議尋找多少稅後月薪以上的工作。4. 不同完全退休年齡下，繼續工作與儲蓄到幾歲較合理。5. 房貸、子女、扶養責任、配偶收入持續性及各項給付起訖如何影響分階段現金流。6. 最優先兩至三項具體行動。
離開原工作不等於完全退休。沿用網站有效計算與限制，僅在資料足夠時比較兩種完全退休年齡或轉職收入情境，清楚列出計算依據與額外假設；不要自行填補未知資料。`;
export function retirementPrompt(summary: string) {
  return `【本次分析任務：AI 退休與轉職規劃】\n${retirementTask}\n\n${summary}\n\n【精簡輸出要求】\n繁體中文、新臺幣，約 250～400 個中文字，必要可稍超或用簡短表格；直接列關鍵金額、年份、年齡、計算依據與行動，不重抄資料、不空泛鼓勵。資料不足時說明無法可靠估算的結論及最需要補充的資料。不得把未填資料當 0、未確認給付當確定收入，或重複加總資產／支出／收入。尊重家庭責任，不強迫削減合理支出；孝親與親屬支援需依負擔能力檢視，不一律取消或認定不可調整。不得僅憑軍人、原住民或其他身分推定給付資格、金額及能否併領；需確認法規時提醒查詢相關主管機關最新官方資訊。自我確認不是達標驗證；退休報酬與提領僅情境分析，不保證結果，不提供個別證券投資指令。`;
}
export const referenceYear = () => Number(currentTaipeiMonth().slice(0, 4));
