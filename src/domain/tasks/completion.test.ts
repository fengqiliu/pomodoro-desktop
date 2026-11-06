import { describe, expect, it } from "vitest";
import { describeCompletion } from "./index";

// Local-time constructors keep these tests independent of the machine's timezone.
const NOW = new Date(2026, 10, 6, 18, 0); // 2026-11-06 18:00 local
const iso = (...args: [number, number, number, number, number]) => new Date(...args).toISOString();

describe("describeCompletion", () => {
  it("labels a completion from today with its local clock time", () => {
    expect(describeCompletion(iso(2026, 10, 6, 14, 32), NOW)).toEqual({
      kind: "today",
      time: "14:32",
    });
    expect(describeCompletion(iso(2026, 10, 6, 0, 5), NOW)).toEqual({
      kind: "today",
      time: "00:05",
    });
  });

  it("labels yesterday by calendar day, not by 24-hour distance", () => {
    expect(describeCompletion(iso(2026, 10, 5, 23, 59), NOW)).toEqual({
      kind: "yesterday",
      time: "23:59",
    });
    expect(describeCompletion(iso(2026, 10, 5, 9, 5), NOW)).toEqual({
      kind: "yesterday",
      time: "09:05",
    });
  });

  it("shows month and day for older completions in the same year", () => {
    expect(describeCompletion(iso(2026, 10, 4, 10, 0), NOW)).toEqual({
      kind: "date",
      month: 11,
      day: 4,
    });
    expect(describeCompletion(iso(2026, 0, 31, 10, 0), NOW)).toEqual({
      kind: "date",
      month: 1,
      day: 31,
    });
  });

  it("adds the year only when it differs from the current one", () => {
    expect(describeCompletion(iso(2025, 11, 31, 22, 0), NOW)).toEqual({
      kind: "date",
      year: 2025,
      month: 12,
      day: 31,
    });
  });

  it("handles yesterday across a month boundary", () => {
    const firstOfMonth = new Date(2026, 11, 1, 8, 0);
    expect(describeCompletion(iso(2026, 10, 30, 21, 15), firstOfMonth)).toEqual({
      kind: "yesterday",
      time: "21:15",
    });
  });

  it("returns null when there is no timestamp or it cannot be parsed", () => {
    expect(describeCompletion(undefined, NOW)).toBeNull();
    expect(describeCompletion("not a date", NOW)).toBeNull();
  });
});
