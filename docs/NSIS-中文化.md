# NSIS 安装包中文化说明

> 本文档说明如何为 Pomodoro 的 NSIS（`.exe`）安装包配置**简体中文**界面。
> 适用于 Windows 平台；macOS / Linux 不受影响。

## 背景知识：NSIS 安装界面的两层文字

Tauri 的 NSIS 安装包界面文字来自**两个来源**，需要分别处理：

| 层级 | 内容 | 来源 | 是否需手动配置 |
| --- | --- | --- | --- |
| ① NSIS 标准界面 | 欢迎页、许可证页、组件页、安装进度、完成页等通用文字 | NSIS 自带的语言文件（`SimpChinese.nlf` / `SimpChinese.nsh`） | 否，只要把语言名加入 `languages` 即自动加载 |
| ② Tauri 自定义消息 | 「已安装」「添加/重新安装组件」「正在安装 WebView2……」「卸载 ${PRODUCTNAME}」等 Tauri 额外添加的提示 | Tauri 内置的 `English.nsh`，**默认只有英文** | **是**，需提供中文翻译并通过 `customLanguageFiles` 指定 |

> 只配 `languages: ["SimpChinese"]` 能让大部分界面变中文，但 Tauri 自己那几条提示仍是英文。
> 要做到全中文，必须两层都配。本项目已同时配置两层。

## 已做的改动

### 1. 新增中文翻译文件

`src-tauri/nsis/SimpChinese.nsh` —— 照 Tauri 内置 `English.nsh` 的结构，把 27 条 `LangString` 翻译为简体中文。

**关键约束**（写/改翻译时务必遵守）：
- `LangString <键名> ${LANG_SIMPCHINESE} "中文译文"` —— 键名与语言常量**不可改动**。
- 占位符变量必须原样保留，**只翻译文字**：
  - `${PRODUCTNAME}` / `${VERSION}` —— 应用名 / 版本（NSIS 变量）
  - `{{product_name}}` —— 应用名（Tauri 模板占位符）
  - `$R4` / `$0` / `$1` / `$\n` —— NSIS 运行时变量与换行
- 例如 `appRunning` 译为 `"{{product_name}} 正在运行！请先关闭它再重试。"`，`{{product_name}}` 保留不动。

### 2. 修改 `src-tauri/tauri.conf.json`

在 `bundle` 下新增 `windows.nsis` 配置：

```json
"bundle": {
  "active": true,
  "targets": "all",
  "icon": [ "..." ],
  "windows": {
    "nsis": {
      "languages": ["SimpChinese", "English"],
      "displayLanguageSelector": true,
      "customLanguageFiles": {
        "SimpChinese": "nsis/SimpChinese.nsh"
      }
    }
  }
}
```

字段含义：

| 字段 | 取值 | 说明 |
| --- | --- | --- |
| `languages` | `["SimpChinese", "English"]` | 安装包可用语言列表，**顺序即优先级**。排在第一的 `SimpChinese` 是默认语言。 |
| `displayLanguageSelector` | `true` | 安装前弹出语言选择框，让用户在「中文(简体)/English」间选择。设为 `false` 则直接用系统语言（匹配不到时回退到列表第一项）。 |
| `customLanguageFiles` | `{"SimpChinese": "nsis/SimpChinese.nsh"}` | 把上面第 1 步的中文翻译文件挂到 `SimpChinese` 语言上。**键名必须是一个已在 `languages` 里声明过的 NSIS 语言**，否则打包会报错。路径相对 `src-tauri/` 目录（与 `icon` 数组的相对路径基准一致）。 |

> `languages` 里用的是 NSIS 的语言标识名（如 `SimpChinese`、`TradChinese`、`English`），不是 BCP-47 语言码。
> 完整语言列表见 NSIS 官方：<https://github.com/kichik/nsis/tree/9465c08046f00ccb6eda985abbdbf52c275c6c4d/Contrib/Language%20files>

## 打包与验证

### 重新打包

```bash
npm run tauri build          # 同时生成 msi + nsis
# 或只重打 NSIS（Rust 已编译缓存时更快）：
npx tauri build --bundles nsis
```

### 验证中文化是否生效

构建完成后，检查生成的安装脚本 `src-tauri/target/release/nsis/x64/installer.nsi`，应能看到：

```nsi
!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"
...
!include "...\nsis\x64\SimpChinese.nsh"   ; 你的自定义中文翻译被 include 进来
!include "...\nsis\x64\English.nsh"
```

### 产物路径

```
src-tauri/target/release/bundle/nsis/Pomodoro_1.0.0_x64-setup.exe   # 中文安装包
```

双击运行，开头会弹出语言选择框（因 `displayLanguageSelector: true`）；选「中文(简体)」后，整个安装/卸载向导界面、WebView2 安装提示等均为中文。

## 常见问题

**Q：为什么我设了 `languages: ["SimpChinese"]`，但「正在安装 WebView2……」「已安装」等仍是英文？**
A：那是 Tauri 自定义消息（第②层），NSIS 自带语言文件不含它们。需要通过 `customLanguageFiles` 提供中文 `.nsh`，本项目已做。

**Q：想同时支持简体 + 繁体中文？**
A：在 `languages` 里加 `"TradChinese"`，并准备 `src-tauri/nsis/TradChinese.nsh`（同样照 `English.nsh` 结构翻译，常量用 `${LANG_TRADCHINESE}`），在 `customLanguageFiles` 里加 `"TradChinese": "nsis/TradChinese.nsh"`。

**Q：不想弹语言选择框，直接默认中文？**
A：把 `displayLanguageSelector` 改为 `false`。此时安装包按系统语言显示——简体中文系统会显示中文，英文系统会回退到 `languages` 第一项（也是 `SimpChinese`），所以仍为中文。

**Q：MSI 安装包（`.msi`）能中文化吗？**
A：不能通过本配置。MSI 由 WiX 生成，界面语言走另一套机制（WiX 的 `WixUI` 本地化 + `Product/@Language`），与 NSIS 无关。本项目默认生成的 `Pomodoro_1.0.0_x64_en-US.msi` 是英文界面。如需中文 MSI，需单独配置 WiX 本地化文件，超出本文范围。
