import { AICoach } from "../components/AICoach";
import { householdSummary } from "../lib/householdSummary";
import { useRef } from "react";
import { useBudgetForm } from "../hooks/useBudgetForm";
import { money as formatMoney } from "../lib/finance";
import {
  budget,
  forecast,
  annualForecast,
  purchaseDuration,
  currentTaipeiMonth,
  switchIncome,
  type BudgetInput,
  type Income,
} from "../lib/budget";
import { CashFlowChart } from "../components/BudgetCharts";
import {
  budgetEntries,
  allocations,
  livingFields,
  detailLimits,
} from "../lib/health";
import {
  HouseholdHealth,
  BudgetReferences,
  FinancialSafety,
} from "../components/HouseholdHealth";
import {
  Field,
  Select,
  Details,
  Stat,
  Breakdown,
  ErrorNotice,
  safely,
  Actions,
  Rows,
  Toggle,
} from "../components/ui";
const money = (value: number) => formatMoney(value, 2);
const loanFields = [
  ["mortgage", "mortgageMonths", "房貸"],
  ["carLoan", "carLoanMonths", "車貸"],
  ["credit", "creditMonths", "信貸"],
  ["otherLoan", "otherMonths", "其他貸款"],
];
export default function Budget({
  onOpenRetirement,
}: { onOpenRetirement?: () => void } = {}) {
  const f = useBudgetForm({
    mode: "monthly",
    salary: "",
    annualBonus: "0",
    annualIncome: "",
    otherIncome: "0",
    investmentCash: "0",
    cashTreatment: "exclude",
    living: "15000",
    necessaryTotal: "15000",
    discretionaryTotal: "0",
    rent: "0",
    householdGoods: "0",
    education: "0",
    homeRepair: "0",
    gifts: "0",
    beauty: "0",
    fitness: "0",
    livingMode: "total",
    food: "6000",
    child: "0",
    insurance: "3000",
    transport: "2000",
    utilities: "2000",
    otherLiving: "2000",
    mortgage: "0",
    mortgageMonths: "240",
    carLoan: "0",
    carLoanMonths: "60",
    credit: "0",
    creditMonths: "24",
    otherLoan: "0",
    otherMonths: "12",
    purchaseName: "購車",
    purchasePrice: "300000",
    purchaseFund: "0",
    purchaseMonths: "60",
    purchaseMonthly: "5000",
    purchaseCost: "0",
    travelPrice: "60000",
    travelFund: "0",
    travelMonths: "12",
    etfMonthly: "0",
    telecom: "0",
    subscriptions: "0",
    clothing: "0",
    dining: "0",
    parentSupport: "0",
    medical: "0",
    purchaseMode: "deadline",
    group_purchase: "wants",
    retirementConfirmed: "no",
    emergencyConfirmed: "no",
    ...Object.fromEntries(
      Object.entries(detailLimits).map(([id, limit]) => [
        `limit_${id}`,
        String(limit),
      ]),
    ),
    saving: "0",
    startMonth: currentTaipeiMonth(),
    forecastYears: "5",
    view: "monthly",
    change: "no",
    changeMonth: "13",
    changeIncome: "50000",
    changeLiving: "15000",
    changeWants: "0",
  });
  const incomeInput = (): Income => ({
    mode: f.values.mode as Income["mode"],
    salary: f.n("salary"),
    annualBonus: f.n("annualBonus"),
    annualIncome: f.n("annualIncome"),
  });
  const changeMode = (mode: string) => {
    const converted = safely(() =>
      switchIncome(incomeInput(), mode as Income["mode"]),
    );
    if (converted.data) {
      const c = converted.data;
      f.patch({
        mode,
        salary: String(c.salary),
        annualBonus: String(c.annualBonus),
        annualIncome: String(c.annualIncome),
      });
    } else f.set("mode", mode);
  };
  const result = safely(() => {
    const details = f.values.livingMode === "detail";
    const parts = Object.fromEntries(
      livingFields.map((field) => [field.id, f.n(field.id)]),
    );
    const categories = Object.fromEntries(
      livingFields.map((field) => [
        field.id,
        f.values[`group_${field.id}`] === "wants"
          ? "wants"
          : f.values[`group_${field.id}`] === "needs"
            ? "needs"
            : field.group,
      ]),
    ) as Record<string, "needs" | "wants">;
    const living = details
      ? Object.values(parts).reduce((sum, v) => sum + v, 0)
      : f.n("necessaryTotal") + f.n("discretionaryTotal");
    if (
      !Number.isInteger(f.n("forecastYears")) ||
      f.n("forecastYears") < 1 ||
      f.n("forecastYears") > 50
    )
      throw new Error("預測年數需為 1～50 整數");
    const input: BudgetInput = {
      ...incomeInput(),
      otherIncome: f.n("otherIncome"),
      investmentCash: f.n("investmentCash"),
      cashTreatment: f.values.cashTreatment as BudgetInput["cashTreatment"],
      living,
      livingMode: f.values.livingMode as "total" | "detail",
      necessaryTotal: f.n("necessaryTotal"),
      discretionaryTotal: f.n("discretionaryTotal"),
      livingDetails: parts,
      livingCategories: categories,
      loans: loanFields.map(([p, m]) => ({ payment: f.n(p), months: f.n(m) })),
      purchaseMode: f.values.purchaseMode as "deadline" | "monthly",
      purchasePrice: f.n("purchasePrice"),
      purchaseFund: f.n("purchaseFund"),
      purchaseMonths: f.n("purchaseMonths"),
      purchaseMonthly: f.n("purchaseMonthly"),
      purchaseCost: f.n("purchaseCost"),
      travelPrice: f.n("travelPrice"),
      travelFund: f.n("travelFund"),
      travelMonths: f.n("travelMonths"),
      etfMonthly: f.etfForCalculation,
      telecom: f.n("telecom"),
      subscriptions: f.n("subscriptions"),
      clothing: f.n("clothing"),
      dining: f.n("dining"),
      parentSupport: f.n("parentSupport"),
      medical: f.n("medical"),
      saving: f.n("saving"),
      startMonth: f.values.startMonth,
      change:
        f.values.change === "yes"
          ? {
              month: f.n("changeMonth"),
              employmentMonthly: f.n("changeIncome"),
              living: f.n("changeLiving"),
              necessaryLiving: f.n("changeLiving"),
              discretionaryLiving: f.n("changeWants"),
            }
          : undefined,
    };
    const current = budget(input),
      monthly = forecast(input, f.n("forecastYears") * 12),
      annual = annualForecast(monthly),
      year = forecast(input, 12),
      entries = budgetEntries(input, current);
    const allCategories = Object.fromEntries(
      entries.map((e) => [e.id, f.values[`group_${e.id}`] ?? e.group]),
    ) as Record<string, import("../lib/health").Group>;
    const items = allocations(entries, current.remaining, allCategories);
    return {
      input,
      current,
      monthly,
      annual,
      items,
      entries,
      annualRemaining: year.reduce((s, x) => s + x.remaining, 0),
      annualIncome: year.reduce((s, x) => s + x.income, 0),
    };
  });
  const lastValid = useRef<typeof result.data>(undefined);
  if (result.data) lastValid.current = result.data;
  const r = result.data ?? lastValid.current;
  const c = r?.current;
  const fullSummary = householdSummary(f.values, r);
  return (
    <div className="workspace budget-workspace">
      <section className="panel inputs">
        <div className="panel-heading">
          <span className="eyebrow">LIFE IN BALANCE</span>
          <h2>家庭財務與生活目標規劃</h2>
          <p>先看日常餘裕，再安排目標與未來。</p>
        </div>
        <div className="storage-notice">
          <p>
            家庭資料只暫存於目前的瀏覽器，不上傳伺服器或
            GitHub。共用裝置使用後可清除。
          </p>
          <p>
            只保存合理值，未完成輸入不覆蓋上次有效資料。清除會重設表單；再次編輯才重新暫存。
          </p>
          <p role="status">{f.storageStatus}</p>
          <button
            onClick={() => {
              lastValid.current = undefined;
              f.clearSaved();
            }}
          >
            清除已儲存資料
          </button>
        </div>
        <Select
          form={f}
          name="mode"
          label="收入模式"
          onChange={changeMode}
          options={[
            ["monthly", "月薪模式：固定月薪＋年度獎金"],
            ["annual", "年薪模式：全年總收入（含獎金）"],
          ]}
        />
        {f.values.mode === "monthly" ? (
          <>
            <Field form={f} name="salary" label="每月固定實領薪資" />
            <Field form={f} name="annualBonus" label="年度獎金（選填）" />
          </>
        ) : (
          <Field
            form={f}
            name="annualIncome"
            label="全年實領總收入（已含獎金）"
          />
        )}
        <p className="hint">
          {f.values.mode === "annual"
            ? "全年總收入 ÷ 12 為月平均，不會再次加計獎金，也不代表每月實際收到相同金額。"
            : "有年度獎金時，總收入及試算結果以月平均呈現；獎金 ÷ 12 只是規劃基準，不代表每月固定入帳。"}
        </p>
        <p className="hint">
          50／30／20
          必須使用稅後可支配收入。若手邊資料是稅前年薪，請先扣除稅費，改填稅後收入；此處不自動推算所得稅。
        </p>
        <Field form={f} name="otherIncome" label="其他每月固定收入" />
        <Details title="投資現金收入">
          <Field
            form={f}
            name="investmentCash"
            label="每年預估股息／投資現金收入"
          />
          <Select
            form={f}
            name="cashTreatment"
            label="投資現金收入處理方式"
            options={[
              ["exclude", "不納入家庭可支配預算"],
              ["spend", "納入可支配預算（月平均）"],
              ["reinvest", "股息再投入，不列可支配現金"],
            ]}
          />
          <p className="hint">
            只填實際現金收入，不含股票未實現價差。股息不保證且可能變動；平均月額不代表每月都有配息，再投入與可支配現金不可重複計入。
          </p>
        </Details>
        <section className="living-inputs" aria-label="生活費輸入">
          {f.values.livingMode === "total" ? (
            <fieldset className="expense-section">
              <legend>生活費快速輸入</legend>
              <Field
                form={f}
                name="necessaryTotal"
                label="每月必要生活費總額"
              />
              <Field
                form={f}
                name="discretionaryTotal"
                label="每月非必要消費總額"
              />
              <button
                className="scenario-button"
                onClick={() => f.set("livingMode", "detail")}
              >
                展開生活費明細
              </button>
            </fieldset>
          ) : (
            <>
              <fieldset className="expense-section">
                <legend>必要生活支出</legend>
                <div className="living-detail-grid">
                  {livingFields
                    .filter((x) => x.group === "needs")
                    .map((x) => (
                      <Field key={x.id} form={f} name={x.id} label={x.name} />
                    ))}
                </div>
              </fieldset>
              <fieldset className="expense-section">
                <legend>非必要消費</legend>
                <div className="living-detail-grid">
                  {livingFields
                    .filter((x) => x.group === "wants")
                    .map((x) => (
                      <Field key={x.id} form={f} name={x.id} label={x.name} />
                    ))}
                </div>
              </fieldset>
              <button
                className="scenario-button"
                onClick={() => f.set("livingMode", "total")}
              >
                切換快速輸入
              </button>
            </>
          )}
          <p className="hint">
            目前採用{f.values.livingMode === "total" ? "快速總額" : "19項明細"}
            作為唯一生活費來源。快速合計 NT${" "}
            {money(f.n("necessaryTotal") + f.n("discretionaryTotal"))}
            ；另存明細合計 NT${" "}
            {money(livingFields.reduce((sum, x) => sum + f.n(x.id), 0))}
            。兩組資料獨立保留，切換不相加、不改寫或補差額。
          </p>
          <p className="hint">
            以上是預設介面分組；孝親、教育、居家維修與治裝等項目可在健檢按用途調整必要／非必要分類。
          </p>
        </section>
        <Details title="貸款設定：房貸、車貸、信貸、其他">
          {loanFields.map(([p, m, label]) => (
            <div className="field-grid" key={p}>
              <Field form={f} name={p} label={`${label}月付額`} />
              <Field
                form={f}
                name={m}
                label={`${label}剩餘期數`}
                unit="月"
                max={600}
                step={1}
              />
            </div>
          ))}
          <p className="hint">
            沒有貸款填 0；剩餘 24 期表示第 24 個月仍扣款、第 25 個月起停止。
          </p>
        </Details>
        <Details title="大型購買與旅行目標">
          <label className="field">
            <span>大型購買目標名稱</span>
            <input
              aria-label="大型購買目標名稱"
              value={f.values.purchaseName}
              maxLength={50}
              onChange={(e) => f.set("purchaseName", e.target.value)}
            />
          </label>
          <Select
            form={f}
            name="purchaseMode"
            label="大型購買規劃模式"
            options={[
              ["deadline", "模式 A：指定購買時間"],
              ["monthly", "模式 B：指定每月儲蓄金額"],
            ]}
          />
          <Field form={f} name="purchasePrice" label="預計購買總金額" />
          <Field form={f} name="purchaseFund" label="已準備的購買基金" />
          {f.values.purchaseMode === "deadline" ? (
            <Field
              form={f}
              name="purchaseMonths"
              label="預計幾個月後購買"
              unit="月"
              min={1}
              max={600}
              step={1}
            />
          ) : (
            <Field form={f} name="purchaseMonthly" label="每月能存多少錢" />
          )}
          <Select
            form={f}
            name="group_purchase"
            label="大型購物目標用途"
            options={[
              ["wants", "非必要消費（如興趣鋼琴）"],
              ["needs", "必要用途（如工作必需設備）"],
              ["savings", "長期資產累積（如購屋頭期款）"],
            ]}
          />
          <Field form={f} name="purchaseCost" label="購入後每月額外持有成本" />
          <p className="hint">
            依最終用途分類，不因錢存入銀行就一律當成儲蓄目標。購屋僅處理頭期款資金，不估算核貸能力。未計利息、通膨與商品價格變動；達標後停止月存，最後一期最多存入尚缺金額。
          </p>
          <h3>旅行與其他儲蓄</h3>
          <Field form={f} name="travelPrice" label="每次旅行預算" />
          <div className="field-grid">
            <Field
              form={f}
              name="travelMonths"
              label="旅行間隔"
              unit="月"
              min={1}
              max={600}
              step={1}
            />
            <Field form={f} name="travelFund" label="現有旅遊基金" />
          </div>
          <Field form={f} name="saving" label="其他每月儲蓄目標" />
        </Details>
        <Details title="未來情境設定">
          <label className="field">
            <span>試算起始年月（臺灣時間）</span>
            <input
              aria-label="試算起始年月"
              type="month"
              value={f.values.startMonth}
              onChange={(e) => f.set("startMonth", e.target.value)}
            />
          </label>
          <Field
            form={f}
            name="forecastYears"
            label="預測年數"
            unit="年"
            min={1}
            max={50}
            step={1}
          />
          <Toggle form={f} name="change">
            設定一次未來收入與生活費變動
          </Toggle>
          {f.values.change === "yes" && (
            <>
              <Field
                form={f}
                name="changeMonth"
                label="從第幾個月開始變動"
                unit="月"
                min={1}
                max={600}
                step={1}
              />
              <Field
                form={f}
                name="changeIncome"
                label="變動後工作收入（月平均，含獎金）"
              />
              <Field
                form={f}
                name="changeLiving"
                label="變動後每月必要生活費總額"
              />
              <Field
                form={f}
                name="changeWants"
                label="變動後每月非必要消費總額"
              />
            </>
          )}
          <p className="hint">
            其他固定收入及投資現金收入維持原設定。這是可調整的情境，不是薪資或家庭支出的預測。
          </p>
        </Details>
        <ErrorNotice message={r ? result.error : undefined} />
        <Actions
          reset={() => {
            lastValid.current = undefined;
            f.reset();
          }}
          summary={fullSummary}
        />
      </section>
      <section className="results" aria-label="家庭預算結果">
        {result.error && r && (
          <p className="hint">
            輸入尚待修正，畫面暫沿用最近一次有效試算；欄位與圖表均保留。
          </p>
        )}
        {!r && (
          <div className="panel empty">
            <span>01 / 從收入開始</span>
            <h2>先填入你的收入</h2>
            <p>
              選擇月薪或年薪模式。資料只在此瀏覽器暫存，可隨時清除，不會上傳。
            </p>
          </div>
        )}
        {r && c && (
          <>
            <div className={`hero-result ${c.deficit ? "warning-result" : ""}`}>
              <span className="result-badge">01 / 現在的生活餘裕</span>
              <Stat decimals={2} label="每日平均可支配金額" value={c.daily} />
              <p>
                {c.period} 共 {c.days} 天：每月可支配金額 ÷ {c.days}
                。月平均收入不等於實際入帳時間，亦非帳戶餘額。
              </p>
              <div className="hero-stats">
                <Stat small label="每月總收入（月平均）" value={c.income} />
                <Stat
                  decimals={2}
                  small
                  label="每月剩餘可支配金額"
                  value={c.remaining}
                />
              </div>
              {c.deficit > 0 && (
                <div className="deficit-banner" role="status">
                  每月預算缺口 NT$ {money(c.deficit)}
                  ；負值保留，請調整支出、目標期限或收入假設。此時 ETF
                  計畫投入仍完整扣除，請檢視是否需要調整。
                </div>
              )}
            </div>
            <div className="panel">
              <h3>收入與支出，一起看清楚</h3>
              <Breakdown
                decimals={2}
                items={[
                  ["工作收入（月平均，含獎金）", c.employmentMonthly],
                  ["其他每月固定收入", r.input.otherIncome],
                  ["投資現金收入（月平均，僅計納入部分）", c.cashMonthly],
                  [
                    "每月生活支出（採用中的來源與購入後成本）",
                    c.living + c.purchaseCost,
                  ],
                  ["每月貸款支出", c.loan],
                  ["每月目標儲蓄與投資", c.goals],
                  ["每月剩餘可支配金額", c.remaining],
                ]}
              />
              {f.values.mode === "monthly" && (
                <p className="hint">
                  固定月薪 NT$ {money(r.input.salary)}；年度獎金 NT${" "}
                  {money(r.input.annualBonus)}，月平均獎金 NT${" "}
                  {money(r.input.annualBonus / 12)}。獎金不保證到帳。
                </p>
              )}
              <p className="hint">
                起始連續 12 個月的收入合計 NT$ {money(r.annualIncome)}；結餘合計
                NT$ {money(r.annualRemaining)}，已逐月計入貸款與目標到期變化。
              </p>
            </div>
            <Details>
              <span className="eyebrow">02 / LOOK AHEAD</span>
              <h3>未來家庭可支配金額變化</h3>
              <Select
                form={f}
                name="view"
                label="現金流顯示週期"
                options={[
                  ["monthly", "逐月：每月金額"],
                  ["annual", "逐年：平均每月金額＋年度總額"],
                ]}
              />
              <CashFlowChart
                rows={f.values.view === "annual" ? r.annual : r.monthly}
                annual={f.values.view === "annual"}
              />
              <p className="hint">
                圖表縱軸為
                {f.values.view === "annual"
                  ? "該年涵蓋月份的平均每月金額"
                  : "當月金額"}
                。每日值依當期結餘及實際天數重新計算；年度每日平均＝涵蓋期間總結餘
                ÷
                總天數。貸款結束即停止扣款；目標儲蓄結束、旅行基金用完與自訂收入／生活費變動均逐期更新。不是累積資產。
              </p>
              <Details title="查看各期精確數據">
                {f.values.view === "annual" ? (
                  <Rows
                    headers={[
                      "年度與涵蓋月份",
                      "平均月結餘",
                      "平均貸款月付",
                      "期間總結餘",
                      "平均每日可支配",
                    ]}
                    rows={r.annual.map((x) => [
                      x.period,
                      money(x.remaining),
                      money(x.loan),
                      money(x.annualRemaining),
                      money(x.daily),
                    ])}
                  />
                ) : (
                  <Rows
                    headers={[
                      "年月",
                      "月結餘",
                      "貸款月付總額",
                      "平均每日可支配",
                      "當月天數",
                    ]}
                    rows={r.monthly.map((x) => [
                      x.period,
                      money(x.remaining),
                      money(x.loan),
                      money(x.daily),
                      x.days,
                    ])}
                  />
                )}
              </Details>
            </Details>
            <HouseholdHealth
              form={f}
              current={c}
              entries={r.entries}
              items={r.items}
            />
            <div className="panel">
              <span className="eyebrow">04 / A GOAL WORTH PLANNING</span>
              <h3>{f.values.purchaseName || "大型購買目標"}</h3>
              <Breakdown
                decimals={2}
                items={[
                  ["預計購買總金額", r.input.purchasePrice],
                  ["已準備的購買基金", r.input.purchaseFund],
                  ["每月需要儲蓄", c.goal.required],
                ]}
              />
              <p className="goal-duration">
                {purchaseDuration(c.goal.monthsToGoal)}
              </p>
              <p className="hint">
                {r.input.purchaseMode === "monthly"
                  ? "依指定每月儲蓄推算，到達資金目標後視為可購買。"
                  : "按指定期限反推月存，向上取整至元；持有成本於原定購買期限後計入。"}
                本月大型購物實際預留 NT$ {money(c.purchase)}，旅遊基金另列 NT${" "}
                {money(c.travel)}，不重複扣款。未計利息、通膨與商品價格變動。
              </p>
              {c.purchase > c.purchaseAffordable && (
                <div className="note caution">
                  大型購物月存超過扣除其他支出、目標與 ETF 後的可負擔額 NT${" "}
                  {money(c.purchase - c.purchaseAffordable)}
                  ，請調整期限、目標或其他分配。
                </div>
              )}
            </div>
            <Details title="試算假設與風險">
              <p>
                月薪模式的年度工作收入＝固定月薪 × 12
                ＋年度獎金；年薪模式直接採全年總收入，不再另加獎金。為比較規劃，兩者均以月平均換算，不是實際逐月入帳預測。其他收入及支出以本次輸入為準。
              </p>
              <p>
                旅行基金只抵減第一個旅行週期，後續完整預留；大型購物資金達標後停止月存，持有成本按所選模式的購買時點計入。ETF
                以使用者金額完整扣除一次，超過負擔能力會警示而不自動降低。每期日平均依當月天數計算，赤字保持負值。
              </p>
              <p>
                未納入自動調薪、通膨或年齡／退休情境；自訂變動不代表未來保證。沒有資產累積推算。完整購屋能力與相同總本金教育比較仍留待後續開發。家庭資料只在此瀏覽器暫存，可清除，不會傳送。
              </p>
            </Details>
          </>
        )}
        <BudgetReferences />
        <FinancialSafety form={f} onOpenRetirement={onOpenRetirement} />
        <AICoach summary={fullSummary} />
      </section>
    </div>
  );
}
