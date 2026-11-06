import { bounded } from "./finance";
export interface Holding {
  code: string;
  shares: number;
  price: number;
}
export function portfolioValue(holdings: Holding[]) {
  if (holdings.length < 1 || holdings.length > 3)
    throw new Error("ETF 持股需為1～3檔");
  const rows = holdings.map((h) => ({
    ...h,
    value: bounded(
      bounded(h.shares, "實際股數") * bounded(h.price, "參考股價"),
      "單筆ETF市值",
    ),
  }));
  return {
    rows,
    total: bounded(
      rows.reduce((s, h) => s + h.value, 0),
      "ETF合計市值",
    ),
  };
}
export function chartDomain(
  data: Record<string, unknown>[],
  keys: string[],
  mode: "full" | "focused",
): [number, number] {
  const values = data
    .flatMap((r) => keys.map((k) => r[k]))
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (!values.length) return [0, 1];
  const min = Math.min(...values),
    max = Math.max(...values);
  if (mode === "full") return [Math.min(0, min), max > 0 ? max * 1.05 : 1];
  const pad =
    max === min ? Math.max(Math.abs(max) * 0.01, 1) : (max - min) * 0.06;
  return [min >= 0 ? Math.max(0, min - pad) : min - pad, max + pad];
}
export function twdAxis(value: number) {
  return Math.abs(value) >= 1e8
    ? `${new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 }).format(value / 1e8)}億元`
    : Math.abs(value) >= 1e4
      ? `${new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 1 }).format(value / 1e4)}萬元`
      : `NT$ ${new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 }).format(value)}`;
}
