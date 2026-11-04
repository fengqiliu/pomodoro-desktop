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

    expect(lines[0]).toBe(
      "date,weekday,pomodoros,minutes,internal_interruptions,external_interruptions"
    );
    expect(lines[1]).toBe("2026-9-27,Sun,0,0,0,0");
    expect(lines[7]).toBe("2026-10-3,Sat,4,100,0,0");
    expect(lines[8]).toBe("total,,19,475,0,0");
    expect(lines[9]).toBe("average,,2.7,68,0.0,0.0");
    expect(lines[10]).toBe("best-day,,2026-9-30,5,,");
  });

  it("exports interruptions split into internal and external, with totals and daily averages", () => {
    const week: DayRecord[] = [
      { ...day("2026-9-28", 1, 2, 50), interruptions: 3, externalInterruptions: 1 },
      { ...day("2026-9-29", 2, 1, 25), interruptions: 2 }, // legacy/unclassified → internal
      day("2026-9-30", 3, 0, 0),
      { ...day("2026-10-1", 4, 0, 0), interruptions: 2, externalInterruptions: 2 },
    ];
    const lines = buildWeeklyReportCsv(week, labels).split("\n");
    expect(lines[1]).toBe("2026-9-28,Mon,2,50,2,1");
    expect(lines[2]).toBe("2026-9-29,Tue,1,25,2,0");
    expect(lines[3]).toBe("2026-9-30,Wed,0,0,0,0");
    expect(lines[4]).toBe("2026-10-1,Thu,0,0,0,2");
    expect(lines[5]).toBe("total,,3,75,4,3");
    expect(lines[6]).toBe("average,,0.8,19,1.0,0.8");
  });

  it("injected labels can be localized", () => {
    const zh = buildWeeklyReportCsv([WEEK[6]], () => "周六");
    expect(zh.split("\n")[1]).toBe("2026-10-3,周六,4,100,0,0");
  });

  it("escapes fields containing commas, quotes or newlines", () => {
    const tricky: DayRecord[] = [day("2026-1-1", 0, 0, 0)];
    const csv = buildWeeklyReportCsv(tricky, () => `a "quoted", label`);
    expect(csv.split("\n")[1]).toBe('2026-1-1,"a ""quoted"", label",0,0,0,0');
  });

  it("omits the best-day row when the window is empty", () => {
    const csv = buildWeeklyReportCsv(
      WEEK.map((d) => ({ ...d, pomodoros: 0, minutes: 0 })),
      labels
    );
    expect(csv.split("\n")).toEqual([
      "date,weekday,pomodoros,minutes,internal_interruptions,external_interruptions",
      "2026-9-27,Sun,0,0,0,0",
      "2026-9-28,Mon,0,0,0,0",
      "2026-9-29,Tue,0,0,0,0",
      "2026-9-30,Wed,0,0,0,0",
      "2026-10-1,Thu,0,0,0,0",
      "2026-10-2,Fri,0,0,0,0",
      "2026-10-3,Sat,0,0,0,0",
      "total,,0,0,0,0",
      "average,,0.0,0,0.0,0.0",
    ]);
  });

  it("still exports interruptions on a window with no completed pomodoros", () => {
    const week = [{ ...day("2026-9-28", 1, 0, 0), interruptions: 2, externalInterruptions: 1 }];
    const lines = buildWeeklyReportCsv(week, labels).split("\n");
    expect(lines).toEqual([
      "date,weekday,pomodoros,minutes,internal_interruptions,external_interruptions",
      "2026-9-28,Mon,0,0,1,1",
      "total,,0,0,1,1",
      "average,,0.0,0,1.0,1.0",
    ]);
  });
});

describe("summarizeWeek interruptions", () => {
  it("totals interruptions across the window, counting missing fields as 0", () => {
    const week = [
      { ...day("2026-9-10", 4, 1, 25), interruptions: 3 },
      day("2026-9-11", 5, 2, 50),
      { ...day("2026-9-12", 6, 0, 0), interruptions: 1 },
    ];
    expect(summarizeWeek(week).totalInterruptions).toBe(4);
    expect(summarizeWeek(week).externalInterruptions).toBe(0);
  });
});

describe("summarizeWeek external interruptions", () => {
  it("totals the external share separately from the overall count", () => {
    const week = [
      { ...day("2026-9-10", 4, 1, 25), interruptions: 3, externalInterruptions: 2 },
      { ...day("2026-9-11", 5, 0, 0), interruptions: 1, externalInterruptions: 1 },
    ];
    const s = summarizeWeek(week);
    expect(s.totalInterruptions).toBe(4);
    expect(s.externalInterruptions).toBe(3);
  });
});
