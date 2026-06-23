# Pomodoro

> 一款扁平风格的桌面番茄钟，专注、安静、不打扰。

一个基于 **Tauri 2** 的单窗口桌面番茄钟（380×580，不可缩放）。前端 React 18 + TypeScript + Vite，后端是一层极薄的 Rust/Tauri 外壳——没有任何自定义命令，所有原生能力都通过 Tauri 插件 API 从 JS 侧调用。默认语言为简体中文，内置 English。

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
- **本地持久化** —— 全部状态保存在 localStorage，跨重启保留；每日自动重置今日计数

## 技术栈

| 层 | 技术 |
| --- | --- |
| 桌面框架 | Tauri 2 |
| 前端 | React 18、TypeScript 5.6、Vite 6 |
| 后端 | Rust（edition 2021） |
| 原生插件 | `tauri-plugin-shell`、`tauri-plugin-global-shortcut` |
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
npm run typecheck     # tsc --noEmit —— 项目唯一的静态检查（无 lint / 无测试）
npm run build         # tsc -b && vite build → dist/
npm run preview       # 预览构建产物

npm run tauri dev     # 桌面应用开发模式
npm run tauri build   # 打包桌面应用（先自动执行 npm run build）

python3 gen_icons.py  # 重新生成应用图标（需 Pillow），输出到 src-tauri/icons/
```

## 项目结构

```
pomodoro-desktop/
├── src/                    # 前端
│   ├── App.tsx             # 全部 UI：计时环 / 任务 / 统计 / 设置弹窗（单文件）
│   ├── App.css             # 主题变量（:root + [data-theme="dark"]）与样式
│   ├── platform.ts         # 浏览器/桌面抽象层：惰性加载 Tauri API
│   ├── noise.ts            # WebAudio 白/棕/粉噪音引擎
│   ├── i18n.ts             # 手写 zh/en 字典 + translate()
│   ├── main.tsx            # React 入口
│   └── index.css           # 浏览器重置（7 行）
├── src-tauri/              # Rust/Tauri 外壳
│   ├── src/lib.rs          # 注册两个插件、运行上下文（无自定义命令）
│   ├── src/main.rs         # Windows 下隐藏控制台窗口
│   ├── tauri.conf.json     # 窗口与打包配置
│   ├── capabilities/default.json   # 原生权限白名单
│   └── icons/              # 应用图标
├── gen_icons.py            # 图标生成脚本（Pillow 绘制扁平番茄时钟）
├── index.html
├── vite.config.ts          # 固定 1420 端口（Tauri 期望）
└── package.json
```

## 工作原理（要点）

- **单一 UI 文件**：`App.tsx` 承载整个界面与状态。无路由、无状态库，使用 `useState`/`useRef` + `localStorage`。三个标签页（计时 / 任务 / 统计）条件渲染。
- **平台抽象层**：`platform.ts` 通过 `__TAURI_INTERNALS__` 判断是否在桌面环境，并惰性动态导入 Tauri API——这样在普通浏览器里不会因无法解析 `@tauri-apps/*` 而崩溃。新增原生功能请走这一层，不要在 `App.tsx` 直接 import。
- **持久化与每日重置**：状态写入带版本后缀的 localStorage 键（`pomodoro-state-v2`、`pomodoro-history-v1` 等）。`loadState()` 在存储日期与今日不符时自动清零当日计数。**修改持久化结构时，递增键的后缀**（如 `-v3`），不做迁移。
- **原生层**：`src-tauri/src/lib.rs` 仅注册 `shell` 与 `global-shortcut` 两个插件，无 `#[tauri::command]`。全局开始/暂停快捷键在 `App.tsx` 注册，随 `settings.hotkey` 变化自动重注册。
- **主题**：CSS 变量在 `App.css` 的 `:root`（浅色）与 `[data-theme="dark"]`（深色）定义；阶段强调色 `--accent`（红/绿/蓝）在每次渲染时以行内样式覆盖。

## 配置

在应用内「设置」面板调整：语言、专注/短休/长休时长、长休间隔、提示音开关、噪音类型与音量、全局快捷键。「恢复默认」可一键重置。

## 许可证

本项目未声明开源许可证。如需使用或分发，请联系作者。
