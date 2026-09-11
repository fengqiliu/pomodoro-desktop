# Pomodoro

> 一款扁平风格的桌面番茄钟，专注、安静、不打扰。

**v2.0** —— 基于 **Tauri 2** 的单窗口桌面番茄钟（380×580，不可缩放，产品名 `Pomodoro`，标识符 `com.flat.pomodoro`）。前端 React 18 + TypeScript + Vite；桌面端由 Rust 原生计时模块负责倒计时截止与完成事件，浏览器开发模式自动回退到 JavaScript 计时。默认语言为简体中文，内置 English。

v2.0 重点：前端由单文件重构为「引擎 hook + 组件」模块化架构，新增数据备份（剪贴板导出/导入）、历史自动裁剪、窗口标题倒计时、应用内快捷键（Space/R/S）与 Toast 提示。

## 功能

- **三阶段计时** —— 专注 / 短休息 / 长休息，环形进度条随阶段变色
- **可配置时长** —— 专注 25 分钟、短休 5 分钟、长休 15 分钟，每完成 4 个番茄进入长休（均可调）
- **任务清单** —— 添加 / 完成 / 删除任务，选一个为「当前专注任务」，自动累计每个任务吃掉的番茄数 🍅
- **7 天统计** —— 柱状图按「番茄数 / 专注分钟」切换，展示今日与本周汇总
- **白噪音** —— 内置白 / 棕 / 粉噪音生成器（WebAudio 实时合成，无音频文件），可调音量
- **完成提示音** —— 阶段结束时播放清脆的钟声
- **深色 / 浅色主题** —— 默认跟随系统，可手动切换
- **窗口置顶** —— 一键钉在最前（Tauri 窗口能力）
- **全局快捷键** —— 开始 / 暂停，默认 `CommandOrControl+Shift+P`，可在设置中修改
- **系统托盘与通知** —— 关闭窗口后继续驻留托盘；可显示/隐藏、退出，并在阶段结束时发送原生通知
- **本地持久化** —— 全部状态保存在 localStorage，跨重启保留；每日自动重置今日计数
- **数据备份** —— 设置中一键导出/导入（剪贴板 JSON 往返，浏览器与桌面端通用）
- **应用内快捷键** —— `Space` 开始/暂停、`R` 重置、`S` 跳过；窗口标题实时显示倒计时
- **中文安装包** —— Windows NSIS 安装器已本地化为简体中文（含语言选择框），详见 `docs/NSIS-中文化.md`

## 技术栈

| 层 | 技术 |
| --- | --- |
| 桌面框架 | Tauri 2 |
| 前端 | React 18、TypeScript 5.6、Vite 6 |
| 后端 | Rust（edition 2021） |
| 原生插件 | `tauri-plugin-global-shortcut`、`tauri-plugin-notification` |
| 音频 | WebAudio API（噪音合成 + 钟声） |
| 国际化 | 手写字典（无第三方库） |

## 前置要求

- **Node.js** 18+
- **Rust** 稳定版工具链（`rustup` 安装）
- **Tauri 2 系统依赖** —— 因平台而异，详见 [Tauri 官方前置说明](https://tauri.app/start/prerequisites/)
  - macOS：Xcode Command Line Tools
  - Windows：Microsoft C++ Build Tools、WebView2（Win 11 已预装）
  - Linux：`webkit2gtk`、`libayatana-appindicator` 等系统库

## 快速开始

```bash
npm install
npm run tauri dev     # 启动完整桌面应用（自动拉起 Vite + 原生窗口）
```

只想调试前端界面、不启动原生窗口时：

```bash
npm run dev           # 仅 Vite，端口 1420，可在普通浏览器打开
```

> 浏览器模式下，置顶 / 全局快捷键等原生功能会自动降级为 no-op（见 `src/platform.ts`），其余功能正常。便于在没有 Rust 环境的机器上迭代 UI。

## 常用命令

```bash
npm install           # 安装依赖
npm run dev           # 仅前端开发（浏览器，:1420）
npm test              # Vitest 回归测试（计时规则）
npm run typecheck     # tsc --noEmit —— TypeScript 静态检查（无 lint）
npm run build         # tsc -b && vite build → dist/
npm run preview       # 预览构建产物

npm run tauri dev     # 桌面应用开发模式
npm run tauri build   # 打包桌面应用（先自动执行 npm run build）
npx tauri build --bundles nsis   # 只重打 NSIS 安装包（Rust 已缓存时更快）
cargo test --manifest-path src-tauri/Cargo.toml native_timer --lib  # 原生计时测试

python3 gen_icons.py  # 重新生成应用图标（需 Pillow），输出到 src-tauri/icons/
```

## 项目结构

```
pomodoro-desktop/
├── src/                    # 前端
│   ├── App.tsx             # 组装层：状态持有、业务收尾、标签页切换
│   ├── hooks/
│   │   └── usePomodoroEngine.ts  # 计时引擎：墙上时间倒计时、原生计时桥接、代际取消
│   ├── components/         # UI 组件：TopBar / TimerView / TasksView / StatsView / SettingsModal
│   ├── types.ts            # Task / Settings / NoisePref 等类型
│   ├── persistence.ts      # 版本化 localStorage 键、默认设置、状态合并与加载
│   ├── stats.ts            # 历史记录：记录、7 天视图、60 天自动裁剪
│   ├── dataBackup.ts       # 备份构建与校验导入（JSON 往返）
│   ├── chime.ts            # 完成钟声（WebAudio 振荡器）
│   ├── platform.ts         # 浏览器/桌面抽象层：惰性加载 Tauri API
│   ├── noise.ts            # WebAudio 白/棕/粉噪音引擎
│   ├── i18n.ts             # 手写 zh/en 字典 + translate()
│   ├── timer/
│   │   ├── timerRules.ts   # 纯计时规则（长休周期、跨日重置、剩余时间）
│   │   └── timerRules.test.ts
│   ├── stats.test.ts / dataBackup.test.ts
│   ├── main.tsx            # React 入口
│   └── index.css           # 浏览器重置（7 行）
├── src-tauri/              # Rust/Tauri 外壳
│   ├── src/lib.rs          # 托盘、窗口生命周期与原生计时命令
│   ├── src/native_timer.rs # 墙上时间计时引擎、代际取消和 Rust 单元测试
│   ├── src/main.rs         # Windows 下隐藏控制台窗口
│   ├── tauri.conf.json     # 窗口与打包配置（含 NSIS 中文化）
│   ├── capabilities/default.json   # 原生权限白名单
│   ├── nsis/SimpChinese.nsh        # NSIS 安装器简体中文翻译（27 条 Tauri 自定义消息）
│   └── icons/              # 应用图标
├── docs/                   # 项目文档
│   ├── 需求规格说明书.md   # SRS：功能/非功能需求（含验收标准）、数据与界面需求
│   ├── 概要设计说明.md     # HLD：总体架构、模块设计、关键机制、接口与测试设计
│   └── NSIS-中文化.md      # NSIS 安装包中文化配置说明
├── gen_icons.py            # 图标生成脚本（Pillow 绘制扁平番茄时钟）
├── index.html
├── vite.config.ts          # 固定 1420 端口（Tauri 期望）
└── package.json
```

## 工作原理（要点）

- **分层架构（v2.0）**：`App.tsx` 只做状态持有与组装；计时机制收敛在 `hooks/usePomodoroEngine.ts`（倒计时、原生桥接、代际取消），阶段结束的业务规则通过 `onPhaseComplete` 回调注入；纯展示组件在 `components/`，纯领域规则在 `timer/timerRules.ts`、`stats.ts`、`dataBackup.ts`（均可被 Vitest 直接测试）。新增功能先找对应模块，不往 `App.tsx` 堆。
- **平台抽象层**：`platform.ts` 通过 `__TAURI_INTERNALS__` 判断是否在桌面环境，并惰性动态导入 Tauri API——这样在普通浏览器里不会因无法解析 `@tauri-apps/*` 而崩溃。新增原生功能请走这一层，不要在组件里直接 import。
- **持久化与每日重置**：状态写入带版本后缀的 localStorage 键（`pomodoro-state-v3`、`pomodoro-history-v1` 等）。日报会在启动、午夜、窗口恢复、完成专注和持久化前校验日期，避免长期驻留托盘时跨日污染数据。**修改持久化结构时，递增键的后缀**，不做迁移。
- **番茄循环**：今日统计与长休息循环分别记录。`cycleFocusCount` 在每次完成专注后推进、触发长休息后归零，并会跨日期延续，因此“每 N 个番茄长休息”不受每日统计重置影响。
- **历史自动裁剪**：`stats.ts` 在启动、记录和导入时把历史裁剪到近 60 天，防止 localStorage 无界增长（图表只用近 7 天）。
- **数据备份**：设置面板可导出/导入 JSON 备份（经剪贴板往返，桌面与浏览器通用）。导入时 `dataBackup.parseBackup` 校验载荷、按默认值合并状态并裁剪历史，坏数据不会写入存储。
- **测试**：计时规则位于 `src/timer/timerRules.ts`，通过 Vitest 覆盖长休息周期、跳过阶段、跨日重置和延迟回调的剩余时间计算；`stats.test.ts` 与 `dataBackup.test.ts` 覆盖历史裁剪与备份往返。
- **双计时适配器**：桌面端通过 `native_timer_start` / `pause` / `cancel` 命令让 Rust 按墙上时间判断完成；启动时会把完成通知的标题与正文交给原生 worker，worker 先发送系统通知、再发送完成事件，因此托盘中不依赖 WebView 的 JS interval 或通知回调。浏览器模式仍使用相同的结束时间戳算法本地完成。React 只负责界面刷新、阶段规则、统计和自动衔接。
- **原生层**：`src-tauri/src/lib.rs` 注册全局快捷键与通知插件，并负责托盘菜单、关闭到托盘、窗口显隐和原生计时命令。全局开始/暂停快捷键由 App 注册，编辑时仅保存草稿，点击「完成」后才尝试应用。
- **主题**：CSS 变量在 `App.css` 的 `:root`（浅色）与 `[data-theme="dark"]`（深色）定义；阶段强调色 `--accent`（红/绿/蓝）在每次渲染时以行内样式覆盖。

## 配置

在应用内「设置」面板调整：语言、专注/短休/长休时长、长休间隔、提示音开关、噪音类型与音量、全局快捷键。「恢复默认」可一键重置。

## 文档

| 文档 | 说明 |
| --- | --- |
| [docs/需求规格说明书.md](docs/需求规格说明书.md) | SRS —— 功能需求（按域编号、含验收标准）、非功能需求、数据/界面需求、验收与测试要求、范围外 |
| [docs/概要设计说明.md](docs/概要设计说明.md) | HLD —— 分层架构与模块设计、关键机制（墙上时间倒计时、双计时适配器、代际取消、每日重置等）、数据与接口设计、错误处理与测试设计 |
| [docs/NSIS-中文化.md](docs/NSIS-中文化.md) | Windows NSIS 安装包简体中文本地化的配置说明 |

## 许可证

本项目采用 **Apache License 2.0** 开源，详见根目录的 `LICENSE` 文件。
