import { useLastValidResult } from "../hooks/useNumericDrafts";
import { goalMonthly, investment, money } from "../lib/finance";
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
export default function Goal() {
  const f = useForm({
    ...assetDefaults,
    target: "1000000",
    years: "10",
    annual: "8",
    bank: "1.5",
    two: "no",
    stageYears: "2",
    stageMonthly: "3000",
  });
  const result = safely(() => {
    if (
      !Number.isInteger(f.n("years")) ||
      f.n("years") < 1 ||
      f.n("years") > 40
    )
      throw new Error("達標年限需為 1～40 整數");
    if (f.values.two === "yes" && !Number.isInteger(f.n("stageYears")))
      throw new Error("第一階段年數需為整數");
    const initial = initialAsset(f),
      annual = f.n("annual") / 100,
      months = f.n("years") * 12,
      stage =
        f.values.two === "yes"
          ? { months: f.n("stageYears") * 12, monthly: f.n("stageMonthly") }
          : undefined;
    const monthly = goalMonthly(f.n("target"), initial, annual, months, stage),
      bankMonthly = goalMonthly(
        f.n("target"),
        initial,
        f.n("bank") / 100,
        months,
        stage,
      );
    const rows = investment({
      initial,
      annual,
      months,
      monthly: stage?.monthly ?? monthly,
      changeMonth: stage ? stage.months + 1 : undefined,
      nextMonthly: monthly,
    });
    return { initial, monthly, bankMonthly, rows, end: rows.at(-1)!, stage };
  });
  const r = useLastValidResult(result, f.revision);
  return (
    <div className="workspace">
      <section className="panel inputs">
        <div className="panel-heading">
          <span className="eyebrow">YOUR PLAN</span>
          <h2>從目標，找到起點</h2>
          <p>希望幾年後，累積到第一桶金？</p>
        </div>
        <Field form={f} name="target" label="目標資產" min={1} />
        <div className="field-grid">
          <Field
            form={f}
            name="years"
            label="達標年限"
            unit="年"
            min={1}
            max={40}
            step={1}
          />
          <Field
            form={f}
            name="annual"
            label="假設年化總報酬率"
            unit="%"
            max={10}
            step={0.5}
          />
        </div>
        <p className="hint">
          8% 僅為教育性假設，並非 0050、006208 或其他 ETF
          的保證報酬。你可以自行調整。
        </p>
        <Asset form={f} />
        <Details title="進階設定">
          <Field
            form={f}
            name="bank"
            label="假設銀行年利率"
            unit="%"
            max={10}
          />
          <Toggle form={f} name="two">
            啟用兩階段投入
          </Toggle>
          {f.values.two === "yes" && (
            <>
              <Field
                form={f}
                name="stageYears"
                label="第一階段年數"
                unit="年"
                min={1}
                max={39}
                step={1}
              />
              <Field form={f} name="stageMonthly" label="第一階段每月投入" />
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
              ? `目標倒推：${f.values.years}年後目標 NT$ ${money(f.n("target"))}，${r.stage ? "第二階段" : ""}每月需投入 NT$ ${money(r.monthly)}。累積本金 ${money(r.end.principal)}，假設收益 ${money(r.end.gain)}。教育模擬，非報酬保證。`
              : ""
          }
        />
      </section>
      <section className="results" aria-label="目標倒推結果">
        {r && (
          <>
            <div className="hero-result">
              <span className="result-badge">讓目標更具體</span>
              <Stat
                label={r.stage ? "第二階段每月需要投入" : "每月需要投入"}
                value={r.monthly}
              />
              <p>
                {r.monthly === 0
                  ? "現有資產或第一階段投入依假設增長已足夠，後續無需新增投入。"
                  : `持續 ${f.values.years} 年，讓每個月的行動靠近目標。`}
              </p>
              <div className="hero-stats">
                <Stat small label="預估期末總市值" value={r.end.value} />
                <Stat small label="同條件銀行每月需存" value={r.bankMonthly} />
              </div>
            </div>
            <div className="panel">
              <h3>看懂每一塊錢的來源</h3>
              <PrincipalBar principal={r.end.principal} total={r.end.value} />
              <Breakdown
                items={[
                  ["現有資產起始市值", r.initial],
                  ["未來新增投入本金", r.end.principal - r.initial],
                  ["累積投入本金（含起始市值）", r.end.principal],
                  ["假設投資收益", r.end.gain],
                ]}
              />
              <p className="hint">
                必要投入向上取整到元，結果以整元投入重算，因此可能略高於目標。
              </p>
            </div>
            <Details>
              <h3>資產如何逐年累積</h3>
              <Chart
                data={r.rows.map((x) => ({ ...x }))}
                lines={[
                  ["value", "預估總市值", "#20745f"],
                  ["principal", "累積本金", "#80938a"],
                ]}
              />
              <Rows
                headers={["年度", "累積本金", "假設收益", "預估市值"]}
                rows={r.rows.map((x) => [
                  x.year,
                  money(x.principal),
                  money(x.gain),
                  money(x.value),
                ])}
              />
              {!r.stage && (
                <>
                  <h3>時間與每月投入的取捨</h3>
                  <Rows
                    headers={["年限", "每月需要投入"]}
                    rows={[5, 10, 20, 30].map((y) => [
                      `${y}年`,
                      `NT$ ${money(goalMonthly(f.n("target"), r.initial, f.n("annual") / 100, y * 12))}`,
                    ])}
                  />
                </>
              )}
              <p className="hint">
                拉長時間通常降低月投入，但也承受更久的市場不確定性。
              </p>
            </Details>
            <Risk />
          </>
        )}
      </section>
    </div>
  );
}
