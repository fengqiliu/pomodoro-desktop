import { defaultState, mergeState, type PersistedState } from "../../domain/settings";
import type { StateStore } from "../../application/ports";
import { STATE_KEY } from "./keys";

/** localStorage-backed store for the core persisted state. */
export const stateStore: StateStore = {
  load() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (!raw) return defaultState();
      return mergeState(JSON.parse(raw) as Partial<PersistedState>);
    } catch {
      return defaultState();
    }
  },

  save(state) {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable — best effort */
    }
  },
};
