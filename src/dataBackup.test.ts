import { describe, expect, it } from "vitest";
import { buildBackup, parseBackup } from "./dataBackup";
import { defaultState } from "./persistence";
import type { History } from "./stats";

describe("buildBackup / parseBackup round-trip", () => {
  it("restores the same state and history it exported", () => {
    const state = {
      ...defaultState(),
      completedToday: 3,
      focusMinutesToday: 75,
      cycleFocusCount: 2,
    };
    state.settings.focus = 30;
    state.tasks = [{ id: "t1", title: "写周报", done: false, pomodoros: 2 }];
    const history: History = {
      "2026-9-11": { date: "2026-9-11", dayIndex: 5, pomodoros: 3, minutes: 75 },
    };

    const parsed = parseBackup(buildBackup(state, history), new Date(2026, 8, 11));

    expect(parsed).not.toBeNull();
    expect(parsed!.state.settings.focus).toBe(30);
    expect(parsed!.state.completedToday).toBe(3);
    expect(parsed!.state.tasks).toEqual(state.tasks);
    expect(parsed!.history["2026-9-11"]).toEqual(history["2026-9-11"]);
  });

  it("merges partial state over defaults on import", () => {
    const backup = JSON.stringify({
      app: "pomodoro",
      version: 2,
      exportedAt: "2026-09-11T00:00:00.000Z",
      state: { settings: { focus: 45 } },
      history: {},
    });

    const parsed = parseBackup(backup);

    expect(parsed).not.toBeNull();
    expect(parsed!.state.settings.focus).toBe(45);
    expect(parsed!.state.settings.short).toBe(5); // default restored
  });

  it("rejects foreign or malformed payloads", () => {
    expect(parseBackup("not json")).toBeNull();
    expect(parseBackup('{"app":"other"}')).toBeNull();
    expect(
      parseBackup(JSON.stringify({ app: "pomodoro", version: 2, state: null, history: null }))
    ).toBeNull();
  });

  it("prunes out-of-window history on import", () => {
    const backup = JSON.stringify({
      app: "pomodoro",
      version: 2,
      exportedAt: "2026-09-11T00:00:00.000Z",
      state: defaultState(),
      history: {
        "2026-9-11": { date: "2026-9-11", dayIndex: 5, pomodoros: 1, minutes: 25 },
        "2025-1-1": { date: "2025-1-1", dayIndex: 3, pomodoros: 8, minutes: 200 },
      },
    });

    const parsed = parseBackup(backup, new Date(2026, 8, 11));

    expect(parsed).not.toBeNull();
    expect(Object.keys(parsed!.history)).toEqual(["2026-9-11"]);
  });
});
