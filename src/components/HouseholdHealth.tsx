import { money as formatMoney } from "../lib/finance";
import type { BudgetInput, BudgetRow } from "../lib/budget";
import {
  healthCheck,
  investmentCheck,
  detailLimits,
  groupNames,
  references,
  type BudgetEntry,
  type Allocation,
  type Group,
  type Limits,
} from "../lib/health";
import { AllocationChart } from "./BudgetCharts";
import {
  Details,
  Field,
  Select,
  Toggle,
  Breakdown,
  ErrorNotice,
  safely,
  type Form,
} from "./ui";
const money = (value: number) => formatMoney(value, 2);
const percent = (v: number | null) =>
  v === null
    ? "無法計算"
    : `${new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 }).format(v)}%`;
export function HouseholdHealth({
  form: f,
  input,
  current: c,
  entries,
  items,
}: {
  form: Form;
  input: BudgetInput;
  current: BudgetRow;
  entries: BudgetEntry[];
  items: Allocation[];
}) {
  const categories = Object.fromEntries(
    entries.map((e) => [e.id, f.values[`group_${e.id}`] ?? e.group]),
  ) as Record<string, Group>;
  const limits = Object.fromEntries(
    Object.keys(detailLimits).map((id) => [id, f.n(`limit_${id}`)]),
  ) as Limits;
  const result = safely(() =>
    healthCheck(entries, c.income, categories, limits),
  );
  const h = result.data ?? healthCheck(entries, c.income, categories);
  const notices = investmentCheck(c, f.values.emergencyConfirmed === "yes");
  return (
    <Details title="家庭收支健檢與投資規劃">
      <span className="eyebrow">03 / UNDERSTAND & PLAN</span>
      <h3>家庭收入都分配到哪裡？</h3>
      <AllocationChart items={items} income={c.income} deficit={c.deficit} />
      <div className={c.remaining < 0 ? "note caution" : "note"}>
        <strong>剩餘金錢：NT$ {money(c.remaining)}</strong>
        {c.remaining < 0 && (
          <p>
            總分配超過收入，赤字 NT$ {money(c.deficit)}
            。環圈無法畫負值，這裡保留真實負結餘，不當成零。
          </p>
        )}
      </div>
      <h3>用金額，規劃 ETF 投入</h3>
      <Field form={f} name="etfMonthly" label="每月預計投入 ETF 金額" />
      <button
        className="scenario-button"
        disabled={c.income <= 0}
        onClick={() => f.set("etfMonthly", String(c.income * 0.1))}
      >
        以月收入 10% 試算
      </button>
      <p className="hint">
        預設 0 元；10% 只是快捷試算情境，不是專家規定的最低股票投資比例。0050
        為教育案例，不構成個別投資建議。
      </p>
      <Breakdown
        decimals={2}
        items={[
          ["每月 ETF 計畫投入（只扣一次）", c.etf],
          ["目標的每日平均投入", c.etfDaily],
          ["扣除其他支出與目標後的可負擔額", c.etfAffordable],
        ]}
      />
      <p className="investment-ratio">
        ETF 投入占稅後月收入：<strong>{percent(c.etfRatio)}</strong>
        {c.income === 0 && "（收入為 0，不除以零）"}
      </p>
      <ErrorNotice message={result.error} />
      {h && (
        <>
          <h3>CFPB 50／30／20 收支參考</h3>
          <p className="hint">
            分母為每月稅後可支配收入 NT$ {money(c.income)}
            （含已選擇納入的現金收入）。這是參考法則，不是所有家庭都必須遵守的硬性規定。
          </p>
          <div className="health-groups">
            {h.groups.map((g) => (
              <div className="health-group" key={g.id}>
                <span>{g.name}</span>
                <strong>{percent(g.ratio)}</strong>
                <small>
                  {g.id === "savings" ? "參考目標" : "參考上限"} {g.reference}%
                </small>
                <p>本月指定 NT$ {money(g.value)}</p>
                {g.ratio !== null && (
                  <p>
                    {g.id === "savings"
                      ? g.ratio < g.reference
                        ? "目前低於參考目標，可依家庭需求檢視；不代表必須增加股票投資。"
                        : "目前已達此情境的參考目標，仍需考量目標期限與風險。"
                      : g.ratio > g.reference
                        ? "目前高於參考上限，可檢視用途與分類；不表示一定能削減。"
                        : "目前在參考上限內，仍應依實際生活需求評估。"}
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="hint">
            各項只歸入一類。未分配的剩餘金錢不自動算已儲蓄；貸款本金與利息未拆分，暫依你選的分類整筆計一次，不能同時再加計本金為儲蓄。大型購買與旅行可分別調整分類。
          </p>
          <Details title="調整支出分類與參考上限">
            <h3>調整必要／非必要／儲蓄分類</h3>
            <p className="hint">
              預設按常見用途分類，伙食、育兒、交通、保險、貸款與大型購買等可能有不同性質，請依自己家庭用途調整。分類只改變健檢歸屬，不改變預算扣款。
            </p>
            <div className="classification-grid">
              {entries.map((e) => (
                <Select
                  key={e.id}
                  form={{
                    ...f,
                    values: {
                      ...f.values,
                      [`group_${e.id}`]: f.values[`group_${e.id}`] ?? e.group,
                    },
                  }}
                  name={`group_${e.id}`}
                  label={`${e.name}的健檢分類`}
                  options={Object.entries(groupNames) as [string, string][]}
                />
              ))}
            </div>
            <h3>調整參考上限</h3>
            <p className="reference-disclaimer">
              細項比例為本站教育性試算參考值，非專家公認標準，可依家庭需求調整。
            </p>
            <div className="field-grid">
              {Object.entries(detailLimits).map(([id]) => (
                <Field
                  key={id}
                  form={f}
                  name={`limit_${id}`}
                  label={`${{ food: "伙食", insurance: "保險", transport: "交通", utilities: "水電", telecom: "電信費", subscriptions: "工具與娛樂訂閱" }[id]}參考上限`}
                  unit="%"
                  max={100}
                />
              ))}
            </div>
            <p className="hint">
              育兒與家庭、其他生活支出、貸款及大型購買沒有統一上限。此處細項值不是
              CFPB、Fidelity 或政府機關的正式建議。
            </p>
          </Details>
          <h3>優先檢視的細項情境</h3>
          <p className="reference-disclaimer">
            細項比例為本站教育性試算參考值，非專家公認標準，可依家庭需求調整。
          </p>
          {result.error ? (
            <p>參考上限有誤，修正後再顯示細項調整情境。</p>
          ) : c.income <= 0 ? (
            <p>尚無正的稅後收入，無法可靠比較比例；請先確認收入。</p>
          ) : h.advice.length ? (
            <ol className="health-advice">
              {h.advice.map((a) => (
                <li key={a.id}>
                  {a.name}支出占收入 {percent(a.actual)}，比本站參考上限高出{" "}
                  {new Intl.NumberFormat("zh-TW", {
                    maximumFractionDigits: 2,
                  }).format(a.excessPoints!)}{" "}
                  個百分點。若將每月{a.name}支出調整至 {money(a.target)}{" "}
                  元，每月可多保留 {money(a.excess!)} 元，一年可多保留{" "}
                  {money(a.annual!)} 元。
                </li>
              ))}
            </ol>
          ) : (
            <p>
              目前已填入且設有上限的細項，未超出你設定的參考值；這不代表整體財務一定安全。
            </p>
          )}
          <p className="hint">
            最多列出 4
            個超出金額較大的項目。只是調整情境，不能斷言必要支出一定能削減，也不會把多個情境的節省再次加進目前結餘。總額模式未拆出伙食等明細時，不憑空推算該項比例；可切換明細補填。
          </p>
          <h3>ETF 投資健檢</h3>
          <div className="investment-notices" aria-label="ETF 投資健檢結果">
            {notices.map((n) => (
              <div
                className={`note ${n.kind === "deficit" || n.kind === "affordability" ? "caution" : ""}`}
                key={n.kind}
                data-kind={n.kind}
              >
                <p>{n.text}</p>
                {n.kind === "affordability" && (
                  <p>超出可負擔額 NT$ {money(c.etfGap)}。</p>
                )}
                {n.kind === "deficit" && (
                  <p>本月赤字 NT$ {money(c.deficit)}。</p>
                )}
              </div>
            ))}
          </div>
          <Toggle form={f} name="emergencyConfirmed">
            我已自行確認緊急預備金安排
          </Toggle>
          <p className="hint">
            此勾選是你的確認，不是系統驗證存款已達標。緊急預備金一般參考目前歸類為必要支出的
            3～6 個月：
            {h.emergencyMax > 0
              ? `NT$ ${money(h.emergencyMin)}～${money(h.emergencyMax)}`
              : "請先確認必要支出與分類"}
            。沒有流動儲蓄資料時，不判定是否達標。
          </p>
          <p className="hint">
            不因 ETF 比例低於 10% 就判定不足，也不因高於 20%
            就判定過多；投入比例 {percent(c.etfRatio)}
            ，仍需連結長期規劃與風險承受能力。
          </p>
          <Details title="退休儲蓄與投資現金流說明">
            <p>
              Fidelity 的退休儲蓄參考目標為每年約稅前收入
              15%，包含符合條件的雇主退休金提撥。它不等於每個人應拿 15% 薪水購買
              ETF，也不能和稅後基準的 50／30／20 比例相加。
            </p>
            <p>
              此處沒有稅前收入、完整退休儲蓄及雇主提撥資料，因此僅提供教育說明，不判定退休儲蓄是否達標。
            </p>
            <Breakdown
              decimals={2}
              items={[
                ["每年預估投資現金收入", input.investmentCash],
                ["納入家庭預算的平均月額", c.cashMonthly],
              ]}
            />
            <p>
              目前選擇：
              {
                {
                  exclude: "不納入預算",
                  spend: "納入可支配預算",
                  reinvest: "股息再投入，不列可支配現金",
                }[input.cashTreatment]
              }
              。股息不保證且可能變動，平均月額不是實際配息月份；未實現價差不算家庭收入，不把再投入股息重複算成可花現金。
            </p>
          </Details>
        </>
      )}
    </Details>
  );
}
export function BudgetReferences() {
  return (
    <Details title="理財參考依據與資料來源">
      <ol className="reference-list">
        {references.map((ref) => (
          <li key={ref.url}>
            <strong>{ref.institution}</strong>
            <br />
            <a href={ref.url} target="_blank" rel="noopener noreferrer">
              {ref.title}
            </a>
            <p>{ref.content}</p>
            <a
              className="source-url"
              href={ref.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {ref.url}
            </a>
          </li>
        ))}
      </ol>
      <p>
        本站提供理財教育與情境試算，非個人化投資建議。實際財務規劃應考量家庭結構、收入穩定性、負債、風險承受能力與退休制度。
      </p>
    </Details>
  );
}
