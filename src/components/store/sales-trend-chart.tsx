import { useId } from "react";

const CHART_LEFT = 50;
const CHART_RIGHT = 650;
const CHART_TOP = 52;
const CHART_BOTTOM = 286;

export function salesTrendX(index: number, itemCount: number) {
  if (itemCount <= 1) return (CHART_LEFT + CHART_RIGHT) / 2;
  return CHART_LEFT + (index * (CHART_RIGHT - CHART_LEFT)) / (itemCount - 1);
}

export function SalesTrendChart({
  days,
  formatValue,
}: {
  days: Array<{ date: string; sales: number }>;
  formatValue: (value: number) => string;
}) {
  const gradientId = `sales-area-${useId().replaceAll(":", "")}`;
  const glowId = `sales-line-glow-${useId().replaceAll(":", "")}`;
  const max = Math.max(1, ...days.map((day) => Math.max(0, day.sales)));
  const x = (index: number) => salesTrendX(index, days.length);
  const y = (value: number) =>
    CHART_BOTTOM - (Math.max(0, value) / max) * (CHART_BOTTOM - CHART_TOP);
  const points = days.map((day, index) => `${x(index)},${y(day.sales)}`).join(" ");
  const areaPoints = `${x(0)},${CHART_BOTTOM} ${points} ${x(days.length - 1)},${CHART_BOTTOM}`;

  return (
    <svg
      className="store-trend"
      viewBox="0 0 700 350"
      role="img"
      aria-labelledby={`${gradientId}-title ${gradientId}-description`}
    >
      <title id={`${gradientId}-title`}>登録店舗の直近営業日別売上</title>
      <desc id={`${gradientId}-description`}>
        正確な日付と金額は各点および下の表で確認できます。
      </desc>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--chart-line)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--chart-line)" stopOpacity="0.015" />
        </linearGradient>
        <filter id={glowId} x="-10%" y="-20%" width="120%" height="140%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradientId})`} className="chart-area-shape" />
      {days.map((day, index) => (
        <line
          key={`${day.date}-grid`}
          x1={x(index)}
          x2={x(index)}
          y1={CHART_TOP}
          y2={CHART_BOTTOM}
          className="chart-gridline chart-date-gridline"
        />
      ))}
      <polyline
        points={points}
        pathLength="1"
        className="chart-line chart-line-glow"
        filter={`url(#${glowId})`}
      />
      <polyline points={points} pathLength="1" className="chart-line" />
      {days.map((day, index) => {
        const latest = index === days.length - 1;
        return (
          <g
            key={day.date}
            className="chart-data-point"
            tabIndex={0}
            aria-label={`${day.date} ${formatValue(day.sales)}`}
            style={{ animationDelay: `${180 + index * 85}ms` }}
          >
            {latest ? (
              <circle cx={x(index)} cy={y(day.sales)} r="10" className="chart-latest-ring" />
            ) : null}
            <circle
              cx={x(index)}
              cy={y(day.sales)}
              r={latest ? 5 : 4}
              className={`chart-point${latest ? " current" : ""}`}
            />
            <text x={x(index)} y="325" textAnchor="middle">
              {day.date.slice(5)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
