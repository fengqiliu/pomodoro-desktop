import { describe, expect, it } from "vitest";
import { buildWeeklyReportCsv, summarizeWeek } from "./index";
import type { DayRecord } from "./focusHistory";

function day(date: string, dayIndex: number, pomodoros: number, minutes: number): DayRecord {
  return { date, dayIndex, pomodoros, minutes };
}

const WEEK: DayRecord[] = [
  day("2026-9-27", 0, 0, 0),
  day("2026-9-28", 1, 2, 50),
  day("2026-9-29", 2, 0, 0),
  day("2026-9-30", 3, 5, 125),
  day("2026-10-1", 4, 3, 75),
  day("2026-10-2", 5, 5, 125),
  day("2026-10-3", 6, 4, 100),
];

describe("summarizeWeek", () => {
  it("aggregates totals, active days, averages and best day", () => {
    const s = summarizeWeek(WEEK);
    expect(s.totalPomodoros).toBe(19);
    expect(s.totalMinutes).toBe(475);
    expect(s.activeDays).toBe(5);
    expect(s.avgPomodoros).toBeCloseTo(19 / 7, 5);
    expect(s.avgMinutes).toBe(68);
    // first day with the max count wins (2026-9-30 and 2026-10-2 both have 5)
    expect(s.bestDay).toBe("2026-9-30");
    expect(s.bestPomodoros).toBe(5);
  });

  it("treats an all-empty window as zero and no best day", () => {
    const s = summarizeWeek(WEEK.map((d) => ({ ...d, pomodoros: 0, minutes: 0 })));
    expect(s.totalPomodoros).toBe(0);
    expect(s.totalMinutes).toBe(0);
    expect(s.activeDays).toBe(0);
    expect(s.bestDay).toBeNull();
    expect(s.bestPomodoros).toBe(0);
    expect(s.avgPomodoros).toBe(0);
  });

  it("handles an empty array without dividing by zero", () => {
    const s = summarizeWeek([]);
    expect(s.totalPomodoros).toBe(0);
    expect(s.avgPomodoros).toBe(0);
    expect(s.bestDay).toBeNull();
  });
});

describe("buildWeeklyReportCsv", () => {
  const labels = (i: number) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i];

  it("emits header, one row per day, and total/average/best summary rows", () => {
    const csv = buildWeeklyReportCsv(WEEK, labels);
    const lines = csv.split("\n");

    expect(lines[0]).toBe("date,weekday,pomodoros,minutes");
    expect(lines[1]).toBe("2026-9-27,Sun,0,0");
    expect(lines[7]).toBe("2026-10-3,Sat,4,100");
    expect(lines[8]).toBe("total,,19,475");
    expect(lines[9]).toBe("average,,2.7,68");
    expect(lines[10]).toBe("best-day,,2026-9-30,5");
  });

  it("injected labels can be localized", () => {
    const zh = buildWeeklyReportCsv([WEEK[6]], () => "周六");
    expect(zh.split("\n")[1]).toBe("2026-10-3,周六,4,100");
  });

  it("escapes fields containing commas, quotes or newlines", () => {
    const tricky: DayRecord[] = [day("2026-1-1", 0, 0, 0)];
    const csv = buildWeeklyReportCsv(tricky, () => `a "quoted", label`);
    expect(csv.split("\n")[1]).toBe('2026-1-1,"a ""quoted"", label",0,0');
  });

  it("omits the best-day row when the window is empty", () => {
    const csv = buildWeeklyReportCsv(WEEK.map((d) => ({ ...d, pomodoros: 0, minutes: 0 })), labels);
    expect(csv.split("\n")).toEqual([
      "date,weekday,pomodoros,minutes",
      "2026-9-27,Sun,0,0",
      "2026-9-28,Mon,0,0",
      "2026-9-29,Tue,0,0",
      "2026-9-30,Wed,0,0",
      "2026-10-1,Thu,0,0",
      "2026-10-2,Fri,0,0",
      "2026-10-3,Sat,0,0",
      "total,,0,0",
      "average,,0.0,0",
    ]);
  });
});
