# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-window Tauri 2 desktop Pomodoro timer (380×580, non-resizable). React 18 + TypeScript + Vite frontend; a thin Rust/Tauri shell that adds no custom commands — every native capability is invoked from JS via Tauri plugin APIs. Default language is Chinese (`zh`); English is also bundled.

## Commands

```bash
npm install
npm run dev          # Vite dev server only — port 1420 (strictPort; Tauri expects this). Works in a plain browser too (see platform.ts).
npm test             # Vitest regression tests for pure timer rules
npm run typecheck    # tsc --noEmit
npm run build        # tsc -b && vite build  →  dist/
npm run preview      # serve the built dist/

npm run tauri dev    # full app: launches Vite (beforeDevCommand) + native window
npm run tauri build  # bundled desktop app (runs npm run build first via beforeBuildCommand)
npx tauri build --bundles nsis  # rebuild only the NSIS .exe (faster when Rust is cached)
```

Vitest covers the pure timer rules in `src/timer/timerRules.test.ts`; there is no linter configured. `npm run typecheck` remains the TypeScript static check.

Regenerate the app icon set (needs Pillow): `python3 gen_icons.py` → writes `src-tauri/icons/`.

## Architecture

### Frontend is one file (`src/App.tsx`, ~900 lines)
The entire UI lives in `App.tsx` — timer ring, tasks list, 7-day stats chart, and the settings modal. No router, no state library: state is `useState`/`useRef` plus `localStorage` persistence. Three tabs (`timer` | `tasks` | `stats`) are conditionally rendered. When adding a feature, expect to touch this one file rather than split it; the surrounding code is deliberately consolidated.

### `platform.ts` — the browser/desktop abstraction (important)
The app must run both as a Tauri desktop window *and* in a plain browser during UI iteration. `@tauri-apps/*` imports would fail to resolve at runtime in a browser, so `platform.ts`:
- Detects desktop via `"__TAURI_INTERNALS__" in window` (`isDesktop()`).
- **Lazy dynamic-imports** the Tauri APIs (`@tauri-apps/api/window`, `@tauri-apps/plugin-global-shortcut`) only when `isDesktop()`, then caches the module.
- Exposes `setAlwaysOnTop` / `isAlwaysOnTop` / `registerShortcut` / `unregisterShortcut` that no-op in the browser.

Always go through `platform.ts`; never import `@tauri-apps/*` directly from `App.tsx` or it breaks browser dev.

### `noise.ts` — WebAudio, no audio assets
Generates white/brown/pink noise procedurally into a 2s `AudioBuffer` that loops, with a controllable `GainNode`. `setType()` rebuilds the buffer gap-free while playing. `App.tsx` owns one `NoiseEngine` instance in a `useRef`. The completion chime (`playChime`) is a separate short oscillator sequence, not part of the engine.

### `i18n.ts` — hand-rolled, no library
A flat `DICT` mapping keys to `[zh, en]` tuples, plus `translate(lang, key, params)` with `{param}` interpolation and `weekdayLabel(lang, dayIndex)`. To add a language: extend the `Lang` type, add it to `LANGS`, and add a third tuple element (then update `INDEX`). Keys are referenced throughout `App.tsx` via the `tr()` callback.

### State, persistence, and daily reset
Everything persists to versioned `localStorage` keys (defined at the top of `App.tsx`):
- `pomodoro-state-v3` — settings, tasks, daily progress (`completedToday`, `focusMinutesToday`, `date`), `cycleFocusCount`, and `noise`.
- `pomodoro-history-v1` — `Record<dateKey, DayRecord>` powering the 7-day chart.
- `pomodoro-theme`, `pomodoro-pinned`, `pomodoro-lang`.

`loadState()` merges stored state over `DEFAULT_SETTINGS` and **resets `completedToday`/`focusMinutesToday` to 0 when the stored `date` != today**. Runtime guards repeat that check at midnight, on focus/visibility restoration, before a completed focus is recorded, and before persistence. `cycleFocusCount` is independent from the daily statistics and resets only after a long break is due. When changing persisted state shapes, bump the key suffix rather than migrating.

### Timer tick
`setInterval(…, 1000)` runs only while `running`. The interval closure reads fresh values through refs (`settingsRef`, `runningRef`) rather than re-subscribing each tick. On a focus phase ending: play chime (if `settings.sound`), normalize and bump the daily statistics, `commitFocusToHistory`, increment the active task's `pomodoros`, then `completeFocusCycle()` advances the persisted cycle counter and picks `long` exactly every `settings.longEvery` sessions. `skip()` uses a separate rule and never records a completed focus. `phaseMinutes()` converts phase → duration in minutes.

### Theming
CSS custom properties in `App.css`: a `:root` (light) block and a `[data-theme="dark"]` override. The phase accent color (`--accent`, red/green/blue by phase) is set as an inline style on the root `.app` div each render, overriding the CSS default. `index.css` is just the 7-line browser reset.

### Native layer (`src-tauri/`)
Intentionally minimal. `lib.rs` registers `tauri-plugin-shell` and `tauri-plugin-global-shortcut` and runs the context — no `#[tauri::command]` functions, no IPC beyond the plugins. Window config and bundle targets live in `tauri.conf.json`. Permissions (window always-on-top, shell open, global-shortcut register/unregister/is-registered) are granted in `capabilities/default.json`. The global start/pause hotkey (default `CommandOrControl+Shift+P`) is registered from `App.tsx` and re-registers when `settings.hotkey` changes.

### NSIS installer localization (`src-tauri/nsis/SimpChinese.nsh`)
The Windows NSIS (`.exe`) installer is localized to Simplified Chinese. NSIS installer text comes from **two layers**, both configured in `tauri.conf.json` under `bundle.windows.nsis`:
- **NSIS standard UI** (welcome/license/finish pages) — auto-loaded by listing the language name in `languages` (e.g. `"SimpChinese"`). No manual work.
- **Tauri custom messages** (27 `LangString`s like "正在安装 WebView2……", "卸载 ${PRODUCTNAME}") — *not* in NSIS's built-in files, so a Chinese `.nsh` is required and wired up via `customLanguageFiles: { "SimpChinese": "nsis/SimpChinese.nsh" }`.

`languages` order is priority (first = default); `displayLanguageSelector: true` shows a pre-install language picker. When editing `SimpChinese.nsh`: `LangString` keys and `${LANG_SIMPCHINESE}` are fixed, and placeholders (`${PRODUCTNAME}`, `${VERSION}`, `$R4`, `$0`, `$1`, `$\n`, `{{product_name}}`) must be preserved verbatim — translate only the prose. MSI (`.msi`) uses WiX localization, a separate mechanism not covered here. Full details in `docs/NSIS-中文化.md`.
