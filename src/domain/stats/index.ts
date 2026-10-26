export * from "./focusHistory";
export * from "./weeklyReport";

// Rolling-window trend rules: a 30-day daily series plus period-over-period
// deltas. Pure functions — no IO, no i18n. Labels are injected by presentation.

import { todayKey } from "../../shared/date";
import { emptyDay, type DayRecord, type History } from "./focusHistory";

/**
 * The last `days` calendar days, oldest → today, zero-filled where history has
 * no record. Generalized from `last7Days` so the trend chart can widen its
 * window without duplicating the fill logic.
 */
export function lastNDays(history: History, days: number, now = new Date()): DayRecord[] {
  const out: DayRecord[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = todayKey(d);
    out.push(history[key] || emptyDay(key, d.getDay()));
  }
  return out;
}

/**
 * A simple moving average over a daily series, aligned 1:1 with the input.
 * The first `period - 1` entries are `null` — there isn't enough history yet —
 * so callers must handle a partial window rather than reading a bogus average.
 */
export function movingAverage(values: number[], period: number): (number | null)[] {
  if (period <= 0) throw new Error("movingAverage period must be > 0");
  return values.map((_, i) => {
    if (i < period - 1) return null;
    const slice = values.slice(i - period + 1, i + 1);
    return slice.reduce((s, v) => s + v, 0) / period;
  });
}

export type TrendDirection = "up" | "down" | "flat";

export interface TrendDelta {
  /** latest value in the window */
  current: number;
  /** mean of the `baselineSize` values preceding the latest `windowSize` */
  baseline: number;
  /** current - baseline, signed */
  delta: number;
  /** delta as a fraction of baseline; null when the baseline is 0 */
  ratio: number | null;
  direction: TrendDirection;
}

/**
 * Compares the most recent `windowSize` values against the `baselineSize` values
 * immediately before them. Both must fit inside `values`, otherwise the baseline
 * is empty and the result is reported as "flat" rather than throwing — a partial
 * history is a normal state for a fresh install.
 */
export function compareWindows(
  values: number[],
  windowSize: number,
  baselineSize: number
): TrendDelta {
  const split = values.length - windowSize;
  const recent = values.slice(split);
  const baselineWindow = values.slice(Math.max(0, split - baselineSize), Math.max(0, split));

  const current = recent.reduce((s, v) => s + v, 0);
  const baseline = baselineWindow.reduce((s, v) => s + v, 0);
  const currentAvg = recent.length ? current / recent.length : 0;
  const baselineAvg = baselineWindow.length ? baseline / baselineWindow.length : 0;
  const delta = currentAvg - baselineAvg;
  const ratio = baselineAvg === 0 ? null : delta / baselineAvg;
  const direction: TrendDirection = delta > 0 ? "up" : delta < 0 ? "down" : "flat";

  return { current, baseline, delta, ratio, direction };
}

/**
 * Calendar-month totals for the month containing `now`, plus the previous month
 * for comparison. Note this is a *calendar* month (1st → last day), unlike the
 * rolling windows above — a partial current month is expected and is reported
 * as-is rather than extrapolated.
 */
export interface MonthSummary {
  /** `YYYY-M` of the reported month. */
  month: string;
  pomodoros: number;
  minutes: number;
  activeDays: number;
  /** previous calendar month's totals, for the delta row. */
  prevPomodoros: number;
  prevMinutes: number;
}

export function summarizeMonth(history: History, now = new Date()): MonthSummary {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based

  let pomodoros = 0;
  let minutes = 0;
  let activeDays = 0;
  let prevPomodoros = 0;
  let prevMinutes = 0;

  for (const record of Object.values(history)) {
    const parts = record.date.split("-").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) continue;
    const [y, m] = parts;
    if (y === year && m === month + 1) {
      pomodoros += record.pomodoros;
      minutes += record.minutes;
      if (record.pomodoros > 0) activeDays += 1;
    } else if (y === year && m === month) {
      prevPomodoros += record.pomodoros;
      prevMinutes += record.minutes;
    } else if (m === 12 && month === 0 && y === year - 1) {
      // December of the previous year precedes January.
      prevPomodoros += record.pomodoros;
      prevMinutes += record.minutes;
    }
  }

  return {
    month: `${year}-${month + 1}`,
    pomodoros,
    minutes,
    activeDays,
    prevPomodoros,
    prevMinutes,
  };
}
