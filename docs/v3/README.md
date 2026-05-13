# V3 · Source of Truth (SoT)

> **Branch**: `v3-modular` · worktree `/Users/matthew/Developer/google-map-website-v3/`
> **GitHub**: https://github.com/matthew6688/webjuice-stack-mvp/tree/v3-modular
> **Last verified live**: 2026-05-14 · doctor 5/5 green · 10 客户 live URL 200
> **本文是 V3 唯一 source of truth · 任何代码变更必须同步更新本索引及相关 doc**

---

## 🔒 代码-文档同步契约 (强制)

任何 V3 代码 PR / commit 提交前必须满足以下任一条:

| 改动类型 | 必须更新 |
|---|---|
| 新增 CLI / 模块文件 | 本 README 「Code 索引」表 + 对应 M{1,2,3}-PRD 「Current State」 + 对应 SOP-N-FLOW |
| 新增/改 launchd plist / cron | 本 README 「Daemon 索引」 + DECISIONS-LOG (新 D) |
| 新增 npm script | 本 README 「NPM scripts」 |
| 修 Bug | 本 README 「Bug fix 历史」 + DECISIONS-LOG Bug log 节 |
| 架构决策 | DECISIONS-LOG (新 D) + 影响到的 PRD §架构 / SOP-FLOW |
| 文档自身改动 | 不重复改本 README · 但相互引用要保持链接有效 |

**违反**: commit message 必须包含 `[no-doc-needed]` 加理由 (例 typo fix / 临时调试)。否则视为不合规 · 需补 doc 后再 merge。

**自检命令** (TODO · 待实装):
```bash
npm run v3:doc-sync-audit
# 扫描 git diff · 比对 SoT 索引 · 报告未同步项
```

---

## 模块状态总览

| 模块 | 范围 | 状态 | PRD | Flow doc | 验证 |
|---|---|---|---|---|---|
| **M1** · 入库 → entity → master.md skeleton | 6 deliverable | ✅ **DONE** | [M1-PRD](./M1-PRD.md) | [SOP-1-FLOW](./SOP-1-FLOW.md) | `npm run v3:validate-m1` 16/16 · `pl:intake-doctor` 5/5 |
| **M2** · audit + 22 章 + grade router + customer audience | 10 deliverable | ✅ **DONE** | [M2-PRD](./M2-PRD.md) | [SOP-2-FLOW](./SOP-2-FLOW.md) | `npm run v3:validate-m2` 46/46 · 10 真客户 audit 全完整 |
| **M3** · reference-adapter → CF Pages publish | 7 deliverable (回填) | ✅ **DONE** | [M3-PRD](./M3-PRD.md) | [SOP-3-FLOW](./SOP-3-FLOW.md) | 10 客户 live URL · curl 200 |
| **M4** · outreach (email / sms / voice / appointment) | TBD | ❌ NOT STARTED | — | — | — |
| **M5** · paid lifecycle (Stripe → approval → domain → revision) | TBD | ❌ NOT STARTED | — | — | — |

---

## Daemon 索引 (launchd · 当前运行)

| Label | Plist 路径 | WorkingDirectory | 触发 | 文档 |
|---|---|---|---|---|
| `ai.profitslocal.task-listener` | `~/Library/LaunchAgents/ai.profitslocal.task-listener.plist` | main worktree | RunAtLoad + KeepAlive | SOP-1 §2 |
| `ai.profitslocal.task-dispatcher` | `~/Library/LaunchAgents/ai.profitslocal.task-dispatcher.plist` | main worktree | RunAtLoad + KeepAlive | SOP-DISCORD-HERMES-FLOW |
| **`ai.profitslocal.v3.task-dispatcher`** (**D30 新**) | `~/Library/LaunchAgents/ai.profitslocal.v3.task-dispatcher.plist` | v3 worktree | RunAtLoad + KeepAlive | SOP-1 §5 · D30 |
| **`ai.profitslocal.intake-doctor-daily`** (**D29 新**) | `~/Library/LaunchAgents/ai.profitslocal.intake-doctor-daily.plist` | v3 worktree | 09:00 daily | M1-PRD §8.1 · D29 |
| `ai.profitslocal.task-api` | … | main worktree | RunAtLoad + KeepAlive | — |
| `ai.profitslocal.sop0-tunnel` | … | main worktree | RunAtLoad + KeepAlive | — |
| `ai.profitslocal.task-retention` | … | main worktree | 03:00 daily | — |

**Hermes cron**:
- `rescore-and-audit` · 每 4 小时 · M2 audit pipeline 触发器 (SOP-2 §1.1)

---

## Code 索引

### 入口 CLI (4 SOP-1 intake + 1 audit + 4 M3)

| 文件 | 模块 | 作用 |
|---|---|---|
| `scripts/cli/pl-pipeline-batch-start.js` | M1 | `intake` · gosom docker batch scrape |
| `scripts/cli/pl-places-search-intake.js` | M1 | `places-intake` · Google Places API |
| `scripts/cli/pl-single-enrich.js` | M1 | `single-enrich` · 单店补全 (phone/URL) |
| `scripts/cli/pl-ingest-image.js` | M1 | `image-extract` · 名片图 vision OCR |
| `scripts/leads/run-audit-pipeline.js` | M2 | `audit` · 4 stage pipeline |
| `scripts/cli/pl-build-from-reference.js` | M3 | reference-adapter → adapted HTML |
| `scripts/cli/pl-build-customer-audit.js` | M3 | English audit page |
| `scripts/cli/pl-build-internal-audit.js` | M3 | 中文 internal audit |
| `scripts/cli/pl-optimize-internal-report.js` | M3 | 多轮 polish internal |
| `scripts/cli/pl-publish-demo.js` | M3 | CF Pages deploy |
| `scripts/cli/pl-bulk-publish-demo.js` | M3 | 批量 deploy |

### Core modules

| 文件 | 模块 | 作用 |
|---|---|---|
| `core/tasks/intent-router.js` | M1 | cascade `codex_cli → claude_cli → ollama → regex` (D27) |
| `core/tasks/task-store.js` | M1 | task CRUD · CWD-bound (D30 根因) |
| `core/leads/dedup-scorer.js` | M1 | 8-key weighted dedup |
| `core/leads/discovery-score.js` | M1 | unified discovery score |
| `core/leads/discovery-store.js` | M1 | entity persist + master.md hook |
| `core/leads/master-md-refresh.js` | M1 | enqueueMasterMdRefresh (fire-and-forget) |
| `core/leads/audit-stage1.js` | M2 | 30-day staleness check |
| `core/leads/reviews-adapter.js` | M2 | docker → places cascade |
| `core/leads/grade-router.js` | M2 | A/B/C/D → Discord + cold queue |
| `core/scoring/lead-grading.js` | M2 | 8 hard-skip + grade/tier |
| `core/scoring/detailed-audit.js` | M2 | Playwright + 12 dim |
| `core/llm/vision-adapter.js` | M2 | vision LLM cascade |
| `core/reports/master-md-builder.js` | M2 | 22 章 builder |
| `core/reports/autoresearch-loop.js` | M2 | M2-D9 5-round loop |
| `core/reports/generator.js` | M2 | SYSTEM_PREAMBLES (D26) |
| `core/leads/reference-adapter-handoff.js` | M3 | buildAdapterPayload + FAMILY_REGISTRY |

### Doctor + ops

| 文件 | 作用 |
|---|---|
| `scripts/cli/pl-sop0-doctor.js` | SOP-0 5 check (daemon + tunnel + listener + ollama + stuck) |
| `scripts/cli/pl-intake-doctor.js` (D29 新) | SOP-1 5 check (entities / docker / Places key / build-md backlog / regex router) |
| `scripts/cli/pl-ops-health-check.js` | 综合 ops 检查 |
| `scripts/cli/pl-task-listener.js` | Discord listener daemon |
| `scripts/cli/pl-task-dispatcher.js` | task dispatcher daemon |
| `scripts/cli/pl-scrape-docker.js` | gosom docker 健康检查 + auto-recover (Bug D 修) |
| `scripts/cli/pl-task-retention.js` | task GC |

### Bug fix scripts (维护用)

| 文件 | 用途 |
|---|---|
| `scripts/v3/refit-docker-reviews.mjs` | Bug 17 · 重抓 reviews via docker |
| `scripts/v3/enrich-photos-for-all.mjs` | Bug 18 · GMB photos download |
| `scripts/v3/batch-master-md-by-city.mjs` | 批量 intake pressure test |
| `scripts/v3/pressure-test-intake-router.mjs` | router 准确率压测 |
| `scripts/v3/pressure-test-intake-chain.mjs` | 整链 post-router 压测 |

---

## NPM scripts · 一键命令

```bash
# Validators
npm run v3:validate-m1                    # 16/16
npm run v3:validate-m2                    # 46/46
npm run v3:validate-all

# E2E
npm run v3:e2e                            # M1+M2 cross-module
npm run v3:e2e-4-entry                    # 4 真入口 → master.md
npm run v3:pressure-intake-router         # 24 routing scenarios
npm run v3:pressure-intake-chain          # 12 post-router scenarios
npm run v3:batch-master-md                # 批量 intake by city

# Health
npm run pl:sop0-doctor                    # SOP-0 5 check
npm run pl:intake-doctor                  # SOP-1 5 check (D29)
npm run pl:intake-doctor -- --json        # JSON cron 模式
npm run pl:ops-health-check               # 综合

# M1 intake
npm run pl:places-search-intake -- "<niche> <city>" --limit N
npm run pl:scrape-docker -- --niche X --city Y --count N
npm run pl:single-enrich -- --phone +61... | --gbp-url ...
npm run pl:ingest-image -- --image-path ...

# M1 ops
npm run leads:build-master-md -- --entity-key <key>
npm run pl:bulk-archive -- --grade D

# M2 audit
npm run scoring:rescore-v2 -- --all-niches | --niche X
npm run leads:run-pipeline -- --entity-key <key> [--refetch] [--with-reviews]

# M3 publish
npm run pl:build-from-reference -- --slug <slug>
npm run pl:build-customer-audit -- --slug <slug>
npm run pl:build-internal-audit -- --slug <slug>
npm run pl:optimize-internal-report -- --slug <slug> [--rounds 3]
npm run pl:publish-demo -- --slug <slug>
npm run pl:bulk-publish-demo -- --all
```

---

## 决策日志 (DECISIONS-LOG · 关键条目)

| ID | Title | 影响 |
|---|---|---|
| D14-D23 | M1 / M2 多个 (master.md / dedup / audit / grading) | M1+M2 设计 |
| D24 | GMB photos paid-only · no LLM classify | M2 |
| D25 | Notification 标准化 | 内部 |
| D26 | customer=English / internal=Chinese | M2 + M3 |
| D27 | intent-router cascade · paid CLIs FIRST | M1 |
| D28 | master.md + audit bundle on V3 publish | M3 |
| D29 | `pl:intake-doctor` health check · daily live | M1 |
| D30 | per-worktree task-dispatcher (v3 plist) | M1 (Bug C 根因) |

完整: [DECISIONS-LOG.md](./DECISIONS-LOG.md)

---

## Doctor 健康看板

| Doctor | Cadence | Cron | 守 |
|---|---|---|---|
| `pl:sop0-doctor` | manual / on-demand | — | 5 daemon + tunnel + listener + ollama + stuck |
| `pl:intake-doctor` | **daily 09:00** (live) | `ai.profitslocal.intake-doctor-daily` | entities / docker / API key / build-md backlog / regex router |
| **(缺)** `pl:audit-doctor` | TODO | — | Stage 1-4 健康 (Playwright / vision / Hermes cron) |
| **(缺)** `pl:publish-doctor` | TODO | — | CF token / wrangler / reference files / live URL spot |

Heartbeat: `data/heartbeats/intake-doctor.txt` (mtime <25h = 活)

---

## 全 V3 文档索引

### 模块 PRD (设计 · 验收标准)
- [M1-PRD.md](./M1-PRD.md) · intake + dedup + master.md skeleton
- [M2-PRD.md](./M2-PRD.md) · audit + 22 章 + grade router
- [M3-PRD.md](./M3-PRD.md) · reference-adapter + publish (**回填 2026-05-14**)

### Operator runbook (SOP-N-FLOW · 流转 / 节点 / 汇报 / 故障)
- [SOP-1-FLOW.md](./SOP-1-FLOW.md) · Discord → master.md (**新 2026-05-14**)
- [SOP-2-FLOW.md](./SOP-2-FLOW.md) · audit pipeline (**新 2026-05-14**)
- [SOP-3-FLOW.md](./SOP-3-FLOW.md) · publish pipeline (**新 2026-05-14**)
- [SOP-DISCORD-HERMES-FLOW.md](./SOP-DISCORD-HERMES-FLOW.md) · Discord ↔ Hermes 协同

### Lead 旅程 (跨 M1+M2 · lifecycle 视角)
- [LEAD-JOURNEY.md](./LEAD-JOURNEY.md) · **每个 lead 从进入到网站就绪的 12 阶段** (**新 2026-05-14**)
  · 分类 / 评分 / 分级 / 决策矩阵 / 漏斗 bleed points / Operator 一日流程

### 设计 + 研究
- [WEBSITE-QUALITY-RND.md](./WEBSITE-QUALITY-RND.md) · website quality R&D
- [WEBSITE-AUTORESEARCH-DESIGN.md](./WEBSITE-AUTORESEARCH-DESIGN.md) · 撤回的 288-variant 方案 (历史)
- [OD-HANDOFF-RESEARCH.md](./OD-HANDOFF-RESEARCH.md) · M3 handoff 论证
- [open-design-upstream-research-2026-05-13.md](./open-design-upstream-research-2026-05-13.md) · OD 上游研究
- [website-quality-research-2026-05-13.md](./website-quality-research-2026-05-13.md) · 网站质量研究

### Audit + Evidence
- [TEST-AND-EVIDENCE.md](./TEST-AND-EVIDENCE.md) · 16 test contract + hard evidence
- [MASTER-MD-AUDIT-2026-05-13.md](./MASTER-MD-AUDIT-2026-05-13.md) · master.md 审计 v1
- [MASTER-MD-AUDIT-V2-2026-05-13.md](./MASTER-MD-AUDIT-V2-2026-05-13.md) · 19 bug 状态 + 10 客户
- [DISCORD-LIVE-E2E-2026-05-13.md](./DISCORD-LIVE-E2E-2026-05-13.md) · Discord 实战 E2E
- [PRE-IMPLEMENT-VERIFICATION.md](./PRE-IMPLEMENT-VERIFICATION.md) · 实装前 8 个 <95% 点

### Reference
- [DECISIONS-LOG.md](./DECISIONS-LOG.md) · 全决策 + Bug log
- [CUSTOMER-FOLDER-STRUCTURE.md](./CUSTOMER-FOLDER-STRUCTURE.md) · `clients/<slug>/v2/` 结构
- [M2-D9-CUSTOMER-AUDIENCE-REPORT.md](./M2-D9-CUSTOMER-AUDIENCE-REPORT.md) · D9 autoresearch loop

---

## Bug fix 历史 · 24 个 (23 fixed · 1 cosmetic 待)

详: [MASTER-MD-AUDIT-V2-2026-05-13.md](./MASTER-MD-AUDIT-V2-2026-05-13.md) (#1-19) + [DECISIONS-LOG.md](./DECISIONS-LOG.md) Bug log 节 (E/F)

| # | Bug | 严重 | 状态 | 修在哪 |
|---|---|---|---|---|
| 1 | master.md 缺 3 必出 section | 🔴 | ✅ | M2 ensureAllRequiredSections |
| 2/15 | visual_freshness=NULL | 🔴 | ✅ | M2 vision-adapter cascade |
| 3 | single-enrich query="Brisbane" → city geo | 🔴 | ✅ | M1 query 逻辑 |
| 4 | evidence_count=0 不读磁盘 | 🟠 | ✅ | countEvidenceOnDisk |
| 5 | Playwright 未装 | 🟠 | ✅ | install |
| 6 | places-search-intake niche 空 | 🟠 | ✅ | normalizeNiche fallback |
| 7/10/14 | duplicate ## headers | 🟡 | ✅ | ensureRequiredOrder |
| 8 | 必出 section 在附录后 | 🟡 | ✅ | anchor regex |
| 9 | city 大小写 | 🟡 | ✅ | normalizeCity |
| 11 | "未明确决策类型: undefined" | 🟢 | ✅ | fallback message |
| 12 | 附录链接到不存在 HTML | 🟢 | ⚠️ cosmetic | 待修 |
| 13/16 | Vision model 字段写死 | 🟢 | ✅ | real provider/model |
| 17 | reviews 卡 5 条 | 🟠 | ✅ | refit-docker-reviews |
| 18 | GMB photos 缺 | 🟠 | ✅ | enrich-photos-for-all |
| 19 | video_url=null | 🟢 | ✅ | localVideoPath fallback |
| A | ollama router 漏 niche/city | 🔴 | ✅ | M1 intent-router NICHE/CITY_KEYWORDS + normalizeArgsForKind |
| B | image-extract human-gate UX 沉默 | 🟠 | ✅ | listener detailed message |
| C | v3 worktree task 孤儿 (dispatcher 看不到) | 🔴 | ✅ | D30 per-worktree dispatcher plist |
| D | docker daemon down 神秘 fetch failed | 🔴 | ✅ | pl-scrape-docker checkContainerHealth + auto-recover |
| E | `--count` 命名误导 (= gosom depth) | 🟢 | ✅ | inline 注释 |
| F | build-master-md 积压 114 | 🔴 | ✅ | D30 闭环 |

---

## 真客户状态 (10 个 · M2 完整 + M3 live)

| Customer | M2 audit | M3 live URL |
|---|---|---|
| brisbane-roof-restoration-experts | 70/4/6/5 | brisbane-roof-restoration-experts-dev.pages.dev |
| brisbane-roofing-solutions-... | 69/4/8/119 | brisbane-roofing-solutions-...-dev.pages.dev |
| diamond-roof-tiling-restoration | 55/3/7/65 | diamond-roof-tiling-restoration-dev.pages.dev |
| fix-my-roof-total-roof-restorations | 51/3/8/128 | fix-my-roof-...-dev.pages.dev |
| gutter-and-roof-repairs | 69/4/7/150 | gutter-and-roof-repairs-dev.pages.dev |
| hurricane-digital-seo-brisbane | 64/6/9/181 | hurricane-digital-seo-brisbane-dev.pages.dev |
| queensland-roofing-pty-ltd | 23/4/10/35 | queensland-roofing-pty-ltd-dev.pages.dev |
| roof-space-renovators | 65/5/5/221 | roof-space-renovators-dev.pages.dev |
| roofshield-roof-restorations | 53/4/6/51 | roofshield-roof-restorations-dev.pages.dev |
| weatherproof-restorations | 61/7/7/136 | weatherproof-restorations-dev.pages.dev |

格式: audit/visual/evidence/reviews

---

## 工作目录约定

- 新代码 / 新 docs → `v3-modular` branch (本 worktree `/Users/matthew/Developer/google-map-website-v3/`)
- ops/紧急 → `main` branch (`/Users/matthew/Developer/google-map-website/`)
- 跨 branch 同步: v3 稳定 + batch 验证后 PR `v3-modular` → `main`

```bash
cd /Users/matthew/Developer/google-map-website-v3            # v3 worktree
git -C /Users/matthew/Developer/google-map-website-v3 branch --show-current  # → v3-modular
```

---

## 已撤回的方案 (历史档案)

| 撤回 | 原因 | 当前替代 |
|---|---|---|
| 288-variant vision-LLM autoresearch | overengineering | reference HTML adapter (M3 default) |
| 4 templates 跨模板组合 | OD 弱在 design decision · 强在 content adapt | 1 reference per niche · OD 只 swap content |
| freeform OD prompt (V2) | 自由参数太多 · 不稳定 | reference-adapter-handoff.js (参数 locked) |
| 建素材库 | =我们替 AI 做 design 决定 · 错向 | reference site = library of section instances |
| ollama-first router cascade | paid CLI 更准 (Matthew 反馈) | D27: codex_cli → claude_cli → ollama → regex |
| main 单 dispatcher 跨 worktree 服务 | task store CWD-bound · 跨 worktree 孤儿 | D30: per-worktree dispatcher plist |

---

## 下一步候选 (M4 之前 · 待 Matthew 决)

| 选项 | 工作量 | 价值 |
|---|---|---|
| `pl:audit-doctor` (SOP-2 健康检查) | 2h | M2 链路也有 daily 监控 |
| `pl:publish-doctor` (SOP-3 健康检查) | 1.5h | live URL spot check + CF quota |
| `npm run v3:doc-sync-audit` 实装 | 3h | 强制 SoT 同步契约可执行 |
| Family ≥ 2 (跨 niche reference site) | 8h | M3 扩到 plumber/electrician 等 |
| Photo classification (vision LLM 标 type) | 4h | 真客户图替换 reference stock |
| M4 outreach 启动 | TBD | 整体 funnel 推进 |

---

## ⚠️ 文档过期 trigger (定期 audit)

每月 1 号自检以下事项 (TODO · 加进 daily cron 提醒):
- [ ] 模块状态总览的 ✅/❌ 与实测一致
- [ ] Daemon 索引与 `launchctl list` 一致
- [ ] NPM scripts 索引与 `package.json` 一致
- [ ] DECISIONS-LOG D 号连续无缺
- [ ] 所有 SOP-N-FLOW 中提到的 CLI 都在 NPM scripts 索引里
- [ ] 真客户 10 个 live URL 仍 curl 200

任何不一致 · 立刻补 doc。
