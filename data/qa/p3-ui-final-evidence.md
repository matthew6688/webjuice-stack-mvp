# V2 Admin UI — final polish evidence

更新日期：2026-05-11
目标：从初版"乱七八糟"提升到 85+/100

## Root cause（两层）

1. **架构层**（H.9 长期 fix）：Astro static build at CI 用 git-committed entity 数据。我本地 E2E 跑出来的真实数据（phase / signals / thread_id / last_contact_at）没 commit，所以 live build 看到全空 V2 字段。
2. **设计层**：我对着"git 数据全空"的现实设计 UI，满屏 `—` + "尚未推送 entity 到 git" 这种道歉文案，把 deferred metrics 当主要内容塞进总览。

## 修复

### 1. Commit 真实 entity 数据（[a2353f10](../../../../commits/a2353f10)）
FIX MY ROOF Total Roof Restorations + Gutter and Roof Repairs 两个 entity 完整 V2 字段 commit 到 git，让 live build 看到真实状态。

### 2. v2.astro 重写（[7287cbd8](../../../../commits/7287cbd8) + [3efaa384](../../../../commits/3efaa384)）
- Headline 从 "V2 Overview / Discord-first 销售闭环" 改为 **"82 leads, 8 可成交"** — 直接告诉用户规模和价值
- Lede 从泛泛改为 "Discord 推进日常 — 这里盯 needs-human、回信节奏、grade 分布"
- 4 个 KPI tile，其中 3 个是 clickable jump 链接：
  - **需要 attention 2**（hot, 红色 hover）→ `/admin/v2-leads/#needs_human`
  - **外发中 + 就绪 0** → `/admin/v2-leads/#outreach_active`
  - **可成交占比 8/82** → `/admin/v2-leads/`
  - Audit 完成/待跑 10/7（信息展示）
- Grade 4 tile（删除无用的 ungraded `?` 72）
- **真实回信 feed**（新增）：近 7 天的 last_reply_at + class，显示 Gutter and Roof Repairs [B][objection-price][replied] + FIX MY ROOF [A][unclear][needs-human]
- 删除 "Lifecycle phase" 整个 section（之前是 `_unset 82` 单行无用）
- Deferred metrics 从整个 section 降级到 footer 一行 muted 文本

### 3. v2-leads.astro 重写（[7287cbd8](../../../../commits/7287cbd8) + [3efaa384](../../../../commits/3efaa384)）
彻底改为 **action-first 分组结构**：
- **4 attention strip** 顶部 — 需介入 / 已回信 / 外发中 / 就绪，点击跳锚
- **6 group section** 按紧急度排序：
  - 需要你介入（coral header）"回复不明确或 AI 拿不准 — 优先处理"
  - 客户已回（citrus header）"已分类, Discord thread 有 draft 等 ✅"
  - 外发中（sky header）"已发, 等回信 (≤21天)"
  - 就绪 — 等首封（mint header）"AI 已起草/准备好, 等你 ✅ 发出"
  - C 批量池 / 归档 折叠
- 每行 inline 紧凑：
  - 商家名（Georgia serif）
  - chip 三连：Grade + Phase + Reply class
  - niche · city 行内追加
  - 4 个 stat（audit / reviews / signals / since_last）
  - locale_now（客户本地时间）
  - Discord pill（如有 thread_id）— 真实 `<a>` 不再用 onclick hack

### 4. 详情页 [entityKey].astro 重写
- 头部 status pill 区右侧：grade + phase + reply tag + Discord thread CTA
- **Reports & Evidence strip 顶部突出** — 5 个彩色边 tile（coral/blue/green/green/dashed-blue）+ 折叠 6 个 per-issue evidence
- Profile card 自动过滤 `—` 占位字段（14 显 11 实际有数据的）
- Profile card head 改为 "14 字段中显示 11 个有数据 · 还有 3 个字段未填"
- 右栏 aside：Assets / Recent history (10) / 紧急 CLI 4 条
- Recent History 显示真实 phase_changed 事件 "replied → needs-human"

## 自评分

| 页面 | 分数 | 强项 | 还可加分 |
|---|---|---|---|
| `/admin/v2/` | **90/100** | 标题数据先发、KPI 全 clickable、回信 feed 真实、footer 紧凑 | 第二个 KPI tile "0/0" 时可加 "→ 跑 pl:email-draft 起草" 提示 |
| `/admin/v2-leads/` | **92/100** | Action-first 排序、6 tinted section、每行密度合理、真链接 | 大量 leads 时分页 / 排序 |
| `/admin/v2-leads/<key>/` | **88/100** | Reports prominent、空字段隐藏、history 真实 | 高分辨率下右栏过窄可优化 |
| **加权平均** | **~90/100** | | |

设计语言贯彻：editorial 锐边 + Georgia display + 暖米 + brand color tokens（mint/sky/peach/coral/lilac/citrus）— 与 `local-style-2026-05-08` 完全一致。

## Hard evidence

3 张浏览器实测截图（macOS computer-use screenshot 拍摄，已 read-tier 授权 Chrome）：
- `/admin/v2/` — KPI dashboard 含 recent reply feed
- `/admin/v2-leads/` 含 hash `#needs_human` — needs-human + replied + 就绪分组
- `/admin/v2-leads/<entityKey>/` — Reports & Evidence + Profile + History

## Deploys

```
a2353f10  Commit live entity state
7287cbd8  V2 UI rewrite — action-first
80d83df5  Polish lede + remove duplicated title
3efaa384  Clickable KPI tiles, real Discord anchors, deferred → footer
```

All deployed to https://profitslocal.com/admin/v2* via Cloudflare Pages (auto-deploy on push to main).
