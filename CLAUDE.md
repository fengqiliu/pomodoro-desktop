# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-window Tauri 2 desktop Pomodoro timer (380×580, non-resizable; product `Pomodoro`, identifier `com.flat.pomodoro`). React 18 + TypeScript + Vite frontend; a thin Rust/Tauri shell that exposes **no `#[tauri::command]` functions** — every native capability is invoked from JS via Tauri plugin APIs, except the system tray and close-to-tray behaviour, which live in Rust. Default language is Chinese (`zh`); English is also bundled. `README.md` (Chinese) is the user-facing counterpart to this file.

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

Vitest covers the pure timer rules in `src/timer/timerRules.test.ts`; there is no linter and no CI configured. `npm run typecheck` is the only static check — run it plus `npm test` before considering a change done. The Rust side has no tests; `npm run tauri build` is the only thing that compiles it.

`package-lock.json` resolves every tarball from `registry.npmmirror.com` (the Chinese npm mirror). On a network that can't reach it, install with `npm install --registry=https://registry.npmjs.org --no-package-lock` rather than editing the lockfile.

Regenerate the app icon set (needs Pillow): `python3 gen_icons.py` → writes `src-tauri/icons/`.

## Architecture

### Frontend is one file (`src/App.tsx`, ~1070 lines)
The entire UI lives in `App.tsx` — timer ring, tasks list, 7-day stats chart, and the settings modal. No router, no state library: state is `useState`/`useRef` plus `localStorage` persistence. Three tabs (`timer` | `tasks` | `stats`) are conditionally rendered. When adding a feature, expect to touch this one file rather than split it; the surrounding code is deliberately consolidated. The one deliberate exception is `src/timer/timerRules.ts` (below) — pure logic is extracted so it can be unit-tested.

### `timer/timerRules.ts` — the only unit-tested module
Pure, dependency-free functions holding the rules that are easy to get wrong, tested in `timerRules.test.ts`:
- `completeFocusCycle(cycleFocusCount, longEvery)` → `{ nextPhase, cycleFocusCount }`; picks `long` exactly every `longEvery` completed focus sessions and resets the counter.
- `nextPhaseAfterCompletedBreak()` / `nextPhaseAfterSkip(phase)` — skipping never records a completed focus, so it cannot advance the long-break cycle.
- `resetDailyProgressIfNeeded(progress, today)` — returns the *same object identity* when the date already matches (callers rely on that to avoid redundant renders).
- `remainingSeconds(endAt, now)` — clamped-at-zero wall-clock countdown.
- `focusesUntilLongBreak(cycleFocusCount, longEvery)` — the "to long break" stat.

New timer rules belong here with a test, not inline in `App.tsx`.

### `platform.ts` — the browser/desktop abstraction (important)
The app must run both as a Tauri desktop window *and* in a plain browser during UI iteration. `@tauri-apps/*` imports would fail to resolve at runtime in a browser, so `platform.ts`:
- Detects desktop via `"__TAURI_INTERNALS__" in window` (`isDesktop()`).
- **Lazy dynamic-imports** the Tauri APIs (`@tauri-apps/api/window`, `@tauri-apps/plugin-global-shortcut`, `@tauri-apps/plugin-notification`) only when `isDesktop()`, then caches the module.
- Exposes `setAlwaysOnTop` / `isAlwaysOnTop` / `registerShortcut` / `unregisterShortcut` / `notifyPhaseDone` that no-op in the browser. `notifyPhaseDone` requests notification permission lazily on first send, so macOS only prompts when a notification is actually due.

Always go through `platform.ts`; never import `@tauri-apps/*` directly from `App.tsx` or it breaks browser dev. Adding a native capability means: add the npm plugin + Rust crate, register the plugin in `lib.rs`, grant the permission in `capabilities/default.json`, and wrap it here.

### `noise.ts` — WebAudio, no audio assets
Generates white/brown/pink noise procedurally into a 2s `AudioBuffer` that loops, with a controllable `GainNode`. `setType()` rebuilds the buffer gap-free while playing. `App.tsx` owns one `NoiseEngine` instance in a `useRef`. The completion chime (`playChime`) is a separate short oscillator sequence, not part of the engine; it reuses one module-level `AudioContext` (`chimeCtx`) rather than creating/closing one per chime — that avoids the browser's AudioContext instance cap and repeated autoplay warnings.

### `i18n.ts` — hand-rolled, no library
A flat `DICT` mapping keys to `[zh, en]` tuples, plus `translate(lang, key, params)` with `{param}` interpolation and `weekdayLabel(lang, dayIndex)`. Missing keys fall back to the key itself. To add a language: extend the `Lang` type, add it to `LANGS`, add a third tuple element to every entry, and update `INDEX`. Keys are referenced throughout `App.tsx` via the `tr()` callback — every user-visible string goes through it (tray menu labels in `lib.rs` are the exception; they are hard-coded Chinese).

### State, persistence, and daily reset
Everything persists to versioned `localStorage` keys (defined at the top of `App.tsx`):
- `pomodoro-state-v3` — settings, tasks, daily progress (`completedToday`, `focusMinutesToday`, `date`), `cycleFocusCount`, and `noise`.
- `pomodoro-history-v1` — `Record<dateKey, DayRecord>` powering the 7-day chart; also held in React state so a per-second tick doesn't re-parse the JSON.
- `pomodoro-theme`, `pomodoro-pinned`, `pomodoro-lang`.

`loadState()` merges stored state over `DEFAULT_SETTINGS` and **resets `completedToday`/`focusMinutesToday` to 0 when the stored `date` != today**. Runtime guards repeat that check on a scheduled midnight timeout, on window focus / `visibilitychange`, before a completed focus is recorded, and before persistence — the app is expected to sit in the tray across days. `cycleFocusCount` is independent from the daily statistics and resets only after a long break is due. When changing persisted state shapes, bump the key suffix rather than migrating.

`Settings` currently holds: `focus`, `short`, `long`, `longEvery`, `sound`, `notifications`, `autoStartBreaks`, `autoStartFocus`, `hotkey`, `noiseType`, `noiseVolume`. Adding a field means updating `DEFAULT_SETTINGS`, the settings modal, and `i18n.ts` — the merge in `loadState()` backfills it for existing users without a version bump.

### Timer tick
`setInterval(…, 1000)` runs only while `running`. The interval **does not decrement a counter**: `endAtRef` stores a wall-clock end timestamp seeded when the phase (re)starts, and each tick derives the remaining time via `remainingSeconds(endAtRef.current, Date.now())`, so interval jitter and background throttling can't drift a long session. The closure reads fresh values through refs (`settingsRef`, `runningRef`, `cycleFocusCountRef`) rather than re-subscribing each tick.

On a focus phase ending: play chime (if `settings.sound`), bump the daily statistics (re-checking the date first), `commitFocusToHistory`, increment the active task's `pomodoros`, then `completeFocusCycle()` advances the persisted cycle counter and picks the next phase. On any phase ending: fire a native notification if `settings.notifications`, then auto-start the next phase when the matching toggle (`autoStartBreaks` / `autoStartFocus`) is on. `skip()` uses `nextPhaseAfterSkip` and never records a completed focus. `phaseMinutes()` converts phase → duration in minutes; editing a duration while paused re-syncs `secondsLeft`, while a running session is deliberately left untouched.

### Theming
CSS custom properties in `App.css`: a `:root` (light) block and a `[data-theme="dark"]` override, with `data-theme` set on `<html>`. The phase accent color (`--accent`, red/green/blue by phase) is set as an inline style on the root `.app` div each render, overriding the CSS default. `index.css` is just the 7-line browser reset.

### Native layer (`src-tauri/`)
Intentionally minimal, but not empty. `lib.rs`:
- Registers `tauri-plugin-shell`, `tauri-plugin-global-shortcut`, and `tauri-plugin-notification`.
- Builds a **system tray** in `setup()` (`tauri` crate feature `tray-icon`) with a two-item menu — `显示/隐藏` and `退出` — plus left-click to toggle window visibility. The tray icon reuses `app.default_window_icon()` (baked in at build time from `bundle.icon`), so no `image-png` feature is needed.
- Intercepts `WindowEvent::CloseRequested` with `api.prevent_close()` and hides the window: **the × button hides to tray instead of quitting**, and the frontend timer keeps running while hidden. Quitting is only via the tray menu.

Still no `#[tauri::command]` functions and no IPC beyond the plugins. Window config and bundle targets live in `tauri.conf.json`. Permissions (window always-on-top, shell open, global-shortcut register/unregister/is-registered, notifications) are granted in `capabilities/default.json` — a native call that silently fails at runtime is usually a missing entry there. The global start/pause hotkey (default `CommandOrControl+Shift+P`) is registered from `App.tsx` and re-registers when `settings.hotkey` changes.

### NSIS installer localization (`src-tauri/nsis/SimpChinese.nsh`)
The Windows NSIS (`.exe`) installer is localized to Simplified Chinese. NSIS installer text comes from **two layers**, both configured in `tauri.conf.json` under `bundle.windows.nsis`:
- **NSIS standard UI** (welcome/license/finish pages) — auto-loaded by listing the language name in `languages` (e.g. `"SimpChinese"`). No manual work.
- **Tauri custom messages** (27 `LangString`s like "正在安装 WebView2……", "卸载 ${PRODUCTNAME}") — *not* in NSIS's built-in files, so a Chinese `.nsh` is required and wired up via `customLanguageFiles: { "SimpChinese": "nsis/SimpChinese.nsh" }`.

`languages` order is priority (first = default); `displayLanguageSelector: true` shows a pre-install language picker. When editing `SimpChinese.nsh`: `LangString` keys and `${LANG_SIMPCHINESE}` are fixed, and placeholders (`${PRODUCTNAME}`, `${VERSION}`, `$R4`, `$0`, `$1`, `$\n`, `{{product_name}}`) must be preserved verbatim — translate only the prose. MSI (`.msi`) uses WiX localization, a separate mechanism not covered here. Full details in `docs/NSIS-中文化.md`.
