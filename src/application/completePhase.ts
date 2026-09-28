import type { Settings } from "../domain/settings";
import { recordFocus, type History } from "../domain/stats";
import { recordPomodoro, type Task } from "../domain/tasks";
import {
  addCompletedFocus,
  completeFocusCycle,
  nextPhaseAfterCompletedBreak,
  phaseMinutes,
  resetDailyProgressIfNeeded,
  type DailyProgress,
  type Phase,
} from "../domain/timer";
import { todayKey } from "../shared/date";

export interface PredictNextPhaseInput {
  finished: Phase;
  cycleFocusCount: number;
  longEvery: number;
}

/**
 * Predicts what phase follows the currently running phase without mutating state.
 * Useful for composing the upcoming notification descriptor before the countdown ends.
 */
export function predictNextPhase({
  finished,
  cycleFocusCount,
  longEvery,
}: PredictNextPhaseInput): Phase {
  if (finished === "focus") {
    return completeFocusCycle(cycleFocusCount, longEvery).nextPhase;
  }
  return nextPhaseAfterCompletedBreak();
}

export interface PhaseNotificationDescriptor {
  titleKey: string;
  bodyKey: string;
  nextPhase: Phase;
}

/**
 * Builds a notification descriptor (i18n keys + params) for a phase completion event,
 * or undefined if notifications are disabled in settings.
 */
export function buildPhaseNotificationDescriptor(
  finished: Phase,
  settings: Pick<Settings, "notifications" | "longEvery">,
  cycleFocusCount: number
): PhaseNotificationDescriptor | undefined {
  if (!settings.notifications) return undefined;

  const nextPhase = predictNextPhase({
    finished,
    cycleFocusCount,
    longEvery: settings.longEvery,
  });

  return {
    titleKey: finished === "focus" ? "notif.title" : "notif.title.break",
    bodyKey: "notif.body",
    nextPhase,
  };
}

export interface CompletePhaseCommand {
  finished: Phase;
  settings: Settings;
  dailyProgress: DailyProgress;
  cycleFocusCount: number;
  tasks: Task[];
  activeTaskId: string | null;
  history: History;
  now?: Date;
}

export interface CompletePhaseResult {
  nextPhase: Phase;
  nextSeconds: number;
  autoStart: boolean;
  nextDailyProgress: DailyProgress;
  nextCycleFocusCount: number;
  nextTasks: Task[];
  nextHistory: History;
  playSound: boolean;
  notification?: PhaseNotificationDescriptor;
}

/**
 * Application use case: coordinates domain logic when a pomodoro phase completes.
 * Pure function: receives current state snapshots and returns updated state + side-effect descriptors.
 * Does not perform I/O, WebAudio, or platform calls directly.
 */
export function completePhase({
  finished,
  settings,
  dailyProgress,
  cycleFocusCount,
  tasks,
  activeTaskId,
  history,
  now,
}: CompletePhaseCommand): CompletePhaseResult {
  const currentDate = now ?? new Date();
  const today = todayKey(currentDate);

  let nextPhase: Phase;
  let nextCycleFocusCount = cycleFocusCount;
  let nextDailyProgress = dailyProgress;
  let nextHistory = history;
  let nextTasks = tasks;

  if (finished === "focus") {
    const focusMins = settings.focus;
    const cycle = completeFocusCycle(cycleFocusCount, settings.longEvery);
    nextCycleFocusCount = cycle.cycleFocusCount;
    nextPhase = cycle.nextPhase;

    // Advance daily progress with auto cross-day reset
    const freshProgress = resetDailyProgressIfNeeded(dailyProgress, today);
    nextDailyProgress = addCompletedFocus(freshProgress, focusMins);

    // Record into history
    nextHistory = recordFocus(history, focusMins, currentDate);

    // Increment active task pomodoros if any
    nextTasks = recordPomodoro(tasks, activeTaskId);
  } else {
    nextPhase = nextPhaseAfterCompletedBreak();
  }

  const autoStart =
    (finished === "focus" && settings.autoStartBreaks) ||
    (finished !== "focus" && settings.autoStartFocus);

  const nextSeconds = phaseMinutes(nextPhase, settings) * 60;

  const notification = buildPhaseNotificationDescriptor(
    finished,
    settings,
    cycleFocusCount
  );

  return {
    nextPhase,
    nextSeconds,
    autoStart,
    nextDailyProgress,
    nextCycleFocusCount,
    nextTasks,
    nextHistory,
    playSound: settings.sound,
    notification,
  };
}

