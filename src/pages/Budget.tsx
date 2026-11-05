import { money as formatMoney } from "../lib/finance";
import {
  budget,
  forecast,
  annualForecast,
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
} from "../components/HouseholdHealth";
import {
  useForm,
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
export default function Budget() {
  const f = useForm({
    mode: "monthly",
    salary: "",
    annualBonus: "0",
    annualIncome: "",
    otherIncome: "0",
    investmentCash: "0",
    cashTreatment: "exclude",
    living: "15000",
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
    const parts = {
      food: f.n("food"),
      child: f.n("child"),
      insurance: f.n("insurance"),
      transport: f.n("transport"),
      utilities: f.n("utilities"),
      otherLiving: f.n("otherLiving"),
    };
    if (
      details &&
      [
        "food",
        "insurance",
        "utilities",
        "child",
        "transport",
        "otherLiving",
      ].some((k) => !Number.isFinite(f.n(k)) || f.n(k) < 0 || f.n(k) > 1e12)
    )
      throw new Error("生活費明細需為 0～1兆的有效金額");
    const living = details
      ? Object.values(parts).reduce((sum, v) => sum + v, 0)
      : f.n("living");
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
      loans: loanFields.map(([p, m]) => ({ payment: f.n(p), months: f.n(m) })),
      purchasePrice: f.n("purchasePrice"),
      purchaseFund: f.n("purchaseFund"),
      purchaseMonths: f.n("purchaseMonths"),
      purchaseMonthly: f.n("purchaseMonthly"),
      purchaseCost: f.n("purchaseCost"),
      travelPrice: f.n("travelPrice"),
      travelFund: f.n("travelFund"),
      travelMonths: f.n("travelMonths"),
      etfMonthly: f.n("etfMonthly"),
      telecom: f.n("telecom"),
      subscriptions: f.n("subscriptions"),
      saving: f.n("saving"),
      startMonth: f.values.startMonth,
      change:
        f.values.change === "yes"
          ? {
              month: f.n("changeMonth"),
              employmentMonthly: f.n("changeIncome"),
              living: f.n("changeLiving"),
            }
          : undefined,
    };
    const current = budget(input),
      monthly = forecast(input, f.n("forecastYears") * 12),
      annual = annualForecast(monthly),
      year = forecast(input, 12),
      entries = budgetEntries(
        input,
        current,
        details && !(input.change && input.change.month === 1)
          ? parts
          : undefined,
      );
    const items = allocations(entries, current.remaining);
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
  const r = result.data;
  const c = r?.current;
  return (
    <div className="workspace budget-workspace">
      <section className="panel inputs">
        <div className="panel-heading">
          <span className="eyebrow">LIFE IN BALANCE</span>
          <h2>家庭財務與生活目標規劃</h2>
          <p>先看日常餘裕，再安排目標與未來。</p>
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
        <Select
          form={f}
          name="livingMode"
          label="必要生活費輸入方式"
          options={[
            ["total", "快速輸入總額"],
            ["detail", "展開生活費明細"],
          ]}
        />
        {f.values.livingMode === "total" ? (
          <Field
            form={f}
            name="living"
            label="每月生活費總額（不含貸款、電信與訂閱）"
          />
        ) : (
          <div className="field-grid">
            {livingFields
              .filter((x) => x.id !== "telecom" && x.id !== "subscriptions")
              .map(({ id, name }) => (
                <Field key={id} form={f} name={id} label={name} />
              ))}
          </div>
        )}
        <div className="field-grid">
          <Field form={f} name="telecom" label="電信費" />
          <Field form={f} name="subscriptions" label="工具與娛樂訂閱" />
        </div>
        <p className="hint">
          電信與訂閱另外填入，不要再包含在生活費總額或其他生活支出，以免重複計入。總額與明細仍擇一。
        </p>
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
          <Field form={f} name="purchasePrice" label="預計購買總金額" />
          <div className="field-grid">
            <Field
              form={f}
              name="purchaseMonths"
              label="預計幾個月後購買"
              unit="月"
              min={1}
              max={600}
              step={1}
            />
            <Field form={f} name="purchaseFund" label="已準備的購買基金" />
          </div>
          <Field
            form={f}
            name="purchaseMonthly"
            label="目前固定目標儲蓄（比較用）"
          />
          <Field form={f} name="purchaseCost" label="購入後每月額外持有成本" />
          <p className="hint">
            可填汽車、鋼琴、家電或購屋基金。月預算依期限所需儲蓄扣除；固定儲蓄僅比較達標時間，不再重複扣款。購屋目前僅處理資金儲蓄，不估算核貸或購屋能力。
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
                label="變動後每月生活費（不含電信與訂閱）"
              />
            </>
          )}
          <p className="hint">
            其他固定收入及投資現金收入維持原設定。這是可調整的情境，不是薪資或家庭支出的預測。
          </p>
        </Details>
        <Actions
          reset={f.reset}
          summary={
            c
              ? `家庭規劃：${c.period} 月平均收入 ${money(c.income)} 元，月可支配 ${money(c.remaining)} 元，日平均 ${money(c.daily)} 元（本月${c.days}天）。ETF目標 ${money(c.etfTarget)} 元，計畫投入 ${money(c.etf)} 元。僅為情境試算。`
              : ""
          }
        />
      </section>
      <section className="results" aria-label="家庭預算結果">
        <ErrorNotice message={result.error} />
        {!r && (
          <div className="panel empty">
            <span>01 / 從收入開始</span>
            <h2>先填入你的收入</h2>
            <p>選擇月薪或年薪模式。資料只在瀏覽器試算，不保存也不上傳。</p>
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
                    "每月生活支出（含電信、訂閱與購入後成本）",
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
              input={r.input}
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
              <p className="hint">
                希望 {r.input.purchaseMonths} 個月後購買；目前固定儲蓄 NT${" "}
                {money(r.input.purchaseMonthly)}／月，
                {c.goal.monthsToGoal === null
                  ? "尚無法推算達標時間，請設定大於 0 的每月儲蓄。"
                  : c.goal.monthsToGoal === 0
                    ? "現有基金已足夠。"
                    : `不計利息約 ${c.goal.monthsToGoal} 個月達標。`}
                可在左側／上方「大型購買與旅行目標」修改。
              </p>
            </div>
            <Details title="試算假設與風險">
              <p>
                月薪模式的年度工作收入＝固定月薪 × 12
                ＋年度獎金；年薪模式直接採全年總收入，不再另加獎金。為比較規劃，兩者均以月平均換算，不是實際逐月入帳預測。其他收入及支出以本次輸入為準。
              </p>
              <p>
                旅行基金只抵減第一個旅行週期，後續完整預留；大型購買儲蓄於期限後停止，改計選填持有成本。ETF
                以使用者金額完整扣除一次，超過負擔能力會警示而不自動降低。每期日平均依當月天數計算，赤字保持負值。
              </p>
              <p>
                未納入自動調薪、通膨或年齡／退休情境；自訂變動不代表未來保證。沒有資產累積推算。完整購屋能力與相同總本金教育比較仍留待後續開發。資料不儲存、不傳送。
              </p>
            </Details>
          </>
        )}
        <BudgetReferences />
      </section>
    </div>
  );
}
