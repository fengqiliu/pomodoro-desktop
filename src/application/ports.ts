// Ports (hexagonal architecture): the capabilities the application needs from
// the outside world. Infrastructure adapters implement these; the presentation
// layer wires the concrete adapters in. Everything here is a type — no runtime
// dependency on Tauri, the DOM, or localStorage.

import type { PersistedState } from "../domain/settings";
import type { History } from "../domain/stats";

export interface WindowPort {
  setAlwaysOnTop(on: boolean): Promise<void>;
  isAlwaysOnTop(): Promise<boolean>;
}

export interface ShortcutPort {
  /** Returns false when the combination cannot be registered. */
  register(keys: string, handler: () => void): Promise<boolean>;
  unregister(keys: string): Promise<void>;
}

export interface NotificationPort {
  /** Best-effort system notification; silently no-ops without permission. */
  notifyPhaseDone(title: string, body: string): Promise<void>;
}

export interface NativeTimerSnapshot {
  running: boolean;
  remainingMs: number;
  generation: number;
}

export interface NativeTimerNotification {
  title: string;
  body: string;
}

export interface NativeTimerCompletion extends NativeTimerSnapshot {
  notificationSent: boolean;
}

export interface NativeTimerPort {
  start(seconds: number, notification?: NativeTimerNotification): Promise<NativeTimerSnapshot | null>;
  pause(): Promise<NativeTimerSnapshot | null>;
  cancel(expectedGeneration?: number): Promise<NativeTimerSnapshot | null>;
  listenCompleted(handler: (completion: NativeTimerCompletion) => void): Promise<() => void>;
}

export interface StateStore {
  load(): PersistedState;
  save(state: PersistedState): void;
}

export interface HistoryStore {
  load(): History;
  save(history: History): void;
}
