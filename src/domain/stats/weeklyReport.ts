import type { DayRecord } from "./focusHistory";

/**
 * Aggregate of one focus window (normally `last7Days(history)`, ordered
 * oldest → today). Pure rules — no IO, no i18n; labels are injected by the
 * presentation layer when needed.
 */
export interface WeekSummary {
  totalPomodoros: number;
  totalMinutes: number;
  /** Days with at least one completed pomodoro. */
  activeDays: number;
  /** totalPomodoros / window length (kept as float for display formatting). */
  avgPomodoros: number;
  /** totalMinutes / window length, rounded to the nearest integer. */
  avgMinutes: number;
  /** Date key (`YYYY-M-D`) of the day with the most pomodoros; null when the window is all empty. */
  bestDay: string | null;
  bestPomodoros: number;
}

/** Summarizes a focus window (normally the last 7 days). */
export function summarizeWeek(week: DayRecord[]): WeekSummary {
  let totalPomodoros = 0;
  let totalMinutes = 0;
  let activeDays = 0;
  let bestDay: string | null = null;
  let bestPomodoros = 0;

  for (const day of week) {
    totalPomodoros += day.pomodoros;
    totalMinutes += day.minutes;
    if (day.pomodoros > 0) activeDays += 1;
    if (day.pomodoros > bestPomodoros) {
      bestPomodoros = day.pomodoros;
      bestDay = day.date;
    }
  }

  const dayCount = week.length || 1;
  return {
    totalPomodoros,
    totalMinutes,
    activeDays,
    avgPomodoros: totalPomodoros / dayCount,
    avgMinutes: round(totalMinutes / dayCount),
    bestDay,
    bestPomodoros,
  };
}

function round(value: number): number {
  return Math.round(value);
}

/** Quotes a CSV field when it contains a separator, quote or newline. */
function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Builds a CSV export of a focus window (normally the last 7 days): one row per
 * day in the given order, then `total` / `average` / `best-day` summary rows.
 * `weekdayLabel` (dayIndex → localized label) is injected so this module stays
 * free of i18n concerns.
 */
export function buildWeeklyReportCsv(
  week: DayRecord[],
  weekdayLabel: (dayIndex: number) => string
): string {
  const row = (...fields: (string | number)[]) => fields.map(csvField).join(",");
  const lines: string[] = [];

  lines.push(row("date", "weekday", "pomodoros", "minutes"));
  for (const day of week) {
    lines.push(row(day.date, weekdayLabel(day.dayIndex), day.pomodoros, day.minutes));
  }

  const summary = summarizeWeek(week);
  lines.push(row("total", "", summary.totalPomodoros, summary.totalMinutes));
  lines.push(row("average", "", summary.avgPomodoros.toFixed(1), round(summary.avgMinutes)));
  if (summary.bestDay !== null) {
    lines.push(row("best-day", "", summary.bestDay, summary.bestPomodoros));
  }

  return lines.join("\n");
}
