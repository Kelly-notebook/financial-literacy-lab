import { budget, money, type BudgetInput } from "../lib/finance";
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
  Chart,
} from "../components/ui";
export default function Budget() {
  const f = useForm({
    mode: "monthly",
    salary: "",
    otherIncome: "0",
    annualIncome: "1800000",
    bonusShare: "0",
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
    credit: "0",
    creditMonths: "24",
    otherLoan: "0",
    otherMonths: "12",
    carPrice: "300000",
    carFund: "0",
    carMonths: "60",
    carCost: "3000",
    travelPrice: "60000",
    travelFund: "0",
    travelMonths: "12",
    investing: "5000",
    saving: "0",
  });
  const result = safely(() => {
    const living =
      f.values.livingMode === "total"
        ? f.n("living")
        : [
            "food",
            "child",
            "insurance",
            "transport",
            "utilities",
            "otherLiving",
          ].reduce((s, k) => s + f.n(k), 0);
    const input: BudgetInput = {
      mode: f.values.mode as "monthly" | "annual",
      salary: f.n("salary"),
      otherIncome: f.n("otherIncome"),
      annualIncome: f.values.mode === "annual" ? f.n("annualIncome") : 0,
      bonusShare: f.values.mode === "annual" ? f.n("bonusShare") / 100 : 0,
      living,
      loans: [
        { payment: f.n("mortgage"), months: f.n("mortgageMonths") },
        { payment: f.n("credit"), months: f.n("creditMonths") },
        { payment: f.n("otherLoan"), months: f.n("otherMonths") },
      ],
      carPrice: f.n("carPrice"),
      carFund: f.n("carFund"),
      carMonths: f.n("carMonths"),
      carCost: f.n("carCost"),
      travelPrice: f.n("travelPrice"),
      travelFund: f.n("travelFund"),
      travelMonths: f.n("travelMonths"),
      investing: f.n("investing"),
      saving: f.n("saving"),
    };
    const current = budget(input),
      endMonth =
        Math.max(
          0,
          ...input.loans.filter((l) => l.payment > 0).map((l) => l.months),
        ) + 1,
      after = budget(input, endMonth);
    return {
      input,
      current,
      after,
      endMonth,
      chart: Array.from(
        { length: Math.min(41, Math.ceil(endMonth / 12) + 1) },
        (_, year) => ({
          year,
          remaining: budget(input, year * 12 + 1).remaining,
          loan: budget(input, year * 12 + 1).loan,
        }),
      ),
    };
  });
  const r = result.data;
  return (
    <div className="workspace">
      <section className="panel inputs">
        <div className="panel-heading">
          <span className="eyebrow">LIFE IN BALANCE</span>
          <h2>把生活，放進計畫裡</h2>
          <p>從固定現金流出發，為想要的生活留一筆。</p>
        </div>
        <Select
          form={f}
          name="mode"
          label="收入模式"
          options={[
            ["monthly", "月薪模式"],
            ["annual", "年薪模式（分列獎金）"],
          ]}
        />
        <Field form={f} name="salary" label="每月固定實領薪資" />
        <Field form={f} name="otherIncome" label="其他每月固定收入" />
        {f.values.mode === "annual" && (
          <>
            <Field form={f} name="annualIncome" label="年度預估實領總收入" />
            <Field
              form={f}
              name="bonusShare"
              label="獎金可用於年度目標比例"
              unit="%"
              max={100}
            />
          </>
        )}
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
          <Field form={f} name="living" label="每月必要生活費（不含貸款）" />
        ) : (
          <div className="field-grid">
            {[
              ["food", "伙食"],
              ["child", "育兒"],
              ["insurance", "保險"],
              ["transport", "交通"],
              ["utilities", "水電"],
              ["otherLiving", "其他生活費"],
            ].map(([k, l]) => (
              <Field key={k} form={f} name={k} label={l} />
            ))}
          </div>
        )}
        <Details title="房貸與其他貸款">
          {[
            ["mortgage", "mortgageMonths", "房貸"],
            ["credit", "creditMonths", "信貸／軍貸"],
            ["otherLoan", "otherMonths", "其他貸款"],
          ].map(([k, m, l]) => (
            <div className="field-grid" key={k}>
              <Field form={f} name={k} label={`${l}月付額`} />
              <Field
                form={f}
                name={m}
                label="剩餘期數"
                unit="月"
                max={600}
                step={1}
              />
            </div>
          ))}
        </Details>
        <Details title="購車、旅行與儲蓄目標">
          <h3>購車計畫</h3>
          <Field form={f} name="carPrice" label="購車目標價格" />
          <div className="field-grid">
            <Field
              form={f}
              name="carMonths"
              label="幾個月後購車"
              unit="月"
              min={1}
              max={600}
              step={1}
            />
            <Field form={f} name="carFund" label="現有購車基金" />
          </div>
          <Field form={f} name="carCost" label="購車後每月持有成本" />
          <p className="hint">
            請考慮稅金、保險、燃料、停車與維修；購車後以持有成本取代購車儲蓄。
          </p>
          <h3>旅行計畫</h3>
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
          <Field form={f} name="investing" label="每月 ETF 投資預算" />
          <Field form={f} name="saving" label="其他每月儲蓄目標" />
        </Details>
        <Actions
          reset={f.reset}
          summary={
            r
              ? `家庭預算：月可分配餘額 ${money(r.current.available)} 元；目標分配後餘額 ${money(r.current.remaining)} 元；每日平均可分配 ${money(r.current.daily)} 元；每月缺口 ${money(r.current.deficit)} 元。非帳戶餘額。`
              : ""
          }
        />
      </section>
      <section className="results" aria-label="家庭預算結果">
        <ErrorNotice message={result.error} />
        {!r && (
          <div className="panel empty">
            <span>01 / 從收入開始</span>
            <h2>先填入你的每月實領薪資</h2>
            <p>資料只在此頁試算，預設不保存。生活目標都可以展開修改。</p>
          </div>
        )}
        {r && (
          <>
            <div
              className={`hero-result ${r.current.deficit ? "warning-result" : ""}`}
            >
              <span className="result-badge">讓每一筆分配更清楚</span>
              <Stat
                label={r.current.deficit ? "每月預算缺口" : "每天可自由分配"}
                value={r.current.deficit || r.current.daily}
              />
              <p>
                {r.current.deficit
                  ? "目前目標超過固定現金流，建議延長期限或調整預算。"
                  : "全年平均＝每月剩餘 × 12 ÷ 365，並非今天的帳戶餘額。"}
              </p>
              <div className="hero-stats">
                <Stat
                  small
                  label="每月可分配餘額（目標前）"
                  value={r.current.available}
                />
                <Stat
                  small
                  label="每月目標分配後餘額"
                  value={r.current.remaining}
                />
              </div>
            </div>
            <div className="panel">
              <h3>每月預算的去向</h3>
              <Breakdown
                items={[
                  [
                    "固定收入（不含獎金）",
                    r.input.salary + r.input.otherIncome,
                  ],
                  ["貸款支出", r.current.loan],
                  ["必要生活費", r.input.living],
                  ["購車預留", r.current.car],
                  ["旅行預留", r.current.travel],
                  ["ETF 投資預算", r.input.investing],
                  ["其他儲蓄", r.input.saving],
                ]}
              />
              {f.values.mode === "annual" && (
                <div className="note">
                  <h3>獎金與全年預算分開看</h3>
                  <Breakdown
                    items={[
                      ["年度非固定收入", r.current.bonus],
                      ["指定可分配獎金", r.current.bonus * r.input.bonusShare],
                      [
                        "全年預算餘額估算（含指定獎金）",
                        r.current.annualRemaining,
                      ],
                    ]}
                  />
                  <p>
                    全年餘額以目前月度配置 × 12
                    加指定獎金估算，未逐月反映到期變動；獎金不保證到帳，也不算每月可花現金。
                  </p>
                </div>
              )}
            </div>
            <Details>
              <h3>貸款結束後，空間如何改變？</h3>
              <Rows
                headers={["時間", "貸款月付", "目標分配後月結餘"]}
                rows={[
                  ["目前", money(r.current.loan), money(r.current.remaining)],
                  [
                    `第 ${r.endMonth} 個月起`,
                    money(r.after.loan),
                    money(r.after.remaining),
                  ],
                ]}
              />
              <Chart
                data={r.chart}
                lines={[
                  ["remaining", "月結餘", "#20745f"],
                  ["loan", "貸款月付", "#cb9244"],
                ]}
              />
              <p className="hint">
                依目前固定薪資與生活費、貸款剩餘期數試算；購車後改扣持有成本。此圖是各時點的月現金流，不是累積資產；薪資成長、生活費通膨與跨年齡預測於第二階段加入。
              </p>
              <h3>緊急預備金參考</h3>
              <p>
                目前每月必要生活費與貸款的 6～12 個月：約{" "}
                <strong>
                  NT$ {money(r.current.emergencyMin)}～
                  {money(r.current.emergencyMax)}
                </strong>
                。
              </p>
            </Details>
            <Details title="試算假設與風險">
              <p>
                收入為實領金額。總額與明細擇一計入，獎金與固定收入分開。旅遊基金只用於這次目標的差額試算；用完後下一輪需重新設定。未預設獎金必然到帳，亦不保證投資收益。
              </p>
              <p>
                此處不推算累積資產，也未納入調薪與生活費通膨。資料不儲存、不傳送至外部服務。
              </p>
            </Details>
          </>
        )}
      </section>
    </div>
  );
}
