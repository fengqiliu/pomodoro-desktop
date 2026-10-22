import type { TrayPort } from "../../application/ports";
import { isDesktop, loadCore } from "./runtime";

/** Tauri tray adapter — updates the tray icon hover text. No-ops in the browser. */
export const trayAdapter: TrayPort = {
  async setTooltip(text) {
    if (!isDesktop()) return;
    try {
      const { invoke } = await loadCore();
      await invoke("set_tray_tooltip", { text });
    } catch {
      /* tooltip is cosmetic; failing to update it must not affect the timer */
    }
  },
};
