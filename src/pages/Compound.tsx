import { investment, money } from "../lib/finance";
import {
  useForm,
  Field,
  Details,
  Asset,
  initialAsset,
  assetDefaults,
  Toggle,
  Stat,
  Breakdown,
  ErrorNotice,
  safely,
  Actions,
  Risk,
  Chart,
  Rows,
  PrincipalBar,
} from "../components/ui";
export default function Compound() {
  const f = useForm({
    ...assetDefaults,
    monthly: "5000",
    annual: "4",
    bank: "1.5",
    change: "no",
    changeYear: "11",
    nextMonthly: "8000",
  });
  const result = safely(() => {
    const initial = initialAsset(f),
      change = f.values.change === "yes";
    if (
      change &&
      (!Number.isInteger(f.n("changeYear")) ||
        f.n("changeYear") < 2 ||
        f.n("changeYear") > 30)
    )
      throw new Error("調整投入起始年需為 2～30 整數");
    const input = {
      initial,
      monthly: f.n("monthly"),
      annual: f.n("annual") / 100,
      months: 360,
      changeMonth: change ? (f.n("changeYear") - 1) * 12 + 1 : undefined,
      nextMonthly: change ? f.n("nextMonthly") : undefined,
    };
    const etf = investment(input),
      bank = investment({ ...input, annual: f.n("bank") / 100 }),
      delays = [0, 60, 120].map(
        (delayMonths) => investment({ ...input, delayMonths }).at(-1)!,
      );
    return {
      initial,
      etf,
      bank,
      delays,
      end: etf.at(-1)!,
      chart: etf.map((x, i) => ({ ...x, bank: bank[i].value })),
    };
  });
  const r = result.data;
  return (
    <div className="workspace">
      <section className="panel inputs">
        <div className="panel-heading">
          <span className="eyebrow">TIME & GROWTH</span>
          <h2>讓時間，參與你的計畫</h2>
          <p>每個月一點累積，看看未來的可能。</p>
        </div>
        <Field form={f} name="monthly" label="每月投入金額" />
        <div className="field-grid">
          <Field
            form={f}
            name="annual"
            label="假設年化總報酬率"
            unit="%"
            max={10}
            step={0.5}
          />
          <Field
            form={f}
            name="bank"
            label="假設銀行年利率"
            unit="%"
            max={10}
          />
        </div>
        <Asset form={f} />
        <Details title="進階設定">
          <Toggle form={f} name="change">
            中途調整每月投入
          </Toggle>
          {f.values.change === "yes" && (
            <>
              <Field
                form={f}
                name="changeYear"
                label="從第幾年開始調整"
                unit="年"
                min={2}
                max={30}
                step={1}
              />
              <Field form={f} name="nextMonthly" label="調整後每月投入" />
            </>
          )}
        </Details>
        <Actions
          reset={f.reset}
          summary={
            r
              ? `長期複利：30年預估市值 NT$ ${money(r.end.value)}，本金 ${money(r.end.principal)}，假設收益 ${money(r.end.gain)}；同額同時點銀行存款 ${money(r.bank.at(-1)!.value)}。非報酬保證。`
              : ""
          }
        />
      </section>
      <section className="results" aria-label="長期複利結果">
        <ErrorNotice message={result.error} />
        {r && (
          <>
            <div className="hero-result">
              <span className="result-badge">30 年的累積想像</span>
              <Stat label="預估總資產" value={r.end.value} />
              <p>不是預測未來，而是看懂本金、時間與假設報酬的關係。</p>
              <div className="hero-stats">
                <Stat small label="累積投入本金" value={r.end.principal} />
                <Stat small label="假設投資收益" value={r.end.gain} />
              </div>
            </div>
            <div className="milestones">
              {[10, 20, 30].map((y) => (
                <div className="panel" key={y}>
                  <span className="eyebrow">{y} 年後</span>
                  <Stat small label="ETF 模擬市值" value={r.etf[y].value} />
                  <p>
                    本金 {money(r.etf[y].principal)} 元<br />
                    假設收益 {money(r.etf[y].gain)} 元<br />
                    銀行 {money(r.bank[y].value)} 元
                  </p>
                </div>
              ))}
            </div>
            <div className="panel">
              <h3>本金與收益的比例</h3>
              <PrincipalBar principal={r.end.principal} total={r.end.value} />
              <Breakdown
                items={[
                  ["現有資產起始市值", r.initial],
                  ["未來新增投入本金", r.end.principal - r.initial],
                  ["同額同時點銀行存款", r.bank.at(-1)!.value],
                ]}
              />
            </div>
            <Details>
              <h3>三條曲線，一起比較</h3>
              <Chart
                data={r.chart}
                lines={[
                  ["value", "ETF 模擬市值", "#20745f"],
                  ["bank", "銀行存款", "#cb9244"],
                  ["principal", "累積本金", "#80938a"],
                ]}
              />
              <Rows
                headers={["年度", "累積本金", "ETF 市值", "銀行存款"]}
                rows={r.chart.map((x) => [
                  x.year,
                  money(x.principal),
                  money(x.value),
                  money(x.bank),
                ])}
              />
              <h3>如果晚 10 年才開始？</h3>
              <Rows
                headers={["開始時間", "累積本金", "30年終點市值", "假設收益"]}
                rows={r.delays.map((x, i) => [
                  ["現在開始", "晚5年", "晚10年"][i],
                  money(x.principal),
                  money(x.value),
                  money(x.gain),
                ])}
              />
              <p className="hint">
                同一個 30 年觀察終點，晚 10 年僅有 20
                年新增投入，因此本金不同，差距不能全部歸因於複利。延後期間不投入新本金，既有起始資產仍依假設增長；未投入款項不計現金利息。相同總本金的公平比較將於第三階段加入。
              </p>
            </Details>
            <Risk />
          </>
        )}
      </section>
    </div>
  );
}
