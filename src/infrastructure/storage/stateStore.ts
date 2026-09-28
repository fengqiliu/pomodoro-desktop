import { defaultState, mergeState, type PersistedState } from "../../domain/settings";
import type { StateStore } from "../../application/ports";
import { STATE_KEY } from "./keys";
import { safeStorage } from "./safeStorage";

/** localStorage-backed store for the core persisted state. */
export const stateStore: StateStore = {
  load() {
    try {
      const raw = safeStorage.getItem(STATE_KEY);
      if (!raw) return defaultState();
      return mergeState(JSON.parse(raw) as Partial<PersistedState>);
    } catch {
      return defaultState();
    }
  },

  save(state) {
    try {
      safeStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable — best effort */
    }
  },
};

