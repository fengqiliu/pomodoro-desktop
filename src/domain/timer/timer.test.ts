import { describe, expect, it } from "vitest";
import {
  addCompletedFocus,
  completeFocusCycle,
  nextPhaseAfterSkip,
  phaseMinutes,
  remainingSeconds,
  resetDailyProgressIfNeeded,
  type DailyProgress,
} from "./index";

describe("completeFocusCycle", () => {
  it("uses a long break for every fourth completed focus session", () => {
    let cycleFocusCount = 0;
    const phases: string[] = [];

    for (let i = 0; i < 8; i++) {
      const result = completeFocusCycle(cycleFocusCount, 4);
      phases.push(result.nextPhase);
      cycleFocusCount = result.cycleFocusCount;
    }

    expect(phases).toEqual([
      "short",
      "short",
      "short",
      "long",
      "short",
      "short",
      "short",
      "long",
    ]);
    expect(cycleFocusCount).toBe(0);
  });
});

describe("nextPhaseAfterSkip", () => {
  it("skips a focus session to a short break without completing it", () => {
    expect(nextPhaseAfterSkip("focus")).toBe("short");
  });

  it("returns to focus when a break is skipped", () => {
    expect(nextPhaseAfterSkip("short")).toBe("focus");
    expect(nextPhaseAfterSkip("long")).toBe("focus");
  });
});

describe("resetDailyProgressIfNeeded", () => {
  it("resets only daily statistics after crossing midnight", () => {
    const yesterday: DailyProgress = {
      date: "2026-08-21",
      completedToday: 6,
      focusMinutesToday: 150,
    };

    expect(resetDailyProgressIfNeeded(yesterday, "2026-08-22")).toEqual({
      date: "2026-08-22",
      completedToday: 0,
      focusMinutesToday: 0,
    });
  });

  it("preserves progress when it already belongs to today", () => {
    const today: DailyProgress = {
      date: "2026-08-22",
      completedToday: 2,
      focusMinutesToday: 50,
    };

    expect(resetDailyProgressIfNeeded(today, "2026-08-22")).toBe(today);
  });
});

describe("addCompletedFocus", () => {
  it("increments the pomodoro count and accumulates focus minutes", () => {
    const progress: DailyProgress = { date: "2026-08-22", completedToday: 2, focusMinutesToday: 50 };
    expect(addCompletedFocus(progress, 25)).toEqual({
      date: "2026-08-22",
      completedToday: 3,
      focusMinutesToday: 75,
    });
  });
});

describe("phaseMinutes", () => {
  it("maps each phase to its configured duration", () => {
    const durations = { focus: 25, short: 5, long: 15 };
    expect(phaseMinutes("focus", durations)).toBe(25);
    expect(phaseMinutes("short", durations)).toBe(5);
    expect(phaseMinutes("long", durations)).toBe(15);
  });
});

describe("remainingSeconds", () => {
  it("derives the accurate remaining time after a delayed timer callback", () => {
    expect(remainingSeconds(150_000, 60_000)).toBe(90);
  });

  it("does not return a negative countdown", () => {
    expect(remainingSeconds(60_000, 150_000)).toBe(0);
  });
});
