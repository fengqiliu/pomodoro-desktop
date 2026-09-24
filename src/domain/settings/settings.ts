// Settings value objects of the settings context.

export type NoiseType = "white" | "brown" | "pink";

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
