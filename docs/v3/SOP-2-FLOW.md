# SOP-2 · master.md skeleton → 22 章 audited master.md + 报告 · 全链路文档

> **作用域**: 从 M1 出口 (entity 入库 · master.md skeleton · phase=AWAITING_AUDIT) 开始，到 22 章 audited master.md + internal/customer audit HTML + screenshots/evidence/video 全套 asset 落盘结束。
> **不在范围**: 网站生成 (M3 · SOP-3) · outreach (M4) · 购后 (M5)。
> **owner**: M2-PRD owns 设计 · 本 doc 是 Operator-facing runbook (4 stage / cron / 触发 / 汇报 / asset)。
> **status**: 当前生产实装 · 10 个真客户 audit 完整。
> **依赖**: SOP-1 已跑过 (master.md skeleton 已在)。

---

## 0. TL;DR · 1 屏看懂

```
M1 出口 · entity + master.md skeleton + phase=AWAITING_AUDIT
        │
        ▼
Hermes cron · 每 4 小时 ai.profitslocal.hermes.rescore-and-audit
   npm run scoring:rescore-v2 -- --all-niches
        │
        ▼
per-niche cheap-audit-v2 (Tinyfish + 10 规则) → fixtures/rescore/<niche>-<ts>.json
        │
        ▼
npm run leads:run-pipeline --all-audit-candidates
        │  4 stage per entity:
        │
        ├─ Stage 1 · detailedAudit (Playwright + 12 dim · 30天 staleness 自动 refetch)
        │            → fixtures + 录屏 + 截图 + 12 dim score
        │            🪝 master.md refresh (audit 字段填)
        ├─ Stage 2 · visualAudit (claude_cli → codex_cli → ollama cascade)
        │            → visual_freshness score + reasoning
        ├─ Stage 3a · gradeLead + persistLeadGrade (A/B/C/D + T1/T2/T3)
        │            ├─ 8 hard-skip → D auto-archive
        │            ├─ A/B → openLeadThread (Discord forum thread)
        │            └─ C → openLeadThread + enqueue cold-outreach-queue
        ├─ Stage 3b · review mining (docker first · Places fallback)
        │            └─ A/B only · C/D skip 省 cost
        └─ Stage 4 · build internal HTML report + 捕获 issue evidence PNG
                     🪝 master.md final refresh · 22 章满
        │
        ▼
Stage 4b · M2-D9 customer-audience autoresearch loop
   (5 round LLM generate → critic → rewrite · English + Australian tone)
        │
        ▼
Master.md design-ready · phase=DESIGN_READY · OD/M3 接手
```

---

## 1. 入口触发方式

### 1.1 自动触发 · Hermes cron (主路径)

**plist**: `~/.hermes/profiles/marketer/cron/rescore-and-audit.yaml`
**频率**: 每 4 小时 (`0 */4 * * *` · 00:00, 04:00, 08:00, 12:00, 16:00, 20:00)
**脚本**: `ops/v3/rescore-and-audit.sh`

```bash
cd /Users/matthew/Developer/google-map-website-v3
npm run scoring:rescore-v2 -- --all-niches >> ~/Library/Logs/v3/rescore.log 2>&1
# 自动 chain run-pipeline · 在 rescore-v2-cli.js 内部
```

### 1.2 手动触发 · 单 entity

```bash
npm run leads:run-pipeline -- --entity-key place_chij... [--refetch] [--with-reviews]
```

| Flag | 含义 |
|---|---|
| `--entity-key` | 必填 · entity store key |
| `--refetch` | 强制重抓 Playwright fixture (默认用 cache) |
| `--with-reviews` | 额外抓 reviews (Places API · ~$0.017) · default 关 |
| `--all-audit-candidates` | 跑所有 phase=AWAITING_AUDIT 的 entity |

### 1.3 Discord 触发 · audit kind

在 `#website-tasks` forum 发 `audit place_chij...` 或 `审计 place_chij...` → listener routeIntent → kind=audit → `leads:run-pipeline --entity-key X` (per intent-router viaRegex#2)。

### 1.4 30 天 staleness 自动 refetch

Stage 1 入口检查 `fixtures/<entityKey>-fetch.json` mtime > 30 天 → 自动当 `--refetch` 处理。无需人工。

---

## 2. Stage 1 · detailedAudit (Playwright + 12 维)

**位置**: `core/scoring/detailed-audit.js`
**输入**: entity JSON + 现有 fixture (or refetch)
**输出**:
- `fixtures/site-fetch-full/<entityKey>.json` (12 dim raw data)
- `clients/<slug>/v2/screenshots/desktop.png` + `mobile.png`
- `clients/<slug>/v2/video/mobile-throttled.webm` (Pixel 8 + Slow 3G throttle)
- `audit_score` (0-100) + decision + issues 数组

**12 维 dimensions** (39 rules):
trust / mobile / form / cta / speed / typography / visual-hierarchy / content-density / brand-consistency / accessibility / analytics / technical

**成本**: T0 free (Playwright + 本地规则 · 无 LLM)

**🪝 Hook**: `enqueueMasterMdRefresh(entityKey, { reason: 'audit' })` 写第二章 audit 字段。

---

## 3. Stage 2 · visualAudit (LLM vision cascade)

**位置**: `core/llm/vision-adapter.js` + `core/llm/visual-audit-prompt.js`
**Cascade**: `claude_cli → codex_cli → ollama` (T3 → T3 → T0 fallback)

**输入**: `desktop.png` 截图 (1280×720 trimmed)
**Prompt**: 评估 visual freshness + design era + 主要痛点 (busy hero / dated form / form-too-demanding 等)

**输出** (写到 master.md 第二章):
```json
{
  "visual_freshness": 4,            // 0-10
  "visual_reasoning": "Heavy navy + Playfair · 2018 era feel · hero CTA buried by 3 form fields",
  "model_used":       "claude-sonnet-4-5",
  "provider":         "claude_cli",
  "latency_ms":       8234
}
```

**成本**:
- claude_cli: ~$0.005 per image
- codex_cli: ~$0.003
- ollama (qwen2-vl-7b): $0 但准确率低 30%

---

## 4. Stage 3 · grading + Discord thread

### 4.1 gradeLead (`core/scoring/lead-grading.js`)

**Hard-skip 8 条** (→ D auto-archive):
- no_phone · no_address · permanently_closed · chain_business · directory_listing · no_website · website_blocked · explicit_opt_out

**A/B/C/D + T1/T2/T3 矩阵**:
| Grade | 标准 | T1 (urgent) | T2 (mid) | T3 (cold) |
|---|---|---|---|---|
| A | 评分 ≥75 · 强 signals | direct sales | upsell | nurture |
| B | 60-75 | direct sales | upsell | nurture |
| C | 40-60 | cold outreach | newsletter | drip |
| D | <40 | archive | archive | archive |

### 4.2 persistLeadGrade

更新 entity JSON `scoring.grade` / `scoring.tier` 字段。

### 4.3 openLeadThread (M2-D3)

A/B/C grade → `core/funnel/lead-thread-sync.js#openLeadThread`:
- 在 Discord `#website-tasks` forum 开 thread
- Thread title: `[<grade>] <business name> · <niche> · <city>`
- 首条 message: master.md frontmatter + audit score + decision + top 3 issues
- Tags: `[graded, <grade>, <tier>]`

### 4.4 Stage 3b · review mining

**Order** (per M2-D2 reviews-adapter):
1. `pl:scrape-docker --extra-reviews --entity-key X` (gosom docker · T0 free · 拿全 review history)
2. 失败 fallback → `fetchLeadReviews` (Places API · T2 paid · 最多 5 条)

**写**: `fixtures/reviews/<entityKey>.json` · normalize 结构 (rating / text / author / date / source)
**用于**: master.md 第二/三章 · pain point 引用 + 销售话术参考

---

## 5. Stage 4 · internal HTML report + evidence

**位置**: `scripts/leads/build-internal-report.js` (or `pl:build-internal-audit`)
**输出**:
- `clients/<slug>/v2/internal-audit-report.html` (中文 · 操作员看 · D26)
- `clients/<slug>/v2/evidence/issue-*.png` (issue-busy-hero / issue-dated-logo / issue-form-clutter 等 6-10 张 annotated 截图)

**用 issue-evidence.js**: 根据 Stage 1 issues 数组 · Playwright 重定位元素 + 截图 + 边框标注。

**🪝 master.md final refresh**: 22 章全部填满 · phase=DESIGN_READY。

---

## 6. Stage 4b · Customer-audience autoresearch loop (M2-D9)

**位置**: `core/reports/autoresearch-loop.js` + `core/reports/generator.js#SYSTEM_PREAMBLES.customer`
**触发**: Stage 4 完后 hook (`scripts/cli/pl-build-customer-audit.js`)
**多轮**: 5 round (generate → critic → rewrite) per D26 English-only + Australian spelling

**输出**:
- `clients/<slug>/v2/customer-facing-audit.html` (~9 KB · 简洁可读)
- `clients/<slug>/v2/customer-facing-audit-desktop.png` + `-mobile.png` (preview 用)

**Headers** (English-only · per D26):
- "What's Working Well"
- "What's Holding You Back"
- "What Changes When We Fix This"
- "Next Step"

**Tone**: Australian-friendly · "If it doesn't, no worries" (classic AU closer)

**成本**: ~$0.50 (claude_cli sonnet · 5 round)

---

## 7. Stage 4c · Optimized internal report (可选 · 2026-05-13 加)

**位置**: `scripts/cli/pl-optimize-internal-report.js`
**触发**: 手动 · `npm run pl:optimize-internal-report -- --slug <slug>`
**做什么**: 对 Stage 4 internal HTML 跑 3-5 round autoresearch · critic + rewrite · 中文标题强制 (一、二、三章节序)

**输出**:
- `clients/<slug>/v2/internal-audit-report.optimized.html` (~38 KB · 3 轮后)
- `clients/<slug>/v2/internal-audit-report.optimized.history.json` (轮次 critique 全留底)

**成本**: ~$1.50 / round · 5 round = ~$7.50
**已知 bug**: Round 3 critique 偶尔复读 Round 2 (LLM 静默 · 待修)

---

## 8. Discord 汇报格式

### 8.1 audit 触发回报 (借 SOP-1 路径 · listener + dispatcher)

```
📋 **Audit · place_chij...** · 已收到
· 在做: 4-stage audit pipeline → `leads:run-pipeline`
· 参数: `--entity-key place_chij...`
· 预计 3-8 分钟出结果 · 完了我会回这里告诉你
· 进度详情: https://admin.profitslocal.com/tasks/<taskId>
```

### 8.2 Stage 进度 (per task progress array)

dispatcher 在 task `progress` 字段追加 (admin URL 可看):
- `stage1.detailed_audit.done` · score=70 · issues=8
- `stage2.visual_audit.done` · score=4 · provider=claude_cli
- `stage3.grade.done` · grade=B · tier=T1 · discord_thread_id=...
- `stage3b.reviews.done` · source=docker · count=119
- `stage4.internal_report.done` · evidence=6 · html_size=47331

### 8.3 完成回报

```
✅ **Audit · brisbane-roof-restoration-experts** · 完成 · 用时 312.5s
· 评分: 70/100 · grade=B · tier=T1
· 主要痛点: busy hero · dated form · form-too-demanding above fold
· 后续: 已开 Discord thread + master.md 22 章满 → DESIGN_READY
· 报告: https://admin.profitslocal.com/clients/brisbane-roof-.../v2/internal-audit-report.html

<details><summary>技术细节</summary>
[stage1] audit_score=70 · 8 issues
[stage2] visual_freshness=4 · claude-sonnet-4-5 · 8234ms
[stage3] grade=B tier=T1 · thread=1234567890
[stage3b] reviews via docker · 5 条 (cap by gosom test)
[stage4] internal-audit-report.html · 6 evidence PNG
[done] exit=0 · duration=312.5s
</details>
```

### 8.4 A/B/C 客户专属 Discord thread (M2-D3 openLeadThread)

完成时 audit pipeline 在 forum 开新 thread：

```
[B] Brisbane Roof Restoration Experts · roofer · brisbane
─────────────────────────────────────
评分: 70 · grade B · tier T1
现状: 网站 desktop ok · mobile form too demanding
主要痛点:
  1. Busy hero with heavy shadow text
  2. Dated logo and header
  3. Quote form too demanding above the fold
audit URL: https://admin.profitslocal.com/clients/.../internal-audit-report.html
master.md: https://admin.profitslocal.com/clients/.../master.md
phase: DESIGN_READY · 等 M3 接
```

---

## 9. 全部 asset 清单 · master.md 之后 / 网站之前

```
data/
├── leads/queues/cheap-site-audit.json           # audit 队列 (Stage 0 用)
├── leads/queues/selected-enrichment.json        # T2/T3 enrich 队列
├── leads/discovery-events.jsonl                 # +audit/grade events
├── finance/ledger.jsonl                         # +audit cost (vision LLM / places reviews)
├── fixtures/site-fetch-full/<entityKey>.json    # 12 dim raw data
├── fixtures/reviews/<entityKey>.json            # normalize 评论
└── fixtures/rescore/<niche>-<ts>.json           # cheap-audit-v2 cycle 数据

clients/<slug>/v2/
├── master.md                                    # ~50KB · 22 章满版
├── master.report.html                           # md→html 渲染
├── screenshots/
│   ├── desktop.png                              # 1280×720 home
│   └── mobile.png                               # Pixel 8 portrait
├── video/
│   └── mobile-throttled.webm                    # 移动+Slow3G 录屏
├── evidence/
│   └── issue-*.png                              # 6-10 张 annotated 截图
├── internal-audit-report.html                   # ~47KB · 中文 · 操作员看
├── internal-audit-report.optimized.html         # (可选) ~38KB · 3 轮 autoresearch
├── internal-audit-report.optimized.history.json # (可选) 轮次 critique 留底
├── customer-facing-audit.html                   # ~9KB · English · 客户看
├── customer-facing-audit-desktop.png            # preview
└── customer-facing-audit-mobile.png             # preview
```

**M2 单客户 asset 总量**: ~6.3 MB (主要 video + screenshots + optimized PNG)

---

## 10. 真客户 audit 状态 (10 个全完整)

| Customer | audit | visual | evidence | reviews | photos |
|---|---|---|---|---|---|
| brisbane-roof-restoration-experts | 70 | 4 | 6 | 5 (places) | 6 |
| brisbane-roofing-solutions-... | 69 | 4 | 8 | 119 (docker) | 6 |
| diamond-roof-tiling-restoration | 55 | 3 | 7 | 65 (docker) | 6 |
| fix-my-roof-total-roof-restorations | 51 | 3 | 8 | 128 (docker) | 6 |
| gutter-and-roof-repairs | 69 | 4 | 7 | 150 (docker) | 6 |
| hurricane-digital-seo-brisbane | 64 | 6 | 9 | 181 (docker) | 6 |
| queensland-roofing-pty-ltd | 23 | 4 | 10 | 35 (docker) | 6 |
| roof-space-renovators | 65 | 5 | 5 | 221 (docker) | 6 |
| roofshield-roof-restorations | 53 | 4 | 6 | 51 (docker) | 6 |
| weatherproof-restorations | 61 | 7 | 7 | 136 (docker) | 6 |

---

## 11. 关键时序 (真实测试)

| 阶段 | 耗时 |
|---|---|
| Stage 1 Playwright + 12 dim | 30-90s (含截图 + 录屏) |
| Stage 2 vision LLM | 5-15s |
| Stage 3 grading + thread open | 2-5s |
| Stage 3b reviews (docker) | 10-30s |
| Stage 3b reviews (places fallback) | 5-15s |
| Stage 4 internal HTML | 20-60s |
| Stage 4b customer audience autoresearch | 90-180s (5 round) |
| **总端到端 (单客户)** | **~3-8 min** |

---

## 12. 健康检查 · 当前差距

**M2 尚无专门 doctor**。建议未来加 `pl:audit-doctor`:
- audit 队列 `cheap-site-audit.json` 积压 < 50
- fixtures dir 24h 内有新文件
- Hermes cron `rescore-and-audit` heartbeat < 5h
- vision LLM (claude_cli) smoke 跑通
- last 10 audit Stage 4 exit code 全 0

目前靠 SOP-1-FLOW intake-doctor 边缘覆盖 (check #4 master.md backlog 间接反映 audit pipeline 卡)。

---

## 13. 故障 runbook

| 现象 | 诊断 | 修复 |
|---|---|---|
| audit Stage 1 Playwright fail | `data/tasks/_logs/v3-dispatcher.log` 看 | `npx playwright install chromium` |
| visual_freshness=null | task progress 看 stage2 输出 | LLM cascade 全挂 · 检查 ANTHROPIC_API_KEY / ollama serve |
| reviews count 卡 5 | Stage 3b source=places fallback | `scripts/v3/refit-docker-reviews.mjs --entity-key X` 强制 docker 重抓 |
| photos 0 张 | entity `latest.photos` 空 | `scripts/v3/enrich-photos-for-all.mjs --entity-key X` |
| Hermes cron 没跑 | `launchctl list \| grep hermes` | kickstart -k 或看 ops/v3/rescore-and-audit.sh 权限 |
| C grade 没进 cold queue | grade-router log | `data/leads/queues/cold-outreach-queue.json` 是否存在 |

---

## 14. 相关文档

- [M2-PRD.md](./M2-PRD.md) · M2 设计 PRD · 10 deliverables
- [M2-D9-CUSTOMER-AUDIENCE-REPORT.md](./M2-D9-CUSTOMER-AUDIENCE-REPORT.md) · D9 autoresearch loop 详解
- [MASTER-MD-AUDIT-V2-2026-05-13.md](./MASTER-MD-AUDIT-V2-2026-05-13.md) · 19 bug + 10 客户审计
- [DECISIONS-LOG.md](./DECISIONS-LOG.md) · D26 customer=English/internal=Chinese · D14-D23 M2 决策
- [SOP-1-FLOW.md](./SOP-1-FLOW.md) · 上游 intake 流转
- [SOP-3-FLOW.md](./SOP-3-FLOW.md) · 下游 publish 流转
