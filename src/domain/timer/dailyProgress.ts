// Daily focus statistics — calendar-bound, unlike the long-break cycle.

export interface DailyProgress {
  date: string;
  completedToday: number;
  focusMinutesToday: number;
}

export function resetDailyProgressIfNeeded(
  progress: DailyProgress,
  today: string
): DailyProgress {
  if (progress.date === today) return progress;

  return {
    date: today,
    completedToday: 0,
    focusMinutesToday: 0,
  };
}

export function addCompletedFocus(progress: DailyProgress, minutes: number): DailyProgress {
  return {
    ...progress,
    completedToday: progress.completedToday + 1,
    focusMinutesToday: progress.focusMinutesToday + minutes,
  };
}

export function isDailyGoalReached(progress: DailyProgress, goal: number): boolean {
  return goal > 0 && progress.completedToday >= goal;
}

export function getDailyGoalPercent(progress: DailyProgress, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(100, Math.round((progress.completedToday / goal) * 100));
}

