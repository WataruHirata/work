import { useId } from "react";

type SalesCompositionItem = {
  name: string;
  sales: number;
};

const chartColors = ["#27856b", "#287fb0", "#d58b32", "#7b61a8", "#c45b54", "#4d8b95"];
const otherColor = "#cbd8d3";

function colorForLabel(label: string) {
  const hash = [...label].reduce((value, character) => value + character.codePointAt(0)!, 0);
  return chartColors[hash % chartColors.length];
}

export function SalesCompositionChart({
  items,
  total,
  formatValue,
}: {
  items: SalesCompositionItem[];
  total: number;
  formatValue: (value: number) => string;
}) {
  const maskId = `sales-donut-mask-${useId().replaceAll(":", "")}`;
  const glowId = `sales-donut-glow-${useId().replaceAll(":", "")}`;
  const rankedItems = items.toSorted((left, right) => right.sales - left.sales);
  const visibleItems = rankedItems.slice(0, 3);
  const otherSales = rankedItems.slice(3).reduce((sum, item) => sum + item.sales, 0);
  const chartItems =
    otherSales > 0 ? [...visibleItems, { name: "その他", sales: otherSales }] : visibleItems;
  const segments = chartItems.map((item, index) => {
    const ratio = (item.sales / total) * 100;
    const gap = Math.min(0.9, ratio * 0.12);
    const accumulated = chartItems
      .slice(0, index)
      .reduce((sum, previous) => sum + (previous.sales / total) * 100, 0);
    return {
      ...item,
      color: item.name === "その他" ? otherColor : colorForLabel(item.name),
      dashLength: Math.max(0.2, ratio - gap),
      dashOffset: -(accumulated + gap / 2),
      ratio,
    };
  });
  const accessibleLabel = segments
    .map((item) => `${item.name} ${formatValue(item.sales)} ${Math.round(item.ratio)}パーセント`)
    .join("、");

  return (
    <div className="department-donut-layout">
      <div className="department-donut" role="img" aria-label={accessibleLabel}>
        <svg className="sales-composition-chart" viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="1.3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <mask id={maskId}>
              <circle
                className="sales-donut-reveal"
                cx="50"
                cy="50"
                r="39"
                pathLength="1"
                fill="none"
                stroke="white"
                strokeWidth="14"
                transform="rotate(-90 50 50)"
              />
            </mask>
          </defs>
          <circle className="sales-donut-track" cx="50" cy="50" r="39" fill="none" />
          <g mask={`url(#${maskId})`} filter={`url(#${glowId})`}>
            {segments.map((item) => (
              <circle
                className="sales-donut-segment"
                key={item.name}
                cx="50"
                cy="50"
                r="39"
                pathLength="100"
                fill="none"
                stroke={item.color}
                strokeDasharray={`${item.dashLength} ${100 - item.dashLength}`}
                strokeDashoffset={item.dashOffset}
                transform="rotate(-90 50 50)"
              />
            ))}
          </g>
        </svg>
        <span aria-hidden="true">
          <small>売上合計</small>
          <strong>{formatValue(total)}</strong>
        </span>
      </div>
      <ul className="department-donut-legend">
        {segments
          .filter((item) => item.name !== "その他")
          .map((item) => (
            <li key={item.name}>
              <i style={{ background: item.color }} />
              <span>{item.name}</span>
              <span className="department-donut-legend-value">
                <strong>{formatValue(item.sales)}</strong>
                <small>{Math.round(item.ratio)}%</small>
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}
