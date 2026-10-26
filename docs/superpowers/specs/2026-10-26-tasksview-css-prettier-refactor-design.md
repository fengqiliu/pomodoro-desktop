# TasksView / App.css 拆分与 Prettier 规范化 — 设计

日期：2026-10-26 · 规模：小型重构（无用户可见行为变化）

## 意图

降低两个最臃肿文件的维护成本（`TasksView.tsx` 402 行、`App.css` 1513 行），并让全局 Prettier 钩子（`~/.claude/settings.json` 对每个被编辑文件执行 `npx --yes prettier --write`）的输出与仓库规范一致，不再整文件重排、污染 diff。顺带把 CLAUDE.md 的测试计数同步为实际值。

## 目标 / 非目标 / 反目标

- 目标：文件按界面区域拆小；Prettier 成为项目正式格式规范并由 CI 校验；文档计数准确。
- 非目标：不改功能、不改类名、不引入 CSS Modules / CSS-in-JS、不调整视觉。
- 反目标：任何界面外观或交互变化（含层叠顺序导致的样式覆盖失效）；格式化改动与逻辑改动混在同一提交里。

## 方案取舍（已选 A）

| 项        | A（已选）                                                                                                | 放弃的方案                                                                                                    |
| --------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Prettier  | 采用为项目规范：配置 + 固定版本 devDependency + `format`/`format:check` + CI 校验 + 独立的全量格式化提交 | B：`.prettierignore` 全量退出（零改动但无规范）；"只加配置不全量格式化"（每碰一个文件就整文件重排，问题延续） |
| App.css   | 按组件拆到同目录 CSS，组件自行 import；`App.css` 只留主题变量、深色模式、公共样式                        | CSS Modules（需改全部类名，纯重构里过重）；只在单文件内整理（文件不变小）                                     |
| TasksView | 拆为 `TaskAddForm` / `TaskFilterBar` / `TaskItem`                                                        | —                                                                                                             |

## 已定的做法

### 1. Prettier（先做，独立提交）

- `.prettierrc`：`printWidth: 100`、`singleQuote: false`、`semi: true`、`trailingComma: "es5"`（贴合现有：对象/数组多行带尾逗号，函数参数不带）。
- `prettier` 以固定版本装为 devDependency，钩子里的 `npx` 将优先用本地版本。
- `.prettierignore`：`dist/`、`src-tauri/`、`package-lock.json`、`docs/`、`*.md`（中文文档不参与格式化）。
- 范围：`src/**/*.{ts,tsx,css}`、`scripts/`、根目录配置文件。
- `package.json` 新增 `format`、`format:check`；CI 前端 job 增加 `npm run format:check` 步骤。
- 提交顺序：①配置与脚本 ②全量格式化（单独提交，仅格式变化）。

### 2. TasksView 拆分

- `TasksView` 保留：筛选状态（status / category / search / showSearch）、`editingId`、`filterTaskEntries` 计算与列表/空状态渲染、页脚。
- `TaskAddForm`：新任务标题、预估番茄数、分类三项输入的状态与提交。
- `TaskFilterBar`：状态胶囊、分类筛选、搜索框（受控，状态由父组件传入）。
- `TaskItem`：单行渲染；编辑草稿（标题、预估数）和失焦处理放在内部，`isEditing` 由父组件传入。
- 保持现有行为：编辑行失焦（含点击筛选/搜索控件）即保存，Enter 保存、Escape 取消；筛选状态下可跨隐藏任务上下移动；a11y 属性与 i18n key 不变。

### 3. App.css 拆分

- 先按区域把分散的同类规则归拢（如顶栏 78 行与 1052 行两段、统计 288 行与 1067 行两段），再拆到各组件旁的 CSS 文件（`TopBar.css`、`TimerView.css`、`TasksView.css`、`StatsView.css`、`TrendPanel.css`、`CategoryBreakdown.css`、`SettingsModal.css` 等，以实际组件为准）。
- `App.css` 保留：`:root` / `[data-theme="dark"]` 变量、全局元素样式、tabs、toast、焦点可见性、`prefers-reduced-motion`、深色模式微调等跨组件规则。
- 层叠顺序：所有规则在最终打包里的相对顺序须保持一致，或确认后置规则与前置规则不冲突后才移动；涉及覆盖关系的规则放在同一文件内。
- 验证：拆分前后在浏览器（`npm run dev`）中对三个标签页 + 设置弹窗，浅色/深色各截图对比，要求无可见差异。

### 4. 文档

- CLAUDE.md（及 README 如有）测试计数改为实际值（当前 13 个文件 / 131 例）；补上新组件与 CSS 组织方式的说明，以及 `format` 脚本。

## 留给实施者

- 各 CSS 文件的具体切分边界、组件 props 的精确命名。
- Prettier 固定的具体版本号（取安装时的最新稳定版）。
- 每一步都需通过 `npm test`、`npm run typecheck`、`npm run build`。
