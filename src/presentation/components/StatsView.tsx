import { useMemo } from "react";
import { weekdayLabel, type Lang } from "../i18n";
import {
  calculateStreak,
  calculateTotalStats,
  summarizeWeek,
  type DayRecord,
  type History,
} from "../../domain/stats";
import type { ChartMetric } from "../uiTypes";

interface Props {
  tr: (key: string, params?: Record<string, string | number>) => string;
  lang: Lang;
  week: DayRecord[];
  history: History;
  dailyGoal?: number;
  chartMetric: ChartMetric;
  accent: string;
  onChartMetricChange: (m: ChartMetric) => void;
  onExportCsv: () => void;
}

export function StatsView({
  tr,
  lang,
  week,
  history,
  dailyGoal,
  chartMetric,
  accent,
  onChartMetricChange,
  onExportCsv,
}: Props) {

  const weekPomos = useMemo(() => week.reduce((s, d) => s + d.pomodoros, 0), [week]);
  const weekMinutes = useMemo(() => week.reduce((s, d) => s + d.minutes, 0), [week]);
  const streak = useMemo(() => calculateStreak(history), [history]);
  const totalStats = useMemo(() => calculateTotalStats(history), [history]);
  const weekSummary = useMemo(() => summarizeWeek(week), [week]);

  const maxVal = useMemo(
    () => Math.max(1, ...week.map((d) => (chartMetric === "pomodoros" ? d.pomodoros : d.minutes))),
    [week, chartMetric]
  );

  const chartW = 300;
  const chartH = 150;
  const barGap = 12;
  const barW = (chartW - barGap * (week.length + 1)) / week.length;
  const todayRecord = week[week.length - 1];

  const totalHours = (totalStats.totalMinutes / 60).toFixed(1);

  return (
    <div className="stats-view">
      <div className="stats-summary">
        <div
          className="summary-card"
          title={
            dailyGoal && dailyGoal > 0
              ? tr("stat.goalProgress", {
                  goal: dailyGoal,
                  percent: Math.min(100, Math.round((todayRecord.pomodoros / dailyGoal) * 100)),
                })
              : undefined
          }
        >
          <div className="summary-num">
            {todayRecord.pomodoros}
            {dailyGoal && dailyGoal > 0 && <span className="stat-sub">/{dailyGoal}</span>}
          </div>
          <div className="summary-label">{tr("stats.card.today")}</div>
        </div>
        <div className="summary-card" title={tr("stats.card.bestStreak", { days: streak.bestStreak })}>

          <div className="summary-num" style={{ color: streak.currentStreak > 0 ? "var(--accent)" : undefined }}>
            {streak.currentStreak}
          </div>
          <div className="summary-label">{tr("stats.card.streak")}</div>
        </div>
        <div className="summary-card">
          <div className="summary-num">{weekPomos}</div>
          <div className="summary-label">{tr("stats.card.weekPomos")}</div>
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

      <div className="stats-report">
        <div className="report-summary">
          <span className="report-label">{tr("stats.report.title")}</span>
          <span className="report-item">{tr("stats.report.active", { n: weekSummary.activeDays })}</span>
          <span className="report-item">
            {weekSummary.bestDay
              ? tr("stats.report.best", { date: weekSummary.bestDay, n: weekSummary.bestPomodoros })
              : "—"}
          </span>
        </div>
        <button className="report-export" onClick={onExportCsv}>
          {tr("stats.report.export")}
        </button>
      </div>

      <div className="stats-foot">
        <div>
          {weekPomos === 0
            ? tr("stats.footer.empty")
            : tr("stats.footer.avg", {
                avg: (weekPomos / 7).toFixed(1),
                mins: Math.round(weekMinutes / 7),
              })}
        </div>
        {totalStats.totalPomodoros > 0 && (
          <div style={{ marginTop: 4, opacity: 0.85, fontSize: "11px" }}>
            {tr("stats.card.totalPomos")}: {totalStats.totalPomodoros} · {tr("stats.card.totalFocus")}: {totalHours}h
          </div>
        )}
      </div>
    </div>
  );
}

