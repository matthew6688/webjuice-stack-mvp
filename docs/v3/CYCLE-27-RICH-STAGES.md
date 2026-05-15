# cycle-27 · Discord Stage 富信息 (排版 v2 定稿 · 暂缓 · Matthew 2026-05-15)

> **状态**: PARKED · 等 Google Places API intake 流程跑通后再回来做
> **前置依赖**: 当前 cycle-26 27/27 test pass + KPI dashboard 修好
> **预估**: 9-13h (含 TDD + retro-edit + live verify)

---

## 背景 · 为什么做

Matthew 反馈 (2026-05-15 E2E retest 后):

> 我们最后拿到的文档是 Master MD 还有一个 Audit Report。
> 想法是: 所有这些报告里面的内容 · 能不能在 Discord 不同阶段 · 选择合适的阶段放进去 · 让我不用点开 html 报告 · 就能在不同的阶段获得这些信息。

核心: master.md 22 section + internal-audit 12 section 的内容 · 切片塞回 Discord 各 stage · Matthew 不需要点开 HTML 就在 Discord 里看到关键信息。

---

## 排版字典 (v2 锁定 · 看 BCV thread 1504750522496978964 有真实预览)

| 元素 | 用途 | 例子 |
|---|---|---|
| `**bold**` | 关键数字 · 状态强调 | `**3** critical` · `**无**` · `**低**` |
| `__underline__` | 子区块标题 (替部分 bold · 视觉多 1 层) | `__结论__` · `__技术栈__` |
| `*italic*` | 「普通话翻译」一行 (技术事实白话版) | `*电话号在 fold 下面 · 客户得滚屏才找到*` |
| `> blockquote` | 客户影响 / takeaway | `> 找不到号 = 直接关掉去搜下一家` |
| `` `inline code` `` | 值 / ID / 文件名 / 指标 | `` `52/100` `` · `` `LCP 4.2s` `` |
| `-# subtext` | 元数据 / evidence 链接 / 备注 | `-# evidence — [...](...)` |
| `———` | major section 分隔 (上下 1 空行) | — |
| `-` bullet | 字段 ≥ 3 项 | `- key: value` |

**不变量**:
1. 正文零 emoji · 状态仅 `✓` / `✗` 谨慎用
2. 没数据用 `—` 占位 · 不删行
3. 段落留呼吸感 · 字段之间不挤
4. `[text](url)` 链接 · 不裸 URL (除 demo live URL)
5. 单条 ≤ 2000 char · 超了拆 2 条 · 第 2 条无 stage header

---

## 9 个 stage 要塞什么 (per stage 决策表)

> 每个 stage 完整 mock text 看 chat 2026-05-15 · 或 BCV thread 历史消息

### Stage 1/9 · 入库 (per-entity thread)
- **基本信息** (5 字段): 名称 · 地址 · 电话 · 网站 · 邮箱
- **GBP** (6 字段): 评分 · 评论数 · 分类 · 照片数 · 营业时间 · about attributes
- **社交** (5 字段): Facebook · Instagram · LinkedIn · YouTube · TikTok
- **线索来源** (5 字段): 搜索词 · 排名 · 来源 · batch · 首次发现
- **网站现状信号** (8 字段): 类型 · 页面 phone · menu link · reservation link · order online · popular times · about attributes · image count
- 数据源: `entity.latest`
- builder: `stage0Message` (rename → `stageEntityIntakeMessage`)

### Stage 2/9 · 排除筛选
- **3 层判断** (3 行): Niche 相关性 · 排除规则 · LLM niche-judge (含 reason)
- **GBP 速览** (5 字段): GBP quality · 触发的红灯 · review count · 类别匹配 · 服务区
- **普通话** blockquote: 为什么 keep / 为什么 archive
- **下一步**: 进 Stage 3 (keep) 或 归档原因 (archive)
- 数据源: `cheap_audit` + `niche_relevance` + `exclusion_filter`
- builder: `cheapAuditPredictMessage` (refactor)

### Stage 3/9 · 网站审计 (拆 2 条)

**msg 1 · 漏水点**:
- **结论**: audit_score + 最弱维度 + 计数 + 普通话 blockquote
- **Critical · N 项**: 每条 = 标题 + italic 翻译 + blockquote 客户影响 + subtext evidence link
- 普通话翻译参考 master.md §五的「技术事实 / 普通话翻译 / 对客户的影响」

**msg 2 · 技术基建**:
- **技术栈** (6 字段): CMS · Analytics · FB pixel · Ads conversion · 服务器响应 · CDN
- **速度** (5 字段): LCP/FCP/CLS/TBT/score + 普通话
- **联系表单** (5 字段): 表单 · 字段数 · captcha · spam protection · 错误提示 + 普通话
- **SEO 迁移**: sitemap · 迁移成本 · 重定向 · robots · canonical
- **GEO Readiness 12 项** (`-#` subtext 聚合显示) + 普通话
- 数据源: master.md detailed_audit + `pagespeed.results.mobile`
- builder: `stage1Message` → 拆 `stageWebsiteAuditMessage1/2`

### Stage 4/9 · 视觉审计
- **Vision LLM 一句话** (blockquote)
- **三维打分**: 新鲜度/信任度/转化准备度/设计年代
- **值得保留的优点** (3 个 bullet)
- **视觉痛点 top 3**: 每个 = 标题 + italic 普通话 + blockquote 修法
- **客户视角素材** (4 字段): desktop / mobile / mobile-video / 桌面 video
- 数据源: `visualAudit.parsedJson`
- builder: `stage2Message` (refactor)

### Stage 5/9 · 打分定级
- **为什么是 X 等级** (5 字段): audit_score · review 数 · 24h emergency · 服务范围 · skip_reasons + 普通话
- **客户口碑** (5 字段): 评论总数 · 平均分 · 最多提到 · 负面 · 复合评分 + 销售可以用 blockquote
- **推荐销售切入点** (3 个有序 bullet)
- **业务规模信号** (5 字段)
- **Upsell 机会** (5 字段)
- 数据源: `entity.grade` + `review_analysis` + `deriveSalesAngles` + master.md §upsell
- builder: `stage3Message` (refactor)

### Stage 6/9 · 内部审计报告
- **6 维度速览** (6 字段): 速度 · SEO · 表单 · 域名 · 信任凭证 · upsell + 运营 30 秒总结
- **报告** (3 链接 · 本地等 publish): master.md · customer-audit · internal-audit
- **Build Assets** (6 字段): Logo · Brand colors · Photos · Voice samples · Content extracted · manifest
- 退出 footer: subtext「Stage 9 publish 完成后 · 本消息会自动 retro-edit 替换 live URL」
- 数据源: audit JSON + build-assets/manifest.json
- builder: `stage4Message` (refactor) · **要被 retro-edit**

### Stage 7/9 · 资格复核
- **一句话** blockquote (crawl 页数 · gates 状态 · score 状态 · LLM judge)
- **7 hard gates** (7 行 ✓/✗ + 简短解释)
- **Scorecard 5 维** (每维 = 标题 + 有/缺 sub-bullets)
- **LLM judge 复核** (5 字段): verdict · confidence · provider · reason · anomalies
- **下一步**: 触发 Stage 8 + redesign-brief 链接
- 数据源: `entity.qualification`
- builder: `stage5Message` (refactor)

### Stage 8/9 · 建 demo
- **怎么建的** (4 字段): Reference 模板 · 改的 section · 保留 · 手动编辑
- **用了客户哪些素材** (5 字段): Logo · Photos · Brand colors · Voice · 图标/字体
- **Output** (6 字段): index.html · modified · retained · swapped · manual · 本地 preview
- **下一步**: 触发 Stage 9
- 数据源: build summary (TODO 新增) + build-assets/manifest.json
- builder: `stage6Message` (refactor) · **要被 retro-edit**
- **依赖**: `pl-build-from-reference.js` 需要输出 build summary (sections modified/retained/swapped count)

### Stage 9/9 · 发布上线
- **Demo live** (3 字段): URL · deployed at · CF deploy ID
- **完整交付包** (4 链接): master.md · customer-audit · internal-audit · demo
- **Asset Integrity** (5 字段): master.md 图片 · video · evidence · 报告 HTML · 失败链接 + 报告完整 blockquote
- **销售下一步** (3 个有序 bullet)
- **Retro-edit · 已自动完成** (2 行): Stage 6 + Stage 8 message 已更新
- 数据源: `entity.deploy` + asset-integrity verifyAssetsRemote
- builder: `stage7Message` (refactor) · **触发 Stage 6/8 retro-edit**

---

## 实现计划 (TDD · Rule 12 + 13)

### Phase 1 · Contract (~1h)
- 新文件: `core/contracts/audit-stage-content.js`
- 导出:
  - `RICH_STAGE_SECTIONS` · 每 stage 必填 sections + 字段 (object map)
  - `RICH_FORMAT` · markdown 字典 + 分隔符常量
  - `MISSING_PLACEHOLDER` = `'—'` (em-dash)
  - `MAX_MESSAGE_LENGTH` = `2000`
- helper:
  - `fmtRow(key, value, opts)` · `- key: value` · null-safe → `—`
  - `fmtBlock(title, rows[], opts)` · `__title__` + bullet list
  - `fmtTranslation(plain, impact)` · italic + blockquote
  - `fmtCriticalIssue(n, title, plain, impact, evidence)` · per-issue card
  - `fmtSeparator()` → `\n\n———\n\n`

### Phase 2 · RED tests (~2h)
- 新文件: `scripts/test/test-cycle27-stage-rich-content.mjs`
- 9 stage 各 3-5 assertion
- 用 Ace Roofing entity (`data/leads/entities/domain_aceroofingservice.com.au.json`) + BCV (qualification 数据) 真 fixture
- assertion 类型:
  - 必填 section 存在 (regex match section title)
  - markdown 元素正确用 (`__` · `*` · `>` · `` ` `` · `-#` · `———`)
  - 缺失字段用 `—` 占位 (test: 给 fixture 移除某字段 · 渲染应含 `—`)
  - 长度 ≤ `MAX_MESSAGE_LENGTH`
  - 正文零 emoji (除 `✓` / `✗`)
- 跑一遍全 fail

### Phase 3 · 实装 9 个 builder (~4-6h)
- 改 `core/funnel/audit-stage-messages.js`
- 每个 builder:
  - 接 audit JSON / master.md derived fields / entity fields
  - 用 Phase 1 helper
  - 缺字段 null-safe → `fmtRow` 自动加 `—`
- Stage 3 拆 `stageWebsiteAuditMessage1` (issues) + `stageWebsiteAuditMessage2` (技术基建) · 调用方按需 post 2 条

### Phase 4 · build summary output (~1h · 阻塞 Stage 8 内容)
- 改 `scripts/cli/pl-build-from-reference.js`
- 输出 `clients/<slug>/v2/build-summary.json` · 字段:
  - reference_family · reference_variant
  - sections_modified[] · sections_retained[]
  - images_swapped (count) · manual_edits (count)
  - assets_used: logo / photos / colors / voice / fonts

### Phase 5 · Retro-edit · Stage 6 + 8 (~1.5h)
- 新函数: `core/funnel/lead-thread-sync.js#editThreadMessage(threadId, messageId, newContent)`
  - PATCH `/channels/<>/messages/<>` body `{content}`
  - 错误处理 (404 = 消息删了 · 403 = 没权限 · log + skip)
- 改 entity persist: build 后写 `entity.discord_stage_message_ids = {6: '...', 8: '...'}`
- pl-publish-demo.js 最后调:
  - 读 `discord_stage_message_ids[6]` + `[8]`
  - 重新调 `stage4Message` / `stage6Message` 但传入已发布的 live URL
  - 调 `editThreadMessage` PATCH 两条

### Phase 6 · E2E live verify (~1h)
- 跑新 batch (Google Places API 或 docker · 选 2 entity 小 batch)
- Matthew Discord 实地看 9 个 stage
- 看不顺再迭代

### Phase 7 · 文档 sync
- 更新 `docs/v3/SOP-AUDIT-STAGE-NOTIFICATIONS.md` (现有 D38 文档)
- 更新 `docs/v3/SOP-MASTER-MD-DATA-LINEAGE.md` (Stage Discord 内容来自 master.md 哪段)
- 更新 `README.md` (cycle-27 entry · DECISIONS-LOG D 号)
- 更新 `CYCLE_TEST_PLAN.md` (test 28-36 共 9 个新 test 文件)

---

## 待 Matthew 决策的开放问题

1. **截图怎么显示**: thumbnail (Discord embed image) vs hyperlink-only?
   - Stage 3 critical issues 的 evidence 截图
   - Stage 4 desktop / mobile 截图
   - 倾向: vision 痛点 thumbnail · evidence hyperlink
2. **Stage 6 retro-edit 时机**: Stage 9 publish 后立即 PATCH · 还是 entity → `outreach-active` 才 PATCH?
3. **Stage 3 拆 2 条**: 是 stage builder 输出 2 个 string · 调用方 post 两次? 还是 1 个 string 内部分两段 · 自动检测 length 拆?

---

## 涉及的现有文件

读: 不改:
- `core/contracts/discord-messages.js` · STAGE_LABELS · ENTITY_PHASE

读: 改:
- `core/funnel/audit-stage-messages.js` · 9 个 stageNMessage builder
- `core/funnel/lead-thread-sync.js` · 加 `editThreadMessage`
- `scripts/cli/pl-build-from-reference.js` · 输出 build-summary.json
- `scripts/cli/pl-publish-demo.js` · 触发 retro-edit

读: 引用 (数据源):
- `data/leads/entities/<key>.json` · `entity.latest` / `cheap_audit` / `grade` / `qualification`
- `clients/<slug>/v2/master.md` · 22 H2 sections
- `clients/<slug>/v2/redesign-brief.json` · Stage 7
- `clients/<slug>/v2/build-assets/manifest.json` · Stage 6/8
- `clients/<slug>/v2/build-summary.json` · Stage 8 (待新建)

新建:
- `core/contracts/audit-stage-content.js`
- `scripts/test/test-cycle27-stage-rich-content.mjs`
- 9 test fixtures (从真 entity / master.md 切片) · 可能多个新 file
