import { useCallback, useEffect, useRef, useState } from "react";
import { isDesktop, nativeTimerAdapter } from "../../infrastructure/platform";
import type { NativeTimerNotification } from "../../application/ports";
import {
  nextPhaseAfterSkip,
  remainingSeconds,
  type Phase,
} from "../../domain/timer";

export interface PhaseCompletion {
  nextPhase: Phase;
  nextSeconds: number;
  autoStart: boolean;
}

export interface PomodoroEngine {
  phase: Phase;
  secondsLeft: number;
  running: boolean;
  toggle: () => Promise<void>;
  reset: () => Promise<void>;
  /** switch to a phase immediately, discarding the running countdown */
  switchTo: (phase: Phase) => Promise<void>;
  /** advance to the next phase without recording a completed focus */
  skip: () => Promise<void>;
  /** while idle/paused, realign the countdown to the phase's configured duration */
  syncIfIdle: () => void;
}

interface Options {
  getPhaseSeconds: (phase: Phase) => number;
  /** native worker sends this when the countdown expires (desktop only) */
  getCompletionNotification: () => NativeTimerNotification | undefined;
  /** business end-of-phase: chime, stats, tasks, notifications. Returns what to run next. */
  onPhaseComplete: (
    finished: Phase,
    nativeNotificationSent: boolean
  ) => PhaseCompletion | Promise<PhaseCompletion>;
  initialPhase?: Phase;
}

// Owns the countdown mechanics only: wall-clock deadline, native timer bridge,
// generation-based cancellation and the 1s paint loop. Business rules for what
// happens when a phase completes live in `options.onPhaseComplete`.
export function usePomodoroEngine(options: Options): PomodoroEngine {
  const initialPhase = options.initialPhase ?? "focus";

  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [secondsLeft, setSecondsLeft] = useState(() => options.getPhaseSeconds(initialPhase));
  const [running, setRunning] = useState(false);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const secondsLeftRef = useRef(secondsLeft);
  secondsLeftRef.current = secondsLeft;
  const runningRef = useRef(running);
  runningRef.current = running;

  // Wall-clock end timestamp for the running countdown. Recomputed when (re)starting;
  // the tick derives remaining time from this so setInterval jitter / background
  // throttling can't drift the timer over a long session.
  const endAtRef = useRef<number | null>(null);
  const nativeTimerListenerReadyRef = useRef(false);
  const nativeTimerRunningRef = useRef(false);
  const nativeTimerGenerationRef = useRef<number | null>(null);
  const completionInFlightRef = useRef(false);
  const countdownActionRef = useRef(0);
  // The global hotkey can double-fire; serialize start/pause transitions.
  const toggleInFlightRef = useRef(false);

  const beginCountdown = useCallback(async (durationSeconds: number) => {
    const action = ++countdownActionRef.current;
    const seconds = Math.max(1, Math.round(durationSeconds));
    let nativeStarted = false;

    if (isDesktop() && nativeTimerListenerReadyRef.current) {
      const snapshot = await nativeTimerAdapter.start(seconds, optionsRef.current.getCompletionNotification());
      if (action !== countdownActionRef.current) {
        if (snapshot) void nativeTimerAdapter.cancel(snapshot.generation);
        return;
      }
      if (snapshot) {
        nativeTimerGenerationRef.current = snapshot.generation;
        nativeStarted = snapshot.running;
      }
    }

    nativeTimerRunningRef.current = nativeStarted;
    secondsLeftRef.current = seconds;
    endAtRef.current = Date.now() + seconds * 1000;
    runningRef.current = true;
    setSecondsLeft(seconds);
    setRunning(true);
  }, []);

  const completeCurrentPhase = useCallback(async (nativeNotificationSent = false) => {
    if (completionInFlightRef.current) return;
    completionInFlightRef.current = true;
    runningRef.current = false;
    nativeTimerRunningRef.current = false;
    setRunning(false);

    try {
      const finished = phaseRef.current;
      const result = await optionsRef.current.onPhaseComplete(finished, nativeNotificationSent);

      const nextSeconds = Math.max(1, Math.round(result.nextSeconds));
      phaseRef.current = result.nextPhase;
      secondsLeftRef.current = nextSeconds;
      setPhase(result.nextPhase);
      setSecondsLeft(nextSeconds);

      if (result.autoStart) {
        await beginCountdown(nextSeconds);
      } else {
        endAtRef.current = null;
      }
    } finally {
      completionInFlightRef.current = false;
    }
  }, [beginCountdown]);

  useEffect(() => {
    if (!isDesktop()) return;
    let cancelled = false;
    let stopListening: (() => void) | null = null;

    nativeTimerAdapter.listenCompleted((completion) => {
      if (completion.generation !== nativeTimerGenerationRef.current) return;
      nativeTimerGenerationRef.current = null;
      nativeTimerRunningRef.current = false;
      void completeCurrentPhase(completion.notificationSent);
    })
      .then((unlisten) => {
        if (cancelled) {
          unlisten();
          return;
        }
        stopListening = unlisten;
        nativeTimerListenerReadyRef.current = true;
      })
      .catch(() => {
        nativeTimerListenerReadyRef.current = false;
      });

    return () => {
      cancelled = true;
      nativeTimerListenerReadyRef.current = false;
      nativeTimerGenerationRef.current = null;
      nativeTimerRunningRef.current = false;
      stopListening?.();
      void nativeTimerAdapter.cancel();
    };
  }, [completeCurrentPhase]);

  // Rust owns desktop completion timing; this loop only paints the countdown.
  // Browser mode uses the same wall-clock calculation and completes locally.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const remaining = remainingSeconds(endAtRef.current!, Date.now());
      secondsLeftRef.current = remaining;
      setSecondsLeft(remaining);
      if (remaining <= 0 && !nativeTimerRunningRef.current) {
        void completeCurrentPhase();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [running, completeCurrentPhase]);

  const pauseCountdown = useCallback(async () => {
    const action = ++countdownActionRef.current;
    nativeTimerGenerationRef.current = null;
    let remaining = endAtRef.current
      ? remainingSeconds(endAtRef.current, Date.now())
      : secondsLeftRef.current;

    if (nativeTimerRunningRef.current) {
      const snapshot = await nativeTimerAdapter.pause();
      if (action !== countdownActionRef.current) return;
      if (snapshot) remaining = Math.ceil(snapshot.remainingMs / 1000);
    }

    nativeTimerRunningRef.current = false;
    runningRef.current = false;
    endAtRef.current = null;
    if (remaining <= 0) {
      await completeCurrentPhase();
      return;
    }
    secondsLeftRef.current = remaining;
    setSecondsLeft(remaining);
    setRunning(false);
  }, [completeCurrentPhase]);

  const cancelCountdown = useCallback(async () => {
    countdownActionRef.current += 1;
    nativeTimerGenerationRef.current = null;
    nativeTimerRunningRef.current = false;
    runningRef.current = false;
    endAtRef.current = null;
    setRunning(false);
    await nativeTimerAdapter.cancel();
  }, []);

  const toggle = useCallback(async () => {
    if (toggleInFlightRef.current) return;
    toggleInFlightRef.current = true;
    try {
      if (runningRef.current) await pauseCountdown();
      else await beginCountdown(secondsLeftRef.current);
    } finally {
      toggleInFlightRef.current = false;
    }
  }, [beginCountdown, pauseCountdown]);

  const reset = useCallback(async () => {
    await cancelCountdown();
    const nextSeconds = optionsRef.current.getPhaseSeconds(phaseRef.current);
    secondsLeftRef.current = nextSeconds;
    setSecondsLeft(nextSeconds);
  }, [cancelCountdown]);

  const switchTo = useCallback(
    async (p: Phase) => {
      await cancelCountdown();
      phaseRef.current = p;
      setPhase(p);
      const nextSeconds = optionsRef.current.getPhaseSeconds(p);
      secondsLeftRef.current = nextSeconds;
      setSecondsLeft(nextSeconds);
    },
    [cancelCountdown]
  );

  const skip = useCallback(async () => {
    await cancelCountdown();
    const np = nextPhaseAfterSkip(phaseRef.current);
    phaseRef.current = np;
    setPhase(np);
    const nextSeconds = optionsRef.current.getPhaseSeconds(np);
    secondsLeftRef.current = nextSeconds;
    setSecondsLeft(nextSeconds);
  }, [cancelCountdown]);

  // When the current phase's duration changes while paused, keep secondsLeft in
  // sync so the ring and countdown reflect the new length. A running session is
  // left untouched (don't silently stretch/shrink an in-progress timer).
  const syncIfIdle = useCallback(() => {
    if (runningRef.current) return;
    const configuredSeconds = optionsRef.current.getPhaseSeconds(phaseRef.current);
    secondsLeftRef.current = configuredSeconds;
    setSecondsLeft(configuredSeconds);
  }, []);

  return {
    phase,
    secondsLeft,
    running,
    toggle,
    reset,
    switchTo,
    skip,
    syncIfIdle,
  };
}
