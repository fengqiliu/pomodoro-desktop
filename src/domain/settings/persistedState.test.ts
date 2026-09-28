import { describe, expect, it } from "vitest";
import {
  composePersistedState,
  defaultState,
  mergeState,
  type PersistedState,
} from "./persistedState";
import { DEFAULT_SETTINGS } from "./settings";

describe("persistedState domain", () => {
  it("defaultState returns valid defaults with today date", () => {
    const s = defaultState();
    expect(s.settings).toEqual(DEFAULT_SETTINGS);
    expect(s.completedToday).toBe(0);
    expect(s.focusMinutesToday).toBe(0);
    expect(s.cycleFocusCount).toBe(0);
    expect(s.tasks).toEqual([]);
    expect(typeof s.date).toBe("string");
  });

  it("mergeState handles empty/corrupt input safely", () => {
    const s1 = mergeState(null);
    expect(s1.settings).toEqual(DEFAULT_SETTINGS);
    const s2 = mergeState(undefined);
    expect(s2.settings).toEqual(DEFAULT_SETTINGS);
    // @ts-expect-error test non-object
    const s3 = mergeState("invalid");
    expect(s3.settings).toEqual(DEFAULT_SETTINGS);
  });

  it("composePersistedState correctly aggregates runtime state slices", () => {
    const state: PersistedState = composePersistedState({
      settings: { ...DEFAULT_SETTINGS, focus: 30 },
      tasks: [{ id: "t1", title: "Task 1", pomodoros: 2, done: false }],
      dailyProgress: {
        date: "2026-9-28",
        completedToday: 4,
        focusMinutesToday: 100,
      },
      cycleFocusCount: 2,
      noise: { on: true, type: "brown", volume: 0.5 },
    });

    expect(state).toEqual({
      settings: { ...DEFAULT_SETTINGS, focus: 30 },
      tasks: [{ id: "t1", title: "Task 1", pomodoros: 2, done: false }],
      completedToday: 4,
      focusMinutesToday: 100,
      date: "2026-9-28",
      cycleFocusCount: 2,
      noise: { on: true, type: "brown", volume: 0.5 },
    });
  });
});
