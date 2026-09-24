# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What this is

A single-window Tauri 2 desktop Pomodoro timer (380×580, non-resizable). React 18 + TypeScript + Vite frontend; a thin Rust/Tauri shell that exposes three `native_timer_*` IPC commands plus tray/window lifecycle — every other native capability is invoked from JS via Tauri plugin APIs. Default language is Chinese (`zh`); English is also bundled.

## Commands

```bash
npm install
npm run dev          # Vite dev server only — port 1420 (strictPort; Tauri expects this). Works in a plain browser too (see src/infrastructure/platform/).
npm run typecheck    # tsc --noEmit
npm test             # vitest run — domain/application unit tests (colocated *.test.ts)
npm run build        # tsc -b && vite build  →  dist/
npm run preview      # serve the built dist/

npm run tauri dev    # full app: launches Vite (beforeDevCommand) + native window
npm run tauri build  # bundled desktop app (runs npm run build first via beforeBuildCommand)
npx tauri build --bundles nsis  # rebuild only the NSIS .exe (faster when Rust is cached)

cargo test --manifest-path src-tauri/Cargo.toml native_timer --lib  # Rust engine tests
```

There is no linter. `npm run typecheck` is the only static check; `npm test` runs the Vitest suites.

Regenerate the app icon set (needs Pillow): `python3 gen_icons.py` → writes `src-tauri/icons/`.

## Architecture

### Frontend layering (DDD, `src/`)
The frontend is split into layers; new features go into the matching layer instead of piling into `App.tsx`:
- `src/domain/` — pure rules, no IO/React/Tauri: `timer/` (phase, pomodoro cycle, daily progress, countdown math + `timer.test.ts`), `tasks/` (+ `task.test.ts`), `stats/` (focus history: record, 7-day view, 60-day prune + `focusHistory.test.ts`), `settings/` (defaults, persisted-state merge & daily-reset rules).
- `src/application/` — ports and use cases: `ports.ts` (`WindowPort` / `ShortcutPort` / `NotificationPort` / `NativeTimerPort` / `StateStore` / `HistoryStore`), `backupService.ts` (build/validate JSON backup + test).
- `src/infrastructure/` — adapters implementing the ports: `platform/` (desktop detection + lazy Tauri imports → `windowAdapter` / `shortcutAdapter` / `notificationAdapter` / `nativeTimerAdapter`), `storage/` (localStorage stores with versioned keys), `audio/` (`noiseEngine.ts`, `chime.ts`).
- `src/presentation/` — `App.tsx` (state composition & wiring), `components/`, `hooks/usePomodoroEngine.ts` (countdown, native bridge, generation cancel), `i18n.ts`, `uiTypes.ts`.
- `src/shared/date.ts` — `todayKey()` shared date helper.

Dependencies point inward: presentation → application/domain/infrastructure; domain and application must stay free of React/Tauri imports. Unit tests live next to the code they cover (`*.test.ts`).

### `src/infrastructure/platform/` — the browser/desktop abstraction (important)
The app must run both as a Tauri desktop window *and* in a plain browser during UI iteration. `@tauri-apps/*` imports would fail to resolve at runtime in a browser, so this layer:
- Detects desktop via `"__TAURI_INTERNALS__" in window` (`isDesktop()` in `runtime.ts`).
- **Lazy dynamic-imports** the Tauri APIs (`@tauri-apps/api/window`, `@tauri-apps/api/core` + `event` for `native_timer_*` IPC, `@tauri-apps/plugin-global-shortcut`, notification) only when `isDesktop()`, then caches the module.
- Exposes `windowAdapter.setAlwaysOnTop/isAlwaysOnTop`, `shortcutAdapter.register/unregister`, `notificationAdapter.notifyPhaseDone`, `nativeTimerAdapter.start/pause/cancel/listenCompleted` — all no-ops (or local fallbacks) in the browser.

Always go through this layer; never import `@tauri-apps/*` directly from presentation code or it breaks browser dev.

### `src/infrastructure/audio/` — WebAudio, no audio assets
Generates white/brown/pink noise procedurally into a 2s `AudioBuffer` that loops, with a controllable `GainNode`. `setType()` rebuilds the buffer gap-free while playing. `App.tsx` owns one `NoiseEngine` instance in a `useRef`. The completion chime (`playChime`) is a separate short oscillator sequence, not part of the engine.

### i18n — hand-rolled, no library
`src/presentation/i18n.ts` is a flat `DICT` mapping keys to `[zh, en]` tuples, plus `translate(lang, key, params)` with `{param}` interpolation and `weekdayLabel(lang, dayIndex)`. To add a language: extend the `Lang` type, add it to `LANGS`, and add a third tuple element (then update `INDEX`). Keys are referenced throughout presentation code via the `tr()` callback.

### State, persistence, and daily reset
Everything persists to versioned `localStorage` keys (defined in `src/infrastructure/storage/keys.ts`):
- `pomodoro-state-v3` — settings, tasks, `completedToday`/`focusMinutesToday`/`cycleFocusCount`, `noise`, and a `date` string (`YYYY-M-D`).
- `pomodoro-history-v1` — `Record<dateKey, DayRecord>` powering the 7-day chart.
- `pomodoro-theme`, `pomodoro-pinned`, `pomodoro-lang`.

`stateStore.load()` (merge/daily-reset logic in `src/domain/settings/persistedState.ts`) merges stored state over `DEFAULT_SETTINGS` and **resets `completedToday`/`focusMinutesToday` to 0 when the stored `date` != today**. When changing persisted state shapes, bump the key suffix (`-v3`, `-v1`) rather than migrating.

### Timer tick
`setInterval(…, 1000)` in `usePomodoroEngine.ts` runs only while `running`; the closure reads fresh values through refs rather than re-subscribing each tick. On a focus phase ending: play chime (if `settings.sound`), `addCompletedFocus` bumps today's counters, `recordFocus` writes history, `recordPomodoro` increments the active task, `completeFocusCycle` advances the long-break cycle, then `nextPhaseAfterCompletedBreak` picks `long` vs `short` using `cycleFocusCount + 1 >= settings.longEvery`. `phaseMinutes()` (domain/timer) converts phase → duration in minutes. On desktop the Rust engine owns the wall-clock deadline and emits a completion event; in the browser a local end-timestamp drives completion.

### Theming
CSS custom properties in `App.css`: a `:root` (light) block and a `[data-theme="dark"]` override. The phase accent color (`--accent`, red/green/blue by phase) is set as an inline style on the root `.app` div each render, overriding the CSS default. `index.css` is just the 7-line browser reset.

### Native layer (`src-tauri/`) — two bounded contexts + assembly root
- `src/lib.rs` — composition root only: registers plugins (`tauri-plugin-global-shortcut`, `tauri-plugin-notification`), manages `NativeTimer` state, registers the three `native_timer_*` commands, wires tray setup and close-to-tray.
- `src/timer/` — timer context: `engine.rs` (wall-clock engine, generation-based cancellation, completion worker, Rust unit tests) and `commands.rs` (thin IPC adapters `native_timer_start` / `native_timer_pause` / `native_timer_cancel`).
- `src/tray/` — tray context: tray menu build (`build_tray`) and window show/hide toggle (`toggle_window`).

Window config and bundle targets live in `tauri.conf.json`. Permissions (window always-on-top, notification, global-shortcut register/unregister/is-registered) are granted in `capabilities/default.json`. The global start/pause hotkey (default `CommandOrControl+Shift+P`) is registered from the presentation layer via `shortcutAdapter` and re-registers when `settings.hotkey` changes.

### NSIS installer localization (`src-tauri/nsis/SimpChinese.nsh`)
The Windows NSIS (`.exe`) installer is localized to Simplified Chinese. NSIS installer text comes from **two layers**, both configured in `tauri.conf.json` under `bundle.windows.nsis`:
- **NSIS standard UI** (welcome/license/finish pages) — auto-loaded by listing the language name in `languages` (e.g. `"SimpChinese"`). No manual work.
- **Tauri custom messages** (27 `LangString`s like "正在安装 WebView2……", "卸载 ${PRODUCTNAME}") — *not* in NSIS's built-in files, so a Chinese `.nsh` is required and wired up via `customLanguageFiles: { "SimpChinese": "nsis/SimpChinese.nsh" }`.

`languages` order is priority (first = default); `displayLanguageSelector: true` shows a pre-install language picker. When editing `SimpChinese.nsh`: `LangString` keys and `${LANG_SIMPCHINESE}` are fixed, and placeholders (`${PRODUCTNAME}`, `${VERSION}`, `$R4`, `$0`, `$1`, `$\n`, `{{product_name}}`) must be preserved verbatim — translate only the prose. MSI (`.msi`) uses WiX localization, a separate mechanism not covered here. Full details in `docs/NSIS-中文化.md`.
