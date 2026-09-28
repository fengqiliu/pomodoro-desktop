import { describe, expect, it } from "vitest";
import { getMillisUntilNextMidnight, todayKey } from "./date";

describe("todayKey", () => {
  it("formats date into YYYY-M-D string format", () => {
    const d = new Date(2026, 8, 28, 14, 30); // 2026-9-28
    expect(todayKey(d)).toBe("2026-9-28");
  });

  it("handles single-digit month and day without zero-padding", () => {
    const d = new Date(2026, 0, 5); // 2026-1-5
    expect(todayKey(d)).toBe("2026-1-5");
  });
});

describe("getMillisUntilNextMidnight", () => {
  it("calculates correct milliseconds to midnight plus buffer", () => {
    // 23:59:50 -> 10s (10000ms) until 24:00:00 + 50ms buffer = 10050ms
    const now = new Date(2026, 8, 28, 23, 59, 50, 0);
    const ms = getMillisUntilNextMidnight(now, 50);
    expect(ms).toBe(10050);
  });

  it("calculates for midday correctly", () => {
    // 12:00:00 -> 12 hours (12 * 3600 * 1000 ms) + 50ms
    const now = new Date(2026, 8, 28, 12, 0, 0, 0);
    const ms = getMillisUntilNextMidnight(now, 50);
    expect(ms).toBe(12 * 60 * 60 * 1000 + 50);
  });
});
