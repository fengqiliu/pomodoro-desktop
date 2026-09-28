import { LANG_KEY, PIN_KEY, THEME_KEY } from "./keys";
import { safeStorage } from "./safeStorage";

export interface PreferenceStore {
  getTheme(): string | null;
  setTheme(theme: string): void;
  getPinned(): boolean;
  setPinned(pinned: boolean): void;
  getLanguage(): string | null;
  setLanguage(lang: string): void;
}

export const preferenceStore: PreferenceStore = {
  getTheme() {
    return safeStorage.getItem(THEME_KEY);
  },
  setTheme(theme) {
    safeStorage.setItem(THEME_KEY, theme);
  },
  getPinned() {
    return safeStorage.getItem(PIN_KEY) === "1";
  },
  setPinned(pinned) {
    safeStorage.setItem(PIN_KEY, pinned ? "1" : "0");
  },
  getLanguage() {
    return safeStorage.getItem(LANG_KEY);
  },
  setLanguage(lang) {
    safeStorage.setItem(LANG_KEY, lang);
  },
};
