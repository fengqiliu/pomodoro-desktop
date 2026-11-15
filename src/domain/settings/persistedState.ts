import { resetDailyProgressIfNeeded, type DailyProgress } from "../timer/dailyProgress";
import type { Task } from "../tasks/task";
import { todayKey } from "../../shared/date";
import { DEFAULT_SETTINGS, NOISE_TYPES, type NoisePref, type Settings } from "./settings";

// Snapshot of the persisted aggregates. Storage adapters serialize this shape
// verbatim — bump the storage key suffix (not this type) when it changes.
export interface PersistedState {
  settings: Settings;
  tasks: Task[];
  completedToday: number;
  focusMinutesToday: number;
  date: string; // YYYY-M-D for daily reset
  cycleFocusCount: number; // completed focus sessions since the last long break
  noise: NoisePref;
}

export function defaultState(): PersistedState {
  return {
    settings: DEFAULT_SETTINGS,
    tasks: [],
    completedToday: 0,
    focusMinutesToday: 0,
    date: todayKey(),
    cycleFocusCount: 0,
    noise: {
      on: false,
      type: DEFAULT_SETTINGS.noiseType,
      volume: DEFAULT_SETTINGS.noiseVolume,
      autoWithFocus: false,
    },
  };
}

// Keeps a stored value only if it has the default's type (and is a finite
// number when numeric) — a hand-edited backup must not put "50" or NaN into
// arithmetic, or a number into the hotkey string.
function sameType<T>(value: unknown, fallback: T): T {
  if (typeof value !== typeof fallback) return fallback;
  if (typeof value === "number" && !Number.isFinite(value)) return fallback;
  return value as T;
}

function sanitizeSettings(raw: unknown): Settings {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const settings = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    (settings as Record<string, unknown>)[key] = sameType(source[key], DEFAULT_SETTINGS[key]);
  }
  if (!NOISE_TYPES.includes(settings.noiseType)) settings.noiseType = DEFAULT_SETTINGS.noiseType;
  return settings;
}

// Merge a partial (possibly untrusted, e.g. imported) state over the defaults.
// Pure — callers decide whether to persist the result.
export function mergeState(parsed: Partial<PersistedState> | null | undefined): PersistedState {
  const fallback = defaultState();
  if (!parsed || typeof parsed !== "object") return fallback;
  const merged: PersistedState = {
    ...fallback,
    ...parsed,
    settings: sanitizeSettings(parsed.settings),
    noise: { ...fallback.noise, ...(parsed.noise ?? {}) } as NoisePref,
    tasks: Array.isArray(parsed.tasks) ? (parsed.tasks as Task[]) : fallback.tasks,
    completedToday: sameType(parsed.completedToday, fallback.completedToday),
    focusMinutesToday: sameType(parsed.focusMinutesToday, fallback.focusMinutesToday),
    cycleFocusCount: sameType(parsed.cycleFocusCount, fallback.cycleFocusCount),
    date: sameType(parsed.date, fallback.date),
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

export interface ComposeStateInput {
  settings: Settings;
  tasks: Task[];
  dailyProgress: DailyProgress;
  cycleFocusCount: number;
  noise: NoisePref;
}

/**
 * Combines runtime domain state slices into a cohesive PersistedState snapshot.
 * Pure function.
 */
export function composePersistedState({
  settings,
  tasks,
  dailyProgress,
  cycleFocusCount,
  noise,
}: ComposeStateInput): PersistedState {
  return {
    settings,
    tasks,
    completedToday: dailyProgress.completedToday,
    focusMinutesToday: dailyProgress.focusMinutesToday,
    date: dailyProgress.date,
    cycleFocusCount,
    noise,
  };
}
