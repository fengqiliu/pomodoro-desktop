import { useEffect, useRef } from "react";
import { getMillisUntilNextMidnight } from "../../shared/date";

/**
 * Triggers `onRollover` whenever a calendar day boundary is crossed:
 * 1. Exactly at midnight via recursive timeout.
 * 2. Whenever window receives focus (e.g. computer wakes from sleep).
 * 3. Whenever document visibility transitions to "visible".
 */
export function useMidnightRollover(onRollover: () => void) {
  const onRolloverRef = useRef(onRollover);
  onRolloverRef.current = onRollover;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const fire = () => {
      onRolloverRef.current();
    };

    const onWindowFocus = () => fire();
    const onVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fire();
      }
    };

    let midnightTimer: number | null = null;
    const schedule = () => {
      const ms = getMillisUntilNextMidnight();
      midnightTimer = window.setTimeout(() => {
        fire();
        schedule();
      }, ms);
    };

    schedule();
    window.addEventListener("focus", onWindowFocus);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    return () => {
      if (midnightTimer !== null) {
        window.clearTimeout(midnightTimer);
      }
      window.removeEventListener("focus", onWindowFocus);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
  }, []);
}
