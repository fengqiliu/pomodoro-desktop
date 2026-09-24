# pomodoro-desktop DDD 重构方案

> 版本：v1.0（对应代码库 v2.0.0，commit 基线 `080dbfe`）
> 状态：**已实施完成** —— 前端 4 文件映射全部落地，Rust 双上下文拆分完成；`npm run typecheck` / `npm test`(23/23) / `npm run build` 全部通过。
> 性质：**行为保持型（behavior-preserving）重构** —— 不改任何用户可见行为、持久化数据格式与 IPC 契约。

---

## 1. 背景与目标

### 1.1 背景

重构前的代码库是「按技术分层」而非「按业务能力」组织的：

- 前端 `src/` 为扁平结构：领域规则（`timerRules.ts`、`stats.ts`、`persistence.ts`、`dataBackup.ts`、`types.ts`）、平台适配（`platform.ts`）、UI 组件与状态组装（`App.tsx`，一度超过千行）混在同一命名空间，业务规则、IO 与 React 渲染互相纠缠。
- Rust 侧 `src-tauri/src/` 只有单文件 `native_timer.rs` 承载全部原生逻辑，而 `lib.rs` 同时承担插件注册、命令分发、托盘构建、窗口生命周期与计时状态管理，装配与业务混杂。

### 1.2 目标

| # | 目标 | 验收标准 |
|---|------|---------|
| G1 | 前端按 DDD 分层（domain / application / infrastructure / presentation）+ 按限界上下文拆分领域模块 | 目录结构符合 §3；领域与应用层零 React/Tauri/DOM/localStorage 依赖 |
| G2 | Rust 拆分为 `timer`、`tray` 两个限界上下文 + 组合根 | `lib.rs` 只做装配；业务逻辑在 `timer/engine.rs` 与 `tray/mod.rs` |
| G3 | 行为完全保持 | 用户可见行为、localStorage 键与数据形状、IPC 命令/事件签名、默认值全部不变 |
| G4 | 可测试性提升 | 领域/应用纯函数可被 Vitest 直接覆盖；Rust 引擎单测随模块迁移保留 |
| G5 | 文档与代码一致 | `AGENTS.md`、`CLAUDE.md`、`README.md`、`docs/` 与新结构同步 |

### 1.3 非目标（明确不做）

- 不引入路由、状态管理库、DI 容器、CQRS/Event Sourcing 等重型模式；
- 不改持久化结构（不迁移、不改键名，沿用「改形状就 bump 键后缀」策略）；
- 不改 IPC 命令名、事件名、payload 字段（`camelCase` 序列化保持）；
- 不重写业务规则本身（如周期推进、每日重置判定的逻辑语义原样保留，仅移动与显式化）；
- 不新增语言、主题、统计维度等任何功能。

---

## 2. 范围与约束

### 2.1 范围

- **前端**：`src/**`（43 个文件，含新增 14 个模块文件、删除 6 个旧扁平文件）；
- **Rust**：`src-tauri/src/{main.rs, lib.rs}` 与新增的 `timer/`、`tray/` 模块；
- **文档**：`AGENTS.md`、`CLAUDE.md`、`README.md`、`docs/概要设计说明.md`、`docs/需求规格说明书.md`。

### 2.2 硬约束

1. **localStorage 兼容**：键 `pomodoro-state-v3`、`pomodoro-history-v1`、`pomodoro-theme`、`pomodoro-pinned`、`pomodoro-lang` 及其 JSON 形状逐字节兼容（`src/infrastructure/storage/keys.ts`）。
2. **IPC 契约不变**：命令 `native_timer_start` / `native_timer_pause` / `native_timer_cancel`；事件 `native-timer-completed`；payload 均为 camelCase。
3. **浏览器可跑**：`npm run dev` 在纯浏览器中仍可用（Tauri API 懒加载 + no-op/回退路径保持）。
4. **依赖单向**：presentation → application / infrastructure → domain；domain、application 不得反向依赖。
5. **工具链不变**：不新增运行时依赖；测试仍用 Vitest（4 套 23 例）与 `cargo test`。

---

## 3. 目标架构总览

### 3.1 分层架构图

```
┌────────────────────────────── 前端 (React + TypeScript) ──────────────────────────────┐
│                                                                                      │
│  presentation/  App.tsx(组装) · components/ · hooks/usePomodoroEngine · i18n · uiTypes │
│        │  只依赖 ▼                                                                                        │
│  application/   ports.ts(六个端口) · backupService(备份用例)                                             │
│        │  实现于 ▼                       │  编排调用 ▼                                                     │
│  infrastructure/  platform/(Tauri适配) · storage/(localStorage) · audio/(WebAudio)    │
│        │                                                                                        │
│  domain/        timer/ · stats/ · tasks/ · settings/   ←—— 纯规则，零 IO、零 React、零 Tauri            │
│  shared/        date.ts（跨上下文共享的纯日期工具）                                                      │
└──────────────────────────────────────┬───────────────────────────────────────────────┘
                                       │  IPC: native_timer_* 命令 / native-timer-completed 事件
┌──────────────────────────────────────▼───────────── 原生层 (Rust / Tauri 2) ───────────┐
│  lib.rs（组合根：插件注册 · 状态管理 · 命令注册 · 关闭到托盘）                             │
│     ├── timer/   限界上下文：engine.rs(墙上时间引擎+代际取消+完成worker) + commands.rs(IPC薄适配) │
│     └── tray/    限界上下文：mod.rs(托盘菜单 · 窗口显隐)                                 │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 依赖规则（必须持续成立）

| 规则 | 说明 | 静态可检查性 |
|------|------|-------------|
| R1 `domain → 无` | 领域层只允许导入同层与 `shared/`；禁止 React/Tauri/DOM/localStorage/`fetch` | code review + grep |
| R2 `application → domain` | 端口类型引用领域模型（`PersistedState`、`History`）；不含运行时 IO | 同上 |
| R3 `infrastructure → application/domain` | 适配器 `implements` 端口；唯一允许触碰 Tauri/localStorage/WebAudio 的层 | 同上 |
| R4 `presentation → 全部` | 组装根：注入实现、编排用例、渲染；业务**规则**不在此层新增 | 同上 |
| R5 Rust：`lib.rs → timer/tray` | 组合根可依赖两个上下文；上下文之间不互相依赖、不依赖组合根 | 模块可见性 |

---

## 4. 前端 DDD 分层设计（已实施）

### 4.1 目录结构（最终形态）

```
src/
├── domain/                      # 领域层：纯业务规则（无 IO / React / Tauri）
│   ├── timer/                   # 番茄钟上下文
│   │   ├── index.ts             # barrel：统一导出
│   │   ├── phase.ts             # Phase 值对象 + 阶段时长查询
│   │   ├── pomodoroCycle.ts     # 长休周期推进 / 跳过 / 距长休余数
│   │   ├── dailyProgress.ts     # 每日进度：跨日重置 + 完成累计
│   │   ├── countdown.ts         # 墙上时间倒计时数学
│   │   └── timer.test.ts        # 9 例
│   ├── stats/                   # 专注历史上下文
│   │   ├── index.ts / focusHistory.ts / focusHistory.test.ts (4 例)
│   ├── tasks/                   # 任务上下文
│   │   ├── index.ts / task.ts / task.test.ts (6 例)
│   └── settings/                # 设置上下文
│       ├── index.ts / settings.ts / persistedState.ts
├── application/                 # 应用层：端口 + 用例（无具体 IO 实现）
│   ├── ports.ts                 # 六个端口接口（纯类型）
│   └── backupService.ts         # 备份构建/校验用例 + backupService.test.ts (4 例)
├── infrastructure/              # 基础设施层：端口的具体适配器
│   ├── platform/                # Tauri/浏览器适配（懒加载动态 import）
│   │   ├── index.ts / runtime.ts / windowAdapter.ts / shortcutAdapter.ts
│   │   ├── notificationAdapter.ts / nativeTimerAdapter.ts
│   ├── storage/                 # localStorage 适配
│   │   ├── index.ts / keys.ts / stateStore.ts / historyStore.ts
│   └── audio/                   # WebAudio 适配
│       ├── chime.ts / noiseEngine.ts
├── presentation/                # 表现层：组装 + 渲染
│   ├── App.tsx                  # 组装根：状态、端口接线、阶段完成规则
│   ├── App.css / i18n.ts / uiTypes.ts
│   ├── hooks/usePomodoroEngine.ts   # 倒计时机制（不含业务规则）
│   └── components/              # TopBar · TimerView · TasksView · StatsView · SettingsModal
├── shared/
│   └── date.ts                  # todayKey() —— 跨上下文共享的纯日期工具
├── main.tsx / index.css / vite-env.d.ts
```

### 4.2 领域层（`src/domain/`）模块明细

#### 4.2.1 番茄钟上下文（`domain/timer/`，barrel 导出）

| 文件 | 职责 | 核心 API |
|------|------|---------|
| `phase.ts` | `Phase` 值对象 | `type Phase = "focus" \| "short" \| "long"`；`phaseMinutes(phase, durations)` |
| `pomodoroCycle.ts` | 长休周期规则 | `completeFocusCycle(count, longEvery) → { nextPhase, cycleFocusCount }`；`nextPhaseAfterCompletedBreak()`；`nextPhaseAfterSkip(phase)`；`focusesUntilLongBreak(count, longEvery)` |
| `dailyProgress.ts` | 日历日统计 | `resetDailyProgressIfNeeded(progress, today)`；`addCompletedFocus(progress, minutes)`；`type DailyProgress` |
| `countdown.ts` | 倒计时数学 | `remainingSeconds(endAt, now)`（由绝对结束时间戳推导，防 interval 抖动漂移） |
| `timer.test.ts` | 9 例：周期推进、跳过、跨日重置、延迟回调剩余时间 | |

> 语义要点（原样保留）：`cycleFocusCount` **跨日存活**（节奏与日历统计解耦，仅在长休到期后归零）；`skip()` 不记录完成专注、**不推进**长休周期。

#### 4.2.2 专注历史上下文（`domain/stats/`）

`type History = Record<dateKey, DayRecord>`；`DayRecord { date, dayIndex, pomodoros, minutes }`。
纯函数：`last7Days(history, now)`（图表 7 天视图，缺日补 `emptyDay`）、`pruneHistory(history, keepDays=60, now)`（启动/记录/导入三处防 localStorage 无界增长）、`recordFocus(history, minutes, now)`。

#### 4.2.3 任务上下文（`domain/tasks/`）

实体 `Task { id, title, done, pomodoros }`。**身份生成注入**（`generateId: () => string`），领域不碰全局/IO。纯函数：`addTask`（新任务前置）、`toggleTaskDone`、`removeTask`、`clearCompletedTasks`、`recordPomodoro(tasks, activeId)`（`activeId === null` 时原样返回）。

#### 4.2.4 设置上下文（`domain/settings/`）

- `settings.ts`：`Settings` / `NoisePref` 值对象 + `DEFAULT_SETTINGS`（25/5/15、longEvery=4、hotkey `CommandOrControl+Shift+P` 等，默认值全部不变）。
- `persistedState.ts`：持久化聚合快照 `PersistedState { settings, tasks, completedToday, focusMinutesToday, date, cycleFocusCount, noise }`；`defaultState()`；`mergeState(parsed)` —— 纯函数，负责「不可信输入合并默认值 + 内嵌跨日重置」。**持久化形状变更策略 = bump 键后缀，不写迁移。**

### 4.3 应用层（`src/application/`）

**`ports.ts`（六端口，纯类型、无运行时依赖）：**

| 端口 | 方法 | 实现者 |
|------|------|--------|
| `WindowPort` | `setAlwaysOnTop` / `isAlwaysOnTop` | `windowAdapter` |
| `ShortcutPort` | `register(keys, handler) → boolean` / `unregister` | `shortcutAdapter` |
| `NotificationPort` | `notifyPhaseDone(title, body)`（无权限时静默 no-op） | `notificationAdapter` |
| `NativeTimerPort` | `start(seconds, notification?)` / `pause()` / `cancel(expectedGeneration?)` / `listenCompleted(handler)`；非桌面返回 `null` | `nativeTimerAdapter` |
| `StateStore` | `load(): PersistedState` / `save(state)` | `stateStore` |
| `HistoryStore` | `load(): History` / `save(history)` | `historyStore` |

辅助类型：`NativeTimerSnapshot { running, remainingMs, generation }`、`NativeTimerNotification { title, body }`、`NativeTimerCompletion = Snapshot & { notificationSent }`。

**`backupService.ts`（唯一用例模块）：**
- `buildBackup(state, history) → string`：序列化 `{ app: "pomodoro", version: 2, exportedAt, state, history }`；
- `parseBackup(text, now?) → { state, history } | null`：校验 `app` 标识与对象形状，`state` 经 `mergeState` 重合并、`history` 经 `pruneHistory(…, 60)` 裁剪 —— **坏数据/旧版备份永远不会写入存储**；JSON 解析失败返回 `null`。

### 4.4 基础设施层（`src/infrastructure/`）

- **`platform/`（浏览器/桌面抽象，最重要）**：`runtime.ts` 提供 `isDesktop()`（检测 `"__TAURI_INTERNALS__" in window`）与五个懒加载器（`loadWin/loadShortcut/loadNotif/loadNativeTimer` —— 动态 `import()` + 模块级缓存，浏览器中从不解析 `@tauri-apps/*`）。四个适配器全部实现 application 端口，非桌面路径返回 `null`/no-op，让调用方自然回退到 JS 墙钟倒计时。`index.ts` 统一 re-export 并透传 ports 类型。
- **`storage/`**：`keys.ts` 五个版本化键常量；`stateStore`（`try/catch` + `mergeState` 兜底 `defaultState()`）；`historyStore`（解析失败回 `{}`）。
- **`audio/`**：`noiseEngine.ts`（2s AudioBuffer 程序化白/棕/粉噪声循环 + GainNode，`setType()` 播放中无缝重建）与 `chime.ts`（完成提示音短振荡序列）——无任何音频资源文件。

### 4.5 表现层（`src/presentation/`）

- **`App.tsx`（组装根）**：`useRef(stateStore.load())` 初始化全部持久化状态；启动即 `pruneHistory(historyStore.load())` 并回写；接线四个 platform 适配器与两个 store；定义阶段完成业务规则 `onPhaseComplete`（提示音 → 日统计 `addCompletedFocus` → `recordFocus` → `recordPomodoro` → `completeFocusCycle` → `nextPhaseAfterCompletedBreak` 选长/短休 → 通知回退 → 自动开始判定）；导出/导入走 `buildBackup`/`parseBackup`；跨日守卫（午夜调度、window focus、visibilitychange）。**不含新增业务规则，只编排。**
- **`hooks/usePomodoroEngine.ts`（计时机制）**：只管机制 —— 墙钟 `endAtRef`、1s 绘制循环、原生桥接（start/pause/cancel + 完成监听）、代际与动作序号双重防陈旧（`countdownActionRef`）、全局热键防双发（`toggleInFlightRef`）、`completionInFlightRef` 防重复完成。业务规则经 `onPhaseComplete` 回调**注入**，返回 `PhaseCompletion { nextPhase, nextSeconds, autoStart }`。对外 API：`toggle/reset/switchTo/skip/syncIfIdle`。
- **`components/`**：五个纯展示组件，只收 props。
- **`i18n.ts`**：手写 `DICT: Record<key, [zh, en]>` + `translate(lang, key, params)`（`{param}` 插值）+ `weekdayLabel`。
- **`uiTypes.ts`**：`Theme` / `ChartMetric` / `Tab` —— 明确标注「UI 类型，非领域模型」。

### 4.6 旧 → 新文件映射表

| 旧路径（扁平） | 新路径（分层） | 说明 |
|---|---|---|
| `src/timer/timerRules.ts` | `src/domain/timer/{phase,pomodoroCycle,dailyProgress,countdown}.ts` | 按内聚拆 4 文件；barrel `index.ts` 汇出 |
| `src/timer/timerRules.test.ts` | `src/domain/timer/timer.test.ts` | 9 例原样迁移 |
| `src/stats.ts` / `src/stats.test.ts` | `src/domain/stats/focusHistory.ts(.test.ts)` | 模块改名，barrel 导出名不变 |
| `src/dataBackup.ts` / `.test.ts` | `src/application/backupService.ts(.test.ts)` | 从领域**上移**应用层（它是用例而非实体规则） |
| `src/persistence.ts` | `src/domain/settings/persistedState.ts` + `src/infrastructure/storage/{keys,stateStore}.ts` | 纯合并/重置留领域；键与 IO 归基础设施 |
| `src/types.ts` | 按归属拆入 `domain/*/` + `presentation/uiTypes.ts` | `Theme/ChartMetric/Tab` 归表现层 |
| `src/platform.ts` | `src/infrastructure/platform/{runtime,window,shortcut,notification,nativeTimer}Adapter.ts` | 单文件 → 惰性加载内核 + 每能力一适配器 |
| `src/noise.ts` / `src/chime.ts` | `src/infrastructure/audio/{noiseEngine,chime}.ts` | WebAudio 适配器 |
| `src/App.tsx` / `App.css` | `src/presentation/App.tsx` / `App.css` | 组装根移入表现层 |
| `src/components/*.tsx` | `src/presentation/components/*.tsx` | 5 组件 |
| `src/hooks/usePomodoroEngine.ts` | `src/presentation/hooks/usePomodoroEngine.ts` | 机制与规则通过回调解耦 |
| `src/i18n.ts` | `src/presentation/i18n.ts` | |
| （散落各处的 `todayKey`） | `src/shared/date.ts` | 跨上下文共享纯工具 |

### 4.7 领域纯净性守则（评审 checklist）

新代码进入 `domain/` 或 `application/` 前自查：① 是否 import 了 React / `@tauri-apps/*` / `localStorage`，或隐式 IO 副作用（`Date` 构造作**参数注入**如 `now = new Date()` 允许）？② 是否可被 Vitest 无 DOM 直接实例化？③ IO 失败是否以返回值/`null` 表达而非抛 UI 异常？三条全过才可入库。

---

## 5. Rust 限界上下文划分（已实施）

### 5.1 模块结构（最终形态）

```
src-tauri/src/
├── main.rs          # 入口：调用 pomodoro_desktop_lib::run()（不变）
├── lib.rs           # ★ 组合根：只装配，零业务逻辑
├── timer/           # 限界上下文①：原生计时
│   ├── mod.rs       # pub mod commands; pub mod engine;
│   ├── engine.rs    # 领域：墙上时间引擎（原 native_timer.rs 平移）
│   └── commands.rs  # 适配：三个 #[tauri::command] 薄 IPC 适配器
└── tray/            # 限界上下文②：系统托盘
    └── mod.rs       # build_tray + toggle_window
```

### 5.2 `lib.rs` —— 组合根（仅装配）

职责清单（全部为「接线」而非业务）：
1. `mod timer; mod tray;` 声明上下文；
2. `.manage(NativeTimer::default())` 注册计时状态；
3. 注册 `tauri-plugin-global-shortcut` 与 `tauri-plugin-notification` 插件；
4. `generate_handler![timer::commands::native_timer_start/pause/cancel]`（**全路径引用宏参数**，避免 `use` 引入非 macro item 导致 `tauri::command` 宏生成函数不可见）；
5. `.setup` 中调用 `tray::build_tray(app)`；
6. `.on_window_event` 拦截 `CloseRequested` → `prevent_close()` + 隐藏窗口（关闭到托盘，前端计时继续）。

### 5.3 `timer/` 上下文

**`engine.rs`（领域核心，自 `native_timer.rs` 原样平移）：**
- 常量 `COMPLETED_EVENT = "native-timer-completed"`；
- `trait Clock`（注入式时钟，`SystemClock` 生产实现 + `TestClock` 测试实现）；
- `TimerSnapshot { running, remaining_ms, generation }`（`#[serde(rename_all = "camelCase")]`）；
- `NativeTimer { state: Arc<Mutex<TimerState>>, clock }`，`start → (Snapshot, TimerTicket)`、`pause`、`cancel(expected_generation: Option<u64>)`、`poll(ticket) → Pending/Completed/Cancelled`；
- **代际（generation）语义**：start/pause/cancel 均递增 generation，旧 worker 持旧票轮询得 `Cancelled` 自杀；带 expected_generation 的定向 cancel 不误杀新一代；
- `spawn_completion_worker(ticket, on_complete)`：每 ≤1s 轮询墙钟，到点执行回调（发系统通知 → emit 事件）；
- **5 个单测原样保留**：`pause_preserves_wall_clock_remaining_time`、`only_the_latest_generation_can_complete`、`cancel_invalidates_the_active_timer`、`stale_targeted_cancel_does_not_stop_a_newer_timer`、`worker_delivers_completion_after_the_wall_clock_deadline`。

**`commands.rs`（IPC 薄适配器，零业务）：**
- `native_timer_start(AppHandle, State<NativeTimer>, duration_ms, notification: Option<CompletionNotification>) → TimerSnapshot`：调 `timer.start` 后 `spawn_completion_worker`，worker 内先 `notification().builder()…show()` 再 `app.emit(COMPLETED_EVENT, TimerCompletedEvent { snapshot(flatten), notification_sent })`；
- `native_timer_pause(State) → TimerSnapshot`；`native_timer_cancel(State, generation: Option<u64>) → TimerSnapshot`；
- DTO 均 `rename_all = "camelCase"`，与前端 `NativeTimerSnapshot/Completion` 严格对齐。

### 5.4 `tray/` 上下文

`build_tray(app: &App)`：菜单「显示/隐藏」「退出」（中文文案不变）、复用 `default_window_icon()`（无 image-png feature）、左键单击/菜单均走 `toggle_window`（hide ↔ show+unminimize+focus）。`app.exit(0)` 退出。与原 `lib.rs` 内实现逐行等价。

### 5.5 Rust 侧旧 → 新映射

| 旧 | 新 | 变化性质 |
|---|---|---|
| `src-tauri/src/native_timer.rs` | `src-tauri/src/timer/engine.rs` | git mv 平移，内容不改 |
| `lib.rs` 中的 3 个 `#[tauri::command] fn` | `src-tauri/src/timer/commands.rs` | 平移 + 由私有改 `pub` |
| `lib.rs` 中的托盘函数 | `src-tauri/src/tray/mod.rs` | 平移 + 由私有改 `pub` |
| `lib.rs`（混合职责） | `lib.rs`（纯组合根） | 删业务、留装配 |

### 5.6 IPC 契约（前后端对齐表，重构中逐字保持）

| 方向 | 名称 | 参数/载荷（camelCase） |
|---|---|---|
| JS → Rust | `native_timer_start` | `{ durationMs: number, notification: { title, body } \| null }` → `Snapshot` |
| JS → Rust | `native_timer_pause` | 无参 → `Snapshot` |
| JS → Rust | `native_timer_cancel` | `{ generation: number \| null }` → `Snapshot` |
| Rust → JS | 事件 `native-timer-completed` | `{ running, remainingMs, generation, notificationSent }` |

前端唯一接触点为 `nativeTimerAdapter`（`src/infrastructure/platform/nativeTimerAdapter.ts`，`event.listen<NativeTimerCompletion>`）。

---

## 6. 关键机制保持（行为不变性论证)

| 机制 | 重构前 | 重构后 | 不变性依据 |
|---|---|---|---|
| 墙钟倒计时 | `endAt` 绝对时间戳 + `remainingSeconds` | 同一函数移至 `domain/timer/countdown.ts` | 纯函数逐字符平移，timer.test 覆盖 |
| 双计时适配器 | 桌面 Rust worker / 浏览器本地 interval | `nativeTimerPort` 判空回退，机制同前 | 适配器返回 `null` 即走旧路径 |
| 代际取消 | Rust generation + JS 动作序号 | `engine.rs` 原样 + engine hook 原样 | 双端代码未改语义 |
| 每日重置 | `mergeState` 内比对 `date` | 同函数移至 `domain/settings/persistedState.ts` | 逻辑平移 + 持久化不变 |
| 长休周期 | `cycleFocusCount` 跨日存活 | `completeFocusCycle` 平移 | 9 例 timer 测试全过 |
| 历史裁剪 | 60 天 prune、7 天视图 | `pruneHistory`/`last7Days` 平移 | focusHistory 4 例全过 |
| 备份往返 | build/parse + merge + prune | 移至应用层，签名不变 | backupService 4 例全过 |
| 提示音/噪声 | WebAudio 程序化生成 | 文件平移至 `infrastructure/audio` | 代码零改动 |
| i18n | 手写 DICT [zh,en] | 平移至 presentation | 键与元组不变 |
| 关闭到托盘 | `prevent_close` + hide | 同逻辑移至组合根 | 逐行平移 |

---

## 7. 迁移实施步骤（实际执行顺序）

> 原则：**每一步结束时 `npm run typecheck` 必须为 0 错误**，小步可回滚；文件移动优先 `git mv` 保历史。

| 阶段 | 动作 | 验证点 |
|---|---|---|
| P0 基线 | 记录重构前行为基线：typecheck / vitest / build 结果、localStorage 键清单、IPC 签名 | 基线全绿 |
| P1 领域抽取 | 从旧 `timerRules.ts` 拆出 `domain/timer/{phase,pomodoroCycle,dailyProgress,countdown}`；`stats.ts → domain/stats`；`types.ts` 按归属拆分；建 barrel `index.ts`；测试文件同步迁移 | `npm test` 23 例全过 |
| P2 设置与持久化 | `persistence.ts` 拆为 `domain/settings/persistedState.ts`（纯逻辑）+ `infrastructure/storage/keys.ts`（键） | 同上 |
| P3 应用层 | 新建 `application/ports.ts`（从旧 platform.ts 的类型面提炼六端口）；`dataBackup.ts → application/backupService.ts` | backup 测试全过 |
| P4 基础设施 | `platform.ts` 拆为 `infrastructure/platform/{runtime,+4 Adapter}`（惰性加载内核独立）；`noise/chime → infrastructure/audio`；store 落地 | typecheck 0 |
| P5 表现层迁移 | `App.tsx/components/hooks/i18n/App.css → presentation/`；`todayKey → shared/date`；全部 import 改写指向新层 | typecheck 0 + build 成功 |
| P6 引擎解耦 | `usePomodoroEngine` 引入 `onPhaseComplete` 回调注入，业务规则收敛回 App | 行为回归（浏览器 dev 手测） |
| P7 Rust 拆分 | `git mv native_timer.rs timer/engine.rs`；新建 `timer/{mod,commands}.rs`、`tray/mod.rs`；`lib.rs` 重写为组合根 | `rustfmt --check` 解析通过；（可编译环境）`cargo test … native_timer --lib` 5 例 |
| P8 删除旧模块 | 确认零引用后删除扁平旧文件 | grep 残留扫描 = 0 |
| P9 文档同步 | `AGENTS.md`、`CLAUDE.md`、`README.md`、`docs/概要设计说明.md`、`docs/需求规格说明书.md` | 5 文档过时引用扫描 = 0 |
| P10 终验 | §8 全套验证 + 行为兼容清单 §9 | 全绿 |

**执行中踩坑与处置（供后人参考）：**
- 并发 `npm install` 会损坏 `@rollup/rollup-win32-x64-msvc` 原生包（症状：vitest 启动报 rollup binding 缺失）→ 删除该包目录后单独重装；
- `nativeTimerAdapter.ts` 的 `event.listen` 需显式 `listen<NativeTimerCompletion>` 泛型，否则 `payload` 推导为 `unknown` 报 typecheck 错；
- Rust 文件须放在 `src-tauri/src/<模块>/` 下（曾误放 `src-tauri/timer/`），`lib.rs` 的 `generate_handler!` 必须用 `timer::commands::` 全路径。

---

## 8. 测试与验证

### 8.1 测试布局（重构后）

| 套件 | 位置 | 例数 | 覆盖内容 |
|---|---|---|---|
| timer | `src/domain/timer/timer.test.ts` | 9 | 阶段周期、长休推进、跳过、跨日重置、延迟回调剩余秒数 |
| task | `src/domain/tasks/task.test.ts` | 6 | 增删切换、清已完成、activeId 为空、pomodoro 计数 |
| focusHistory | `src/domain/stats/focusHistory.test.ts` | 4 | 7 天视图、缺日补齐、60 天裁剪、记录累计 |
| backupService | `src/application/backupService.test.ts` | 4 | 构建往返、非法 JSON、错误 app 标识、形状校验 |
| Rust engine | `src-tauri/src/timer/engine.rs` `#[cfg(test)]` | 5 | 墙钟暂停保持、代际独占完成、取消失效、定向取消不误杀、worker 到点完成 |

### 8.2 验证结果（本次实施实测）

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | ✅ 0 错误 |
| `npm test`（vitest run） | ✅ 4 文件 23/23 通过（~0.8s） |
| `npm run build`（tsc -b && vite build） | ✅ 产出 dist/ |
| 过时引用 grep（旧模块名/旧 API） | ✅ 全仓库 0 命中（历史规格 `docs/superpowers/specs/` 除外，刻意保留原貌） |
| `rustfmt --check`（全部 5 个 Rust 文件） | ✅ 解析通过（仅风格差异；本仓库未强制 rustfmt） |
| `cargo test … native_timer --lib` | ⛔ **本机无法执行**：缺 MSVC `link.exe` 与 Windows SDK（见 §10） |

### 8.3 建议的回归手测（桌面端，待工具链就绪）

1. 启动/暂停/重置/跳过/切换阶段（鼠标 + `Space`/`R`/`S` + 全局热键 `Ctrl+Shift+P` 双击防抖）；
2. 专注自然到点：提示音 → 系统通知（原生先于事件）→ 自动进入休息 → `completedToday`/`focusMinutesToday`/图表/任务 pomodoro 同步；
3. 第 4 个专注到点进入长休；`skip` 不计数、不推进周期；
4. 跨日：改系统日期后启动/聚焦，日统计清零而 `cycleFocusCount` 保留；
5. 关闭窗口到托盘后计时继续、到点仍通知；托盘左键/菜单显隐正常；
6. 设置导出/导入：正常备份往返；粘贴坏 JSON 被拒且原数据不受影响；
7. 旧版 localStorage（v3 键）升级启动：设置/任务/历史完整可见；
8. 纯浏览器 `npm run dev`：全部 UI 可用、计时本地完成、原生调用 no-op。

---

## 9. 行为兼容性核对清单

| 维度 | 项目 | 状态 |
|---|---|---|
| 持久化 | 五个 localStorage 键名不变（`pomodoro-state-v3` / `pomodoro-history-v1` / `pomodoro-theme` / `pomodoro-pinned` / `pomodoro-lang`） | ✅ |
| 持久化 | `PersistedState` JSON 形状、`History` 形状、`DEFAULT_SETTINGS` 默认值 | ✅ |
| 持久化 | 跨日重置触发条件（load 合并时、午夜调度、focus/visibility、记录前、保存前） | ✅ |
| IPC | 三命令名 + `durationMs`/`generation` 参数名 + camelCase 返回 | ✅ |
| IPC | 事件名 `native-timer-completed` 与 `{…, notificationSent}` 载荷 | ✅ |
| IPC | worker「先系统通知、后事件」的顺序 | ✅ |
| UI | 三 Tab、380×580 窗口、主题色 `PHASE_COLOR`、中英文键、托盘文案 | ✅ |
| 音频 | 白/棕/粉噪声参数、完成提示音序列、无资源文件 | ✅ |
| 行为 | `skip` 不计专注、不推进周期；`cycleFocusCount` 跨日保留；60 天裁剪 / 7 天视图 | ✅ |
| 行为 | 关闭到托盘、全局热键、置顶开关、备份导出/导入拒绝坏数据 | ✅ |

---

## 10. 风险与已知限制

| # | 风险/限制 | 影响 | 缓解措施 |
|---|---|---|---|
| L1 | **本机缺 MSVC 工具链与 Windows SDK**，`cargo check/test` 无法执行（link.exe 缺失，在依赖构建脚本阶段即失败） | Rust 侧未经编译器验证 | 已做 `rustfmt --check` 语法解析（5 文件全过）+ 命令签名/serde/导入人工逐行比对；**待装 VS Build Tools 后执行 `cargo test --manifest-path src-tauri/Cargo.toml native_timer --lib`（5 例）与 `npm run tauri dev` 手测** |
| L2 | 桌面端行为仅靠静态验证与推演，未实机回归 | 原生计时/托盘/通知路径存在未知偏差可能 | §8.3 八项手测清单，工具链就绪后逐项执行 |
| L3 | barrel `index.ts` 的 `export *` 可能掩盖同名冲突 | 编译期可发现（重复导出报错） | 当前各上下文命名不冲突；新增同名导出时改为显式命名导出 |
| L4 | `App.tsx` 仍是最大单文件（组装根职责集中） | 可读性上限 | 属组装而非业务；后续可按 §11 拆 hooks，业务规则不得回流 |
| L5 | 历史文档 `docs/superpowers/specs/*` 含旧结构表述 | 新读者可能混淆 | 刻意保留（历史决策快照），文首可加「结构以 AGENTS.md 为准」提示 |

---

## 11. 后续演进方向（超出本次范围）

1. **`App.tsx` 继续瘦身**：跨日守卫、Toast、设置弹窗各自收敛为 `presentation/hooks/*`；业务规则若变复杂，抽 `application/` 用例（如 `completePhaseUseCase`）而非写进组件。
2. **统计上下文扩展**：新增周报/导出 CSV 时，规则进 `domain/stats`，仅视图进 `StatsView`。
3. **Rust 侧告警/持久化**：若原生层需要记录日志或落盘，作为 `timer` 上下文的仓储端口（trait）注入，组合根装配实现——保持 `engine.rs` 纯逻辑可测。
4. **依赖约束 CI**：用 `dependency-cruiser` 或简单 grep 规则把 §3.2 的 R1–R4 固化（domain/application 禁 React/Tauri/localStorage）。
5. **多语言**：按 i18n 既有约定扩展 `Lang` 与 `DICT` 第三元组，不引第三方 i18n 库。

---

## 12. 附录

### 12.1 命令速查

```bash
npm install            # 依赖（勿并发多个 npm install）
npm run dev            # Vite :1420（浏览器/tauri 共用）
npm run typecheck      # tsc --noEmit —— 唯一静态检查
npm test               # vitest run —— 23 例领域/应用测试
npm run build          # tsc -b && vite build
npm run tauri dev      # 完整桌面应用
cargo test --manifest-path src-tauri/Cargo.toml native_timer --lib   # Rust 引擎 5 例（需 MSVC 工具链）
```

### 12.2 本次实施产生的变更概览（git）

- 新增：`src/{domain,application,infrastructure,shared}/**`、`src-tauri/src/{timer,tray}/**`
- 移动（保历史）：`App.tsx/components/hooks/i18n → presentation/`、`chime/noise → infrastructure/audio`、`native_timer.rs → timer/engine.rs`
- 删除：`src/{timer,stats,dataBackup,persistence,platform,types}*` 等旧扁平模块
- 重写：`src-tauri/src/lib.rs`（组合根）
- 文档：`AGENTS.md`、`CLAUDE.md`、`README.md`、`docs/概要设计说明.md`、`docs/需求规格说明书.md` + 本文档
- 修复：`nativeTimerAdapter.ts` 的 `event.listen<NativeTimerCompletion>` 泛型标注（typecheck 所需）

### 12.3 相关文档

- [`AGENTS.md`](../AGENTS.md) —— 面向编码代理的仓库约定（分层、命令、原生层）
- [`README.md`](../README.md) —— 用户向项目说明（目录树、工作原理）
- [`docs/概要设计说明.md`](概要设计说明.md) —— HLD：总体架构、模块设计、关键机制、接口与测试设计
- [`docs/需求规格说明书.md`](需求规格说明书.md) —— SRS：功能/非功能需求与验收标准
- [`docs/NSIS-中文化.md`](NSIS-中文化.md) —— 安装器本地化（与本重构正交）

---

*本文档描述的重构已实施完毕；§8.2 为实测验证结果，§10 L1/L2 为遗留待办。*
