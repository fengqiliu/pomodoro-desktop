import { describe, expect, it } from "vitest";
import {
  calculateStreak,
  calculateTotalStats,
  last7Days,
  pruneHistory,
  recordFocus,
  recordInterruption,
  todayInterruptions,
  type History,
} from "./index";

const NOW = new Date(2026, 8, 11); // 2026-9-11, a Friday

function key(daysAgo: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

describe("pruneHistory", () => {
  it("drops records older than the retention window", () => {
    const history: History = {
      [key(0)]: { date: key(0), dayIndex: 5, pomodoros: 3, minutes: 75 },
      [key(30)]: { date: key(30), dayIndex: 5, pomodoros: 1, minutes: 25 },
      [key(59)]: { date: key(59), dayIndex: 3, pomodoros: 2, minutes: 50 },
      [key(60)]: { date: key(60), dayIndex: 2, pomodoros: 9, minutes: 225 },
      [key(120)]: { date: key(120), dayIndex: 0, pomodoros: 4, minutes: 100 },
    };

    const pruned = pruneHistory(history, 60, NOW);

    expect(Object.keys(pruned).sort()).toEqual([key(0), key(30), key(59)].sort());
  });

  it("keeps an empty history empty", () => {
    expect(pruneHistory({}, 60, NOW)).toEqual({});
  });
});

describe("recordFocus", () => {
  it("accumulates pomodoros and minutes for today", () => {
    let history = recordFocus({}, 25, NOW);
    history = recordFocus(history, 25, NOW);

    expect(history[key(0)]).toEqual({
      date: key(0),
      dayIndex: NOW.getDay(),
      pomodoros: 2,
      minutes: 50,
    });
  });
});

describe("last7Days", () => {
  it("fills missing days with empty records and orders oldest → today", () => {
    const history: History = {
      [key(1)]: { date: key(1), dayIndex: 4, pomodoros: 5, minutes: 125 },
    };

    const week = last7Days(history, NOW);

    expect(week).toHaveLength(7);
    expect(week[5].pomodoros).toBe(5); // yesterday
    expect(week[6].date).toBe(key(0)); // today last
    expect(week[0].pomodoros).toBe(0); // six days ago, no record
    expect(week[6].dayIndex).toBe(NOW.getDay());
  });
});

describe("calculateStreak", () => {
  it("returns 0 streaks for empty history", () => {
    const { currentStreak, bestStreak } = calculateStreak({}, NOW);
    expect(currentStreak).toBe(0);
    expect(bestStreak).toBe(0);
  });

  it("calculates current streak when today has pomodoros", () => {
    const history: History = {
      [key(0)]: { date: key(0), dayIndex: 5, pomodoros: 2, minutes: 50 },
      [key(1)]: { date: key(1), dayIndex: 4, pomodoros: 3, minutes: 75 },
      [key(2)]: { date: key(2), dayIndex: 3, pomodoros: 1, minutes: 25 },
    };
    const { currentStreak, bestStreak } = calculateStreak(history, NOW);
    expect(currentStreak).toBe(3);
    expect(bestStreak).toBe(3);
  });

  it("preserves yesterday's streak if today has 0 pomodoros yet", () => {
    const history: History = {
      [key(1)]: { date: key(1), dayIndex: 4, pomodoros: 3, minutes: 75 },
      [key(2)]: { date: key(2), dayIndex: 3, pomodoros: 1, minutes: 25 },
    };
    const { currentStreak, bestStreak } = calculateStreak(history, NOW);
    expect(currentStreak).toBe(2);
    expect(bestStreak).toBe(2);
  });

  it("breaks current streak if both today and yesterday have no pomodoros", () => {
    const history: History = {
      [key(2)]: { date: key(2), dayIndex: 3, pomodoros: 4, minutes: 100 },
      [key(3)]: { date: key(3), dayIndex: 2, pomodoros: 2, minutes: 50 },
    };
    const { currentStreak, bestStreak } = calculateStreak(history, NOW);
    expect(currentStreak).toBe(0);
    expect(bestStreak).toBe(2);
  });

  it("calculates bestStreak across disconnected historical runs", () => {
    const history: History = {
      // 4-day streak in the past
      [key(10)]: { date: key(10), dayIndex: 1, pomodoros: 1, minutes: 25 },
      [key(11)]: { date: key(11), dayIndex: 0, pomodoros: 2, minutes: 50 },
      [key(12)]: { date: key(12), dayIndex: 6, pomodoros: 3, minutes: 75 },
      [key(13)]: { date: key(13), dayIndex: 5, pomodoros: 1, minutes: 25 },
      // current 2-day streak
      [key(0)]: { date: key(0), dayIndex: 5, pomodoros: 1, minutes: 25 },
      [key(1)]: { date: key(1), dayIndex: 4, pomodoros: 2, minutes: 50 },
    };
    const { currentStreak, bestStreak } = calculateStreak(history, NOW);
    expect(currentStreak).toBe(2);
    expect(bestStreak).toBe(4);
  });
});

describe("calculateTotalStats", () => {
  it("returns zero counts for empty history", () => {
    expect(calculateTotalStats({})).toEqual({
      totalPomodoros: 0,
      totalMinutes: 0,
      totalDays: 0,
    });
  });

  it("aggregates all records with pomodoros > 0", () => {
    const history: History = {
      [key(0)]: { date: key(0), dayIndex: 5, pomodoros: 2, minutes: 50 },
      [key(1)]: { date: key(1), dayIndex: 4, pomodoros: 4, minutes: 100 },
      [key(2)]: { date: key(2), dayIndex: 3, pomodoros: 0, minutes: 0 },
    };
    expect(calculateTotalStats(history)).toEqual({
      totalPomodoros: 6,
      totalMinutes: 150,
      totalDays: 2,
    });
  });
});

describe("interruptions", () => {
  it("counts an interruption on today's record without touching focus totals", () => {
    const start: History = {
      "2026-9-11": { date: "2026-9-11", dayIndex: 5, pomodoros: 2, minutes: 50 },
    };
    const h = recordInterruption(recordInterruption(start, NOW), NOW);
    expect(h["2026-9-11"]).toEqual({
      date: "2026-9-11",
      dayIndex: 5,
      pomodoros: 2,
      minutes: 50,
      interruptions: 2,
    });
    expect(start["2026-9-11"].interruptions).toBeUndefined();
  });

  it("creates today's record when the first event of the day is an interruption", () => {
    expect(recordInterruption({}, NOW)["2026-9-11"]).toEqual({
      date: "2026-9-11",
      dayIndex: 5,
      pomodoros: 0,
      minutes: 0,
      interruptions: 1,
    });
  });

  it("reads today's count, treating records saved before the field existed as 0", () => {
    expect(todayInterruptions({}, NOW)).toBe(0);
    expect(
      todayInterruptions(
        { "2026-9-11": { date: "2026-9-11", dayIndex: 5, pomodoros: 1, minutes: 25 } },
        NOW
      )
    ).toBe(0);
    expect(todayInterruptions(recordInterruption({}, NOW), NOW)).toBe(1);
  });
});
