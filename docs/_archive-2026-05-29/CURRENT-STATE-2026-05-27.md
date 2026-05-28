# ProfitsLocal · 当前状态汇总 (2026-05-27)

> **Mission**: 后续 agent / dev 看完这份文档应该能在 15 分钟内理解整条流水线、知道哪些 SOP 已定、哪些命令已写、哪些坑必须避开。**不重复发现工作 · 不重复造轮子**。
>
> **生成方法**: 1 个 general-purpose agent 读了 10 份 SOP 共 ~4800 行 + `npm run ops:sop-audit` 输出 + 我手动校对。原始 digest 在 `/tmp/sop-discovery-report.md`。

---

## 0. TL;DR (60 秒版)

ProfitsLocal 是一条 **"找客户 → 审 → 预制网站 → 销售 → 交付"** 的流水线，按 Discord channel 切成 5 段：

```
SOP-1 客户发现           ✅ v1.0    pl:scrape-docker / pl:run-enrichment-batch
SOP-2 筛选+审计           ✅ v1.0    rescore-v2-cli / leads:run-pipeline
SOP-3 网站预制           ✅ v1.0    pl:build-from-reference / pl:publish-demo
SOP-4 Cold Outreach     ✅ v1.0    pl:outreach-clean / pl:outreach-health-check
SOP-5 交付维护           ⚪ TODO    —
```

横切（已有）：SOP-X-Handoff (entity schema 合约) · SOP-X-Tooling · SOP-X-Dedup · SOP-X-Ownership-Registry · SOP-X-Maintenance-Rules

v3 升级层（Matthew 2026-05-19/20 签）：**Data Checkpoint** (`pl:data-checkpoint`) + **Audit Standard** (4-tier `pl:audit-tier`) · 这两份是 canonical · 任何 SOP-3 改动必须 honor 它们。

**还在 plan 里没写代码**：`docs/v3/V3-BUILD-AUDIT-LOOP-PLAN.md` 列了 7 个 `pl:audit-*` CLI · 全部待写。

---

## 1. SOP 现状速查表

| SOP / 概念 | 文档 | 版本 | Owner CLI | 主要 Artifact |
|------------|------|------|-----------|---------------|
| SOP-0 任务系统 | `SOP_0_TASK_SYSTEM.md` | v1.7 | task router · `pl:sop0-doctor` | `data/pipeline/tasks/<id>.json` |
| SOP-1 发现+enrichment | `SOP_1_INTAKE_DISCOVERY.md` | v1.0 | `pl:scrape-docker` · `pl:ingest-image` · `pl:run-enrichment-batch` · `pl:download-places-photos` | `data/leads/entities/<entityKey>.json` |
| SOP-2 筛选+审计 | `SOP_2_LEAD_DISCOVERY_PIPELINE.md` | active 2026-05-12 | `rescore-v2-cli` · `leads:run-pipeline` · `pl:audit-vision` | `entity.audit` · `entity.grade` · `entity.discord_thread_id` |
| SOP-3 网站构建 | `SOP_3_WEBSITE_BUILD.md` | v1.0/v1.1 (2026-05-17) | `pl:build-from-reference` · `pl:build-customer-audit` · `pl:publish-demo` | `clients/<slug>/v2/handoff/` (14 文件) · `clients/<slug>/v2/concept/reference-adapter/index.html` |
| SOP-4 Cold Outreach | `SOP_4_COLD_OUTREACH_OPS.md` | v1.0 (2026-05-15) | `pl:outreach-clean` · `pl:outreach-health-check` · `/api/outreach-webhook` | provider-agnostic outreach state |
| SOP-X-Handoff | `SOP_HANDOFF_CONTRACT.md` | v1.0 | (schema) · 计划 `pl:handoff-verify` | entity `schemaVersion=1` |
| SOP-X-Ownership-Registry | `SOP_OWNERSHIP_REGISTRY.md` | v1.0 | `ops:sop-audit` | (registry table itself) |
| SOP-X-Maintenance-Rules | `SOP_MAINTENANCE_RULES.md` | v1.0 | (process doc) | commit-message protocol |
| **v3 · Data Checkpoint** | `v3/SOP-DATA-CHECKPOINT.md` | canonical (2026-05-19) | `pl:data-checkpoint` · `pl:pipeline-all` | `clients/<slug>/v2/checkpoint.json` · `pipeline.html` |
| **v3 · Audit Standard** | `v3/SOP-AUDIT-STANDARD.md` | canonical (2026-05-20) | `pl:audit-tier`（待写 orchestrator · 复用现有 dim） | `<out>/_tier-audit.json` + `.md` |
| **v3 · Build-Audit-Loop** | `v3/V3-BUILD-AUDIT-LOOP-PLAN.md` | 计划 · ~92% confidence (2026-05-16) | 7 个 `pl:audit-*` 待写 | 5 个 `*-audit.json` 待写 |

---

## 2. ⚠️ SOP_OVERVIEW.md 已 stale · 必修

`docs/SOP_OVERVIEW.md` §4 Layer-1 表格里曾经写 SOP-3 已 unwritten 标签 · 但实际 `SOP_3_WEBSITE_BUILD.md` 已 **v1.0 (2026-05-17)** <!-- doc-freshness:ignore narrative-explanation --> · 在 `SOP_OWNERSHIP_REGISTRY §1.10` 已注册。这是 maintenance-rule 违规 · `ops:sop-audit` 会 catch · 下一次有人改 SOP_OVERVIEW 时必须更新此条。

---

## 3. 我（Claude 夜班）做的工作映射到现有 plan

| 我做的命令 / Skill | 对应已有 SOP / 计划 | 状态 |
|------------------|--------------------|------|
| `pl:data-checkpoint` (已有 · iter 3 接进 e2e) | `v3/SOP-DATA-CHECKPOINT.md` canonical | ✅ 完全对齐 |
| `pl:audit-tier` (调用现有 · 我没改 orchestrator) | `v3/SOP-AUDIT-STANDARD.md §6C` 已 spec | ✅ 命令已存在 · 我没造新的 |
| `pl:assemble-handoff` (我修了 manifest 路径 bug + checkpoint gate) | SOP-3 §3 "Handoff Enrichment" 大致覆盖 · 但没有单独 SOP | ⚠️ Orphan |
| `pl:validate-handoff` (我加了 --slug flag + 修 schema) | `V3-BUILD-AUDIT-LOOP-PLAN §3.1` `pl:audit-handoff` 是计划替代 | ⚠️ 现有命令 · 计划重命名 |
| `pl:compose-site` (我加了 validate gate) | SOP-3 §6 (current uses `pl:build-from-reference` · claude CLI direct path) | ⚠️ 路径分裂 (template vs reference) |
| `pl:research-pack` (我新写的 6-step wrapper) | SOP-3 §3 + V3-BUILD-AUDIT-LOOP `pl:build-handoff` 系列 | ⚠️ Wrapper · 不在任何 SOP |
| `pl:e2e` (我新写的 5-step chain) | `V3-BUILD-AUDIT-LOOP-PLAN §7` 整个 Phase A/B/C/D | ⚠️ Orphan orchestrator |
| `skills/profitslocal-lead-discovery/SKILL.md` (我写的) | SOP-1 + SOP-2 部分内容 | ⚠️ Skill wraps existing CLIs · 跟 SOP-1/2 互补不冲突 |
| `skills/profitslocal-build-research-pack/SKILL.md` (我写的) | SOP-3 territory | ⚠️ 同上 · skill 层 wrapping |
| `docs/contracts/lead-to-research.md` (我写的 v1) | 跟 `SOP_HANDOFF_CONTRACT.md` 是**不同层** | ⚠️ 不冲突但需要 cross-ref |
| `core/utils/slug.js` (单一 slug helper · iter 1) | 通用 utility · 没 SOP 涵盖 | ✅ 干净 |
| `core/handoff/gbp-sources.js` (GBP sidecar shared · iter 2) | SOP-3 §3 photos pipeline 一部分 | ✅ 干净 |
| `core/contracts/lead-to-research-validator.js` | 我新建 · 跟 SOP-X-Handoff validator 是不同 contract | ⚠️ 待 cross-ref |
| `scripts/qa/test-schema-fixtures.mjs` (iter 4 · 批量 schema vs fixture 校验) | 没现存 SOP 涵盖 · 但解决 `Handoff §6` schemaVersion 漂移问题 | ⚠️ Orphan · 高价值 |

**总结**：我新增 8 项 · 5 项是 wrap-existing · 3 项是真新（research-pack wrapper · e2e wrapper · schema-fixtures smoke）。**没有重复造轮子的**，但 4 个 orphan 需要 SOP 涵盖。

---

## 4. 4 个 Orphan Stages 需要 SOP

按 V3-BUILD-AUDIT-LOOP-PLAN 命名规范 · 这 4 个 stage 应该获得官方 SOP / 至少正式 spec：

| 我的命令 | 应正式 spec 为 | 优先级 |
|----------|---------------|--------|
| `pl:assemble-handoff` | SOP-3 子章节 §3.5 "Assemble" · 或单独 SOP-3-FLOW 段 | P0 |
| `pl:validate-handoff` | 重命名为 `pl:audit-handoff` (per V3-BUILD-AUDIT-LOOP-PLAN §3.1) · 或保留并文档化 | P0 |
| `pl:e2e` wrapper | 全新 SOP-X-Orchestrator · 或并入 SOP-3-FLOW | P1 |
| Iterate-fix loop（半成品） | `V3-BUILD-AUDIT-LOOP-PLAN §3.3 pl:verify-audit-fixes` 已 spec · 实现待补 | P1 (高杠杆 · 修 Grade F → C) |

---

## 5. 14 条不可违反的架构规则

来源全部是已签 SOP / Matthew 决策记录 · **任何新工作必须 honor**：

1. **单一真理源** · 一个概念有且仅有一个 owner SOP · 跨 SOP 引用必须 1 句 + 链接 [`OWNERSHIP_REGISTRY §0` · `MAINTENANCE_RULES §1`]
2. **SOP-1 / SOP-2 通过 JSON 不通过代码** · 解耦在 entity-store 层 [`HANDOFF §1.1`]
3. **Entity schema 改动必须 bump schemaVersion + 写 migration 脚本** 到 `scripts/migrations/<n>-to-<n+1>.js` [`HANDOFF §6`]
4. **T1 zero-tolerance** · 任何 T1 fail 阻止 publish (binary) · 综合分门 = `T1 PASS AND (T2+T3+T4)/3 ≥ 73` [`AUDIT-STANDARD §0 §5`]
5. **T1.4/T1.8 anti-fabrication** · 永不发明 ABN / "X% faster" / 客户数 stats [`AUDIT-STANDARD §1`]
6. **T1.5 wrong-state authority ban** · VIC→VBA / QLD→QBCC / NSW→Fair Trading / WA→Building Commission · 错州监管字眼 0 容忍
7. **Per-page floor 规则** · 1 个差页 cap 整个 T2 (≤60/≤50) · 不能用好页平均掉差页 [`AUDIT-STANDARD §2C`]
8. **Data Checkpoint 是硬门** · `pl:build-od-seed` 第 1 行读 `checkpoint.json` · RED → `exit 1` · 仅 `--force-pages multi` 可由 Matthew override [`SOP-DATA-CHECKPOINT §2 §5`]
9. **YELLOW 必须带 preview banner publish** · `cf-pages-deploy.json.preview_mode=true` + Discord 通知列推断字段 [`SOP-DATA-CHECKPOINT §4`]
10. **Provenance = `_source` sibling field** (2026-05-17 决定 · NOT `_meta.sources` map) [`SOP-3 §5.2 §8`]
11. **Fix loop 仅 +5-10 pt 微调** · 大回归在源头修 (data / brief / DESIGN / skill) · 不在 iterate-site 打补丁 [`AUDIT-STANDARD §5B`]
12. **Autoresearch 是离线 lab · 不是 per-customer loop** · 生产读 `locked-combos.json` [`SOP-3 §4`]
13. **客户面 audit / master.md / proposal HTML 不带 emoji** (用户全局规则 `feedback_no_emoji_in_reports`)
14. **Discord 可见改动 PASS 证据必须有 raw Discord API output** · 不接受 `task.status=done` (用户全局规则 `feedback_discord_api_verify`)

---

## 6. 哪里开始接手（new agent 入口）

如果你是接手的 agent · **按以下顺序读**：

```
1. 这份文档 (CURRENT-STATE-2026-05-27.md)        · 入口 · 你在读
2. SOP_OWNERSHIP_REGISTRY.md                     · 每个概念归属哪个 SOP
3. SOP_OVERVIEW.md  (注意 SOP-3 那条 stale)       · 顶层蓝图
4. SOP_MAINTENANCE_RULES.md                      · 改 SOP 前 5 问清单
5. 跟你任务相关的具体 SOP (1/2/3/4)
6. v3/SOP-AUDIT-STANDARD.md + SOP-DATA-CHECKPOINT.md  · v3 canonical
7. v3/V3-BUILD-AUDIT-LOOP-PLAN.md                 · 计划中的 7 个 CLI
8. SOP_HANDOFF_CONTRACT.md                        · entity schema · 跨 SOP 数据
9. docs/contracts/lead-to-research.md             · 我新增 skill 层 contract
10. docs/overnight-2026-05-22.md                  · 我夜班做的 4 iter 记录
```

**改任何 SOP 前必跑**：
```bash
npm run ops:sop-audit            # 单一来源审计
```

---

## 7. 改动起点（如果继续推进流水线）

### Option A · 修 SOP_OVERVIEW.md 的 stale 标记
1 个 commit · 5 分钟 · 让 §4 SOP-3 状态从 "TODO" 改成 "v1.0 (`docs/SOP_3_WEBSITE_BUILD.md`)" · 让 `ops:sop-audit` 不再失败。

### Option B · 把 4 个 orphan stage 写进 SOP-3 子章节
按 §4 的清单 · 不写新 SOP 文件 · 仅扩 SOP_3_WEBSITE_BUILD.md。Honor `SOP_MAINTENANCE_RULES §3` commit 模板。

### Option C · 实现 `pl:verify-audit-fixes`（fix loop 真做出来）
最高杠杆 · `V3-BUILD-AUDIT-LOOP-PLAN §3.3` 已 spec · 实现后 vicwest 应能从 Grade F → C/B。

### Option D · 把 `pl:e2e` wrapper 改成 honor V3-BUILD-AUDIT-LOOP-PLAN 的 6-stage 形式
我现在的 5-step chain (checkpoint → enrich → assemble → validate → compose) 应该按 plan 扩成 6-step (含 stage 5 post-build audit + stage 6 internal-fix-comparison)。

**建议顺序**：A → B → D → C（先把 doc 对齐，再把 wrapper 对齐 plan，再做真正高杠杆的 fix-loop）。

---

## 8. 我夜班的具体产出索引

| 文件 | 用途 |
|------|------|
| `docs/overnight-2026-05-22.md` | 4 iter 完整 log |
| `docs/contracts/lead-to-research.md` | Skill A→B handoff v1 schema |
| `core/contracts/lead-to-research-validator.js` | 上述 schema 共享 validator |
| `core/utils/slug.js` | 单一 slug helper (`slugify` · `safeId` · `slugFromEntity`) |
| `core/handoff/gbp-sources.js` | GBP sidecar shared writer (test + runtime 共用) |
| `scripts/cli/pl-e2e.js` | 5-step end-to-end chain wrapper |
| `scripts/cli/pl-research-pack.js` | Skill B 6-step wrapper |
| `scripts/qa/test-schema-fixtures.mjs` | 批量 v2-spec vs schema 校验 smoke |
| `scripts/qa/test-slug-helper.mjs` | 34 cases slug helper unit |
| `scripts/leads/test-extract-json.js` | 18 cases LLM JSON repair |
| `scripts/leads/test-handoff-contract.js` | 7 fixtures handoff contract smoke |
| `scripts/leads/test-gbp-handoff-copy.js` | 13 cases GBP sidecar |
| `data/qa/lead-to-research/*.handoff.json` | 7 contract test fixtures |
| `skills/profitslocal-lead-discovery/SKILL.md` | Skill A wrap (codex-locked canonical) |
| `skills/profitslocal-build-research-pack/SKILL.md` | Skill B wrap (codex-locked canonical) |

### 6 个完整 npm test 命令（全 green）
```bash
npm run leads:test-handoff-contract     # 7/7
npm run leads:test-extract-json         # 18/18
npm run leads:test-slug-helper          # 34/34
npm run leads:test-gbp-handoff-copy     # 13/13
npm run leads:test-schema-fixtures      # 4/4
npm run leads:test-search-runner        # ok
```

### 1 个一键 e2e（默认 4 步 · 不烧 LLM）
```bash
npm run pl:e2e -- --slug vicwest-roofing
# 实测 3 客户全 green · 总 27 pages 4s
```

---

## 9. 已知的下一步质量问题（pl:audit-tier 报告 · 不要忽视）

跑 `npm run pl:audit-tier --slug vicwest-roofing --output-dir experiments/v2-compare/vicwest-roofing --skip-vision --skip-codex` 实测：

```
T1 · ❌ FAIL · ABN 不在任何 HTML
T2 · 35/100 · index 919词 < 1500标准 · 8 页重复度 D2.7=40
T3 · 100/100 (跳 vision · 不可信)
T4 · 61/100 · schema.org JSON-LD = 0
Composite · 65 · Grade F
```

**这才是当前流水线真实的质量**。pipeline 跑通 ≠ 网站能用。修这 3 件是 V3-BUILD-AUDIT-LOOP-PLAN §3.3 `pl:verify-audit-fixes` 的核心价值。

---

**END · last updated 2026-05-27 · Claude (overnight + discovery agent collaboration)**
