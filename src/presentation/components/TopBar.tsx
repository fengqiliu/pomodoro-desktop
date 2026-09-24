import { NOISE_KEY } from "../i18n";
import type { NoisePref } from "../../domain/settings";
import type { Theme } from "../uiTypes";

interface Props {
  tr: (key: string, params?: Record<string, string | number>) => string;
  theme: Theme;
  pinned: boolean;
  noise: NoisePref;
  onToggleNoise: () => void;
  onToggleTheme: () => void;
  onTogglePin: () => void;
  onOpenSettings: () => void;
}

export function TopBar({
  tr,
  theme,
  pinned,
  noise,
  onToggleNoise,
  onToggleTheme,
  onTogglePin,
  onOpenSettings,
}: Props) {
  return (
    <div className="window-controls">
      <div className="brand">
        <span className="brand-dot" />
        <span className="brand-name">Pomodoro</span>
      </div>
      <div className="ctrl-cluster">
        <button
          className={noise.on ? "icon-btn active-noise" : "icon-btn"}
          onClick={onToggleNoise}
          aria-label={tr("top.noise")}
          title={noise.on ? tr("top.noise.on", { type: tr(NOISE_KEY[noise.type]) }) : tr("top.noise")}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <button
          className="icon-btn"
          onClick={onToggleTheme}
          aria-label={tr("top.theme.toDark")}
          title={theme === "dark" ? tr("top.theme.toLight") : tr("top.theme.toDark")}
        >
          {theme === "dark" ? (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M12 2.5v2.2M12 19.3v2.2M4.5 4.5l1.6 1.6M17.9 17.9l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.5 19.5l1.6-1.6M17.9 6.1l1.6-1.6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path
                d="M20 14.5A8 8 0 119.5 4 6.5 6.5 0 0020 14.5z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
        <button
          className={pinned ? "icon-btn active-pin" : "icon-btn"}
          onClick={onTogglePin}
          aria-label={tr("top.pin")}
          title={pinned ? tr("top.unpin") : tr("top.pin")}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 4h6l-1 6 3.5 2.5-.5 1.5H13v6l-1 1-1-1v-6H7l-.5-1.5L9 10 9 4z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
              fill={pinned ? "currentColor" : "none"}
            />
          </svg>
        </button>
        <button className="icon-btn" onClick={onOpenSettings} aria-label={tr("top.settings")} title={tr("top.settings")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M19.4 13a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
