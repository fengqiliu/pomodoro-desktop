import { describe, expect, it } from "vitest";
import {
  LANGS,
  NOISE_KEY,
  PHASE_KEY,
  translate,
  weekdayLabel,
  type Lang,
} from "./i18n";
import type { NoiseType } from "../domain/settings";
import type { Phase } from "../domain/timer";

// A key that exists in the dictionary resolves to prose; a key that does not
// resolves to itself. That asymmetry is the contract everything else builds on.
function resolves(key: string, lang: Lang): boolean {
  return translate(lang, key) !== key;
}

const ALL_LANGS: Lang[] = ["zh", "en"];

describe("translate", () => {
  it("returns the requested language variant", () => {
    expect(translate("zh", "phase.focus")).toBe("专注");
    expect(translate("en", "phase.focus")).toBe("Focus");
  });

  it("translates every phase in both languages", () => {
    for (const phase of ["focus", "short", "long"] as Phase[]) {
      for (const lang of ALL_LANGS) {
        expect(resolves(PHASE_KEY[phase], lang)).toBe(true);
      }
    }
  });

  it("falls back to the key itself for unknown entries", () => {
    expect(translate("zh", "no.such.key")).toBe("no.such.key");
    expect(translate("en", "no.such.key")).toBe("no.such.key");
  });

  it("substitutes named parameters", () => {
    expect(translate("zh", "task.footer", { total: 3, done: 1 })).toBe(
      "共 3 个任务 · 已完成 1 个"
    );
    expect(translate("en", "task.footer", { total: 3, done: 1 })).toBe("3 tasks · 1 done");
  });

  it("accepts string parameters and renders them verbatim", () => {
    expect(translate("zh", "notif.body", { next: "短休息" })).toBe("开始 短休息");
    expect(translate("en", "notif.body", { next: "Short Break" })).toBe("Starting Short Break");
  });

  it("keeps a placeholder visible when its parameter is absent or undefined", () => {
    // `undefined` reaches translate() from JS callers (e.g. a missing setting),
    // so the guard must cover it even though TS types say otherwise.
    const undefinedParam = { next: undefined } as unknown as Record<string, string>;

    expect(translate("zh", "notif.body")).toBe("开始 {next}");
    expect(translate("zh", "notif.body", { other: "x" })).toBe("开始 {next}");
    expect(translate("zh", "notif.body", undefinedParam)).toBe("开始 {next}");
  });

  it("returns the raw string when no params are supplied", () => {
    expect(translate("zh", "app.name")).toBe("Pomodoro");
  });
});

describe("weekdayLabel", () => {
  it("labels all seven days in both languages", () => {
    const zh = Array.from({ length: 7 }, (_, i) => weekdayLabel("zh", i));
    const en = Array.from({ length: 7 }, (_, i) => weekdayLabel("en", i));

    expect(zh).toEqual(["周日", "周一", "周二", "周三", "周四", "周五", "周六"]);
    expect(en).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  });

  it("does not fall back to the raw key for a valid day index", () => {
    for (let i = 0; i < 7; i++) {
      expect(weekdayLabel("zh", i)).not.toBe(`day.${i}`);
    }
  });
});

describe("dictionary integrity", () => {
  it("offers Simplified Chinese first, then English", () => {
    expect(LANGS.map((l) => l.code)).toEqual(["zh", "en"]);
  });

  it("maps every noise type to an existing entry in both languages", () => {
    for (const type of ["white", "brown", "pink"] as NoiseType[]) {
      for (const lang of ALL_LANGS) {
        expect(resolves(NOISE_KEY[type], lang)).toBe(true);
      }
    }
  });

  it("keeps the notification strings used by the native timer available", () => {
    for (const key of ["notif.title", "notif.title.break", "notif.body"]) {
      for (const lang of ALL_LANGS) {
        expect(resolves(key, lang)).toBe(true);
      }
    }
  });
});