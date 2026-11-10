import { budgetModes, type BudgetMode } from "./budgetModes";
import { bounded } from "./finance";
import {
  separateExpenseKeys,
  type BudgetInput,
  type BudgetRow,
} from "./budget";
export type Group = "needs" | "wants" | "savings";
export const groupNames: Record<Group, string> = {
  needs: "必要支出",
  wants: "非必要消費",
  savings: "儲蓄與財務目標",
};
export { livingFields } from "./living";
import { livingFields } from "./living";
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
  flow?: "living";
}
/** A single-entry ledger is shared by the donut and 50/30/20. The remainder is deliberately excluded from savings. */
export function budgetEntries(
  input: BudgetInput,
  row: BudgetRow,
  details?: LivingDetails,
): BudgetEntry[] {
  const living: BudgetEntry[] = input.livingMode
    ? row.livingEntries
    : details
      ? livingFields
          .filter(
            (x) => !(separateExpenseKeys as readonly string[]).includes(x.id),
          )
          .map((x) => ({
            ...x,
            value: bounded(details[x.id as keyof LivingDetails] ?? 0, x.name),
            flow: "living",
          }))
      : [
          {
            id: "otherLiving",
            name: "其他生活支出（總額）",
            value: row.baseLiving,
            color: "#91a38b",
            group: "needs",
            flow: "living",
          },
        ];
  return [
    ...living,
    ...(input.livingMode
      ? []
      : livingFields
          .filter((x) =>
            (separateExpenseKeys as readonly string[]).includes(x.id),
          )
          .map((x) => ({
            ...x,
            value: input[x.id as (typeof separateExpenseKeys)[number]] ?? 0,
            flow: "living" as const,
          }))),
    {
      id: "loans",
      name: "貸款（房貸、車貸、信貸等）",
      value: row.loan,
      color: "#b48958",
      group: "needs",
    },
    {
      flow: "living",
      id: "purchaseCost",
      name: "購入後額外持有成本",
      value: row.purchaseCost,
      color: "#9b9980",
      group: "needs",
    },
    {
      id: "purchase",
      name: "大型購物儲蓄",
      value: row.purchase,
      color: "#c6ad77",
      group: "wants",
    },
    {
      id: "travel",
      name: "旅遊基金儲蓄",
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
export function entryGroup(
  e: BudgetEntry,
  categories: Record<string, Group> = {},
) {
  const group = categories[e.id] ?? e.group;
  return e.flow === "living"
    ? group === "wants"
      ? "wants"
      : e.group === "wants" && group === "savings"
        ? "wants"
        : "needs"
    : group;
}
export function allocations(
  entries: BudgetEntry[],
  remaining: number,
  categories: Record<string, Group> = {},
): Allocation[] {
  const sum = (id: string) => entries.find((e) => e.id === id)?.value ?? 0;
  const costs = (group: Group) =>
    entries
      .filter((e) => e.flow === "living" && entryGroup(e, categories) === group)
      .reduce((s, e) => s + e.value, 0);
  return [
    { name: "必要生活支出", value: costs("needs"), color: "#397a5e" },
    { name: "非必要消費", value: costs("wants"), color: "#bc8f61" },
    { name: "貸款", value: sum("loans"), color: "#9b849e" },
    { name: "大型購物儲蓄", value: sum("purchase"), color: "#b8a15b" },
    { name: "旅遊基金", value: sum("travel"), color: "#7099ad" },
    { name: "ETF 投資", value: sum("etf"), color: "#246a63" },
    { name: "剩餘可支配金額", value: Math.max(0, remaining), color: "#b7c9a5" },
  ];
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
export function groupState(
  id: Group,
  ratio: number | null,
  deficit = false,
  mode: BudgetMode = "classic",
) {
  if (ratio === null)
    return { tone: "unknown", message: "沒有正的稅後收入，暫不判定比例狀態。" };
  const reference = budgetModes[mode][id];
  if (id !== "savings") {
    const points = ratio - reference;
    return points > 0
      ? {
          tone: deficit ? "pink" : "watch",
          message: `高於參考目標 ${new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 }).format(points)} 個百分點；比例差異本身不是財務風險或減支理由，須先看現金流、安全及重要目標。`,
        }
      : {
          tone: "normal",
          message: "在參考目標內；低於消費比例不是異常，也不需要花完額度。",
        };
  }
  if (ratio < reference)
    return {
      tone: ratio < 10 ? "yellow" : "watch",
      message: `低於 ${reference}% 參考目標，可檢視退休、儲蓄與其他目標的安排；不是強制儲蓄額度，也不代表必須增加 ETF。${ratio < 10 ? "低於10%僅是教育性提醒，不是財務異常判定。" : ""}`,
    };
  return deficit
    ? {
        tone: "normal",
        message:
          "此項比例達到參考目標，但家庭仍有赤字，不能據此判定整體財務良好。",
      }
    : {
        tone: "green",
        message: `此項達到 ${reference}% 參考目標；高於目標不是異常，也不代表整體財務安全已經過驗證。`,
      };
}
export function healthCheck(
  entries: BudgetEntry[],
  income: number,
  categories: Record<string, Group> = {},
  limits: Limits = { ...detailLimits },
  mode: BudgetMode = "classic",
) {
  bounded(income, "稅後月收入", 0, Number.MAX_VALUE);
  Object.values(limits).forEach((v) => bounded(v, "細項參考上限", 0, 100));
  const sums: Record<Group, number> = { needs: 0, wants: 0, savings: 0 };
  const seen = new Set<string>();
  entries.forEach((e) => {
    if (seen.has(e.id)) throw new Error("收支項目不可重複計入");
    seen.add(e.id);
    bounded(e.value, e.name, 0, Number.MAX_VALUE);
    const group = entryGroup(e, categories);
    if (!Object.hasOwn(sums, group)) throw new Error("請選擇有效的支出分類");
    sums[group] += e.value;
  });
  const total = sums.needs + sums.wants + sums.savings;
  const cashDeficit = Math.max(0, total - income);
  const groups = (["needs", "wants", "savings"] as const).map((id) => {
    const ratio = income > 0 ? (sums[id] / income) * 100 : null;
    return {
      id,
      name: groupNames[id],
      value: sums[id],
      ratio,
      reference: budgetModes[mode][id],
      referenceAmount: (income * budgetModes[mode][id]) / 100,
      ...groupState(id, ratio, cashDeficit > 0, mode),
    };
  });
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
    total,
    cashDeficit,
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
      "退休規劃背景閱讀；功能三不作退休儲蓄比例或達標判定，詳細試算留在第四單元。",
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
