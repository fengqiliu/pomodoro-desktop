// Runtime detection and lazy Tauri API loading.
// The @tauri-apps/* imports are only resolvable in the desktop build; in a
// plain browser they'd fail at runtime, so every adapter dynamic-imports its
// module lazily and guards with isDesktop().

export function isDesktop(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

let winApi: typeof import("@tauri-apps/api/window") | null = null;
let shortcutApi: typeof import("@tauri-apps/plugin-global-shortcut") | null = null;
let notifApi: typeof import("@tauri-apps/plugin-notification") | null = null;
let coreApi: typeof import("@tauri-apps/api/core") | null = null;
let eventApi: typeof import("@tauri-apps/api/event") | null = null;

export async function loadWin() {
  if (!winApi) winApi = await import("@tauri-apps/api/window");
  return winApi;
}

export async function loadShortcut() {
  if (!shortcutApi)
    shortcutApi = await import("@tauri-apps/plugin-global-shortcut");
  return shortcutApi;
}

export async function loadNotif() {
  if (!notifApi) notifApi = await import("@tauri-apps/plugin-notification");
  return notifApi;
}

export async function loadNativeTimer() {
  if (!coreApi || !eventApi) {
    [coreApi, eventApi] = await Promise.all([
      import("@tauri-apps/api/core"),
      import("@tauri-apps/api/event"),
    ]);
  }
  return { core: coreApi!, event: eventApi! };
}
