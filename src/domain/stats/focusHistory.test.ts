import { describe, expect, it } from "vitest";
import { last7Days, pruneHistory, recordFocus, type History } from "./index";

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
