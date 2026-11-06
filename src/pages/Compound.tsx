import {
  PortfolioAsset,
  portfolioInitial,
  portfolioDefaults,
} from "../components/PortfolioAsset";
import { useLastValidResult } from "../hooks/useNumericDrafts";
import { investment, money } from "../lib/finance";
import {
  useForm,
  Field,
  Select,
  Details,
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
    ...portfolioDefaults,
    years: "30",
    axisMode: "full",
    monthly: "5000",
    annual: "8",
    bank: "1.5",
    change: "no",
    changeYear: "11",
    nextMonthly: "8000",
  });
  const result = safely(() => {
    const initial = portfolioInitial(f),
      change = f.values.change === "yes";
    if (
      change &&
      (!Number.isInteger(f.n("changeYear")) ||
        f.n("changeYear") < 2 ||
        f.n("changeYear") > 30)
    )
      throw new Error("調整投入起始年需為 2～30 整數");
    const years = f.n("years");
    const input = {
      initial,
      monthly: f.n("monthly"),
      annual: f.n("annual") / 100,
      months: years * 12,
      changeMonth: change ? (f.n("changeYear") - 1) * 12 + 1 : undefined,
      nextMonthly: change ? f.n("nextMonthly") : undefined,
    };
    const etf = investment(input),
      bank = investment({ ...input, annual: f.n("bank") / 100 }),
      delays = [0, 60, 120]
        .filter((d) => d <= years * 12)
        .map((delayMonths) => ({
          ...investment({ ...input, delayMonths }).at(-1)!,
          delayMonths,
        }));
    return {
      initial,
      years,
      etf,
      bank,
      delays,
      end: etf.at(-1)!,
      chart: etf.map((x, i) => ({ ...x, bank: bank[i].value })),
    };
  });
  const r = useLastValidResult(result, f.revision);
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
        <p className="hint">
          8% 僅為教育性假設，並非 0050、006208 或其他 ETF
          的保證報酬。你可以自行調整。
        </p>
        <Field
          form={f}
          name="years"
          label="投資年數"
          unit="年"
          min={1}
          max={40}
          step={1}
        />
        <PortfolioAsset form={f} />
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
        <ErrorNotice message={result.error} />
        <p className="hint">
          可先清空再輸入；暫時無效時保留有效試算，完成後在欄位旁提示。
        </p>
        <Actions
          reset={f.reset}
          summary={
            r
              ? `長期複利：${r.years}年預估市值 NT$ ${money(r.end.value)}，本金 ${money(r.end.principal)}，假設收益 ${money(r.end.gain)}；同額同時點銀行存款 ${money(r.bank.at(-1)!.value)}。非報酬保證。`
              : ""
          }
        />
      </section>
      <section className="results" aria-label="長期複利結果">
        {r && (
          <>
            <div className="hero-result">
              <span className="result-badge">{r.years} 年的累積想像</span>
              <Stat label="預估總資產" value={r.end.value} />
              <p>不是預測未來，而是看懂本金、時間與假設報酬的關係。</p>
              <div className="hero-stats">
                <Stat small label="累積投入本金" value={r.end.principal} />
                <Stat small label="假設投資收益" value={r.end.gain} />
              </div>
            </div>
            <div className="milestones">
              {[...new Set([10, 20, 30, r.years])]
                .filter((y) => y <= r.years)
                .sort((a, b) => a - b)
                .map((y) => (
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
              <Select
                form={f}
                name="axisMode"
                label="Y 軸顯示模式"
                options={[
                  ["full", "完整金額模式（從0元開始）"],
                  ["focused", "聚焦資產變化模式"],
                ]}
              />
              {f.values.axisMode === "focused" && (
                <p className="reference-disclaimer">
                  此模式會調整縱軸起點，以便觀察變化幅度；視覺差距可能因此放大。
                </p>
              )}
              <Chart
                axisMode={f.values.axisMode as "full" | "focused"}
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
                headers={[
                  "開始時間",
                  "累積本金",
                  `${r.years}年終點市值`,
                  "假設收益",
                ]}
                rows={r.delays.map((x) => [
                  x.delayMonths === 0
                    ? "現在開始"
                    : `晚${x.delayMonths / 12}年`,
                  money(x.principal),
                  money(x.value),
                  money(x.gain),
                ])}
              />
              <p className="hint">
                同一個 {r.years} 年觀察終點，延後開始會縮短新增投入的
                年數，因此本金不同，差距不能全部歸因於複利。延後期間不投入新本金，既有起始資產仍依假設增長；未投入款項不計現金利息。相同總本金的公平比較將於第三階段加入。
              </p>
            </Details>
            <Risk />
          </>
        )}
      </section>
    </div>
  );
}
