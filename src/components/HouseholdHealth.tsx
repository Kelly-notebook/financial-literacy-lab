import { selectedBudgetMode } from "../lib/budgetModes";
import { draftIssue } from "../lib/savingsComparison";
import { useState } from "react";
import { money as formatMoney } from "../lib/finance";
import type { BudgetRow } from "../lib/budget";
import {
  healthCheck,
  entryGroup,
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
  current: c,
  entries,
  items,
  onCompound,
}: {
  form: Form;
  current: BudgetRow;
  entries: BudgetEntry[];
  items: Allocation[];
  onCompound?: (monthly: number) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const categories = Object.fromEntries(
    entries.map((e) => [e.id, f.values[`group_${e.id}`] ?? e.group]),
  ) as Record<string, Group>;
  const limits = Object.fromEntries(
    Object.keys(detailLimits).map((id) => [id, f.n(`limit_${id}`)]),
  ) as Limits;
  const mode = selectedBudgetMode(f.values, c.income);
  const result = safely(() =>
    healthCheck(entries, c.income, categories, limits, mode.mode),
  );
  const h =
    result.data ??
    healthCheck(entries, c.income, categories, undefined, mode.mode);
  const transferIssue = draftIssue(f.values, [
    ["etfMonthly", "每月預計投入 ETF 金額"],
  ]);
  const notices = investmentCheck(c, f.values.emergencyConfirmed === "yes");
  return (
    <Details title="家庭收支健檢與投資規劃">
      <span className="eyebrow">03 / UNDERSTAND & PLAN</span>
      <h3>家庭收入都分配到哪裡？</h3>
      <AllocationChart
        items={items}
        income={c.income}
        deficit={c.deficit}
        onSelect={(name) => setExpanded(expanded === name ? null : name)}
      />
      <div className="ring-reconciliation">
        <p>
          其他每月儲蓄目標 NT${" "}
          {money(entries.find((e) => e.id === "saving")?.value ?? 0)}
        </p>
        <p>
          該金額已從可支配餘額扣除，但未包含於七類切片，也不混入
          ETF、購物或旅遊。長期儲蓄／財務安全用途可歸 CFPB 儲蓄類別。
        </p>
        <p>
          對帳：七類合計 NT$ {money(items.reduce((s, x) => s + x.value, 0))} ＋
          其他每月儲蓄 NT${" "}
          {money(entries.find((e) => e.id === "saving")?.value ?? 0)} ＝ 月收入
          NT$ {money(c.income)}
          {c.deficit > 0 ? ` ＋ 赤字 NT$ ${money(c.deficit)}` : ""}。
        </p>
      </div>
      {expanded && (
        <div className="living-breakdown">
          <h3>{expanded}細項</h3>
          <Breakdown
            decimals={2}
            items={entries
              .filter(
                (e) =>
                  e.flow === "living" &&
                  entryGroup(e, categories) ===
                    (expanded === "必要生活支出" ? "needs" : "wants"),
              )
              .map((e) => [
                `${e.name}（占收入 ${percent(c.income > 0 ? (e.value / c.income) * 100 : null)}）`,
                e.value,
              ])}
          />
          <p className="hint">
            快速模式只列該類總額；明細模式才有19項資料，不由總額虛構明細。
          </p>
        </div>
      )}
      <div className={c.remaining < 0 ? "note caution" : "note"}>
        <strong>剩餘金錢：NT$ {money(c.remaining)}</strong>
        <p className="hint">
          這是尚未分配的每月預算結餘，不是銀行存款或累積現金資產。
        </p>
        {c.remaining < 0 && (
          <p>
            總分配超過收入，赤字 NT$ {money(c.deficit)}
            。環圈無法畫負值，這裡保留真實負結餘，不當成零。
          </p>
        )}
      </div>
      <h3>用金額，規劃 ETF 投入</h3>
      <Field
        validateOnBlur
        form={f}
        name="etfMonthly"
        label="每月預計投入 ETF 金額"
      />
      {onCompound && (
        <>
          <button
            className="scenario-button"
            disabled={!!transferIssue}
            onClick={() => onCompound(f.n("etfMonthly"))}
          >
            帶入長期複利試算
          </button>
          {transferIssue && <p className="hint">{transferIssue}</p>}
          <p className="hint">
            只帶入目前有效 ETF 月投入，取代原月投入並設為 30
            年；停用既有中途投入設定，不把全部結餘視為投資。起始資產與報酬率保留。
          </p>
        </>
      )}
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
          <h3>家庭參考預算比例</h3>
          <p>
            目前採用：{mode.preset.name}；必要 {mode.preset.needs}%／品質生活{" "}
            {mode.preset.wants}%／儲蓄投資 {mode.preset.savings}
            %。可在收入區切換參考預算模式。
          </p>
          <p className="hint">{mode.note}</p>
          <p className="hint">
            分母為每月稅後可支配收入 NT$ {money(c.income)}
            （含已選擇納入的現金收入）。推薦以此月平均 × 12
            年化，不將月薪與年薪再次相加，也不代表逐月實際入帳。
          </p>
          <div className="health-groups">
            {h.groups.map((g) => (
              <div
                className={`health-group tone-${mode.monthlyIncome === undefined ? "unknown" : g.tone}`}
                data-group={g.id}
                data-tone={
                  mode.monthlyIncome === undefined ? "unknown" : g.tone
                }
                key={g.id}
              >
                <span>
                  {g.id === "wants" ? "品質生活（非必要消費）" : g.name}
                </span>
                <strong>
                  {mode.monthlyIncome === undefined
                    ? "收入待確認"
                    : percent(g.ratio)}
                </strong>
                <small>參考目標 {g.reference}%</small>
                <p>本月指定 NT$ {money(g.value)}</p>
                <p>
                  每月參考金額：
                  {mode.monthlyIncome === undefined
                    ? "收入待確認"
                    : `NT$ ${money((mode.monthlyIncome * g.reference) / 100)}`}
                </p>
                <p>
                  {mode.monthlyIncome === undefined
                    ? "目前收入未完成，暫不判定比例狀態。"
                    : g.message}
                </p>
              </div>
            ))}
          </div>
          <p className="reference-disclaimer">
            經典 50／30／20
            保留為經典參考；其他三種比例及收入門檻是本站教育性設計，不是官方統計標準。比例是參考目標，不是支出上限、必須花完的額度或強制儲蓄額度。低於消費預算或高於儲蓄目標不屬異常。赤字與債務風險應先於比例檢視。
          </p>
          <p className="hint">
            各項只歸入一類。未分配的每月預算結餘不自動算已儲蓄，也不是實際累積現金資產；沒有現金存量及用途資料，不能判定現金過多。貸款本金與利息未拆分，暫依你選的分類整筆計一次，不能同時再加計本金為儲蓄。大型購買與旅行可分別調整分類。
          </p>
          <Details title="調整支出分類與參考上限">
            <h3>調整必要／非必要／儲蓄分類</h3>
            <p className="hint">
              預設按常見用途分類，伙食、育兒、交通、保險、貸款與大型購買等可能有不同性質，請依自己家庭用途調整。分類只改變健檢歸屬，不改變預算扣款。
            </p>
            <div className="classification-grid">
              {entries
                .filter((e) => !e.id.startsWith("quick"))
                .map((e) => (
                  <Select
                    key={e.id}
                    form={{
                      ...f,
                      values: {
                        ...f.values,
                        [`group_${e.id}`]: entryGroup(e, categories),
                      },
                    }}
                    name={`group_${e.id}`}
                    label={`${e.name}的健檢分類`}
                    options={
                      Object.entries(groupNames).filter(
                        ([key]) => e.flow !== "living" || key !== "savings",
                      ) as [string, string][]
                    }
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
          ) : mode.monthlyIncome === undefined ? (
            <p>尚無正的稅後收入，無法可靠比較比例；請先確認收入。</p>
          ) : c.remaining >= 0 && c.etfGap === 0 ? (
            <p>
              目前沒有現金流赤字或已知投資目標缺口，不因細項比例或非必要分類要求減支。請先確認家庭安全與重要目標，再依生活品質及偏好決定是否調整。
            </p>
          ) : h.advice.length ? (
            <ol className="health-advice">
              {h.advice.map((a) => (
                <li key={a.id}>
                  {a.name}支出占收入 {percent(a.actual)}，比本站參考上限高出{" "}
                  {new Intl.NumberFormat("zh-TW", {
                    maximumFractionDigits: 2,
                  }).format(a.excessPoints!)}{" "}
                  個百分點。目前有現金流或目標缺口；只有確認此項可調且影響重要目標時，才考慮以下情境，並非必須削減。若將每月
                  {a.name}支出調整至 {money(a.target)} 元，每月可多保留{" "}
                  {money(a.excess!)} 元，一年可多保留 {money(a.annual!)} 元。
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
          <p className="hint">
            不因 ETF 低於 10% 就判定不足，也不因高於 20% 就判定過多。必要支出
            3～6 個月的一般緩衝參考為{" "}
            {h.emergencyMax > 0
              ? `NT$ ${money(h.emergencyMin)}～${money(h.emergencyMax)}`
              : "請先確認必要支出與分類"}
            ，不是已驗證的存款達標判定。
          </p>
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

export function FinancialSafety({
  form: f,
  onOpenRetirement,
}: {
  form: Form;
  onOpenRetirement?: () => void;
}) {
  return (
    <section className="panel financial-safety" aria-label="財務安全檢查">
      <h3>財務安全檢查</h3>
      <Toggle form={f} name="emergencyConfirmed">
        我已準備 3～6 個月必要生活支出的緊急預備金。
      </Toggle>
      {f.values.emergencyConfirmed !== "yes" && (
        <p className="hint">
          可先檢視並逐步建立財務緩衝，再考慮提高 ETF
          投資金額；未勾選不表示財務不健康。
        </p>
      )}
      <Toggle form={f} name="retirementConfirmed">
        我已開始為退休儲蓄或投資，並定期檢視規劃。
      </Toggle>
      <p className="hint">這只是自我確認，不代表退休資金已足夠。</p>
      {f.values.retirementConfirmed !== "yes" && (
        <p className="hint">
          可在適合的時間整理退休目標，之後定期檢視；這是自我確認，不代表退休資金已足夠，也不作退休達標判定。
        </p>
      )}
      <a
        href="#retirement"
        onClick={(e) => {
          e.preventDefault();
          onOpenRetirement?.();
        }}
      >
        前往第四單元：退休提領模擬器
      </a>
      <p className="hint">
        兩項勾選只用於自我提醒，均不影響收支金額、ETF 投入或 50／30／20
        計算。已勾選不代表經過驗證的財務安全評估；狀態只隨此瀏覽器的家庭暫存保存。
      </p>
    </section>
  );
}
