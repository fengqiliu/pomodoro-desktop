import type { ShortcutPort } from "../../application/ports";
import { isDesktop, loadShortcut } from "./runtime";

/** Global shortcut adapter — no-ops in the browser. */
export const shortcutAdapter: ShortcutPort = {
  async register(keys, handler) {
    if (!isDesktop() || !keys) return false;
    const { register, unregister } = await loadShortcut();
    try {
      await unregister(keys);
      await register(keys, handler);
      return true;
    } catch {
      return false;
    }
  },

  async unregister(keys) {
    if (!isDesktop() || !keys) return;
    const { unregister } = await loadShortcut();
    try {
      await unregister(keys);
    } catch {
      /* ignore */
    }
  },
};
