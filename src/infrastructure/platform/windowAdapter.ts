import type { WindowPort } from "../../application/ports";
import { isDesktop, loadWin } from "./runtime";

/** Tauri window adapter — always-on-top control. No-ops in the browser. */
export const windowAdapter: WindowPort = {
  async setAlwaysOnTop(on) {
    if (!isDesktop()) return;
    const { getCurrentWindow } = await loadWin();
    await getCurrentWindow().setAlwaysOnTop(on);
  },

  async isAlwaysOnTop() {
    if (!isDesktop()) return false;
    const { getCurrentWindow } = await loadWin();
    try {
      return await getCurrentWindow().isAlwaysOnTop();
    } catch {
      return false;
    }
  },
};
