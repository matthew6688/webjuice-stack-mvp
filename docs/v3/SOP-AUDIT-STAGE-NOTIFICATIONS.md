# SOP · Audit Pipeline · Per-Stage Discord 通知规范

> **作用域**: V3 audit pipeline (`leads:run-pipeline`) 每 stage 发到 Discord thread 的消息格式 + 内容规范。
> **owner**: Cross-cutting · M2 audit + Discord display。
> **status**: D38 (2026-05-14) 第一版 · 实装在 `core/funnel/audit-stage-messages.js`。

---

## 0. TL;DR

```
Audit pipeline 4 stage · 每 stage 完成发 1 条独立消息到 thread
共 5 条 (启动 + 4 stage done) per entity

风格:
  - 无 emoji (默认成功)
  - 仅失败保留 ❌ 异常 marker
  - URL 全部 hyperlink (live 时)
  - 本地路径只显文件名 (publish 前)
  - 字数 < 1000 / 消息 (Discord 2000 上限内 · 留余量)
```

---

## 1. 5 条消息 · 内容规范

### 1.1 Pipeline 启动

**触发**: `processLead(entityKey)` 开始
**内容**:
```
**Audit pipeline 启动** · 4 stages · 预计 2-5 min
```
**字数**: ~50 · 仅一行

---

### 1.2 Stage 1/4 · 网站审计

**触发**: detailedAudit + contact-extraction 完成
**内容**:
```
**Stage 1/4 · 网站审计** done · {durationSec}s

总分: {audit_score}/100 · {decision}
12 维最弱 3 项:
- {title1} ({brief details})
- {title2}
- {title3}

Tech: {cms} · {analytics_top_2} · {pixels_top_2}
Sitemap: {total_urls} pages · {migration_complexity} migration complexity
Speed: LCP {lcp}s · FCP {fcp}s · CWV {cwv}

联系信息:
- email: {email[0]} (from [/contact/]({contact_us_url}))
- phone: {phone} (verified)
- social: [Facebook]({fb_url}) · [Instagram]({ig_url})

Hard triggers: passed (无触发) OR {triggers.join(' · ')}
```

**数据源**:
- `audit.audit_score · audit.decision · audit.issues[]` from `core/scoring/detailed-audit.js`
- `fetchPayload.tech_stack · sitemap_analysis · performance` from `core/audit/site-fetch-full.js`
- `extractContactInfo()` from D37 `core/audit/contact-extraction.js`
- D38: 自动 follow `contact_us_url` 抓 /contact/ 页扩充

**字数**: ~600

---

### 1.3 Stage 2/4 · 视觉审计

**触发**: vision LLM cascade 完成
**内容**:
```
**Stage 2/4 · 视觉审计** · {provider} · {latencySec}s

视觉评分:
- 新鲜度 {fresh}/10 · 风格 {age}
- 信任 {trust}/10
- 转化 {conv}/10

Top 3 问题:
1. {issue1.title}
2. {issue2.title}
3. {issue3.title}

provider {provider} · model {model} · ~${cost.toFixed(4)}
```

**数据源**:
- `visualFixture.parsedJson.{visual_freshness · visual_trust · visual_conversion · visual_age · issues}`
- `out.provider · model · latencyMs · theoreticalCostUsd` from `core/llm/vision-adapter.js`

**字数**: ~360

---

### 1.4 Stage 3/4 · 分级 router

**触发**: gradeLead + persistLeadGrade 完成
**内容**:
```
**Stage 3/4 · 分级 router** done

Grade: {grade} / {tier} ({pricing})
原因: {factors.slice(0,3).join(' · ')}
下一步: {next_action.slice(0, 200)}

phase: {phase} (set) · thread: {channel_status}
```

**channel_status 逻辑**:
- `project_thread_id` 已设 → `#website-projects 已开`
- grade=D → `不开 thread (archived)`
- 其他 → `即将 open #website-leads (publish 后 graduate)`

**数据源**:
- `leadGrade.{investment_level · product_tier · investment_factors · next_action · skip_reasons}` from `core/scoring/lead-grading.js`
- `entity.phase · project_thread_id`

**字数**: ~280

---

### 1.5 Stage 4/4 · 内部审计报告

**触发**: build-internal-report exit 0
**内容** (publish 后 · live URLs):
```
**Stage 4/4 · 内部审计报告** done

[internal audit]({internal_audit_url}) · {htmlSize} KB · {evidence_count} evidence PNG
[master.md]({master_md_url}) updated · 22 sections

Evidence:
- [Busy hero with heavy shadow text]({base}/evidence/issue-busy-hero-with-heavy-shadow-text.png)
- [Dated logo and header]({base}/evidence/issue-dated-logo-and-header.png)
- [Desktop form visual clutter]({base}/evidence/issue-desktop-form-visual-clutter.png)
- [Generic trust signals missing]({base}/evidence/issue-generic-trust-signals-missing.png)
- [Homepage title clear]({base}/evidence/issue-homepage-title-clear.png)
- [Quote form too demanding above fold]({base}/evidence/issue-quote-form-too-demanding-above-fold.png)
_(+N 张更多)_ if > 10

Audit pipeline 完整 · phase=design-ready · ready for M3 demo build
```

**内容** (publish 前 · 本地文件):
```
**Stage 4/4 · 内部审计报告** done

internal-audit-report.html · {htmlSize} KB · {evidence_count} evidence PNG (待 publish)
master.md updated (本地 · 待 publish)

Evidence ({count} · 本地 · 待 publish 后 link):
- Busy hero with heavy shadow text
- ...

Audit pipeline 完整 · phase=design-ready · ready for M3 demo build
```

**数据源**:
- `cf-pages-deploy.json` (如存在) → live URLs
- `clients/<slug>/v2/evidence/*.png` 文件列表
- `htmlSize` from fs.statSync

**字数**: ~600 (有 6 evidence · live 时) · ~430 (本地时)

---

### 1.6 失败 · 异常 marker (唯一保留 emoji)

**触发**: 任何 stage throw 或 build-report exit 非 0
**内容**:
```
❌ **Stage {stage}/4 · 失败**

reason: {reason}
retry: {retry_hint}

audit 终止
```

---

## 2. 实装位置

| 文件 | 用途 |
|---|---|
| `core/funnel/audit-stage-messages.js` (新 D38) | 5 个 builder + failure builder · 中心化模板 |
| `scripts/leads/run-audit-pipeline.js` | 5 个 hook 点 · 调 `postStage(entityKey, msg)` |
| `core/audit/contact-page-fetch.js` (新 D38) | D38 2-page crawl · 抓 /contact/ 页扩充 contact info |
| `core/audit/contact-extraction.js` (D37) | email + contact_us_url + social_links 抽取 |

---

## 3. 测试 · 验收

```bash
# 重 audit 一个 keeper (已 publish 的)
npm run leads:run-pipeline -- --entity-key place_chijwdbif... --refetch

# 期望 (brisbane-roof 已 publish):
#   - 5 messages posted to thread 1504269382304530583
#   - Stage 1 显示 12 维弱项 + tech + sitemap + speed + 联系
#   - Stage 2 显示 3 visual scores + top 3 issues
#   - Stage 3 显示 grade + tier + factors + phase
#   - Stage 4 显示 internal audit hyperlink + master.md link + 6 evidence hyperlink
```

预期消息 1024-字符内 · Discord 不截断。

---

## 4. 维护契约

### 4.1 新 stage 加 hook
- 加 builder fn 到 `audit-stage-messages.js`
- 在 `run-audit-pipeline.js` 对应 stage 末尾 `postStage(entityKey, stageMsgs.newStageMsg(...))`
- 更新本文档 §1

### 4.2 字段加进 audit fixture
- 加进 builder 输入参数
- 控制字符总数 < 1000
- 必要时 truncate 长字段 (例 `.slice(0, 200)`)

### 4.3 数据缺失时
- 不要 throw · skip 该行
- 例: 若 `contact.emails.length === 0` · 显示 `email: —`
- 不要让 builder 因为 1 字段缺整条不发

---

## 5. 相关文档

- [README.md (SoT)](./README.md) · V3 索引
- [SOP-DISCORD-DISPLAY.md](./SOP-DISCORD-DISPLAY.md) · Discord title + profile card 显示规范
- [SOP-2-FLOW.md](./SOP-2-FLOW.md) · audit pipeline 4 stage 详解
- [DECISIONS-LOG.md](./DECISIONS-LOG.md) · D37 (contact extraction) · D38 (per-stage rich messages + 2-page crawl)
- [INTAKE-RUNBOOK.md](./INTAKE-RUNBOOK.md) · 4 入口端到端测试
