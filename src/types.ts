import type { NoiseType } from "./noise";
import type { Phase } from "./timer/timerRules";

export type Theme = "light" | "dark";
export type ChartMetric = "pomodoros" | "minutes";

export interface Task {
  id: string;
  title: string;
  done: boolean;
  pomodoros: number;
}

export interface Settings {
  focus: number; // minutes
  short: number;
  long: number;
  longEvery: number; // long break after this many focus sessions
  sound: boolean;
  notifications: boolean;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  hotkey: string;
  noiseType: NoiseType;
  noiseVolume: number; // 0..1
}

export interface NoisePref {
  on: boolean;
  type: NoiseType;
  volume: number;
}

export interface PersistedState {
  settings: Settings;
  tasks: Task[];
  completedToday: number;
  focusMinutesToday: number;
  date: string; // YYYY-M-D for daily reset
  cycleFocusCount: number; // completed focus sessions since the last long break
  noise: NoisePref;
}

export type Tab = "timer" | "tasks" | "stats";
export type { Phase };
