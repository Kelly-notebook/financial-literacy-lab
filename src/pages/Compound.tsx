import { currentTaipeiMonth } from "../lib/budget";
import { useEffect, useState } from "react";
import {
  compoundDraftIssue,
  draftIssue,
  retirementTransferIssue,
  savingsComparison,
  type MonthlyTransfer,
  type RetirementTransfer,
} from "../lib/savingsComparison";
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
export default function Compound({
  incoming,
  onConsumed,
  onRetirement,
}: {
  incoming?: MonthlyTransfer;
  onConsumed?: () => void;
  onRetirement?: (data: RetirementTransfer) => void;
} = {}) {
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
    extra: "2000",
  });
  const [source, setSource] = useState<MonthlyTransfer>();
  useEffect(() => {
    if (!incoming) return;
    f.patch({ monthly: String(incoming.monthly), years: "30", change: "no" });
    setSource(incoming);
    onConsumed?.();
    // The incoming object is a one-shot user action; later form edits do not replay it.
  }, [incoming]);
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
      input,
      years,
      etf,
      bank,
      delays,
      end: etf.at(-1)!,
      chart: etf.map((x, i) => ({ ...x, bank: bank[i].value })),
    };
  });
  const r = useLastValidResult(result, f.revision);
  const mainIssue = compoundDraftIssue(f.values) ?? result.error;
  const comparison = safely(() =>
    r ? savingsComparison(r.input, f.n("extra")) : undefined,
  );
  const extraIssue =
    draftIssue(f.values, [["extra", "每月額外增加投入金額"]]) ??
    comparison.error;
  const transferIssue = mainIssue ?? retirementTransferIssue(r?.end.value);
  const enhancedIssue =
    mainIssue ??
    extraIssue ??
    retirementTransferIssue(comparison.data?.enhanced.value);
  const sendRetirement = (assets: number, scenario: string) => {
    if (!onRetirement || mainIssue || retirementTransferIssue(assets)) return;
    onRetirement({
      assets,
      years: r!.years,
      scenario,
      baseYear: Number(currentTaipeiMonth().slice(0, 4)),
    });
  };
  return (
    <div className="workspace">
      <section className="panel inputs">
        <div className="panel-heading">
          <span className="eyebrow">TIME & GROWTH</span>
          <h2>讓時間，參與你的計畫</h2>
          <p>每個月一點累積，看看未來的可能。</p>
        </div>
        {source && (
          <p className="note" role="status">
            已帶入家庭預算 ETF 月投入 NT$ {money(source.monthly, 2)}，帶入時設為
            30
            年，取代原月投入並停用中途調整。起始資產與報酬率沿用；後續可自行修改，不自動同步。
          </p>
        )}
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
          reset={() => {
            f.reset();
            setSource(undefined);
          }}
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
            {onRetirement && (
              <div className="panel">
                <button
                  className="scenario-button"
                  disabled={!!transferIssue}
                  onClick={() => sendRetirement(r.end.value, "原方案 A")}
                >
                  將期末資產帶入退休提領
                </button>
                {transferIssue && <p className="hint">{transferIssue}</p>}
                <p className="hint">
                  帶入完整期末資產（含起始市值與投入），作為 {r.years}{" "}
                  年後退休當下的名目起始資產，不是今天的實際資產。未來購買力與今天不同。
                </p>
              </div>
            )}
            <Details title="多存一點，未來差多少？">
              <Field form={f} name="extra" label="每月額外增加投入金額" />
              {comparison.data && (
                <div className="savings-comparison">
                  <Rows
                    headers={[
                      "情境",
                      "每月投入",
                      "期末總資產",
                      "累積投入本金",
                      "假設投資收益",
                    ]}
                    rows={[
                      [
                        "原方案 A",
                        money(comparison.data.baseMonthly, 2),
                        money(comparison.data.base.value, 2),
                        money(comparison.data.base.principal, 2),
                        money(comparison.data.base.gain, 2),
                      ],
                      [
                        "增加投入 B",
                        money(comparison.data.enhancedMonthly, 2),
                        money(comparison.data.enhanced.value, 2),
                        money(comparison.data.enhanced.principal, 2),
                        money(comparison.data.enhanced.gain, 2),
                      ],
                    ]}
                  />
                  <Breakdown
                    decimals={2}
                    items={[
                      ["B 比 A 多累積資產", comparison.data.additionalAssets],
                      [
                        "額外資產首年 4% 提領的月平均",
                        comparison.data.additionalMonthlyWithdrawal,
                      ],
                    ]}
                  />
                  {r.input.changeMonth !== undefined && (
                    <p className="hint">
                      原方案包含中途調整：自第 {f.n("changeYear")} 年起，A 每月
                      NT$ {money(r.input.nextMonthly!, 2)}，B 每月 NT${" "}
                      {money(r.input.nextMonthly! + f.n("extra"), 2)}
                      ；額外投入每個月都加上，不只第一階段。
                    </p>
                  )}
                  <p className="hint">
                    兩方案使用相同期初本金、{r.years} 年期間與年化{" "}
                    {r.input.annual * 100}%
                    假設，同樣月底投入。只做比較，不修改原月投入或家庭預算。
                  </p>
                  {onRetirement && (
                    <div className="actions">
                      <button
                        disabled={!!transferIssue}
                        onClick={() =>
                          sendRetirement(
                            comparison.data!.base.value,
                            "原方案 A",
                          )
                        }
                      >
                        以原方案試算退休
                      </button>
                      <button
                        disabled={!!enhancedIssue}
                        onClick={() => {
                          if (!enhancedIssue)
                            sendRetirement(
                              comparison.data!.enhanced.value,
                              "增加投入方案 B",
                            );
                        }}
                      >
                        以增加投入方案試算退休
                      </button>
                    </div>
                  )}
                </div>
              )}
              {(mainIssue || extraIssue || comparison.error) && (
                <p className="hint">
                  {mainIssue || extraIssue || comparison.error}{" "}
                  暫留有效結果供參考，修正後才能帶入對應方案。
                </p>
              )}
              {!mainIssue && !extraIssue && enhancedIssue && (
                <p className="hint">增加方案：{enhancedIssue}</p>
              )}
              <p className="reference-disclaimer">
                以上均為未來名目金額；{r.years} 年後的購買力與今天不同。4%
                是首年提領的教育情境（月額為年額除以
                12），不保證退休安全，也不等於今天的生活費。退休通膨設定以退休起始年為基準，不重複折算累積期間。
              </p>
            </Details>
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
