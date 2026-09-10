// Thin platform abstraction: real Tauri calls in desktop, no-ops in browser.
// The @tauri-apps/* imports are only resolved by Vite in the desktop build;
// in a plain browser they'd fail to resolve at runtime, so we dynamic-import
// them lazily and guard with a feature check.

export function isDesktop(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

let winApi: typeof import("@tauri-apps/api/window") | null = null;
let shortcutApi: typeof import("@tauri-apps/plugin-global-shortcut") | null = null;
let notifApi: typeof import("@tauri-apps/plugin-notification") | null = null;
let coreApi: typeof import("@tauri-apps/api/core") | null = null;
let eventApi: typeof import("@tauri-apps/api/event") | null = null;

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

async function loadWin() {
  if (!winApi) winApi = await import("@tauri-apps/api/window");
  return winApi;
}

async function loadShortcut() {
  if (!shortcutApi)
    shortcutApi = await import("@tauri-apps/plugin-global-shortcut");
  return shortcutApi;
}

async function loadNotif() {
  if (!notifApi)
    notifApi = await import("@tauri-apps/plugin-notification");
  return notifApi;
}

async function loadNativeTimer() {
  if (!coreApi || !eventApi) {
    [coreApi, eventApi] = await Promise.all([
      import("@tauri-apps/api/core"),
      import("@tauri-apps/api/event"),
    ]);
  }
  return { core: coreApi!, event: eventApi! };
}

export async function setAlwaysOnTop(on: boolean): Promise<void> {
  if (!isDesktop()) return;
  const { getCurrentWindow } = await loadWin();
  await getCurrentWindow().setAlwaysOnTop(on);
}

export async function isAlwaysOnTop(): Promise<boolean> {
  if (!isDesktop()) return false;
  const { getCurrentWindow } = await loadWin();
  try {
    return await getCurrentWindow().isAlwaysOnTop();
  } catch {
    return false;
  }
}

export async function registerShortcut(
  keys: string,
  handler: () => void
): Promise<boolean> {
  if (!isDesktop() || !keys) return false;
  const { register, unregister } = await loadShortcut();
  try {
    await unregister(keys);
    await register(keys, handler);
    return true;
  } catch {
    return false;
  }
}

export async function unregisterShortcut(keys: string): Promise<void> {
  if (!isDesktop() || !keys) return;
  const { unregister } = await loadShortcut();
  try {
    await unregister(keys);
  } catch {
    /* ignore */
  }
}

export async function startNativeTimer(
  seconds: number,
  notification?: NativeTimerNotification
): Promise<NativeTimerSnapshot | null> {
  if (!isDesktop()) return null;
  try {
    const { core } = await loadNativeTimer();
    return await core.invoke<NativeTimerSnapshot>("native_timer_start", {
      durationMs: Math.max(1, Math.round(seconds * 1000)),
      notification: notification ?? null,
    });
  } catch {
    return null;
  }
}

export async function pauseNativeTimer(): Promise<NativeTimerSnapshot | null> {
  if (!isDesktop()) return null;
  try {
    const { core } = await loadNativeTimer();
    return await core.invoke<NativeTimerSnapshot>("native_timer_pause");
  } catch {
    return null;
  }
}

export async function cancelNativeTimer(
  expectedGeneration?: number
): Promise<NativeTimerSnapshot | null> {
  if (!isDesktop()) return null;
  try {
    const { core } = await loadNativeTimer();
    return await core.invoke<NativeTimerSnapshot>("native_timer_cancel", {
      generation: expectedGeneration ?? null,
    });
  } catch {
    /* native timer cancellation is best-effort during shutdown/reset */
    return null;
  }
}

export async function listenNativeTimerCompleted(
  handler: (completion: NativeTimerCompletion) => void
): Promise<() => void> {
  if (!isDesktop()) return () => {};
  const { event } = await loadNativeTimer();
  return event.listen<NativeTimerCompletion>("native-timer-completed", ({ payload }) => {
    handler(payload);
  });
}

// Best-effort native phase-complete notification. Permission is requested inside
// (on first enabled send), so macOS shows the system prompt only when needed.
// No-op in the browser.
export async function notifyPhaseDone(title: string, body: string): Promise<void> {
  if (!isDesktop()) return;
  try {
    const { isPermissionGranted, requestPermission, sendNotification } = await loadNotif();
    let granted = await isPermissionGranted();
    if (!granted) granted = (await requestPermission()) === "granted";
    if (!granted) return;
    sendNotification({ title, body });
  } catch {
    /* notifications are best-effort */
  }
}
