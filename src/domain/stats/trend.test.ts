import { describe, expect, it } from "vitest";
import {
  compareWindows,
  last7Days,
  lastNDays,
  movingAverage,
  summarizeMonth,
  type History,
} from "./index";

const NOW = new Date(2026, 8, 11); // 2026-9-11

function key(daysAgo: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function historyAt(daysAgo: number, pomodoros: number, minutes = pomodoros * 25): History {
  return { [key(daysAgo)]: { date: key(daysAgo), dayIndex: 0, pomodoros, minutes } };
}

describe("lastNDays", () => {
  it("returns the window oldest → today, zero-filled", () => {
    const history: History = {
      [key(0)]: { date: key(0), dayIndex: 5, pomodoros: 3, minutes: 75 },
      [key(6)]: { date: key(6), dayIndex: 2, pomodoros: 1, minutes: 25 },
    };
    const series = lastNDays(history, 7, NOW);

    expect(series).toHaveLength(7);
    expect(series[0].date).toBe(key(6));
    expect(series[6].date).toBe(key(0));
    expect(series[0].pomodoros).toBe(1);
    expect(series[6].pomodoros).toBe(3);
    // gap in the middle is filled, not skipped
    expect(series[3].pomodoros).toBe(0);
    expect(series[3].date).toBe(key(3));
  });

  it("agrees with last7Days for a 7-day window", () => {
    const history = historyAt(2, 4);
    expect(lastNDays(history, 7, NOW)).toEqual(last7Days(history, NOW));
  });

  it("handles month boundaries (Aug 31 → Sep 1)", () => {
    const d = new Date(2026, 8, 1); // 2026-9-1
    const series = lastNDays({}, 3, d);
    expect(series.map((x) => x.date)).toEqual(["2026-8-30", "2026-8-31", "2026-9-1"]);
  });
});

describe("movingAverage", () => {
  it("is null until the window is full, then averages", () => {
    expect(movingAverage([1, 2, 3, 4], 3)).toEqual([null, null, 2, 3]);
  });

  it("returns nulls for the whole series when period exceeds its length", () => {
    expect(movingAverage([1, 2], 5)).toEqual([null, null]);
  });

  it("rejects a non-positive period", () => {
    expect(() => movingAverage([1, 2], 0)).toThrow();
  });

  it("handles an empty series", () => {
    expect(movingAverage([], 3)).toEqual([]);
  });
});

describe("compareWindows", () => {
  it("compares the recent window against the preceding baseline", () => {
    const result = compareWindows([1, 1, 5, 5], 2, 2);
    expect(result.current).toBe(10);
    expect(result.baseline).toBe(2);
    expect(result.delta).toBeCloseTo(4); // avg 5 vs 1
    expect(result.direction).toBe("up");
  });

  it("reports down when the recent average drops", () => {
    const result = compareWindows([8, 8, 2, 2], 2, 2);
    expect(result.delta).toBeCloseTo(-6);
    expect(result.direction).toBe("down");
  });

  it("is flat when both averages match", () => {
    expect(compareWindows([3, 3, 3, 3], 2, 2).direction).toBe("flat");
  });

  it("yields a null ratio when the baseline is empty (fresh install)", () => {
    const result = compareWindows([0, 0, 4], 1, 2);
    expect(result.baseline).toBe(0);
    expect(result.ratio).toBeNull();
    expect(result.direction).toBe("up");
  });

  it("degrades to a partial baseline instead of throwing when history is short", () => {
    const result = compareWindows([4, 8], 1, 5);
    expect(result.baseline).toBe(4); // only the one preceding value available
    expect(result.direction).toBe("up");
  });
});

describe("summarizeMonth", () => {
  const now = new Date(2026, 8, 15); // September 2026

  function rec(date: string, pomodoros: number, minutes = pomodoros * 25) {
    return { date, dayIndex: 0, pomodoros, minutes };
  }

  it("totals the current calendar month and the previous one", () => {
    const history: History = {
      "2026-9-1": rec("2026-9-1", 4),
      "2026-9-10": rec("2026-9-10", 6),
      "2026-8-20": rec("2026-8-20", 9),
      "2026-7-15": rec("2026-7-15", 99), // two months back — excluded
    };
    const summary = summarizeMonth(history, now);

    expect(summary.month).toBe("2026-9");
    expect(summary.pomodoros).toBe(10);
    expect(summary.minutes).toBe(250);
    expect(summary.activeDays).toBe(2);
    expect(summary.prevPomodoros).toBe(9);
    expect(summary.prevMinutes).toBe(225);
  });

  it("crosses the year boundary from December into January", () => {
    const jan = new Date(2027, 0, 10);
    const history: History = {
      "2027-1-5": rec("2027-1-5", 3),
      "2026-12-25": rec("2026-12-25", 7),
    };
    const summary = summarizeMonth(history, jan);

    expect(summary.month).toBe("2027-1");
    expect(summary.pomodoros).toBe(3);
    expect(summary.prevPomodoros).toBe(7); // December 2026, not counted as current
  });

  it("counts only days with pomodoros as active", () => {
    const history: History = {
      "2026-9-2": rec("2026-9-2", 0),
      "2026-9-3": rec("2026-9-3", 1),
    };
    expect(summarizeMonth(history, now).activeDays).toBe(1);
  });

  it("returns zeros for an empty history", () => {
    expect(summarizeMonth({}, now)).toEqual({
      month: "2026-9",
      pomodoros: 0,
      minutes: 0,
      activeDays: 0,
      prevPomodoros: 0,
      prevMinutes: 0,
    });
  });

  it("skips malformed date keys rather than producing NaN totals", () => {
    const history: History = {
      bogus: { date: "not-a-date", dayIndex: 0, pomodoros: 5, minutes: 125 },
      "2026-9-4": rec("2026-9-4", 2),
    };
    const summary = summarizeMonth(history, now);
    expect(summary.pomodoros).toBe(2);
    expect(summary.minutes).toBe(50);
  });
});