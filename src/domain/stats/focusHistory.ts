import { todayKey } from "../../shared/date";

export interface DayRecord {
  date: string; // YYYY-M-D
  dayIndex: number; // 0..6 — label resolved at render time by lang
  pomodoros: number;
  minutes: number;
}

export type History = Record<string, DayRecord>;

export function emptyDay(date: string, dayIndex: number): DayRecord {
  return { date, dayIndex, pomodoros: 0, minutes: 0 };
}

export function last7Days(history: History, now = new Date()): DayRecord[] {
  const out: DayRecord[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = todayKey(d);
    out.push(history[key] || emptyDay(key, d.getDay()));
  }
  return out;
}

// localStorage is unbounded, and the chart only ever shows the last 7 days —
// keep a wider window for manual inspection but drop everything older.
export function pruneHistory(history: History, keepDays = 60, now = new Date()): History {
  const valid = new Set<string>();
  for (let i = 0; i < keepDays; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    valid.add(todayKey(d));
  }
  const pruned: History = {};
  for (const [key, record] of Object.entries(history)) {
    if (valid.has(key)) pruned[key] = record;
  }
  return pruned;
}

export function recordFocus(history: History, minutes: number, now = new Date()): History {
  const key = todayKey(now);
  const cur = history[key] || emptyDay(key, now.getDay());
  return {
    ...history,
    [key]: { ...cur, pomodoros: cur.pomodoros + 1, minutes: cur.minutes + minutes },
  };
}
