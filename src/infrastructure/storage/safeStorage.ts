/**
 * Safe wrapper around Web Storage API (localStorage).
 * Gracefully falls back to in-memory key-value store if storage is restricted
 * (e.g. private browsing, security sandbox, or SSR/Node environment).
 */
const memoryStore = new Map<string, string>();

function getStorage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    /* access denied */
  }
  return null;
}

export const safeStorage = {
  getItem(key: string): string | null {
    const storage = getStorage();
    if (storage) {
      try {
        return storage.getItem(key);
      } catch {
        /* fallback to memory */
      }
    }
    return memoryStore.get(key) ?? null;
  },

  setItem(key: string, value: string): void {
    const storage = getStorage();
    if (storage) {
      try {
        storage.setItem(key, value);
        return;
      } catch {
        /* quota exceeded or access denied */
      }
    }
    memoryStore.set(key, value);
  },

  removeItem(key: string): void {
    const storage = getStorage();
    if (storage) {
      try {
        storage.removeItem(key);
      } catch {
        /* ignore */
      }
    }
    memoryStore.delete(key);
  },

  clearMemory(): void {
    memoryStore.clear();
  },
};
