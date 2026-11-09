import { useEffect, useState } from "react";
import type { RetirementTransfer } from "../lib/savingsComparison";
import { useLastValidResult } from "../hooks/useNumericDrafts";
import {
  retirement,
  requiredRetirement,
  sequenceReturns,
  money,
  type Strategy,
} from "../lib/finance";
import {
  useForm,
  Field,
  Select,
  Details,
  Asset,
  initialAsset,
  assetDefaults,
  Stat,
  Breakdown,
  ErrorNotice,
  safely,
  Actions,
  Risk,
  Chart,
  Rows,
} from "../components/ui";
export default function Retirement({
  incoming,
  onConsumed,
}: { incoming?: RetirementTransfer; onConsumed?: () => void } = {}) {
  const f = useForm({
    ...assetDefaults,
    initial: "10000000",
    mode: "assets",
    gapMode: "direct",
    gap: "30000",
    expenses: "40000",
    income: "10000",
    rate: "4",
    annual: "4",
    inflation: "2",
    years: "30",
    age: "60",
    strategy: "real",
    label: "taiwan",
  });
  const [source, setSource] = useState<RetirementTransfer>();
  useEffect(() => {
    if (!incoming) return;
    f.patch({
      initial: String(incoming.assets),
      assetMode: "value",
      mode: "assets",
    });
    setSource(incoming);
    onConsumed?.();
    // Only a new explicit transfer changes the form; other retirement assumptions stay intact.
  }, [incoming]);
  const [result] = [
    safely(() => {
      const rate = f.n("rate") / 100;
      if (rate < 0.01 || rate > 0.1) throw new Error("提領率需為 1%～10%");
      const gap =
        f.values.gapMode === "direct"
          ? f.n("gap")
          : Math.max(0, f.n("expenses") - f.n("income"));
      if (
        f.values.mode === "need" &&
        f.values.gapMode === "expenses" &&
        (!Number.isFinite(f.n("expenses")) ||
          !Number.isFinite(f.n("income")) ||
          f.n("expenses") < 0 ||
          f.n("income") < 0)
      )
        throw new Error("生活費與固定退休收入需為非負數");
      const initial =
          f.values.mode === "need"
            ? requiredRetirement(gap, rate)
            : initialAsset(f),
        input = {
          initial,
          rate,
          annual: f.n("annual") / 100,
          inflation: f.n("inflation") / 100,
          years: f.n("years"),
          age: f.n("age"),
          strategy: f.values.strategy as Strategy,
        };
      if (input.years < 10) throw new Error("模擬期間至少10年");
      if (!Number.isInteger(input.age)) throw new Error("退休年齡需為整數");
      const rows = retirement(input),
        returns = sequenceReturns(input.years),
        forward = retirement({ ...input, returns }),
        reverse = retirement({ ...input, returns: [...returns].reverse() });
      const strategies = (
        ["real", "proportional", "nominal"] as Strategy[]
      ).map((strategy) => ({
        strategy,
        rows: retirement({ ...input, strategy }),
      }));
      return {
        initial,
        input,
        gap,
        rows,
        forward,
        reverse,
        returns,
        strategies,
        first: rows[0],
        end: rows.at(-1)!,
        failure: rows.find((x) => x.unmet || x.exhausted),
      };
    }),
  ];
  const r = useLastValidResult(result, f.revision);
  return (
    <div className="workspace">
      <section className="panel inputs">
        <div className="panel-heading">
          <span className="eyebrow">YOUR NEXT CHAPTER</span>
          <h2>為下一段人生，留好選擇</h2>
          <p>看懂提領策略，也理解模擬的限制。</p>
        </div>
        {source && (
          <div className="note retirement-source" role="status">
            <p>已帶入長期複利的期末資產，作為退休起始市值。</p>
            <p className="hint">
              來源：{source.years} 年累積・{source.scenario}・NT${" "}
              {money(source.assets, 2)}
              。這是未來退休時的名目資產，不是今天的持有資產；可自行修改，不自動同步。未來月提領不等於今天生活費的購買力。通膨與實質金額以退休起始年為基準，未再折算累積期間；4%
              僅為教育情境，不保證資產持續支應退休生活。
            </p>
          </div>
        )}
        <Select
          form={f}
          name="mode"
          label="試算方向"
          options={[
            ["assets", "已有資產 → 試算可提領金額"],
            ["need", "每月需求 → 倒推起始資產"],
          ]}
        />
        {f.values.mode === "assets" ? (
          <Asset form={f} />
        ) : (
          <>
            <Select
              form={f}
              name="gapMode"
              label="每月需求輸入方式"
              options={[
                ["direct", "直接輸入投資需補足金額"],
                ["expenses", "生活費減固定退休收入"],
              ]}
            />
            {f.values.gapMode === "direct" ? (
              <Field form={f} name="gap" label="每月需由投資補足" />
            ) : (
              <>
                <Field form={f} name="expenses" label="每月總生活費" />
                <Field form={f} name="income" label="每月固定退休收入" />
              </>
            )}
          </>
        )}
        <Field
          form={f}
          name="rate"
          label="首年／當期資產提領率"
          unit="%"
          min={1}
          max={10}
          step={0.5}
        />
        <Select
          form={f}
          name="strategy"
          label="提領策略"
          options={[
            ["real", "固定實質：首年比例，之後隨通膨增加"],
            ["proportional", "當期比例：每年按剩餘資產比例提領"],
            ["nominal", "固定名目：每年領相同金額"],
          ]}
        />
        <div className="field-grid">
          <Field
            form={f}
            name="annual"
            label="假設年化名目總報酬"
            unit="%"
            max={10}
          />
          <Field form={f} name="inflation" label="年通膨率" unit="%" max={5} />
        </div>
        <Details title="進階設定">
          <div className="field-grid">
            <Field
              form={f}
              name="age"
              label="退休起始年齡"
              unit="歲"
              min={18}
              max={100}
              step={1}
            />
            <Field
              form={f}
              name="years"
              label="模擬期間"
              unit="年"
              min={10}
              max={50}
              step={1}
            />
          </div>
          <Select
            form={f}
            name="label"
            label="資產配置標籤"
            options={[
              ["taiwan", "0050／006208（臺灣50示範）"],
              ["mixed", "股票＋債券＋現金（概念情境）"],
              ["custom", "自訂"],
            ]}
          />
          {f.values.label === "custom" && (
            <label className="field">
              <span>自訂資產配置名稱</span>
              <input
                maxLength={60}
                value={f.values.customLabel ?? ""}
                onChange={(e) => f.set("customLabel", e.target.value)}
              />
            </label>
          )}
          <p className="hint">
            標籤不會自動改變報酬率或提領率，不代表實際歷史績效。
          </p>
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
              ? `退休模擬：起始資產 ${money(r.initial)} 元，首年提領 ${money(r.first.withdrawal)} 元，平均每月 ${money(r.first.withdrawal / 12)} 元。策略 ${f.values.strategy}；${f.values.years}年末資產 ${money(r.end.balance)} 元。非安全退休保證。`
              : ""
          }
        />
      </section>
      <section className="results" aria-label="退休提領結果">
        {r && (
          <>
            <div className="hero-result">
              <span className="result-badge">退休生活的現金流想像</span>
              <Stat
                label={
                  f.values.mode === "need"
                    ? "概念性所需起始資產"
                    : "首年平均每月投資提領"
                }
                value={
                  f.values.mode === "need" ? r.initial : r.first.withdrawal / 12
                }
              />
              <p>
                {f.values.mode === "need"
                  ? "第一年投資缺口 × 12 ÷ 提領率，並非保證不耗盡的精算結果。"
                  : "年度提領 ÷ 12，非保證每月實際入帳。"}
              </p>
              <div className="hero-stats">
                <Stat
                  small
                  label="首年實際提領總額"
                  value={r.first.withdrawal}
                />
                <Stat
                  small
                  label={`${r.input.years} 年末名目剩餘資產`}
                  value={r.end.balance}
                />
              </div>
            </div>
            <div className="panel">
              <h3>先看懂你選的提領方式</h3>
              <p>
                {f.values.strategy === "real"
                  ? `第一年以起始資產提領 ${f.n("rate")}%，往後每年依 ${f.n("inflation")}% 通膨增加預定金額，不跟著當期市值重算。`
                  : f.values.strategy === "proportional"
                    ? `每年以當年年初剩餘資產的 ${f.n("rate")}% 提領，收入會隨資產變動；不套用通膨增額，也不保證足夠生活。`
                    : "每年預定提領相同名目金額，通膨會降低購買力。"}
              </p>
              <Breakdown
                items={[
                  ["退休起始市值", r.initial],
                  ["期末實質資產（起始年購買力）", r.end.realBalance],
                  ["累積實際提領", r.end.cumulative],
                ]}
              />
              {f.values.mode === "need" && f.values.gapMode === "expenses" && (
                <Breakdown
                  items={[
                    ["年度總生活費", f.n("expenses") * 12],
                    ["年度固定退休收入", f.n("income") * 12],
                    ["需由投資補足的年度缺口", r.gap * 12],
                  ]}
                />
              )}
              <div className={r.failure ? "note caution" : "note"}>
                {r.failure
                  ? `第 ${r.failure.year} 年（${r.failure.age} 歲）${r.failure.unmet ? "預定提領需求無法滿足" : "資產耗盡"}。`
                  : `此固定報酬情境至 ${r.input.age + r.input.years} 歲尚有資產，但不代表安全提領率已獲驗證。`}
              </div>
            </div>
            <Details>
              <Select
                form={f}
                name="view"
                label="資產圖表金額"
                options={[
                  ["nominal", "名目金額"],
                  ["real", "實質金額（起始年購買力）"],
                ]}
              />
              <Chart
                data={r.rows.map((x) => ({
                  ...x,
                  assets: f.values.view === "real" ? x.realBalance : x.balance,
                }))}
                lines={[["assets", "剩餘資產", "#20745f"]]}
              />
              <Chart
                bar
                data={r.rows.map((x) => ({ ...x }))}
                lines={[["withdrawal", "每年實際提領", "#cb9244"]]}
              />
              <h3>10／20／30 年與自訂終點</h3>
              <Rows
                headers={["年度", "名目資產", "實質資產"]}
                rows={[...new Set([10, 20, 30, r.input.years])]
                  .filter((y) => y <= r.input.years)
                  .sort((a, b) => a - b)
                  .map((y) => [
                    `${y}年`,
                    money(r.rows[y - 1].balance),
                    money(r.rows[y - 1].realBalance),
                  ])}
              />
              <h3>相同條件，三種提領方式</h3>
              <Rows
                headers={["策略", "累積提領", "期末資產", "首次不足／耗盡"]}
                rows={r.strategies.map((s) => {
                  const fail = s.rows.find((x) => x.unmet || x.exhausted);
                  return [
                    {
                      real: "固定實質",
                      proportional: "當期比例",
                      nominal: "固定名目",
                    }[s.strategy],
                    money(s.rows.at(-1)!.cumulative),
                    money(s.rows.at(-1)!.balance),
                    fail ? `第${fail.year}年` : "本情境未發生",
                  ];
                })}
              />
              <h3>報酬順序風險</h3>
              <p>
                完全相同的年度報酬數值，只改變順序。以下為人工示範，並非歷史回測或預測。固定提領遇到早期下跌，可能更快消耗資產。
              </p>
              <Chart
                data={r.forward.map((x, i) => ({
                  year: x.year,
                  forward: x.balance,
                  reverse: r.reverse[i].balance,
                }))}
                lines={[
                  ["forward", "原始順序", "#20745f"],
                  ["reverse", "反轉順序", "#cb9244"],
                ]}
              />
              <Rows
                headers={[
                  "年度",
                  "原序報酬",
                  "反序報酬",
                  "原序餘額",
                  "反序餘額",
                ]}
                rows={r.forward.map((x, i) => [
                  x.year,
                  `${(r.returns[i] * 100).toFixed(0)}%`,
                  `${(r.returns[r.returns.length - 1 - i] * 100).toFixed(0)}%`,
                  money(x.balance),
                  money(r.reverse[i].balance),
                ])}
              />
              <p>
                原序首次不足：{r.forward.find((x) => x.unmet)?.year ?? "未發生"}
                ；反序首次不足：
                {r.reverse.find((x) => x.unmet)?.year ?? "未發生"}。
              </p>
              <h3>逐年提領明細</h3>
              <p className="hint">
                年度提領為該年實際可提領金額；資產不足時不會把未領到的金額計入累積提領。
              </p>
              {r.failure && (
                <p className="note caution retirement-shortfall" role="status">
                  第 {r.failure.year} 年（{r.failure.age} 歲）
                  {r.failure.unmet ? "資產不足，無法滿足預定提領" : "資產耗盡"}
                  。請留意後續可提領金額及剩餘資產。
                </p>
              )}
              <Rows
                headers={["年度／年齡", "年度提領", "累積提領", "剩餘資產"]}
                rows={r.rows.map((x) => [
                  `${x.year}年／${x.age}歲`,
                  money(x.withdrawal),
                  money(x.cumulative),
                  money(x.balance),
                ])}
              />
              {f.values.mode === "need" && (
                <>
                  <h3>不同提領率的概念性起始資產</h3>
                  <Rows
                    headers={["提領率", "所需資產"]}
                    rows={[0.02, 0.03, 0.04, 0.05].map((rate) => [
                      `${rate * 100}%`,
                      money(requiredRetirement(r.gap, rate)),
                    ])}
                  />
                </>
              )}
            </Details>
            <Risk retirement />
            <Details title="認識 FIRE 與 4% 法則">
              <p>
                FIRE 指財務獨立、提早退休。4%
                法則來自特定美國歷史時期、股票與債券組合及約 30
                年退休期的研究，不能直接推論 100% 臺股 ETF 同樣安全。
              </p>
              <p>
                股息與賣出 ETF
                都是提領來源，股息不是額外免費收益。退休規劃還需考慮波動、長壽、費用與生活費變化。
              </p>
            </Details>
          </>
        )}
      </section>
    </div>
  );
}
