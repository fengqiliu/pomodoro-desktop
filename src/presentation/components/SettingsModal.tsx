import { useEffect } from "react";
import { LANGS, type Lang } from "../i18n";
import type { NoisePref, NoiseType, Settings } from "../../domain/settings";

interface Props {
  tr: (key: string, params?: Record<string, string | number>) => string;
  lang: Lang;
  onLangChange: (l: Lang) => void;
  settings: Settings;
  onSettingsChange: (updater: (s: Settings) => Settings) => void;
  noise: NoisePref;
  onNoiseChange: (updater: (n: NoisePref) => NoisePref) => void;
  hotkeyDraft: string;
  onHotkeyDraftChange: (v: string) => void;
  hotkeyError: "empty" | "registration" | null;
  onClose: () => void;
  onReset: () => void;
  onDone: () => void;
  onExport: () => void;
  onImport: () => void;
}

function Switch({
  on,
  onToggle,
  label,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button className={on ? "switch on" : "switch"} onClick={onToggle} aria-label={label}>
      <span className="switch-knob" />
    </button>
  );
}

export function SettingsModal({
  tr,
  lang,
  onLangChange,
  settings,
  onSettingsChange,
  noise,
  onNoiseChange,
  hotkeyDraft,
  onHotkeyDraftChange,
  hotkeyError,
  onClose,
  onReset,
  onDone,
  onExport,
  onImport,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span>{tr("settings.title")}</span>
          <button className="icon-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="field-divider">{tr("settings.section.general")}</div>
          <label className="field">
            <span>{tr("settings.language")}</span>
            <select className="select" value={lang} onChange={(e) => onLangChange(e.target.value as Lang)}>
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{tr("settings.focus")}</span>
            <input
              type="number"
              min="1"
              max="120"
              value={settings.focus}
              onChange={(e) => onSettingsChange((s) => ({ ...s, focus: Number(e.target.value) || 1 }))}
            />
          </label>
          <label className="field">
            <span>{tr("settings.short")}</span>
            <input
              type="number"
              min="1"
              max="60"
              value={settings.short}
              onChange={(e) => onSettingsChange((s) => ({ ...s, short: Number(e.target.value) || 1 }))}
            />
          </label>
          <label className="field">
            <span>{tr("settings.long")}</span>
            <input
              type="number"
              min="1"
              max="60"
              value={settings.long}
              onChange={(e) => onSettingsChange((s) => ({ ...s, long: Number(e.target.value) || 1 }))}
            />
          </label>
          <label className="field">
            <span>{tr("settings.longEvery")}</span>
            <input
              type="number"
              min="2"
              max="10"
              value={settings.longEvery}
              onChange={(e) => onSettingsChange((s) => ({ ...s, longEvery: Number(e.target.value) || 4 }))}
            />
          </label>
          <label className="field switch-field">
            <span>{tr("settings.sound")}</span>
            <Switch
              on={settings.sound}
              onToggle={() => onSettingsChange((s) => ({ ...s, sound: !s.sound }))}
              label={tr("settings.sound")}
            />
          </label>
          <label className="field switch-field">
            <span>{tr("settings.notifications")}</span>
            <Switch
              on={settings.notifications}
              onToggle={() => onSettingsChange((s) => ({ ...s, notifications: !s.notifications }))}
              label={tr("settings.notifications")}
            />
          </label>
          <label className="field switch-field">
            <span>{tr("settings.autoStartBreaks")}</span>
            <Switch
              on={settings.autoStartBreaks}
              onToggle={() => onSettingsChange((s) => ({ ...s, autoStartBreaks: !s.autoStartBreaks }))}
              label={tr("settings.autoStartBreaks")}
            />
          </label>
          <label className="field switch-field">
            <span>{tr("settings.autoStartFocus")}</span>
            <Switch
              on={settings.autoStartFocus}
              onToggle={() => onSettingsChange((s) => ({ ...s, autoStartFocus: !s.autoStartFocus }))}
              label={tr("settings.autoStartFocus")}
            />
          </label>

          <div className="field-divider">{tr("settings.section.noise")}</div>
          <label className="field">
            <span>{tr("settings.noiseType")}</span>
            <select
              className="select"
              value={noise.type}
              onChange={(e) => onNoiseChange((n) => ({ ...n, type: e.target.value as NoiseType }))}
            >
              <option value="brown">{tr("settings.noiseType.brown")}</option>
              <option value="white">{tr("settings.noiseType.white")}</option>
              <option value="pink">{tr("settings.noiseType.pink")}</option>
            </select>
          </label>
          <label className="field">
            <span>{tr("settings.volume")}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={noise.volume}
              onChange={(e) => onNoiseChange((n) => ({ ...n, volume: Number(e.target.value) }))}
              className="range"
            />
          </label>

          <div className="field-divider">{tr("settings.section.hotkey")}</div>
          <label className="field">
            <span>{tr("settings.hotkey.startPause")}</span>
            <input
              type="text"
              className="hotkey-input"
              value={hotkeyDraft}
              onChange={(e) => {
                onHotkeyDraftChange(e.target.value);
              }}
              placeholder="CommandOrControl+Shift+P"
            />
          </label>
          <div className="field-hint">
            {tr("settings.hotkey.hint")}
            <code>CommandOrControl+Shift+P</code>
          </div>
          {hotkeyError && (
            <div className="field-error" role="alert">
              {tr(`settings.hotkey.error.${hotkeyError}`)}
            </div>
          )}

          <div className="field-divider">{tr("settings.section.data")}</div>
          <div className="data-actions">
            <button className="ghost-btn" onClick={onExport}>
              {tr("settings.export")}
            </button>
            <button className="ghost-btn" onClick={onImport}>
              {tr("settings.import")}
            </button>
          </div>
        </div>
        <div className="modal-foot">
          <button className="ghost-btn" onClick={onReset}>
            {tr("settings.reset")}
          </button>
          <button className="primary-btn" onClick={onDone}>
            {tr("settings.done")}
          </button>
        </div>
      </div>
    </div>
  );
}
