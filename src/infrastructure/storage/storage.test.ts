import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { safeStorage } from "./safeStorage";
import { stateStore } from "./stateStore";
import { historyStore } from "./historyStore";
import { preferenceStore } from "./preferenceStore";
import { DEFAULT_SETTINGS } from "../../domain/settings";

describe("storage infrastructure", () => {
  beforeEach(() => {
    safeStorage.clearMemory();
  });

  afterEach(() => {
    safeStorage.clearMemory();
  });

  describe("safeStorage", () => {
    it("reads and writes key-value pairs safely", () => {
      safeStorage.setItem("test-key", "val-123");
      expect(safeStorage.getItem("test-key")).toBe("val-123");
      safeStorage.removeItem("test-key");
      expect(safeStorage.getItem("test-key")).toBeNull();
    });
  });

  describe("preferenceStore", () => {
    it("handles theme reading and writing", () => {
      expect(preferenceStore.getTheme()).toBeNull();
      preferenceStore.setTheme("dark");
      expect(preferenceStore.getTheme()).toBe("dark");
    });

    it("handles pinned status reading and writing as '1' / '0'", () => {
      expect(preferenceStore.getPinned()).toBe(false);
      preferenceStore.setPinned(true);
      expect(preferenceStore.getPinned()).toBe(true);
      expect(safeStorage.getItem("pomodoro-pinned")).toBe("1");

      preferenceStore.setPinned(false);
      expect(preferenceStore.getPinned()).toBe(false);
      expect(safeStorage.getItem("pomodoro-pinned")).toBe("0");
    });

    it("handles language reading and writing", () => {
      expect(preferenceStore.getLanguage()).toBeNull();
      preferenceStore.setLanguage("en");
      expect(preferenceStore.getLanguage()).toBe("en");
    });
  });

  describe("stateStore", () => {
    it("returns default state when empty", () => {
      const state = stateStore.load();
      expect(state.settings).toEqual(DEFAULT_SETTINGS);
      expect(state.completedToday).toBe(0);
      expect(state.tasks).toEqual([]);
    });

    it("saves and loads state round-trip", () => {
      const sample = stateStore.load();
      sample.completedToday = 5;
      sample.cycleFocusCount = 3;
      stateStore.save(sample);

      const loaded = stateStore.load();
      expect(loaded.completedToday).toBe(5);
      expect(loaded.cycleFocusCount).toBe(3);
    });
  });

  describe("historyStore", () => {
    it("returns empty object when empty", () => {
      expect(historyStore.load()).toEqual({});
    });

    it("saves and loads history round-trip", () => {
      const hist = {
        "2026-9-28": { date: "2026-9-28", dayIndex: 1, pomodoros: 4, minutes: 100 },
      };
      historyStore.save(hist);
      expect(historyStore.load()).toEqual(hist);
    });
  });
});
