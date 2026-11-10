import { money } from "../lib/finance";
import type { budgetReferenceCards } from "../lib/health";
const percent = (value: number) =>
  `${new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 }).format(value)}%`;
/** Present one resolved model; do not recalculate thresholds or overwrite its tone in JSX. */
export function BudgetReferenceCards({
  cards,
}: {
  cards: ReturnType<typeof budgetReferenceCards>;
}) {
  return (
    <div className="health-groups">
      {cards.map((card) => (
        <div
          key={card.id}
          className={`health-group tone-${card.tone}`}
          data-group={card.id}
          data-tone={card.tone}
        >
          <span>
            {card.id === "wants" ? "品質生活（非必要消費）" : card.name}
          </span>
          <strong
            title={
              card.ratio === null
                ? "收入尚未確認"
                : `原始比例 ${card.ratio}%（以原值判斷警示）`
            }
          >
            {card.ratio === null ? "收入待確認" : percent(card.ratio)}
          </strong>
          <small>參考目標 {card.reference}%</small>
          <p>本月指定 NT$ {money(card.value, 2)}</p>
          <p>
            每月參考金額：
            {card.referenceAmount === null
              ? "收入待確認"
              : `NT$ ${money(card.referenceAmount, 2)}`}
          </p>
          <p>{card.message}</p>
        </div>
      ))}
    </div>
  );
}
