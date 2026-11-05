import {
  useId,
  useState,
  useRef,
  useLayoutEffect,
  type ReactNode,
} from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { Copy, Check, RotateCcw, ChevronDown } from "lucide-react";
import { money, bounded } from "../lib/finance";
import {
  parseNumericInput,
  formatMoneyInput,
  editMoneyInput,
} from "../lib/numberInput";
export type Values = Record<string, string>;
export function useForm(initial: Values) {
  const [values, setValues] = useState(initial);
  return {
    values,
    set: (key: string, value: string) =>
      setValues((v) => ({ ...v, [key]: value })),
    patch: (patch: Values) => setValues((v) => ({ ...v, ...patch })),
    reset: () => setValues(initial),
    n: (key: string) => parseNumericInput(values[key]),
  };
}
export type Form = ReturnType<typeof useForm>;
export function Field({
  form,
  name,
  label,
  unit = "元",
  min = 0,
  max = 1e12,
  step = "any",
}: {
  form: Form;
  name: string;
  label: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number | string;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const isMoney = unit === "元";
  const display = isMoney
    ? formatMoneyInput(form.values[name] ?? "")
    : form.values[name];
  useLayoutEffect(() => {
    if (
      inputRef.current !== null &&
      pendingCaret.current !== null &&
      inputRef.current === document.activeElement
    ) {
      inputRef.current.setSelectionRange(
        pendingCaret.current,
        pendingCaret.current,
      );
      pendingCaret.current = null;
    }
  });
  const v = form.n(name),
    invalid =
      !Number.isFinite(v) ||
      v < min ||
      v > max ||
      (step === 1 && !Number.isInteger(v));
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <div className={`input-wrap ${invalid ? "invalid" : ""}`}>
        <input
          id={id}
          aria-label={label}
          ref={inputRef}
          type={isMoney ? "text" : "number"}
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={display}
          onChange={(e) => {
            if (isMoney) {
              const edit = editMoneyInput(
                e.target.value,
                e.target.selectionStart ?? e.target.value.length,
                display,
                (e.nativeEvent as InputEvent).inputType,
              );
              pendingCaret.current = edit.caret;
              form.set(name, edit.text);
            } else form.set(name, e.target.value);
          }}
          aria-invalid={invalid}
        />
        <span>{unit}</span>
      </div>
      {invalid && (
        <small className="field-error">
          請輸入 {money(min)}～{money(max)}
          {step === 1 ? " 的整數" : ""}
        </small>
      )}
    </label>
  );
}
export function Select({
  form,
  name,
  label,
  options,
  onChange,
}: {
  form: Form;
  name: string;
  label: string;
  options: [string, string][];
  onChange?: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select
        aria-label={label}
        value={form.values[name]}
        onChange={(e) =>
          onChange ? onChange(e.target.value) : form.set(name, e.target.value)
        }
      >
        {options.map(([value, text]) => (
          <option value={value} key={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}
export function Toggle({
  form,
  name,
  children,
}: {
  form: Form;
  name: string;
  children: ReactNode;
}) {
  return (
    <label className="toggle">
      <input
        type="checkbox"
        checked={form.values[name] === "yes"}
        onChange={(e) => form.set(name, e.target.checked ? "yes" : "no")}
      />
      {children}
    </label>
  );
}
export function Details({
  title = "展開詳細分析",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <details className="details">
      <summary>
        {title}
        <ChevronDown size={17} />
      </summary>
      <div className="details-body">{children}</div>
    </details>
  );
}
export function Asset({ form }: { form: Form }) {
  return (
    <>
      <Select
        form={form}
        name="assetMode"
        label="現有資產輸入方式"
        options={[
          ["value", "直接輸入市值"],
          ["shares", "ETF 股數 × 參考股價"],
        ]}
      />
      {form.values.assetMode === "value" ? (
        <Field form={form} name="initial" label="現有資產起始市值" />
      ) : (
        <>
          <label className="field">
            <span>ETF 名稱（僅作標籤）</span>
            <input
              value={form.values.etf}
              onChange={(e) => form.set("etf", e.target.value)}
              maxLength={40}
            />
          </label>
          <div className="field-grid">
            <Field form={form} name="shares" label="持股數" unit="股" />
            <Field form={form} name="price" label="自填參考股價" />
          </div>
          <p className="hint">
            價格由你提供，非即時行情。市值與股數模式擇一計入。
          </p>
        </>
      )}
    </>
  );
}
export function initialAsset(form: Form) {
  if (form.values.assetMode === "shares") {
    return (
      bounded(form.n("shares"), "持股數") * bounded(form.n("price"), "參考股價")
    );
  }
  return bounded(form.n("initial"), "起始市值");
}
export const assetDefaults = {
  assetMode: "value",
  initial: "0",
  shares: "0",
  price: "100",
  etf: "0050",
};
export function Stat({
  label,
  value,
  unit = "元",
  small = false,
}: {
  label: string;
  value: number;
  unit?: string;
  small?: boolean;
}) {
  return (
    <div className={`stat ${small ? "small" : ""}`}>
      <span>{label}</span>
      <strong title={String(value)}>
        {money(value)}
        <em>{unit}</em>
      </strong>
    </div>
  );
}
export function Breakdown({ items }: { items: [string, number][] }) {
  return (
    <dl className="breakdown">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>NT$ {money(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
export function ErrorNotice({ message }: { message?: string }) {
  return message ? (
    <div className="error" role="alert">
      {message}。請修正輸入後再試算。
    </div>
  ) : null;
}
export function safely<T>(fn: () => T): { data?: T; error?: string } {
  try {
    return { data: fn() };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "輸入有誤" };
  }
}
export function Actions({
  reset,
  summary,
}: {
  reset: () => void;
  summary: string;
}) {
  const [status, setStatus] = useState("");
  return (
    <div className="actions">
      <button onClick={reset}>
        <RotateCcw size={15} />
        重設示範值
      </button>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(summary);
            setStatus("已複製");
          } catch {
            setStatus("無法複製，請選取結果文字");
          }
        }}
      >
        {status === "已複製" ? <Check size={15} /> : <Copy size={15} />}複製摘要
      </button>
      <span role="status">{status}</span>
    </div>
  );
}
export function Risk({ retirement = false }: { retirement?: boolean }) {
  return (
    <Details title="試算假設與風險">
      <p>
        這是教育性模擬，不是投資建議或報酬保證。固定報酬曲線無法反映真實波動，ETF
        不保證勝過銀行；銀行利率也會變動。
      </p>
      <p>
        {retirement
          ? "每年年初提領，年末計算報酬。通膨用於調整固定實質提領及購買力。4% 法則不是配息率，也無法保證持有臺股 ETF 就能安全退休。"
          : "有效年化報酬換算月率 r = (1 + R)^(1/12) − 1，每月底投入。銀行使用相同時點。未計通膨，未來金額不等於今日購買力。"}
      </p>
      <p>
        總報酬已包含股息再投入，不另加配息。不含稅費、交易成本、管理費與極端市場風險。起始市值只是試算基準，非歷史投入成本；收益為試算起點後的模擬增值。
      </p>
    </Details>
  );
}
export function Chart({
  data,
  lines,
  bar = false,
}: {
  data: Record<string, number | boolean>[];
  lines: [string, string, string][];
  bar?: boolean;
}) {
  const common = (
    <>
      <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e3eae5" />
      <XAxis
        dataKey="year"
        tickLine={false}
        axisLine={false}
        tickFormatter={(v) => `${v}年`}
        minTickGap={24}
      />
      <YAxis
        width={52}
        tickLine={false}
        axisLine={false}
        tickFormatter={(v) => `${money(v / 10000)}萬`}
      />
      <Tooltip
        formatter={(v) => `NT$ ${money(Number(v))}`}
        labelFormatter={(v) => `第 ${v} 年`}
      />
      <Legend />
    </>
  );
  return (
    <div
      className="chart"
      role="img"
      aria-label={
        lines.map((l) => l[1]).join("、") + "逐年圖表，金額單位新臺幣"
      }
    >
      <ResponsiveContainer width="100%" height={300}>
        {bar ? (
          <BarChart data={data}>
            {common}
            {lines.map(([key, name, color]) => (
              <Bar
                key={key}
                dataKey={key}
                name={name}
                fill={color}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        ) : (
          <LineChart data={data}>
            {common}
            {lines.map(([key, name, color], i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={name}
                stroke={color}
                strokeWidth={2.5}
                strokeDasharray={i === 2 ? "5 5" : undefined}
                dot={false}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
export function Rows({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <div
      className="table-scroll"
      tabIndex={0}
      role="region"
      aria-label="詳細數據表，可左右捲動"
    >
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function PrincipalBar({
  principal,
  total,
}: {
  principal: number;
  total: number;
}) {
  const portion = total > 0 ? Math.min(100, (principal / total) * 100) : 0;
  return (
    <div className="allocation">
      <div className="allocation-track">
        <span style={{ width: `${portion}%` }} />
      </div>
      <p>
        <span>● 累積本金 {portion.toFixed(1)}%</span>
        <span>● 假設收益 {(100 - portion).toFixed(1)}%</span>
      </p>
    </div>
  );
}
