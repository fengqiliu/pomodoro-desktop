import { mergeState, type PersistedState } from "../domain/settings";
import { pruneHistory, type History } from "../domain/stats";

const BACKUP_APP_ID = "pomodoro";
const BACKUP_VERSION = 2;

interface BackupPayload {
  app: string;
  version: number;
  exportedAt: string;
  state: unknown;
  history: unknown;
}

export function buildBackup(state: PersistedState, history: History): string {
  const payload: BackupPayload = {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    state,
    history,
  };
  return JSON.stringify(payload, null, 2);
}

// Validates a backup string and returns the state/history ready to persist.
// State is re-merged over defaults and the history pruned, so a hand-edited or
// older backup cannot poison the store.
export function parseBackup(
  text: string,
  now = new Date()
): { state: PersistedState; history: History } | null {
  try {
    const payload = JSON.parse(text) as Partial<BackupPayload>;
    if (payload.app !== BACKUP_APP_ID) return null;
    if (typeof payload.state !== "object" || payload.state === null) return null;
    if (typeof payload.history !== "object" || payload.history === null) return null;
    return {
      state: mergeState(payload.state as Partial<PersistedState>),
      history: pruneHistory(payload.history as History, 60, now),
    };
  } catch {
    return null;
  }
}
