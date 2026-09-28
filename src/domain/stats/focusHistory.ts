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

export interface StreakStats {
  currentStreak: number;
  bestStreak: number;
}

/**
 * Calculates current and best focus streaks (consecutive calendar days with >= 1 pomodoro).
 * If today has 0 pomodoros, current streak is preserved from yesterday (grace period).
 * If yesterday also had 0 pomodoros, current streak is 0.
 */
export function calculateStreak(history: History, now = new Date()): StreakStats {
  const parseDateKey = (k: string): Date | null => {
    const parts = k.split("-").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  };

  // 1. Current streak calculation
  let currentStreak = 0;
  const today = todayKey(now);
  const hasToday = (history[today]?.pomodoros ?? 0) > 0;

  let checkDate = new Date(now);
  if (!hasToday) {
    // Check if yesterday had pomodoros; if not, current streak broken
    checkDate.setDate(checkDate.getDate() - 1);
    const yesterdayKey = todayKey(checkDate);
    if ((history[yesterdayKey]?.pomodoros ?? 0) <= 0) {
      currentStreak = 0;
    } else {
      // Yesterday counts, count backwards from yesterday
      while (true) {
        const k = todayKey(checkDate);
        if ((history[k]?.pomodoros ?? 0) > 0) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }
  } else {
    // Today counts, count backwards from today
    while (true) {
      const k = todayKey(checkDate);
      if ((history[k]?.pomodoros ?? 0) > 0) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // 2. Best streak calculation across all unique sorted active dates
  const activeDates: number[] = [];
  for (const [key, rec] of Object.entries(history)) {
    if (rec.pomodoros > 0) {
      const d = parseDateKey(key);
      if (d) {
        // Normalize to midnight UTC timestamp to avoid daylight saving offset issues
        const normalized = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
        activeDates.push(normalized);
      }
    }
  }

  activeDates.sort((a, b) => a - b);
  const uniqueDays = Array.from(new Set(activeDates));

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  let bestStreak = 0;
  let tempStreak = 0;

  for (let i = 0; i < uniqueDays.length; i++) {
    if (i === 0) {
      tempStreak = 1;
    } else {
      const diffDays = Math.round((uniqueDays[i] - uniqueDays[i - 1]) / ONE_DAY_MS);
      if (diffDays === 1) {
        tempStreak++;
      } else {
        tempStreak = 1;
      }
    }
    if (tempStreak > bestStreak) {
      bestStreak = tempStreak;
    }
  }

  bestStreak = Math.max(bestStreak, currentStreak);

  return { currentStreak, bestStreak };
}

export interface TotalStats {
  totalPomodoros: number;
  totalMinutes: number;
  totalDays: number;
}

/**
 * Aggregates lifetime pomodoros, minutes, and active days across all history records.
 */
export function calculateTotalStats(history: History): TotalStats {
  let totalPomodoros = 0;
  let totalMinutes = 0;
  let totalDays = 0;

  for (const record of Object.values(history)) {
    if (record.pomodoros > 0) {
      totalPomodoros += record.pomodoros;
      totalMinutes += record.minutes;
      totalDays++;
    }
  }

  return { totalPomodoros, totalMinutes, totalDays };
}

