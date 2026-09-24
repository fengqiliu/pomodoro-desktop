import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { DEFAULT_SETTINGS, type NoisePref, type Settings } from "../../domain/settings";
import type { HotkeyError } from "./useHotkey";

interface Options {
  settings: Settings;
  setSettings: Dispatch<SetStateAction<Settings>>;
  setNoise: Dispatch<SetStateAction<NoisePref>>;
  setHotkeyError: Dispatch<SetStateAction<HotkeyError>>;
  /** engine reset — restart the current phase at its configured duration */
  resetTimer: () => Promise<void>;
}

// Settings modal state: open/close, hotkey draft (validated on confirm only),
// and reset-to-defaults. The hotkey is applied to settings only on save.
export function useSettingsDialog({
  settings,
  setSettings,
  setNoise,
  setHotkeyError,
  resetTimer,
}: Options) {
  const [showSettings, setShowSettings] = useState(false);
  const [hotkeyDraft, setHotkeyDraft] = useState(settings.hotkey);

  const changeHotkeyDraft = useCallback(
    (v: string) => {
      setHotkeyDraft(v);
      setHotkeyError(null);
    },
    [setHotkeyError]
  );

  // ---- phase/settings controls ----
  const resetSettings = useCallback(() => {
    void resetTimer();
    setSettings((current) => ({ ...current, ...DEFAULT_SETTINGS }));
    setHotkeyDraft(DEFAULT_SETTINGS.hotkey);
    setHotkeyError(null);
    setNoise((n) => ({ on: n.on, type: DEFAULT_SETTINGS.noiseType, volume: DEFAULT_SETTINGS.noiseVolume }));
  }, [resetTimer, setSettings, setHotkeyError, setNoise]);

  const openSettings = useCallback(() => {
    setHotkeyDraft(settings.hotkey);
    setShowSettings(true);
  }, [settings.hotkey]);

  const closeSettings = useCallback(() => setShowSettings(false), []);

  const saveSettings = useCallback(() => {
    const hotkey = hotkeyDraft.trim();
    if (!hotkey) {
      setHotkeyError("empty");
      return;
    }
    setSettings((current) => (current.hotkey === hotkey ? current : { ...current, hotkey }));
    setHotkeyError(null);
    setShowSettings(false);
  }, [hotkeyDraft, setSettings, setHotkeyError]);

  return {
    showSettings,
    hotkeyDraft,
    changeHotkeyDraft,
    openSettings,
    closeSettings,
    resetSettings,
    saveSettings,
  };
}