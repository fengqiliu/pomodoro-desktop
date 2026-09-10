# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-window Tauri 2 desktop Pomodoro timer (380×580, non-resizable). React 18 + TypeScript + Vite frontend; the Rust/Tauri host owns tray/window lifecycle and the authoritative desktop countdown. Three custom timer commands bridge the native clock to React. Default language is Chinese (`zh`); English is also bundled.

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
cargo test --manifest-path src-tauri/Cargo.toml native_timer --lib
```

Vitest covers the pure timer rules in `src/timer/timerRules.test.ts`; there is no linter configured. `npm run typecheck` remains the TypeScript static check.

Regenerate the app icon set (needs Pillow): `python3 gen_icons.py` → writes `src-tauri/icons/`.

## Architecture

### Frontend is layered (since v2.0)
`App.tsx` is the assembly layer: it owns all state and the end-of-phase business rules, then composes presentational components from `src/components/` (`TopBar`, `TimerView`, `TasksView`, `StatsView`, `SettingsModal`). No router, no state library: state is `useState`/`useRef` plus `localStorage` persistence. Three tabs (`timer` | `tasks` | `stats`) are conditionally rendered.

- **`hooks/usePomodoroEngine.ts`** owns the countdown *mechanics*: wall-clock deadline, native timer bridge, generation-based cancellation, the 1s paint loop, and toggle/pause/reset/skip/switchTo. Business rules for what a completed phase means are injected via the `onPhaseComplete` callback (returns `{ nextPhase, nextSeconds, autoStart }`). The engine never touches stats/tasks/notifications itself.
- **Pure domain modules** (directly unit-testable, no React): `timer/timerRules.ts` (phase cycle, daily reset, remaining time), `stats.ts` (history record / 7-day view / 60-day pruning), `dataBackup.ts` (backup build + validated import), `persistence.ts` (storage keys, defaults, state merging), `chime.ts` (completion sound), `types.ts`.
- When adding a feature, put mechanics in the engine, rules in a pure module, markup in a component — don't grow `App.tsx`.

### `platform.ts` — the browser/desktop abstraction (important)
The app must run both as a Tauri desktop window *and* in a plain browser during UI iteration. `@tauri-apps/*` imports would fail to resolve at runtime in a browser, so `platform.ts`:
- Detects desktop via `"__TAURI_INTERNALS__" in window` (`isDesktop()`).
- **Lazy dynamic-imports** the Tauri APIs (`@tauri-apps/api/window`, core invoke/event, global shortcut, notification) only when `isDesktop()`, then caches the module.
- Exposes window, shortcut, notification, and native-timer adapters. Browser-only rendering never invokes Tauri and uses the JS timer fallback.

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

`loadState()` merges stored state over `DEFAULT_SETTINGS` via `mergeState()` and **resets `completedToday`/`focusMinutesToday` to 0 when the stored `date` != today**. Runtime guards repeat that check at midnight, on focus/visibility restoration, before a completed focus is recorded, and before persistence. `cycleFocusCount` is independent from the daily statistics and resets only after a long break is due. When changing persisted state shapes, bump the key suffix rather than migrating.

History (`pomodoro-history-v1`) is pruned to the last 60 days on startup, on each recorded focus, and on backup import — the chart only shows 7 days. **Data backup** (Settings → 数据): `buildBackup` serializes `{app, version, exportedAt, state, history}`; export copies it to the clipboard and import reads the clipboard (falls back to a prompt), validates via `parseBackup`, re-merges state over defaults, prunes history, then reloads.

### Timer tick
On desktop, `native_timer.rs` owns the completion deadline. `native_timer_start` creates a generation ticket and a Rust worker; pause/cancel increment the generation so stale workers cannot complete. The worker polls wall-clock time at most once per second, sends its native completion notification payload, and emits `native-timer-completed` with `notificationSent`. The React interval only paints remaining seconds. In a plain browser, that same interval becomes the completion adapter. Both paths converge in the engine's `completeCurrentPhase`, which delegates to App's `onPhaseComplete` (chime, daily/history/task updates, cycle advancement, notification fallback, auto-start decision). `skip()` cancels first and never records a completed focus.

### Theming
CSS custom properties in `App.css`: a `:root` (light) block and a `[data-theme="dark"]` override. The phase accent color (`--accent`, red/green/blue by phase) is set as an inline style on the root `.app` div each render, overriding the CSS default. `index.css` is just the 7-line browser reset.

### Native layer (`src-tauri/`)
`lib.rs` registers `tauri-plugin-global-shortcut` and `tauri-plugin-notification`, creates the tray menu, hides the main window on close, manages `NativeTimer`, and exposes `native_timer_start`, `native_timer_pause`, and `native_timer_cancel`. `native_timer.rs` is a deep module around wall-clock deadlines, remaining-time snapshots, generation-based cancellation, and deterministic tests. Window config and bundle targets live in `tauri.conf.json`. Permissions (window always-on-top, global-shortcut register/unregister/is-registered, notification) are granted in `capabilities/default.json`. The global start/pause hotkey (default `CommandOrControl+Shift+P`) is registered from `App.tsx`; settings edit a draft and apply it only when the modal is confirmed.

### NSIS installer localization (`src-tauri/nsis/SimpChinese.nsh`)
The Windows NSIS (`.exe`) installer is localized to Simplified Chinese. NSIS installer text comes from **two layers**, both configured in `tauri.conf.json` under `bundle.windows.nsis`:
- **NSIS standard UI** (welcome/license/finish pages) — auto-loaded by listing the language name in `languages` (e.g. `"SimpChinese"`). No manual work.
- **Tauri custom messages** (27 `LangString`s like "正在安装 WebView2……", "卸载 ${PRODUCTNAME}") — *not* in NSIS's built-in files, so a Chinese `.nsh` is required and wired up via `customLanguageFiles: { "SimpChinese": "nsis/SimpChinese.nsh" }`.

`languages` order is priority (first = default); `displayLanguageSelector: true` shows a pre-install language picker. When editing `SimpChinese.nsh`: `LangString` keys and `${LANG_SIMPCHINESE}` are fixed, and placeholders (`${PRODUCTNAME}`, `${VERSION}`, `$R4`, `$0`, `$1`, `$\n`, `{{product_name}}`) must be preserved verbatim — translate only the prose. MSI (`.msi`) uses WiX localization, a separate mechanism not covered here. Full details in `docs/NSIS-中文化.md`.
