import { useCallback, type Dispatch, type SetStateAction } from "react";
import { recordInterruption, todayInterruptions, type History } from "../../domain/stats";
import { canLogInterruption, type Phase } from "../../domain/timer";
import { historyStore } from "../../infrastructure/storage";

interface Options {
  history: History;
  setHistory: Dispatch<SetStateAction<History>>;
  phase: Phase;
  running: boolean;
  secondsLeft: number;
  phaseSeconds: number;
}

// Focus interruption log: today's count, whether logging is allowed right now,
// and the action that records one into the persisted per-day history.
export function useInterruptions({
  history,
  setHistory,
  phase,
  running,
  secondsLeft,
  phaseSeconds,
}: Options) {
  const canLog = canLogInterruption(phase, running, secondsLeft, phaseSeconds);

  const log = useCallback(() => {
    if (!canLog) return;
    setHistory((prev) => {
      const next = recordInterruption(prev);
      historyStore.save(next);
      return next;
    });
  }, [canLog, setHistory]);

  return { todayCount: todayInterruptions(history), canLog, log };
}
