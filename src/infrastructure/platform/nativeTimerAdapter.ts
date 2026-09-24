import type { NativeTimerCompletion, NativeTimerPort } from "../../application/ports";
import { isDesktop, loadNativeTimer } from "./runtime";

/** Rust native-timer bridge — returns null in the browser so callers fall back
 *  to the JS wall-clock countdown. */
export const nativeTimerAdapter: NativeTimerPort = {
  async start(seconds, notification) {
    if (!isDesktop()) return null;
    try {
      const { core } = await loadNativeTimer();
      return await core.invoke("native_timer_start", {
        durationMs: Math.max(1, Math.round(seconds * 1000)),
        notification: notification ?? null,
      });
    } catch {
      return null;
    }
  },

  async pause() {
    if (!isDesktop()) return null;
    try {
      const { core } = await loadNativeTimer();
      return await core.invoke("native_timer_pause");
    } catch {
      return null;
    }
  },

  async cancel(expectedGeneration) {
    if (!isDesktop()) return null;
    try {
      const { core } = await loadNativeTimer();
      return await core.invoke("native_timer_cancel", {
        generation: expectedGeneration ?? null,
      });
    } catch {
      /* native timer cancellation is best-effort during shutdown/reset */
      return null;
    }
  },

  async listenCompleted(handler) {
    if (!isDesktop()) return () => {};
    const { event } = await loadNativeTimer();
    return event.listen<NativeTimerCompletion>("native-timer-completed", ({ payload }) => {
      handler(payload);
    });
  },
};
