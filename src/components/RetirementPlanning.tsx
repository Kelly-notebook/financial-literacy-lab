import { useState } from "react";
import { Details } from "./ui";
import { AICoach } from "./AICoach";
import { money } from "../lib/finance";
import { formatMoneyInput, parseNumericInput } from "../lib/numberInput";
import {
  budgetPlanningPatch,
  emptyTime,
  incomeGap,
  optionalNumber,
  planningDefaults,
  planningLabels,
  planningSummary,
  referenceYear,
  retirementPrompt,
  timeDescription,
  type Time,
  type Planning,
  type BudgetTransfer,
} from "../lib/retirementPlanning";
function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Time;
  onChange: (t: Time) => void;
}) {
  return (
    <div className="field-grid">
      <label className="field">
        <span>{label}基準</span>
        <select
          aria-label={`${label}基準`}
          value={value.mode}
          onChange={(e) =>
            onChange({ ...value, mode: e.target.value as Time["mode"] })
          }
        >
          <option value="year">西元年份</option>
          <option value="roc">民國年份</option>
          <option value="age">年齡</option>
        </select>
      </label>
      <label className="field">
        <span>{label}</span>
        <input
          aria-label={label}
          inputMode="numeric"
          value={value.value}
          onChange={(e) => onChange({ ...value, value: e.target.value })}
        />
      </label>
    </div>
  );
}
export function RetirementPlanning({
  simulationSummary,
  getBudget,
}: {
  simulationSummary: string;
  getBudget?: () => BudgetTransfer | undefined;
}) {
  const [p, setP] = useState(planningDefaults),
    [baseYear] = useState(referenceYear),
    [budget, setBudget] = useState<BudgetTransfer>(),
    [notice, setNotice] = useState("");
  const patch = (data: Partial<Planning>) =>
    setP((old) => ({ ...old, ...data }));
  const gap = incomeGap(p, baseYear);
  const summary = [
    simulationSummary,
    planningSummary(p, baseYear, budget),
  ].join("\n\n");
  const field = (
    key: keyof typeof planningLabels,
    kind: "money" | "integer" | "text" = "money",
  ) => {
    const value = p[key],
      invalid =
        kind !== "text" &&
        value.trim() !== "" &&
        optionalNumber(
          value,
          kind === "integer" ? (key === "year" ? 2200 : 120) : 1e12,
          kind === "integer",
        ) === undefined;
    return (
      <label className="field" key={key}>
        <span>{planningLabels[key]}</span>
        <input
          aria-label={planningLabels[key]}
          inputMode={
            kind === "text"
              ? "text"
              : kind === "integer"
                ? "numeric"
                : "decimal"
          }
          maxLength={kind === "text" ? 300 : 30}
          value={kind === "money" ? formatMoneyInput(value) : value}
          aria-invalid={invalid}
          onChange={(e) => patch({ [key]: e.target.value })}
        />
        {invalid && (
          <small role="status">請填有效非負數；年齡及人數需為整數。</small>
        )}
      </label>
    );
  };
  const select = (
    key: "reason" | "work" | "ownHome" | "spouseDuration",
    options: string[],
  ) => (
    <label className="field">
      <span>{planningLabels[key]}</span>
      <select
        aria-label={planningLabels[key]}
        value={p[key]}
        onChange={(e) => patch({ [key]: e.target.value })}
      >
        <option value="">未提供</option>
        {options.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="retirement-planning">
      <Details title="進階退休與轉職規劃（選填）">
        <p className="hint">
          所有資料選填、僅留在本次頁面，重整會清除；空白為未提供。與上方提領試算分開，不改原本參數或公式。金額皆為新臺幣稅後月額，資產為市值。
        </p>
        <button
          className="scenario-button"
          onClick={() => {
            const incoming = getBudget?.();
            if (!incoming) {
              setNotice("尚無家庭資料，請先填寫家庭預算。");
              return;
            }
            try {
              const data = budgetPlanningPatch(incoming);
              patch(data);
              setBudget(incoming);
              setNotice(
                `已帶入 ${incoming.snapshot?.current.period} 家庭預算：取代生活費、投資、其他目標與貸款；配偶收入及其他固定支出請自行確認。`,
              );
            } catch (e) {
              setNotice((e as Error).message);
            }
          }}
        >
          帶入家庭預算資料
        </button>
        <p className="hint">
          每次點擊會取代對應欄位；其他欄位保留、不自動同步或寫回家庭。帶入生活費含當期必要與非必要消費及持有成本，不含貸款，請調整為離職後所需生活額；其他目標含當期購物、旅遊及其他儲蓄，各計一次。未帶入原薪資或不明是否持續的收入，也不自動判定配偶收入。
        </p>
        <p role="status">{notice}</p>
        <h3>A. 個人與職涯</h3>
        <p className="hint">
          年度基準：{baseYear}
          ；年齡換算為近似年份，不含生日。離開原工作與完全退休分別設定。
        </p>
        <div className="field-grid">
          {field("age", "integer")}
          {field("retireAge", "integer")}
        </div>
        <TimeField
          label="預計離開目前工作時間"
          value={p.leave}
          onChange={(leave) => patch({ leave })}
        />
        <p className="hint">
          離開原工作：{timeDescription(p.leave, p, baseYear)}；完全退休：
          {gap.retireYear ? `西元 ${gap.retireYear} 年` : "未提供或缺目前年齡"}
          。
        </p>
        <div className="field-grid">
          {select("reason", ["一般退休", "軍職退伍", "轉職", "其他"])}
          {select("work", ["是，預計繼續工作", "否", "尚未決定"])}
        </div>
        <h3>B. 資產與投資</h3>
        <div className="field-grid">
          {field("stocks")}
          {field("cash")}
          {field("otherAssets")}
          {field("invest")}
          {field("saving")}
        </div>
        <p className="hint">
          前三項僅填今天實際持有且互不重疊的資產。每月投入是未來現金流，長期複利帶入則是未來期末資產；三者不相加。上方提領的未來資產不會自動填入今天市值，也不拿來抵扣轉職工作收入。
        </p>
        <h3>C. 家庭責任與生活支出</h3>
        <div className="field-grid">
          {field("spouse")}
          <label className="field">
            <span>配偶收入持續方式</span>
            <select
              aria-label="配偶收入持續方式"
              value={p.spouseDuration}
              onChange={(e) => patch({ spouseDuration: e.target.value })}
            >
              <option value="">未確認</option>
              <option value="ongoing">假設持續</option>
              <option value="until">持續到指定時間</option>
            </select>
          </label>
        </div>
        {p.spouseDuration === "until" && (
          <TimeField
            label="配偶收入結束時間"
            value={p.spouseEnd}
            onChange={(spouseEnd) => patch({ spouseEnd })}
          />
        )}
        <div className="field-grid">
          {field("children", "integer")}
          {field("childAges", "text")}
          {field("living")}
          {field("fixed")}
        </div>
        <p className="hint">
          子女年齡請依序填寫（例如
          2、5）；只供規劃，不自動增列教育費。生活費應包含既有子女與扶養費；「其他扶養或固定支出」只填尚未包含的額外金額，沒有請填
          0。
        </p>
        {p.loans.map((l, i) => (
          <div key={l.id} className="planning-row">
            <label className="field">
              <span>{l.name}每月還款</span>
              <input
                aria-label={`${l.name}每月還款`}
                inputMode="decimal"
                value={formatMoneyInput(l.monthly)}
                onChange={(e) =>
                  patch({
                    loans: p.loans.map((v, j) =>
                      j === i ? { ...v, monthly: e.target.value } : v,
                    ),
                  })
                }
              />
            </label>
            <TimeField
              label={`${l.name}結束時間`}
              value={l.end}
              onChange={(end) =>
                patch({
                  loans: p.loans.map((v, j) => (j === i ? { ...v, end } : v)),
                })
              }
            />
          </div>
        ))}
        <div className="field-grid">
          {select("ownHome", ["是", "否", "尚待確認"])}
          {field("retirementLiving")}
        </div>
        {field("responsibility", "text")}
        <p className="hint">
          自住房屋與可動用資產分開，不以房屋市值支付生活費。固定支出與退休後生活費是否含貸款須自行核對；完全退休生活費只供
          AI 分析，不自動取代目前生活費。
        </p>
        <h3>D. 退休給付與其他收入</h3>
        <p className="hint">
          只列本人工作收入與配偶收入以外的收入；不可重複列入配偶薪資。同筆投資股息與含息提領不可重複使用。資格及金額需自行向主管機關確認，身分不代表符合資格或能併領。一次性給付不作固定月收入。
        </p>
        {p.benefits.map((b, i) => {
          const update = (data: Partial<typeof b>) =>
            patch({
              benefits: p.benefits.map((v, j) =>
                j === i ? { ...v, ...data } : v,
              ),
            });
          return (
            <fieldset className="planning-row" key={b.id}>
              <legend>第 {i + 1} 筆給付或收入</legend>
              <label className="field">
                <span>收入名稱</span>
                <input
                  aria-label={`第 ${i + 1} 筆收入名稱`}
                  maxLength={100}
                  value={b.name}
                  onChange={(e) => update({ name: e.target.value })}
                />
              </label>
              <div className="field-grid">
                <label className="field">
                  <span>給付頻率</span>
                  <select
                    aria-label={`第 ${i + 1} 筆給付頻率`}
                    value={b.kind}
                    onChange={(e) =>
                      update({ kind: e.target.value as typeof b.kind })
                    }
                  >
                    <option value="monthly">每月</option>
                    <option value="once">一次性</option>
                  </select>
                </label>
                <label className="field">
                  <span>稅後金額</span>
                  <input
                    aria-label={`第 ${i + 1} 筆稅後金額`}
                    inputMode="decimal"
                    value={formatMoneyInput(b.amount)}
                    onChange={(e) => update({ amount: e.target.value })}
                  />
                </label>
              </div>
              <TimeField
                label={`第 ${i + 1} 筆開始時間`}
                value={b.start}
                onChange={(start) => update({ start })}
              />
              <label className="field">
                <span>資格及金額狀態</span>
                <select
                  aria-label={`第 ${i + 1} 筆確認狀態`}
                  value={b.status}
                  onChange={(e) =>
                    update({ status: e.target.value as typeof b.status })
                  }
                >
                  <option value="pending">尚待確認</option>
                  <option value="confirmed">
                    已確認（使用者自述，未查證）
                  </option>
                </select>
              </label>
              {b.kind === "monthly" && (
                <>
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={b.ongoing}
                      onChange={(e) => update({ ongoing: e.target.checked })}
                    />
                    持續領取，未設定結束時間（明確假設）
                  </label>
                  {!b.ongoing && (
                    <TimeField
                      label={`第 ${i + 1} 筆結束時間`}
                      value={b.end}
                      onChange={(end) => update({ end })}
                    />
                  )}
                </>
              )}
              <button
                onClick={() =>
                  patch({ benefits: p.benefits.filter((_, j) => j !== i) })
                }
              >
                移除第 {i + 1} 筆收入
              </button>
            </fieldset>
          );
        })}
        <button
          className="scenario-button"
          onClick={() =>
            patch({
              benefits: [
                ...p.benefits,
                {
                  id: crypto.randomUUID(),
                  name: "",
                  kind: "monthly",
                  amount: "",
                  start: emptyTime(),
                  end: emptyTime(),
                  ongoing: false,
                  status: "pending",
                },
              ],
            })
          }
        >
          新增給付或收入
        </button>
        <h3>離職／退伍後，每月至少需要多少工作收入？</h3>
        {field("year", "integer")}
        <p className="hint">
          未指定試算年份時採離職年份。顯示金額向上取整至元。這是指定年份的簡化月平均缺口：起訖年整年視為有效，貸款最後還款年仍扣整年，沒有年內月份精算。生活費及目標固定，不自動調通膨；可以改年份比較。
        </p>
        {gap.basic === undefined ? (
          <p className="note">
            基本生活試算缺少或待修正：{gap.missing.join("、")}。
          </p>
        ) : (
          <div className="note">
            <p>
              西元 {gap.year} 年
              {gap.age === undefined ? "" : `（約 ${gap.age} 歲）`}
              ，基本生活所需：
              <strong>NT$ {money(Math.ceil(gap.basic))}／月（稅後）</strong>
            </p>
            <p>
              當期支出 NT$ {money(gap.expenses, 2)}（含貸款 {money(gap.loan, 2)}
              ）－配偶收入 {money(gap.spouseIncome, 2)}－已確認其他月收入{" "}
              {money(gap.benefitIncome, 2)}；最低為 0。
            </p>
          </div>
        )}
        {gap.goals === undefined ? (
          <p className="hint">
            維持儲蓄目標尚無可靠估算：
            {[...gap.missing, ...gap.goalsMissing].join("、")}。
          </p>
        ) : (
          <p className="note">
            維持儲蓄目標：
            <strong>NT$ {money(Math.ceil(gap.goals))}／月（稅後）</strong>
            ；另外納入投資 {money(
              parseNumericInput(p.invest),
              2,
            )}、其他目標 {money(parseNumericInput(p.saving), 2)}，各計一次。
          </p>
        )}
        {gap.excluded.map((text, i) => (
          <p className="hint" key={i}>
            {text}
          </p>
        ))}
        {gap.retireYear !== undefined &&
          gap.year !== undefined &&
          gap.year >= gap.retireYear && (
            <p className="note caution">
              此年份已達設定的完全退休時間；數字代表仍需補足的收入缺口，不是已能安全退休的判定。
            </p>
          )}
        <p className="reference-disclaimer">
          未確認及未填的其他收入不扣抵；結果僅採已確認收入的條件情境，不代表其他收入已確認為
          0。不使用今天資產、未來資產或原提領結果補缺口，不預測安全退休年齡；跨年度通膨、家庭變動與法規請交由
          AI 根據完整資料分析並自行核對。
        </p>
        <button
          onClick={() => {
            setP(planningDefaults());
            setBudget(undefined);
            setNotice("已清除進階規劃與家庭帶入快照，上方退休試算不變。");
          }}
        >
          清除進階規劃資料
        </button>
      </Details>
      <AICoach summary={summary} planningPrompt={retirementPrompt(summary)} />
    </div>
  );
}
