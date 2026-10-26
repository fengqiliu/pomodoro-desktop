# TasksView / App.css 拆分与 Prettier 规范化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Prettier 成为项目格式规范，把 `TasksView.tsx`（402 行）拆成三个子组件、把 `App.css`（1513 行）按组件拆分，且界面与交互零变化。

**Architecture:** 先落 Prettier（配置 + 一次独立的全量格式化），之后所有编辑都由全局钩子按仓库规范格式化。TasksView 的两条纯规则（分类轮换、预估数解析）下沉到 `domain/tasks` 并用 TDD 覆盖，再拆出 `TaskAddForm` / `TaskFilterBar` / `TaskItem`。CSS 按组件就近拆分，用浏览器内的"计算样式快照"在拆分前后逐元素比对，证明无视觉变化。

**Tech Stack:** React 18 + TypeScript + Vite 6、Vitest 4、Prettier（devDependency，精确版本）、GitHub Actions。

**Spec:** `docs/superpowers/specs/2026-10-26-tasksview-css-prettier-refactor-design.md`

## Global Constraints

- 无任何用户可见的行为或外观变化；类名、i18n key、a11y 属性一律不改。
- Prettier 配置：`printWidth: 100`、`singleQuote: false`、`semi: true`、`trailingComma: "es5"`。
- `.prettierignore`：`dist`、`src-tauri`、`package-lock.json`、`docs`、`*.md`。
- 全量格式化必须是单独提交，只含格式变化。
- 不引入 CSS Modules / CSS-in-JS / 新的运行时依赖；Prettier 只作 devDependency。
- 每个任务结束前通过：`npm test`、`npm run typecheck`、`npm run build`；Task 1 之后还要通过 `npm run format:check`。
- domain 层保持纯净（架构守卫 R1–R7），新测试与源文件同目录。
- npm registry 是 `https://registry.npmmirror.com`；沙箱里安装依赖需把 `registry.npmmirror.com` 加入 allowed_domains。

## Review Focus

1. **CSS 层叠顺序**：同优先级规则跨文件后先后顺序改变（尤其 `:where(button, [role="tab"], input, select, textarea, a):focus-visible` 只有 0,1,0 优先级，必须仍排在所有组件样式之后）→ Task 4 的计算样式快照比对覆盖。
2. **编辑行失焦逻辑**：标题输入框 ↔ 预估输入框之间切换焦点不得退出编辑；Enter 保存后紧随的 blur 不得二次保存；Escape 不得保存 → Task 3 Step 6 手动核对。
3. **筛选视图中的排序接线**：拆分后上/下移仍用原始下标、跳过隐藏任务 → Task 3 Step 6 手动核对（domain 层已有 `filterTaskEntries` 用例）。
4. **钩子对 `.md` 的处理**：加 `.prettierignore` 后，`npx prettier --write` 作用于 `docs/**/*.md` 不得改动文件 → Task 1 Step 4。
5. **深色主题与设置弹窗样式**：`[data-theme="dark"] .modal`、`.ctrl-main` 等主题微调拆走后仍生效 → Task 4 快照包含深色主题与弹窗打开状态。

---

## 文件结构

| 文件 | 职责 |
|---|---|
| `.prettierrc.json`、`.prettierignore`（新建） | 格式规范与排除范围 |
| `.git-blame-ignore-revs`（新建） | 让 `git blame` 跳过全量格式化提交 |
| `package.json` / `package-lock.json` | `prettier` devDependency，`format`、`format:check` 脚本 |
| `.github/workflows/ci.yml` | 前端 job 增加格式检查步骤 |
| `src/domain/tasks/task.ts`、`task.test.ts` | 新增 `nextTaskCategory`、`parseEstimate` |
| `src/presentation/components/TaskAddForm.tsx`（新建） | 新增任务表单（标题/分类/预估） |
| `src/presentation/components/TaskFilterBar.tsx`（新建） | 状态胶囊、分类筛选、搜索开关与搜索行 |
| `src/presentation/components/TaskItem.tsx`（新建） | 单个任务行，含编辑草稿与失焦处理 |
| `src/presentation/components/TasksView.tsx` | 只做组装：筛选状态、`editingId`、列表/空状态/页脚 |
| `src/presentation/components/*.css`（新建） | 各组件样式：`TopBar.css`、`TimerView.css`、`TasksView.css`、`StatsView.css`、`TrendPanel.css`、`CategoryBreakdown.css`、`SettingsModal.css` |
| `src/presentation/a11y.css`（新建） | 焦点可见性与 reduced-motion，必须最后加载 |
| `src/presentation/App.css` | 只留主题变量、全局元素、`.app`、tabs、`.tab-panel`、toast 及跨组件共享类 |
| `CLAUDE.md`、`README.md` | 测试计数、新组件、CSS 组织、`format` 脚本 |

---

### Task 1: 采用 Prettier 并全量格式化

**Files:**
- Create: `.prettierrc.json`, `.prettierignore`, `.git-blame-ignore-revs`
- Modify: `package.json`, `package-lock.json`, `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `npm run format`（`prettier --write .`）、`npm run format:check`（`prettier --check .`）；之后各任务的代码都应已符合格式。

- [ ] **Step 1: 安装 Prettier（精确版本）**

Run: `npm install --save-dev --save-exact prettier`（allowed_domains: `registry.npmmirror.com`）
Expected: `package.json` 的 devDependencies 出现不带 `^` 的 `"prettier": "x.y.z"`。

- [ ] **Step 2: 写配置、脚本与 CI 步骤**

`.prettierrc.json` 写入 Global Constraints 中的四项配置；`.prettierignore` 写入五项排除。`package.json` 的 scripts 增加 `"format": "prettier --write ."` 和 `"format:check": "prettier --check ."`。`ci.yml` 的 frontend job 在 `Install frontend dependencies` 之后插入：

```yaml
      - name: Prettier format check
        run: npm run format:check
```

- [ ] **Step 3: 确认检查当前会失败**

Run: `npm run format:check`
Expected: 以非零码退出，并列出待格式化的文件（证明检查确实有效）。

- [ ] **Step 4: 确认 `.md` 已被排除**

Run: `npx prettier --write docs/superpowers/specs/2026-10-26-tasksview-css-prettier-refactor-design.md && git status --short docs/`
Expected: 输出里没有该文件的修改。

- [ ] **Step 5: 提交配置**

```bash
git add .prettierrc.json .prettierignore package.json package-lock.json .github/workflows/ci.yml
git commit -m "chore: 采用 Prettier 作为项目格式规范"
```

- [ ] **Step 6: 全量格式化并验证**

Run: `npm run format && npm run format:check && npm test && npm run typecheck && npm run build`
Expected: 全部通过；`git diff --stat` 只涉及格式（逐个抽查 `src/domain/tasks/task.ts`、`App.css`、`ci.yml`，确认只有空白/换行/逗号变化）。

- [ ] **Step 7: 提交全量格式化**

```bash
git add -A
git commit -m "style: 全量 Prettier 格式化（仅格式变化）"
```

- [ ] **Step 8: 记录 blame 忽略**

把 Step 7 的完整提交哈希写入 `.git-blame-ignore-revs`（前面加一行注释 `# Prettier 全量格式化`）。

```bash
git add .git-blame-ignore-revs
git commit -m "chore: git blame 忽略全量格式化提交"
```

---

### Task 2: 任务分类轮换与预估数解析下沉到 domain

**Files:**
- Modify: `src/domain/tasks/task.ts`
- Test: `src/domain/tasks/task.test.ts`

**Interfaces:**
- Produces:
  - `nextTaskCategory(current?: TaskCategory): TaskCategory | undefined`：无分类 → `work` → `study` → `life` → `other` → 无分类（与 `TasksView` 现有的 `NEXT_CATEGORY` 一致；按 `TASK_CATEGORIES` 的顺序实现）。
  - `parseEstimate(input: string): number | undefined`：用 `parseInt(input, 10)` 解析，结果是 NaN 或 ≤ 0 时返回 `undefined`。

- [ ] **Step 1: 写失败测试**

```ts
describe("nextTaskCategory", () => {
  it("cycles none → work → study → life → other → none", () => {
    expect(nextTaskCategory(undefined)).toBe("work");
    expect(nextTaskCategory("work")).toBe("study");
    expect(nextTaskCategory("study")).toBe("life");
    expect(nextTaskCategory("life")).toBe("other");
    expect(nextTaskCategory("other")).toBeUndefined();
  });
});

describe("parseEstimate", () => {
  it("accepts positive integers and truncates decimals", () => {
    expect(parseEstimate("3")).toBe(3);
    expect(parseEstimate("2.7")).toBe(2);
  });
  it("returns undefined for empty, zero, negative and non-numeric input", () => {
    for (const s of ["", "0", "-2", "abc"]) expect(parseEstimate(s)).toBeUndefined();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/domain/tasks/task.test.ts`
Expected: FAIL（`nextTaskCategory` / `parseEstimate` is not a function，或导入报错）。

- [ ] **Step 3: 在 `task.ts` 中实现两个函数**（签名见 Interfaces；`index.ts` 已经 `export *`，不需要改）

- [ ] **Step 4: 运行确认通过**

Run: `npm test && npm run typecheck`
Expected: 全部通过（用例数比当前多 3 个）。

- [ ] **Step 5: 提交**

```bash
git add src/domain/tasks/task.ts src/domain/tasks/task.test.ts
git commit -m "refactor(tasks): 分类轮换与预估数解析下沉为纯函数"
```

---

### Task 3: 拆分 TasksView

**Files:**
- Create: `src/presentation/components/TaskAddForm.tsx`, `TaskFilterBar.tsx`, `TaskItem.tsx`
- Modify: `src/presentation/components/TasksView.tsx`

**Interfaces:**
- Consumes: Task 2 的 `nextTaskCategory`、`parseEstimate`；已有的 `filterTaskEntries`、`formatTaskProgress`、`TASK_CATEGORY_KEY`。
- Produces（`tr` 的类型都与 `TasksView` 的 `Props["tr"]` 一致）：
  - `TaskAddForm({ tr, onAdd })`：`onAdd` 的签名与 `TasksView` 的 `onAdd` 相同；内部持有 `newTask`、`estimatedStr`、`newCategory`，提交后清空标题和预估（分类保留，与现状一致）。
  - `TaskFilterBar({ tr, totalCount, activeCount, doneCount, statusFilter, onStatusFilterChange, categoryFilter, onCategoryFilterChange, searchQuery, onSearchQueryChange })`：返回 fragment，包含 `.task-filter-bar` 和条件渲染的 `.task-search-row`；内部持有 `showSearch`。
  - `TaskItem({ tr, task, isActive, isEditing, canMoveUp, canMoveDown, onSetActive, onToggleDone, onDelete, onCycleCategory, onStartEdit, onCommitEdit, onCancelEdit, onMove })`：
    - `onCommitEdit: (title: string, estimate: number | undefined) => void`，`title` 已 trim；
    - `onMove?: (direction: -1 | 1) => void`，未传时不渲染排序按钮；
    - 编辑草稿（`editingTitle`、`editingEstimate`）和 `ignoreBlurRef` 都放在内部，在 `isEditing` 变为 true 时用任务当前值初始化。
  - `TasksView` 的 Props 与导出（`memo` 包裹的 `TasksView`）保持不变。

- [ ] **Step 1: 采集基线快照**（供本任务与 Task 4 共用）

`npm run dev` 启动后，在内置浏览器打开 `http://localhost:1420`。手动添加 3 个任务：一个带分类 `work` 和预估 3，一个无分类，一个标记完成。然后在页面中注入下面的快照函数：

```js
window.__snap = () => {
  const h = (s) => { let x = 2166136261; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619); return (x >>> 0).toString(16); };
  const out = {};
  document.querySelectorAll("#root *").forEach((el, i) => {
    const cs = getComputedStyle(el);
    out[`${i}:${el.tagName}.${el.getAttribute("class") ?? ""}`] = h(Array.from(cs, (p) => p + ":" + cs.getPropertyValue(p)).join(";"));
  });
  return out;
};
window.__save = (k) => localStorage.setItem("__snap:" + k, JSON.stringify(__snap()));
window.__diff = (k) => { const a = JSON.parse(localStorage.getItem("__snap:" + k)), b = __snap(); const keys = new Set([...Object.keys(a), ...Object.keys(b)]); return [...keys].filter((x) => a[x] !== b[x]); };
```

依次进入下面 8 个状态，每个状态执行一次 `__save("<状态名>")`：浅色/深色主题（`document.documentElement.setAttribute("data-theme", …)`）× {计时页、任务页（打开搜索行）、统计页（展开"趋势与月度"区）、设置弹窗打开}。

- [ ] **Step 2: 新建三个子组件**

从 `TasksView.tsx` 中原样搬出对应的 JSX 与逻辑，类名、属性、元素层级保持一致。`TaskItem` 用 `nextTaskCategory` 代替 `NEXT_CATEGORY`、用 `parseEstimate` 代替内联的 `parseInt`；`TaskAddForm` 同样使用 `parseEstimate`。

- [ ] **Step 3: 改写 `TasksView` 为组装层**

保留 `statusFilter`、`categoryFilter`、`searchQuery`、`editingId`、计数、`filterTaskEntries` 结果、两种空状态和页脚。`onCommitEdit` 在父组件中处理：标题非空时调用 `onRenameTask`；预估与原值不同时调用 `onUpdateEstimate`；最后 `setEditingId(null)`。`onMove(direction)` 映射为 `onMoveTask(index, displayedTasks[visibleIndex + direction].index)`。删除 `NEXT_CATEGORY` 和不再使用的导入。

- [ ] **Step 4: 静态检查**

Run: `npm test && npm run typecheck && npm run build && npm run format:check`
Expected: 全部通过；`wc -l src/presentation/components/TasksView.tsx` 明显小于 402 行。

- [ ] **Step 5: 快照比对**

逐个状态重新进入并执行 `__diff("<状态名>")`。
Expected: 8 个状态都返回 `[]`（DOM 结构和计算样式完全一致）。

- [ ] **Step 6: 手动核对交互**（对应 Review Focus 2、3）

- 双击标题进入编辑，用 Tab 在标题与预估输入框之间切换，确认不退出编辑；Enter 后只保存一次（标题与预估都已更新）；Escape 不保存。
- 选择"待完成"筛选，对相邻两个可见任务点上移/下移，确认跨过被隐藏的已完成任务；切回"全部"时顺序正确。
- 分类徽章点击轮换五次后回到"无分类"。

- [ ] **Step 7: 提交**

```bash
git add src/presentation/components/
git commit -m "refactor(tasks): TasksView 拆分为 TaskAddForm / TaskFilterBar / TaskItem"
```

---

### Task 4: 按组件拆分 App.css

**Files:**
- Create: `src/presentation/components/{TopBar,TimerView,TasksView,StatsView,TrendPanel,CategoryBreakdown,SettingsModal}.css`, `src/presentation/a11y.css`
- Modify: `src/presentation/App.css`, `src/presentation/App.tsx`，以及上述 7 个组件的 `.tsx`（各自在顶部 `import "./X.css";`）

**Interfaces:**
- Consumes: Task 3 Step 1 保存在 localStorage 里的 8 个基线快照（如果快照丢失，先在 Task 3 完成后的代码上重新采集，再开始拆分）。

**归属规则：** 只被一个组件使用的类，放进该组件的 CSS；被两个及以上组件、或被 `App.tsx` 使用的类留在 `App.css`。已确认需要留下的共享类：`.icon-btn`、`.stats`/`.stat*`、`.seg`、`.chart-head`、`.chart-title`（`.empty`/`.empty-ico` 只被 TasksView 使用，归入 `TasksView.css`）。归属不确定时，用 `grep -rn '<类名>' src/presentation` 核实。

| 原 App.css 区段 | 去向 |
|---|---|
| `:root`、`[data-theme="dark"]` 变量、`*`、`body`、`button`、`input`、`.app`、tabs、`.tab-panel`、toast、共享类 | `App.css` |
| top bar（78 行起）、top bar button cluster（1052 行起） | `TopBar.css` |
| timer view、controls、`[data-theme="dark"] .ctrl-main` | `TimerView.css` |
| tasks view、task filters、task item badges、edit row、`.tasks-foot`、`.link-btn` | `TasksView.css`（由 `TasksView.tsx` 导入，子组件不再单独导入） |
| modal、settings additions、`.data-actions`、`[data-theme="dark"] .modal` | `SettingsModal.css` |
| stats tab、weekly report、collapsible "trends & monthly"（共享类除外） | `StatsView.css` |
| 30-day trend + monthly summary | `TrendPanel.css` |
| category breakdown card | `CategoryBreakdown.css` |
| `:where(...):focus-visible`、`@media (prefers-reduced-motion: reduce)` | `a11y.css` |

**加载顺序：** `App.tsx` 第一行导入仍是 `import "./App.css";`；在最后一个组件导入（`SettingsModal`）之后加 `import "./a11y.css";`。`main.tsx` 不改（`index.css` 仍最后加载，与现在一致）。同一目标文件内的规则保持它们在原 App.css 中的相对顺序；重复的选择器（如 `.task.done .task-title`）不合并。

- [ ] **Step 0: 采集生产构建基线**

拆分前先运行 `npm run build && npm run preview`。preview 端口与 dev 不同，localStorage 不共享，所以要在 preview 地址上重新添加 Task 3 Step 1 的 3 个样例任务，注入同一段快照函数，用 `prod:<状态名>` 为键保存 8 个基线。

- [ ] **Step 1: 按上表搬移规则**（剪切粘贴，不改任何声明）

- [ ] **Step 2: 静态检查**

Run: `npm test && npm run typecheck && npm run build && npm run format:check && wc -l src/presentation/App.css`
Expected: 全部通过；`App.css` 降到约 300 行以内。

- [ ] **Step 3: 快照比对**

`npm run dev` 下逐个状态执行 `__diff("<状态名>")`。
Expected: 8 个状态都返回 `[]`。如果某个状态不为空，对差异元素用 `getComputedStyle` 定位出不同的属性，修正规则的归属或顺序后重新比对。

- [ ] **Step 4: 生产构建核对**

Run: `npm run build && npm run preview`，在 preview 地址上对 8 个状态执行 `__diff("prod:<状态名>")`（构建产物中 CSS 的合并顺序可能与 dev 不同）。
Expected: 8 个状态都返回 `[]`。

- [ ] **Step 5: 清理快照并提交**

在 dev 和 preview 两个地址上分别执行 `Object.keys(localStorage).filter((k) => k.startsWith("__snap:")).forEach((k) => localStorage.removeItem(k))`，然后：

```bash
git add src/presentation/
git commit -m "refactor(css): App.css 按组件拆分，a11y 规则独立并最后加载"
```

---

### Task 5: 同步文档

**Files:**
- Modify: `CLAUDE.md`, `README.md`

- [ ] **Step 1: 取实际计数**

Run: `npm test 2>&1 | grep -E "Test Files|Tests "`
记下文件数和用例数（预计 13 个文件 / 134 个用例）。

- [ ] **Step 2: 更新 CLAUDE.md**

- 把两处 "13 suites / 130 cases" 改成实际值；
- 在 Commands 中加入 `npm run format` / `npm run format:check`，删除 "There is no linter configured" 中关于格式化的过时说法，注明 Prettier 已由 CI 检查；
- Frontend layering 段的组件列表补上 `TaskAddForm`、`TaskFilterBar`、`TaskItem`、`TrendPanel`、`CategoryBreakdown`；
- Theming 段说明 CSS 组织方式：`App.css` 放变量与共享样式，组件 CSS 与组件同目录，`a11y.css` 最后加载。

- [ ] **Step 3: 更新 README.md 中的测试计数**（如有对应描述）

- [ ] **Step 4: 提交并推送**

```bash
git add CLAUDE.md README.md docs/superpowers/
git commit -m "docs: 同步测试计数、组件拆分与 CSS/Prettier 约定"
git push origin master
```
