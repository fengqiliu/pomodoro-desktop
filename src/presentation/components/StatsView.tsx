import { useMemo } from "react";
import { weekdayLabel, type Lang } from "../i18n";
import type { DayRecord } from "../../domain/stats";
import type { ChartMetric } from "../uiTypes";

interface Props {
  tr: (key: string, params?: Record<string, string | number>) => string;
  lang: Lang;
  week: DayRecord[];
  chartMetric: ChartMetric;
  accent: string;
  onChartMetricChange: (m: ChartMetric) => void;
}

export function StatsView({ tr, lang, week, chartMetric, accent, onChartMetricChange }: Props) {
  const weekPomos = useMemo(() => week.reduce((s, d) => s + d.pomodoros, 0), [week]);
  const weekMinutes = useMemo(() => week.reduce((s, d) => s + d.minutes, 0), [week]);
  const maxVal = useMemo(
    () => Math.max(1, ...week.map((d) => (chartMetric === "pomodoros" ? d.pomodoros : d.minutes))),
    [week, chartMetric]
  );

  const chartW = 300;
  const chartH = 150;
  const barGap = 12;
  const barW = (chartW - barGap * (week.length + 1)) / week.length;
  const todayRecord = week[week.length - 1];

  return (
    <div className="stats-view">
      <div className="stats-summary">
        <div className="summary-card">
          <div className="summary-num">{todayRecord.pomodoros}</div>
          <div className="summary-label">{tr("stats.card.today")}</div>
        </div>
        <div className="summary-card">
          <div className="summary-num">{weekPomos}</div>
          <div className="summary-label">{tr("stats.card.weekPomos")}</div>
        </div>
        <div className="summary-card">
          <div className="summary-num">{weekMinutes}</div>
          <div className="summary-label">{tr("stats.card.weekMins")}</div>
        </div>
      </div>

      <div className="chart-head">
        <span className="chart-title">{tr("stats.chart.title")}</span>
        <div className="chart-toggle">
          <button
            className={chartMetric === "pomodoros" ? "seg active" : "seg"}
            onClick={() => onChartMetricChange("pomodoros")}
          >
            {tr("stats.chart.pomos")}
          </button>
          <button
            className={chartMetric === "minutes" ? "seg active" : "seg"}
            onClick={() => onChartMetricChange("minutes")}
          >
            {tr("stats.chart.minutes")}
          </button>
        </div>
      </div>

      <svg className="chart" width={chartW} height={chartH} viewBox={`0 0 ${chartW} ${chartH}`}>
        {week.map((d, i) => {
          const val = chartMetric === "pomodoros" ? d.pomodoros : d.minutes;
          const h = (val / maxVal) * (chartH - 36);
          const x = barGap + i * (barW + barGap);
          const y = chartH - 22 - h;
          const isToday = i === week.length - 1;
          return (
            <g key={d.date}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(h, val > 0 ? 4 : 0)}
                rx={4}
                className={isToday ? "chart-bar today" : "chart-bar"}
                fill={isToday ? accent : "var(--chart-bar)"}
              />
              <text x={x + barW / 2} y={chartH - 7} textAnchor="middle" className="chart-axis">
                {weekdayLabel(lang, d.dayIndex)}
              </text>
              {val > 0 && (
                <text x={x + barW / 2} y={y - 5} textAnchor="middle" className="chart-val">
                  {val}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="stats-foot">
        {weekPomos === 0
          ? tr("stats.footer.empty")
          : tr("stats.footer.avg", {
              avg: (weekPomos / 7).toFixed(1),
              mins: Math.round(weekMinutes / 7),
            })}
      </div>
    </div>
  );
}
