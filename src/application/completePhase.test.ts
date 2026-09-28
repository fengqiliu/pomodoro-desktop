import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "../domain/settings";
import type { Task } from "../domain/tasks";
import type { History } from "../domain/stats";
import type { DailyProgress } from "../domain/timer";
import {
  buildPhaseNotificationDescriptor,
  completePhase,
  predictNextPhase,
} from "./completePhase";

describe("predictNextPhase", () => {
  it("predicts short break when cycle has not reached longEvery", () => {
    expect(predictNextPhase({ finished: "focus", cycleFocusCount: 1, longEvery: 4 })).toBe(
      "short"
    );
  });

  it("predicts long break when cycle reaches longEvery", () => {
    expect(predictNextPhase({ finished: "focus", cycleFocusCount: 3, longEvery: 4 })).toBe("long");
  });

  it("predicts focus when finishing any break", () => {
    expect(predictNextPhase({ finished: "short", cycleFocusCount: 0, longEvery: 4 })).toBe(
      "focus"
    );
    expect(predictNextPhase({ finished: "long", cycleFocusCount: 0, longEvery: 4 })).toBe("focus");
  });
});

describe("buildPhaseNotificationDescriptor", () => {
  it("returns undefined when notifications are disabled in settings", () => {
    const desc = buildPhaseNotificationDescriptor(
      "focus",
      { ...DEFAULT_SETTINGS, notifications: false },
      1
    );
    expect(desc).toBeUndefined();
  });

  it("returns notification descriptor when notifications are enabled", () => {
    const desc = buildPhaseNotificationDescriptor(
      "focus",
      { ...DEFAULT_SETTINGS, notifications: true, longEvery: 4 },
      1
    );
    expect(desc).toEqual({
      titleKey: "notif.title",
      bodyKey: "notif.body",
      nextPhase: "short",
    });
  });

  it("uses break title key when finishing break", () => {
    const desc = buildPhaseNotificationDescriptor(
      "short",
      { ...DEFAULT_SETTINGS, notifications: true },
      0
    );
    expect(desc?.titleKey).toBe("notif.title.break");
    expect(desc?.nextPhase).toBe("focus");
  });
});

describe("completePhase use case", () => {
  const baseSettings: Settings = {
    ...DEFAULT_SETTINGS,
    focus: 25,
    short: 5,
    long: 15,
    longEvery: 4,
    sound: true,
    notifications: true,
    autoStartBreaks: false,
    autoStartFocus: true,
  };

  const initialProgress: DailyProgress = {
    date: "2026-9-28",
    completedToday: 2,
    focusMinutesToday: 50,
  };

  const initialTasks: Task[] = [
    { id: "task-1", title: "Active task", pomodoros: 2, done: false },
    { id: "task-2", title: "Other task", pomodoros: 0, done: false },
  ];

  const initialHistory: History = {};

  const fixedDate = new Date(2026, 8, 28, 10, 0, 0); // 2026-9-28

  it("handles standard focus completion (cycle < longEvery)", () => {
    const result = completePhase({
      finished: "focus",
      settings: baseSettings,
      dailyProgress: initialProgress,
      cycleFocusCount: 1,
      tasks: initialTasks,
      activeTaskId: "task-1",
      history: initialHistory,
      now: fixedDate,
    });

    expect(result.nextPhase).toBe("short");
    expect(result.nextSeconds).toBe(5 * 60);
    expect(result.autoStart).toBe(false);
    expect(result.nextCycleFocusCount).toBe(2);
    expect(result.nextDailyProgress).toEqual({
      date: "2026-9-28",
      completedToday: 3,
      focusMinutesToday: 75,
    });
    expect(result.nextTasks[0].pomodoros).toBe(3);
    expect(result.nextHistory["2026-9-28"]).toBeDefined();
    expect(result.nextHistory["2026-9-28"].minutes).toBe(25);
    expect(result.playSound).toBe(true);
    expect(result.notification).toEqual({
      titleKey: "notif.title",
      bodyKey: "notif.body",
      nextPhase: "short",
    });
  });

  it("transitions to long break and resets cycle count when cycle hits longEvery", () => {
    const result = completePhase({
      finished: "focus",
      settings: { ...baseSettings, autoStartBreaks: true },
      dailyProgress: initialProgress,
      cycleFocusCount: 3,
      tasks: initialTasks,
      activeTaskId: null,
      history: initialHistory,
      now: fixedDate,
    });

    expect(result.nextPhase).toBe("long");
    expect(result.nextSeconds).toBe(15 * 60);
    expect(result.autoStart).toBe(true);
    expect(result.nextCycleFocusCount).toBe(0);
    expect(result.nextDailyProgress.completedToday).toBe(3);
    expect(result.nextTasks).toEqual(initialTasks);
    expect(result.notification?.nextPhase).toBe("long");
  });

  it("resets daily progress if finishing on a new calendar day", () => {
    const staleProgress: DailyProgress = {
      date: "2026-9-27",
      completedToday: 5,
      focusMinutesToday: 125,
    };

    const result = completePhase({
      finished: "focus",
      settings: baseSettings,
      dailyProgress: staleProgress,
      cycleFocusCount: 0,
      tasks: initialTasks,
      activeTaskId: "task-1",
      history: initialHistory,
      now: fixedDate,
    });

    expect(result.nextDailyProgress).toEqual({
      date: "2026-9-28",
      completedToday: 1,
      focusMinutesToday: 25,
    });
  });

  it("handles break completion: transitions back to focus and respects autoStartFocus", () => {
    const result = completePhase({
      finished: "short",
      settings: baseSettings,
      dailyProgress: initialProgress,
      cycleFocusCount: 2,
      tasks: initialTasks,
      activeTaskId: "task-1",
      history: initialHistory,
      now: fixedDate,
    });

    expect(result.nextPhase).toBe("focus");
    expect(result.nextSeconds).toBe(25 * 60);
    expect(result.autoStart).toBe(true);
    expect(result.nextCycleFocusCount).toBe(2);
    expect(result.nextDailyProgress).toEqual(initialProgress);
    expect(result.nextTasks).toEqual(initialTasks);
    expect(result.nextHistory).toEqual(initialHistory);
    expect(result.notification?.titleKey).toBe("notif.title.break");
    expect(result.notification?.nextPhase).toBe("focus");
  });

  it("respects sound=false and notifications=false flags", () => {
    const silentSettings: Settings = {
      ...baseSettings,
      sound: false,
      notifications: false,
    };

    const result = completePhase({
      finished: "focus",
      settings: silentSettings,
      dailyProgress: initialProgress,
      cycleFocusCount: 0,
      tasks: initialTasks,
      activeTaskId: null,
      history: initialHistory,
      now: fixedDate,
    });

    expect(result.playSound).toBe(false);
    expect(result.notification).toBeUndefined();
  });

  it("flags goalReachedJustNow when completing a focus session hits the dailyGoal", () => {
    const goalSettings: Settings = {
      ...baseSettings,
      dailyGoal: 3,
    };

    // Before this session, completedToday is 2. Now becomes 3 -> reached!
    const result1 = completePhase({
      finished: "focus",
      settings: goalSettings,
      dailyProgress: { date: "2026-9-28", completedToday: 2, focusMinutesToday: 50 },
      cycleFocusCount: 0,
      tasks: initialTasks,
      activeTaskId: null,
      history: initialHistory,
      now: fixedDate,
    });
    expect(result1.goalReachedJustNow).toBe(true);

    // If next session finishes, completedToday was 3 (already met) -> false
    const result2 = completePhase({
      finished: "focus",
      settings: goalSettings,
      dailyProgress: { date: "2026-9-28", completedToday: 3, focusMinutesToday: 75 },
      cycleFocusCount: 1,
      tasks: initialTasks,
      activeTaskId: null,
      history: initialHistory,
      now: fixedDate,
    });
    expect(result2.goalReachedJustNow).toBe(false);
  });
});

