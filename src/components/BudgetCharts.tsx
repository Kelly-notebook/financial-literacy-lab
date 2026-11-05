import { useId } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { money } from "../lib/finance";
import type { Allocation } from "../lib/budget";
export interface FlowPoint {
  period: string;
  remaining: number;
  loan: number;
  daily: number;
  annualRemaining?: number;
}
export function CashFlowChart({
  rows,
  annual,
}: {
  rows: FlowPoint[];
  annual: boolean;
}) {
  const label = annual ? "平均每月" : "每月";
  return (
    <>
      <div
        className="chart"
        role="img"
        aria-label="未來家庭可支配金額變化；紅點代表赤字，詳細數值可參閱下方表格"
      >
        <ResponsiveContainer width="100%" height={320}>
          <LineChart
            data={rows}
            margin={{ top: 12, right: 10, bottom: 8, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 5" vertical={false} />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} minTickGap={45} />
            <YAxis
              width={57}
              tickFormatter={(v) =>
                `${new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 1 }).format(v / 10000)}萬`
              }
            />
            <ReferenceLine y={0} stroke="#b9c4b6" />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as FlowPoint;
                return (
                  <div className="budget-tooltip">
                    <strong>{row.period}</strong>
                    <p>
                      {label}結餘：NT$ {money(row.remaining)}
                    </p>
                    <p>
                      {label}貸款月付總額：NT$ {money(row.loan)}
                    </p>
                    <p>當期平均每日可支配：NT$ {money(row.daily)}</p>
                    {annual && (
                      <p>
                        該年度涵蓋期間總結餘：NT$ {money(row.annualRemaining!)}
                      </p>
                    )}
                  </div>
                );
              }}
            />
            <Line
              name={`${label}可支配金額`}
              type="linear"
              dataKey="remaining"
              stroke="#20745f"
              strokeWidth={2}
              isAnimationActive={false}
              dot={({ cx, cy, payload }) => (
                <circle
                  key={payload.period}
                  cx={cx}
                  cy={cy}
                  r={payload.remaining < 0 ? 3 : 1.5}
                  fill={payload.remaining < 0 ? "#be493c" : "#20745f"}
                  stroke="none"
                />
              )}
            />
            <Line
              name={`${label}貸款月付總額`}
              type="stepAfter"
              dataKey="loan"
              stroke="#b58d53"
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="chart-key">
        <span>● {label}可支配金額</span>
        <span className="negative-text">● 赤字資料點</span>
        <span>┄ {label}貸款月付總額</span>
      </p>
    </>
  );
}
export function AllocationChart({
  items,
  income,
  deficit,
}: {
  items: Allocation[];
  income: number;
  deficit: number;
}) {
  const id = useId();
  const total = items.reduce((s, x) => s + x.value, 0);
  return (
    <>
      <div className="allocation-layout">
        <div
          className="donut"
          role="img"
          aria-label="家庭每月分配環圈圖，金額與比例列於旁邊"
        >
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie
                data={items}
                dataKey="value"
                nameKey="name"
                innerRadius={65}
                outerRadius={96}
                paddingAngle={2}
                isAnimationActive={false}
              >
                {items.map((item) => (
                  <Cell key={`${id}-${item.name}`} fill={item.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `NT$ ${money(Number(v))}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="allocation-legend">
          {items.map((item) => (
            <li key={item.name}>
              <span>
                <i style={{ background: item.color }} />
                {item.name}
              </span>
              <strong>
                {money(item.value)} 元{" "}
                <small>
                  ({total > 0 ? ((item.value / total) * 100).toFixed(1) : "0"}%)
                </small>
              </strong>
            </li>
          ))}
        </ul>
      </div>
      <p className="hint">
        環圈分母為本月總分配 NT$ {money(total)}；本月收入 NT$ {money(income)}。
        {deficit > 0
          ? "支出已超過收入，缺口另列，不以負值切片或虛構收入平衡。"
          : "含剩餘可支配金額。"}
        未填入的支出不另行假設分類。
      </p>
    </>
  );
}
