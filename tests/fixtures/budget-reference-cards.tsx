// Browser component fixture only: this is not an entry point of the production build.
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { BudgetReferenceCards } from "../../src/components/BudgetReferenceCards";
import {
  budgetReferenceCards,
  healthCheck,
  type BudgetEntry,
} from "../../src/lib/health";
import {
  budgetModeOptions,
  selectedBudgetMode,
} from "../../src/lib/budgetModes";
import { parseNumericInput } from "../../src/lib/numberInput";
import "../../src/styles.css";
function Fixture() {
  const [v, setV] = useState({
    budgetMode: "auto",
    mode: "monthly",
    salary: "100000",
    annualBonus: "0",
    annualIncome: "0",
    otherIncome: "0",
    cashTreatment: "exclude",
    investmentCash: "0",
  });
  const [amounts, setAmounts] = useState({
    needs: "68310",
    wants: "25850",
    savings: "5540",
  });
  const rawIncome = parseNumericInput(v.salary);
  const income = Number.isFinite(rawIncome) && rawIncome >= 0 ? rawIncome : 0;
  const mode = selectedBudgetMode(v, income);
  const entries: BudgetEntry[] = (["needs", "wants", "savings"] as const).map(
    (group) => ({
      id: group,
      name: group,
      value: parseNumericInput(amounts[group]),
      group,
      color: "",
    }),
  );
  const h = healthCheck(entries, income, {}, undefined, mode.mode);
  return (
    <main className="panel">
      <h1>參考預算卡片元件測試</h1>
      <label className="field">
        <span>測試月收入</span>
        <input
          aria-label="測試月收入"
          value={v.salary}
          onChange={(e) => setV({ ...v, salary: e.target.value })}
        />
      </label>
      <label className="field">
        <span>測試模式</span>
        <select
          aria-label="測試模式"
          value={v.budgetMode}
          onChange={(e) => setV({ ...v, budgetMode: e.target.value })}
        >
          {budgetModeOptions.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {(["needs", "wants", "savings"] as const).map((id) => (
        <label className="field" key={id}>
          <span>測試{id}金額</span>
          <input
            aria-label={`測試${id}金額`}
            value={amounts[id]}
            onChange={(e) => setAmounts({ ...amounts, [id]: e.target.value })}
          />
        </label>
      ))}
      <p role="status" data-mode={mode.mode}>
        {mode.preset.name}；{mode.note}
      </p>
      <BudgetReferenceCards
        cards={budgetReferenceCards(h.groups, mode.monthlyIncome !== undefined)}
      />
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Fixture />
  </StrictMode>,
);
