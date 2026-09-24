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
