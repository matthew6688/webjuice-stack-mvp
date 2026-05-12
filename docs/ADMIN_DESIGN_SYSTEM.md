# Admin Design System · v1.1

**所有 `/admin/*` 页面遵守本文档。** 不允许 per-page 自造视觉模式。

更新日期：2026-05-12
对应 CSS：`src/styles/admin-design-system.css`（强制加载于 `src/layouts/AdminLayout.astro`）
配套页面参考：`/admin/scoring/sop-2` （视觉典范）

## v1.1 增量（2026-05-12）

新增组件 + 规则，配套 SOP 单一真理来源协议落地：

| 组件 / 规则 | 类名 | 用途 |
|---|---|---|
| **页面元信息** | `.admin-page-meta` + `.admin-page-version` / `.admin-page-updated` | 每个 admin 页面顶部显示版本 + 最近更新日 |
| **代码同步 banner** | `.admin-code-sync-banner` (`.is-synced` / `.is-stale`) | 显式声明页面与代码同步状态；is-stale 时强调 "未上代码只能 TODO" |
| **TODO 链接 marker** | `.admin-todo-link` | 链接到不存在 / 未上线的文档时用：strikethrough + 红 TODO badge |
| **Section padding 规则** | `.scoring-shell .admin-paper-section` / `.sop-page .admin-paper-section` | padding: 22px 30px · 配合 sop-shell 实现 text vs container-edge 间距一致 |
| **Table 标准** | admin-table (citrus header + 交替行 + hover) | 所有 admin 表格统一样式，不允许 per-page 写 `<table>` 自定 CSS |
| **Folder-tab 对齐** | `.sop-tabs--global { max-width: 1080px }` + `.sop-shell { max-width: 1080px }` | tabs 必须与 shell 容器顶边对齐 |

### 单一真理来源协议（CRITICAL）

代码 ↔ 文档 ↔ 页面 三者必须同步：

1. 改代码 → 同一 PR 改 doc 对应章节 → 改 admin 页面 → 截图 verify live
2. 想法未落代码 → 只能进 doc TODO / 页面 TODO 列表，**不能** 在主流程章节 claim "已就绪"
3. 检测不一致 → `.admin-code-sync-banner.is-stale` 顶部明示

详见 [SOP_OVERVIEW.md §5](SOP_OVERVIEW.md)。

> **维护规则**：改 design system → 同时改这份 doc + admin-design-system.css + 截图所有 admin 页面 verify 没破坏。
> **加新组件 → 先在本文档提议，被批准再落到 CSS。** 不要直接在 per-page `<style>` 加新模式。

---

## 0. 为什么有这份 doc

历史问题：每个 admin 页面（Overview / SOP-1 / SOP-2 / queue / leads / ...）自己写 `<style>` block，重复定义 `.chip-coral` / `.card` / `.banner`，颜色不统一、间距不统一、字号不统一。Matthew 看完反馈"乱七八糟"。

解决：**集中所有视觉模式到一份 CSS + 一份文档**。新页面只能从下面的组件库里挑。

---

## 1. Tokens（CSS 变量，在 `global.css` 顶部定义）

### 1.1 颜色

| Token | 值 | 用途 |
|---|---|---|
| `--pl-cream` | `#fff6ec` | 整页背景 |
| `--pl-paper` | `#fffcf7` | 卡片 / section 背景 |
| `--pl-ink` | `#17191c` | 主文字 + 边框 |
| `--pl-muted` | `#5e6268` | 次文字 / meta |
| `--pl-line` | `#17191c` | 所有 border（等于 ink） |
| `--pl-coral` | `#ff5a3d` | accent 1 · 主强调（错误 / 紧急 / hover 链接） |
| `--pl-coral-soft` | `#ffb39f` | coral 浅色 |
| `--pl-citrus` | `#ffd45a` | accent 2 · 警告 / 注意 / tab 高亮 |
| `--pl-mint` | `#cdeccf` | accent 3 · 成功 / 完成 |
| `--pl-sky` | `#8bd3f7` | accent 4 · 信息 / 中性 |
| `--pl-lilac` | `#eadcfb` | accent 5 · 跨段 / artifact |

**禁止**：硬编码颜色（`#abc123`、`hsl(...)`）。任何颜色必须用 token 或 `color-mix(in srgb, var(--pl-X) Y%, var(--pl-paper))` 调子色。

### 1.2 字体

| Token | 用途 |
|---|---|
| `Georgia, "Times New Roman", serif` | 所有 h1/h2/h3/h4 + card title + chip 标签 |
| `var(--pl-body)` (sans) | 所有 body / p / li / table cell |
| `ui-monospace, "SF Mono", Menlo, monospace` | code / 字段名 / tech 内容 |

### 1.3 间距 + 阴影

- **section 间距**：相邻 `.admin-paper-section` 之间靠顶 border 分隔
- **shadow**：`3px 3px 0 var(--pl-line)` (默认) / `4px 4px 0 var(--pl-line)` (banner / step active)
- **hover 抬升**：`transform: translate(-1px, -1px)` + shadow 加 1px

### 1.4 字号阶梯

| 角色 | 字号 |
|---|---|
| 页 h1（admin-header h1） | 28-30px |
| 章节 h2（admin-paper-section-head h2） | clamp(22px, 1.8vw, 28px) (已 global) |
| section subhead h3 | 15-17px Georgia |
| Card title | 15-16px Georgia |
| Body 文 | 13.5-14px sans |
| Meta / micro | 11-12px sans italic |
| Code inline | 11.5-12px mono |
| Eyebrow | 11px uppercase letter-spacing 0.06em |

---

## 2. Page Template（强制）

每个 admin 页面**必须**这样组织：

```astro
<Layout title="..." active="...">
  <section class="poster-section admin-section">
    <div class="admin-shell" data-ui-version="local-style-2026-05-08">

      <!-- 1. Header (必须) -->
      <header class="admin-header">
        <div>
          <p class="eyebrow">栏目名 · 英文 SECTION</p>
          <h1>中文主标题</h1>
          <p class="zh-en-sub">English subtitle</p>
          <p class="lede">一句话解释这个页面是干嘛的</p>
          <!-- 可选: <a class="admin-doc-link-btn" href="...">详细文档</a> -->
          <p class="meta-line">
            <span>meta1 <code>...</code></span>
            <span class="dot">·</span>
            <span>meta2 <code>...</code></span>
          </p>
        </div>
        <div class="admin-count">
          <span>label</span>
          <strong>数字</strong>
          <span class="micro-note">说明</span>
        </div>
      </header>

      <!-- 2. Tab strip (可选, SOP 页必须) -->
      <nav class="sop-tabs">
        <a href="..." class="sop-tab sop-tab--active"><!-- ... --></a>
      </nav>

      <!-- 3. Banner (可选, 限 1 个) -->
      <div class="admin-banner admin-banner-coral">
        <span class="admin-banner-icon">⚠</span>
        <div class="admin-banner-body">
          <strong>...</strong>
          <p>...</p>
        </div>
      </div>

      <!-- 4. Sections (核心内容, 任意多个) -->
      <section class="admin-paper-section">
        <div class="admin-paper-section-head">
          <div>
            <p class="eyebrow">eyebrow</p>
            <h2>章节标题 <span class="en-sub">English</span></h2>
          </div>
          <span class="admin-section-count">额外信息 / 计数</span>
        </div>
        <!-- section body: table / card-grid / list / flow ... -->
      </section>

      <!-- 5. Maintenance section (页底, optional) -->
      <section class="admin-paper-section">
        <!-- 维护协议 / 相关文档 link 等 -->
      </section>

    </div>
  </section>
</Layout>
```

### 2.1 严格约束

| ✅ DO | ❌ DON'T |
|---|---|
| 用 `.admin-paper-section` 包所有内容块 | 直接放 `<section>` 或自造 `<div class="my-section">` |
| 用 `.admin-paper-section-head` 标准化章节头 | 用裸 `<h2>` 散落在内容里 |
| 用 `.admin-table` chrome | 自造 `<table style="...">` |
| 用 `.chip` + `.chip-coral` 等 6 个色变体 | per-page 重新定义 `.chip-coral { background: ... }` |
| 用 `.admin-card` + `.admin-card-grid-*` | 自造 `.my-card-grid { grid-template-columns: ... }` |
| 用 `.admin-banner` + 4 色变体 | 自造 `.usp-banner { background: ... }` |
| Section 内容用 `--pl-paper` 背景 | 在 `.admin-paper-section` 上加 `background:` |
| 颜色用 token + color-mix() | 硬编码颜色 `#ff8800` |

### 2.2 唯一允许的 per-page CSS

- 极少的 **layout-only** 布局（如 funnel-grid 这种特殊路径图）
- 这种**必须**继承全局组件颜色 + 字体 + spacing；只允许定义 grid-template / 位置

---

## 3. Component 库（详细规范）

### 3.1 Chip · `.chip`

```html
<span class="chip">默认</span>
<span class="chip chip-coral">紧急</span>
<span class="chip chip-citrus">警告</span>
<span class="chip chip-mint">完成</span>
<span class="chip chip-sky">信息</span>
<span class="chip chip-lilac">artifact</span>
<span class="chip chip-muted">未激活</span>
```

**何时用**：状态标签（grade / phase / tag）/ 行内 label。
**不要**：当作按钮（按钮另有规范）。

### 3.2 Card · `.admin-card`

```html
<div class="admin-card admin-card-tinted-mint">
  <p class="eyebrow">eyebrow</p>
  <h3 class="admin-card-title">标题</h3>
  <p class="admin-card-body">正文</p>
  <p class="admin-card-meta">辅助</p>
</div>
```

变体（tinted 背景）：`admin-card-tinted-{mint, citrus, sky, lilac, coral}`。

**Card grid**：
```html
<div class="admin-card-grid admin-card-grid-3">
  <div class="admin-card">...</div>
</div>
```
`admin-card-grid-{2,3,4,auto}`。

**何时用**：dimensional metrics / 入口对比 / channel 简介 / snapshot 数据。

### 3.3 Banner · `.admin-banner`

```html
<div class="admin-banner admin-banner-coral">
  <span class="admin-banner-icon">⚠</span>
  <div class="admin-banner-body">
    <strong>标题</strong>
    <p>内容</p>
  </div>
</div>
```

变体：`admin-banner-{coral, citrus, mint, lilac}`。

**何时用**：source-of-truth 提示 / USP 声明 / 紧急通知 / 维护规则提示。
**限制**：**每页最多 1 个 banner**（避免视觉过载）。

### 3.4 Step list · `.admin-step-list`

```html
<ol class="admin-step-list">
  <li class="step-done">
    <span class="admin-step-num">1</span>
    <div class="admin-step-body"><strong>完成的步骤</strong><p>...</p></div>
  </li>
  <li class="step-active">
    <span class="admin-step-num">2</span>
    <div class="admin-step-body">...</div>
  </li>
  <li class="step-pending">
    <span class="admin-step-num">3</span>
    <div class="admin-step-body">...</div>
  </li>
</ol>
```

**何时用**：4-step protocol 进度 / 多步骤工作流。

### 3.5 Table · `.admin-table`

```html
<div class="admin-table-wrap">
  <table class="admin-table">
    <thead><tr><th>列1</th><th>列2</th></tr></thead>
    <tbody>
      <tr><td>...</td><td><span class="chip chip-mint">label</span></td></tr>
    </tbody>
  </table>
</div>
```

**何时用**：超过 4 行的结构化数据 / 列表。
**不要**：用 table 做 layout。

### 3.6 Marker list · `.admin-marker-list`

```html
<ul class="admin-marker-list">
  <li><strong>主点</strong> — 解释，含 <code>code 引用</code></li>
</ul>
```

**何时用**：容易忽略的点 / gotcha 列表 / TODO 列表。

### 3.7 Note line · `.admin-note-line`

```html
<p class="admin-note-line"><strong>⚠ 注意</strong>：单行重要提示 + <code>code 引用</code></p>
```

**何时用**：节内小提示。比 banner 轻量。

### 3.8 Flow diagram · `.admin-flow-grid`

```html
<div class="admin-flow-grid">
  <div class="admin-flow-step">
    <div class="admin-flow-num">1</div>
    <div>
      <h3>步骤标题</h3>
      <p>说明</p>
      <p class="admin-flow-meta">meta</p>
    </div>
  </div>
  <div class="admin-flow-arrow">▼</div>
  <div class="admin-flow-step flow-end">...</div>
</div>
```

**何时用**：pipeline / 漏斗 / 时间轴 / 顺序流程。

### 3.9 Doc link button · `.admin-doc-link-btn`

```html
<a href="/path/to/doc" class="admin-doc-link-btn">
  <span class="icon">📘</span>
  <span class="text">
    <strong>详细文档名</strong>
    <span class="sub">说明 · 行数</span>
  </span>
  <span class="arrow">→</span>
</a>
```

**何时用**：从 macro overview 页跳到 detail markdown viewer。

### 3.10 Back link · `.admin-back-link`

```html
<a href="/parent" class="admin-back-link">← 返回父页</a>
```

---

## 4. 命名规则

- 全局组件：`admin-*` 前缀（admin-card / admin-banner / admin-step-list / ...）
- Tab 系列：`sop-*` 前缀（sop-tabs / sop-tab）
- Chip 颜色：`chip-{color}` 命名
- 工具类：`text-muted` / `accent-coral`

**禁止**：
- ❌ Per-page bespoke 名（`.my-funnel-step` / `.entry-card` / `.usp-banner`）
- ❌ 不带前缀的全局名（`.card` / `.list`）—— 容易和外部 CSS 冲突

---

## 5. 添加新组件流程

1. 在本文档对应 section 提议（pattern + 用途 + 名字）
2. 给我（Matthew）看 mockup / 引用 SOP-2 类似 pattern
3. 批准后：
   - 加 CSS 到 `src/styles/admin-design-system.css`
   - 在本文档 §3 Component 库 加一节
   - Refactor 至少 1 个 admin 页面用上新组件 → screenshot 证明
4. Commit 一起：CSS + doc + 用例页面

---

## 6. 当前合规状态

| 页面 | 合规度 | 备注 |
|---|---|---|
| `/admin/scoring/sop-2` | ✅ 100% | 视觉典范，design system 提炼自此页 |
| `/admin/scoring/sop-2-doc` | ✅ 95% | markdown chrome 用 `:global()` + token 对齐 |
| `/admin/scoring` (Overview) | 🟡 待 refactor | USP banner / funnel section 背景色 / channel-mini 自造 |
| `/admin/scoring/sop-1` | 🟡 待 refactor | 4-step progress / entry-grid 自造（已 ported 到 admin-step-list） |
| `/admin/leads` | 🟡 待审 | 历史页，下一轮迁移 |
| `/admin/queue` | 🟡 待审 | 同上 |
| `/admin` (Overview) | 🟡 待审 | 同上 |

---

## 7. 维护协议

### 7.1 改 design system → 触发的事

- 改 token 颜色 → 改 global.css + 跑 build + 截图所有 admin 页面验证未破坏
- 改 component CSS → 改 admin-design-system.css + 改这份 doc + 截图
- 加 new component → §5 流程

### 7.2 改 admin 页面内容 → 触发的事

- 不能加新的 `<style>` 自造组件
- 只能从本文档 §3 挑现有组件
- 找不到合适的 → 触发 §5 (加新组件流程)

### 7.3 Decision records

| ID | 决策 | 日期 |
|---|---|---|
| **D-DS-1** | 集中所有 admin 视觉模式到一份 CSS + 一份 MD（不允许 per-page 自造）| 2026-05-12 |
| **D-DS-2** | SOP-2 (`/admin/scoring/sop-2`) 是视觉典范，design system 提炼自此页 | 2026-05-12 |
| **D-DS-3** | 6 个 chip 色变体 + 5 个 card 色变体 + 4 个 banner 色变体（不再扩） | 2026-05-12 |
| **D-DS-4** | 每页最多 1 个 banner（避免视觉过载） | 2026-05-12 |
| **D-DS-5** | h1 / h2 不能在 markdown 渲染区被全局 `h1 { max-width }` 限制 → `:global()` + `!important` | 2026-05-12 |

---

## 8. 相关文档

- `src/styles/admin-design-system.css` — 实现
- `src/styles/global.css` — token 定义 + admin-shell / admin-header / admin-paper-section / admin-table
- `src/layouts/AdminLayout.astro` — top nav + 加载 design system
- `/admin/scoring/sop-2` — 视觉典范页

---

**任何 admin 页面改动 → 必须先查这份文档。**
