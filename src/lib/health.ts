import { bounded } from "./finance";
import type { BudgetInput, BudgetRow } from "./budget";
export type Group = "needs" | "wants" | "savings";
export const groupNames: Record<Group, string> = {
  needs: "必要支出",
  wants: "非必要消費",
  savings: "儲蓄與財務目標",
};
export const livingFields = [
  { id: "food", name: "伙食", color: "#71917a", group: "needs", cap: 15 },
  { id: "child", name: "育兒與家庭", color: "#a7bc94", group: "needs" },
  { id: "insurance", name: "保險", color: "#8488a7", group: "needs", cap: 10 },
  { id: "transport", name: "交通", color: "#789ca4", group: "needs", cap: 10 },
  { id: "utilities", name: "水電", color: "#b7aa7b", group: "needs", cap: 5 },
  { id: "telecom", name: "電信費", color: "#9b9ac3", group: "needs", cap: 3 },
  {
    id: "subscriptions",
    name: "工具與娛樂訂閱",
    color: "#c397a6",
    group: "wants",
    cap: 5,
  },
  { id: "otherLiving", name: "其他生活支出", color: "#91a38b", group: "needs" },
] as const;
export const detailLimits = {
  food: 15,
  insurance: 10,
  transport: 10,
  utilities: 5,
  telecom: 3,
  subscriptions: 5,
};
export type LimitId = keyof typeof detailLimits;
export type Limits = Record<LimitId, number>;
export type LivingDetails = Record<
  "food" | "child" | "insurance" | "transport" | "utilities" | "otherLiving",
  number
>;
export interface BudgetEntry {
  id: string;
  name: string;
  value: number;
  color: string;
  group: Group;
}
/** A single-entry ledger is shared by the donut and 50/30/20. The remainder is deliberately excluded from savings. */
export function budgetEntries(
  input: BudgetInput,
  row: BudgetRow,
  details?: LivingDetails,
): BudgetEntry[] {
  const living: BudgetEntry[] = details
    ? livingFields
        .filter((x) => x.id !== "telecom" && x.id !== "subscriptions")
        .map((x) => ({
          ...x,
          value: bounded(details[x.id as keyof LivingDetails], x.name),
        }))
    : [
        {
          id: "otherLiving",
          name: "其他生活支出（總額）",
          value: row.baseLiving,
          color: "#91a38b",
          group: "needs",
        },
      ];
  return [
    ...living,
    {
      id: "telecom",
      name: "電信費",
      value: input.telecom,
      color: "#9b9ac3",
      group: "needs",
    },
    {
      id: "subscriptions",
      name: "工具與娛樂訂閱",
      value: input.subscriptions,
      color: "#c397a6",
      group: "wants",
    },
    {
      id: "loans",
      name: "貸款（房貸、車貸、信貸等）",
      value: row.loan,
      color: "#b48958",
      group: "needs",
    },
    {
      id: "purchaseCost",
      name: "購入後額外持有成本",
      value: row.purchaseCost,
      color: "#9b9980",
      group: "needs",
    },
    {
      id: "purchase",
      name: "大型購買目標儲蓄",
      value: row.purchase,
      color: "#c6ad77",
      group: "savings",
    },
    {
      id: "travel",
      name: "旅行目標儲蓄",
      value: row.travel,
      color: "#c6ad77",
      group: "wants",
    },
    {
      id: "saving",
      name: "其他儲蓄",
      value: input.saving,
      color: "#9287a4",
      group: "savings",
    },
    {
      id: "etf",
      name: "ETF 投資",
      value: row.etf,
      color: "#216b53",
      group: "savings",
    },
  ];
}
export interface Allocation {
  name: string;
  value: number;
  color: string;
}
export function allocations(
  entries: BudgetEntry[],
  remaining: number,
): Allocation[] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const living = livingFields.map((f) => ({
    name:
      f.id === "otherLiving"
        ? (byId.get("otherLiving")?.name ?? f.name)
        : f.name,
    value:
      (byId.get(f.id)?.value ?? 0) +
      (f.id === "otherLiving" ? (byId.get("purchaseCost")?.value ?? 0) : 0),
    color: f.color,
  }));
  return [
    ...living,
    {
      name: "貸款（房貸、車貸、信貸等）",
      value: byId.get("loans")?.value ?? 0,
      color: "#b48958",
    },
    {
      name: "大型購買與旅行目標儲蓄",
      value:
        (byId.get("purchase")?.value ?? 0) + (byId.get("travel")?.value ?? 0),
      color: "#c6ad77",
    },
    {
      name: "其他儲蓄",
      value: byId.get("saving")?.value ?? 0,
      color: "#9287a4",
    },
    { name: "ETF 投資", value: byId.get("etf")?.value ?? 0, color: "#216b53" },
    { name: "剩餘金錢", value: Math.max(0, remaining), color: "#c8d9bf" },
  ].filter((x) => x.value > 0);
}
export function detailComparison(
  income: number,
  expense: number,
  limit: number,
) {
  bounded(income, "稅後月收入", 0, Number.MAX_VALUE);
  bounded(expense, "每月支出");
  bounded(limit, "參考上限", 0, 100);
  if (income === 0)
    return {
      actual: null,
      excessPoints: null,
      target: 0,
      excess: null,
      annual: null,
    };
  const actual = (expense / income) * 100,
    excess = Math.max(0, expense - (income * limit) / 100);
  return {
    actual,
    excessPoints: actual - limit,
    target: (income * limit) / 100,
    excess,
    annual: excess * 12,
  };
}
export function healthCheck(
  entries: BudgetEntry[],
  income: number,
  categories: Record<string, Group> = {},
  limits: Limits = { ...detailLimits },
) {
  bounded(income, "稅後月收入", 0, Number.MAX_VALUE);
  Object.values(limits).forEach((v) => bounded(v, "細項參考上限", 0, 100));
  const sums: Record<Group, number> = { needs: 0, wants: 0, savings: 0 };
  const seen = new Set<string>();
  entries.forEach((e) => {
    if (seen.has(e.id)) throw new Error("收支項目不可重複計入");
    seen.add(e.id);
    bounded(e.value, e.name, 0, Number.MAX_VALUE);
    const group = categories[e.id] ?? e.group;
    if (!Object.hasOwn(sums, group)) throw new Error("請選擇有效的支出分類");
    sums[group] += e.value;
  });
  const groups = (["needs", "wants", "savings"] as const).map((id) => ({
    id,
    name: groupNames[id],
    value: sums[id],
    ratio: income > 0 ? (sums[id] / income) * 100 : null,
    reference: { needs: 50, wants: 30, savings: 20 }[id],
  }));
  const advice = entries
    .filter((e) => e.id in limits)
    .map((e) => ({
      id: e.id,
      name: e.name,
      limit: limits[e.id as LimitId],
      ...detailComparison(income, e.value, limits[e.id as LimitId]),
    }))
    .filter((e) => e.excess !== null && e.excess > 1e-7)
    .sort((a, b) => b.excess! - a.excess!)
    .slice(0, 4);
  return {
    groups,
    advice,
    total: sums.needs + sums.wants + sums.savings,
    emergencyMin: sums.needs * 3,
    emergencyMax: sums.needs * 6,
  };
}
export interface InvestmentNotice {
  kind: "deficit" | "affordability" | "emergency" | "planning";
  text: string;
}
export function investmentCheck(
  row: BudgetRow,
  emergencyConfirmed: boolean,
): InvestmentNotice[] {
  const messages: InvestmentNotice[] = [];
  if (row.remaining < 0)
    messages.push({
      kind: "deficit",
      text: "家庭現金流赤字，請優先處理收支缺口，再評估 ETF 投入計畫。",
    });
  if (row.etfGap > 0)
    messages.push({
      kind: "affordability",
      text: "ETF 目標投入超過扣除其他支出與既定目標後的可負擔金額。請檢視投入額；系統保留你的計畫金額，沒有自動截成零或降低投入。",
    });
  if (!emergencyConfirmed)
    messages.push({
      kind: "emergency",
      text: "尚未確認緊急預備金，請先檢視必要生活支出及可動用的流動儲蓄。系統沒有你的流動儲蓄資料，不能判定已達標。",
    });
  if (row.remaining >= 0 && row.etfGap === 0 && emergencyConfirmed)
    messages.push({
      kind: "planning",
      text: "此情境可負擔設定的投資金額。請搭配長期目標、風險承受能力及收入穩定性檢視；金額為 0 也不會判定不足。",
    });
  return messages;
}
export const references = [
  {
    institution: "Consumer Financial Protection Bureau (CFPB)",
    title: "Analyzing Budgets",
    content:
      "50／30／20 預算參考法則：以稅後可支配收入比較必要支出、非必要消費與儲蓄目標。",
    url: "https://files.consumerfinance.gov/f/documents/cfpb_building_block_activities_analyzing-budgets_guide.pdf",
  },
  {
    institution: "Fidelity Investments",
    title: "How Much Should I Save for Retirement?",
    content:
      "每年約稅前收入 15% 的退休儲蓄參考目標，包含符合條件的雇主退休金提撥；不是 ETF 最低投入比例。",
    url: "https://www.fidelity.com/viewpoints/retirement/how-much-money-should-I-save",
  },
  {
    institution: "Federal Reserve Bank of St. Louis",
    title: "When the Unexpected Happens, Be Ready with an Emergency Fund",
    content:
      "緊急預備金一般以 3～6 個月必要生活支出作參考，不代表個別家庭已達標。",
    url: "https://www.stlouisfed.org/publications/page-one-economics/2025/sep/when-unexpected-happens-be-ready-with-emergency-fund",
  },
  {
    institution: "U.S. Bureau of Labor Statistics (BLS)",
    title: "Consumer Expenditures in 2024",
    content: "消費支出統計僅作背景參考，不作為細項支出上限。",
    url: "https://www.bls.gov/opub/reports/consumer-expenditures/2024/home.htm",
  },
];
