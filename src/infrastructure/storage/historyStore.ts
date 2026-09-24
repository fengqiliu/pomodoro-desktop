import type { History } from "../../domain/stats";
import type { HistoryStore } from "../../application/ports";
import { HISTORY_KEY } from "./keys";

/** localStorage-backed store for the focus history. */
export const historyStore: HistoryStore = {
  load() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) return JSON.parse(raw) as History;
    } catch {
      /* ignore */
    }
    return {};
  },

  save(history) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      /* ignore */
    }
  },
};
