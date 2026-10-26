import {
  compareWindows,
  lastNDays,
  movingAverage,
  summarizeMonth,
  type History,
} from "../../domain/stats";
import type { ChartMetric } from "../uiTypes";
import "./TrendPanel.css";

const TREND_DAYS = 30;
const RECENT = 7;
const PRIOR = 7;
const AVG_PERIOD = 7;

const W = 300;
const H = 54;
const PAD = 6;

interface TrendProps {
  tr: (key: string, params?: Record<string, string | number>) => string;
  history: History;
  metric: ChartMetric;
  accent: string;
}

/**
 * Compact 30-day trend sparkline: one bar per day plus an overlaid 7-day moving
 * average. All arithmetic lives in `domain/stats`; this file only maps it to SVG.
 */
export function TrendChart({ tr, history, metric, accent }: TrendProps) {
  const series = lastNDays(history, TREND_DAYS);
  const values = series.map((d) => (metric === "pomodoros" ? d.pomodoros : d.minutes));
  const max = Math.max(1, ...values);
  const avg = movingAverage(values, AVG_PERIOD);

  // The average gets its own scale — sharing the daily max would pin the line to
  // the floor whenever the daily values are spiky.
  const avgPoints = avg.filter((v): v is number => v !== null);
  const avgMax = Math.max(1, ...avgPoints);
  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2;
  const colW = innerW / TREND_DAYS;

  const delta = compareWindows(values, RECENT, PRIOR);
  const arrow = delta.direction === "up" ? "▲" : delta.direction === "down" ? "▼" : "—";
  const dirKey =
    delta.direction === "up"
      ? "stats.trend.up"
      : delta.direction === "down"
        ? "stats.trend.down"
        : "stats.trend.flat";

  const linePath = avgPoints
    .map((v, i) => {
      // avg[i] describes the window ending at day i + AVG_PERIOD - 1.
      const x = PAD + (i + AVG_PERIOD - 1 + 0.5) * colW;
      const y = PAD + innerH - (v / avgMax) * innerH;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="trend">
      <div className="chart-head">
        <span className="chart-title">{tr("stats.trend.title")}</span>
        <span className="trend-delta">
          <span className={`trend-arrow ${delta.direction}`}>{arrow}</span>
          {tr(dirKey)}
          <span className="trend-delta-sub">
            {tr("stats.trend.window")} vs {tr("stats.trend.baseline")}
          </span>
        </span>
      </div>

      <svg className="trend-svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        {values.map((v, i) => {
          const h = (v / max) * innerH;
          const isRecent = i >= TREND_DAYS - RECENT;
          return (
            <rect
              key={series[i].date}
              x={PAD + i * colW}
              y={PAD + innerH - h}
              width={Math.max(1, colW - 1)}
              height={Math.max(h, v > 0 ? 1 : 0)}
              className={isRecent ? "trend-bar recent" : "trend-bar"}
              fill={isRecent ? accent : "var(--chart-bar)"}
            />
          );
        })}
        {avgPoints.length > 1 && <path d={linePath} className="trend-line" fill="none" />}
      </svg>
    </div>
  );
}

interface MonthProps {
  tr: (key: string, params?: Record<string, string | number>) => string;
  history: History;
}

/** Calendar-month totals with a month-over-month delta row. */
export function MonthSummaryCard({ tr, history }: MonthProps) {
  const month = summarizeMonth(history);
  const delta = month.pomodoros - month.prevPomodoros;
  const hours = (month.minutes / 60).toFixed(1);

  const cell = (label: string, value: string) => (
    <div className="month-cell">
      <div className="month-val">{value}</div>
      <div className="month-label">{label}</div>
    </div>
  );

  return (
    <div className="month-summary">
      <div className="chart-head">
        <span className="chart-title">{tr("stats.month.title")}</span>
        <span className="month-key">{month.month}</span>
      </div>
      <div className="month-grid">
        {cell(tr("stats.month.pomos"), String(month.pomodoros))}
        {cell(tr("stats.month.minutes"), `${hours}h`)}
        {cell(tr("stats.month.active"), String(month.activeDays))}
      </div>
      <div className="month-delta">
        {tr("stats.month.vsPrev")}:{" "}
        <span className={delta > 0 ? "up" : delta < 0 ? "down" : "flat"}>
          {delta > 0 ? "+" : ""}
          {delta}
        </span>{" "}
        🍅 · {month.prevPomodoros} → {month.pomodoros}
      </div>
    </div>
  );
}
