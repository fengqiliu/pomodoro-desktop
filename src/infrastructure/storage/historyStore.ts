import type { History } from "../../domain/stats";
import type { HistoryStore } from "../../application/ports";
import { HISTORY_KEY } from "./keys";
import { safeStorage } from "./safeStorage";

/** localStorage-backed store for the focus history. */
export const historyStore: HistoryStore = {
  load() {
    try {
      const raw = safeStorage.getItem(HISTORY_KEY);
      if (raw) return JSON.parse(raw) as History;
    } catch {
      /* ignore */
    }
    return {};
  },

  save(history) {
    try {
      safeStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      /* ignore */
    }
  },
};

