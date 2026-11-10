import { portfolioValue } from "../lib/portfolio";
import { bounded, money } from "../lib/finance";
import { Field, Select, ErrorNotice, safely, type Form } from "./ui";
export const portfolioDefaults = {
  assetMode: "value",
  initial: "0",
  holdingCount: "1",
  code1: "0050",
  shares1: "0",
  price1: "100",
  code2: "",
  shares2: "0",
  price2: "0",
  code3: "",
  shares3: "0",
  price3: "0",
};
export function readHoldings(f: Form) {
  return portfolioValue(
    Array.from({ length: Number(f.values.holdingCount) }, (_, i) => ({
      code: f.values[`code${i + 1}`],
      shares: f.n(`shares${i + 1}`),
      price: f.n(`price${i + 1}`),
    })),
  );
}
export function portfolioInitial(f: Form) {
  return f.values.assetMode === "value"
    ? bounded(f.n("initial"), "起始市值")
    : readHoldings(f).total;
}
export function PortfolioAsset({ form: f }: { form: Form }) {
  const count = Number(f.values.holdingCount),
    result = safely(() => readHoldings(f));
  const remove = (index: number) => {
    const patch: Record<string, string> = { holdingCount: String(count - 1) };
    for (let i = index; i < count; i++)
      for (const key of ["code", "shares", "price"])
        patch[`${key}${i}`] = f.values[`${key}${i + 1}`];
    f.patch(patch);
  };
  return (
    <>
      <Select
        form={f}
        name="assetMode"
        label="現有資產輸入方式"
        options={[
          ["value", "直接輸入起始市值"],
          ["shares", "依 ETF 持股自動計算"],
        ]}
      />
      {f.values.assetMode === "value" ? (
        <Field form={f} name="initial" label="現有資產起始市值" />
      ) : (
        <>
          <p className="hint">
            實際股數計算，1 股就是 1
            股，不以「張」換算。代號可自填，參考價不是即時行情。
          </p>
          {Array.from({ length: count }, (_, i) => i + 1).map((i) => (
            <fieldset
              className="holding-card"
              aria-label={`第${i}檔ETF`}
              key={i}
            >
              <legend>第 {i} 檔 ETF</legend>
              <label className="field">
                <span>ETF 代號</span>
                <input
                  aria-label={`第${i}檔ETF代號`}
                  maxLength={30}
                  value={f.values[`code${i}`]}
                  onChange={(e) => f.set(`code${i}`, e.target.value)}
                />
              </label>
              <div className="field-grid">
                <Field
                  form={f}
                  name={`shares${i}`}
                  label={`第${i}檔持有股數`}
                  unit="股"
                  step={1}
                />
                <Field
                  form={f}
                  name={`price${i}`}
                  label={`第${i}檔每股參考價格`}
                />
              </div>
              <p>
                該筆市值：NT${" "}
                {result.data ? money(result.data.rows[i - 1].value, 2) : "—"}
              </p>
              {i > 1 && (
                <button className="scenario-button" onClick={() => remove(i)}>
                  刪除第 {i} 檔
                </button>
              )}
            </fieldset>
          ))}
          <button
            className="scenario-button"
            disabled={count >= 3}
            onClick={() => {
              const next = count + 1;
              f.patch({
                holdingCount: String(next),
                [`code${next}`]: "",
                [`shares${next}`]: "0",
                [`price${next}`]: "0",
              });
            }}
          >
            新增 ETF
          </button>
          <p>
            <strong>
              ETF 持股合計市值：NT${" "}
              {result.data ? money(result.data.total, 2) : "—"}
            </strong>
          </p>
          <ErrorNotice message={result.error} />
          <p className="hint">
            最多三檔，未用完不影響試算；全部套用同一組合報酬假設，不另加直接輸入的市值。ETF
            之間可能高度持股重疊，持有多檔不一定代表有效分散風險。
          </p>
        </>
      )}
    </>
  );
}
