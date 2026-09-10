import { resetDailyProgressIfNeeded, type DailyProgress } from "./timer/timerRules";
import type { NoisePref, PersistedState, Settings, Task } from "./types";

export const STATE_KEY = "pomodoro-state-v3";
export const THEME_KEY = "pomodoro-theme";
export const PIN_KEY = "pomodoro-pinned";
export const HISTORY_KEY = "pomodoro-history-v1";
export const LANG_KEY = "pomodoro-lang";

export const DEFAULT_SETTINGS: Settings = {
  focus: 25,
  short: 5,
  long: 15,
  longEvery: 4,
  sound: true,
  notifications: true,
  autoStartBreaks: false,
  autoStartFocus: false,
  hotkey: "CommandOrControl+Shift+P",
  noiseType: "brown",
  noiseVolume: 0.3,
};

export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function defaultState(): PersistedState {
  return {
    settings: DEFAULT_SETTINGS,
    tasks: [],
    completedToday: 0,
    focusMinutesToday: 0,
    date: todayKey(),
    cycleFocusCount: 0,
    noise: { on: false, type: DEFAULT_SETTINGS.noiseType, volume: DEFAULT_SETTINGS.noiseVolume },
  };
}

// Merge a partial (possibly untrusted, e.g. imported) state over the defaults.
// Pure — callers decide whether to persist the result.
export function mergeState(parsed: Partial<PersistedState> | null | undefined): PersistedState {
  const fallback = defaultState();
  if (!parsed || typeof parsed !== "object") return fallback;
  const merged: PersistedState = {
    ...fallback,
    ...parsed,
    settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    noise: { ...fallback.noise, ...(parsed.noise ?? {}) } as NoisePref,
    tasks: Array.isArray(parsed.tasks) ? (parsed.tasks as Task[]) : fallback.tasks,
  };
  const dailyProgress: DailyProgress = resetDailyProgressIfNeeded(
    {
      date: merged.date,
      completedToday: merged.completedToday,
      focusMinutesToday: merged.focusMinutesToday,
    },
    todayKey()
  );
  merged.date = dailyProgress.date;
  merged.completedToday = dailyProgress.completedToday;
  merged.focusMinutesToday = dailyProgress.focusMinutesToday;
  return merged;
}

export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return defaultState();
    return mergeState(JSON.parse(raw) as Partial<PersistedState>);
  } catch {
    return defaultState();
  }
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — best effort */
  }
}
