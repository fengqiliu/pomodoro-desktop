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
