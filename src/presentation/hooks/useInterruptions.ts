import { useCallback, type Dispatch, type SetStateAction } from "react";
import {
  recordInterruption,
  todayInterruptions,
  type History,
  type InterruptionKind,
} from "../../domain/stats";
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

// Focus interruption log: today's internal/external counts, whether logging is allowed right now,
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

  const log = useCallback(
    (kind: InterruptionKind) => {
      if (!canLog) return;
      setHistory((prev) => {
        const next = recordInterruption(prev, kind);
        historyStore.save(next);
        return next;
      });
    },
    [canLog, setHistory]
  );

  return { today: todayInterruptions(history), canLog, log };
}
