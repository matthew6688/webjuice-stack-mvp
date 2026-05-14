# V3 D43 Cycle Test Plan · 自动化 E2E 测试循环

> 目标：4 entries 投递 → 全链路验证 → 0 bug → 才能开 3500 bulk run

## 4 Entries (Cycle 1)

| 编号 | kind | target.cli (npm script) | args | 期望路径 |
|------|------|-------------------------|------|---------|
| A | `intake` | `pl:pipeline-batch-start` | `['--niche','roofers','--city','brisbane','--limit','10']` | discovery → 10 leads → cheap-audit-queue |
| B | `audit` | `leads:run-pipeline` | `['--entity-key','place_chijwdbif2xzkwsrru6lkmu2l0o']` | M1+M2 single-entity |
| C | `single-enrich` | `pl:single-enrich` | `['--business-name','Brisbane Roof Restoration Experts','--phone','0731321605','--city','brisbane','--niche','roofer']` | enrichment + LLM judge (auto-chains audit) |
| D | `image-extract` | `pl:ingest-image` | skip (无 image fixture) — 记 KNOWN-LIMITATION |

Valid task KINDS (from `core/tasks/task-store.js`): `intake, enrich, audit, dedup, photos, image-extract, ops, single-enrich, places-intake, demo_build, photos_fetch`.

## 7 PASS 验收 (每个 entry)

1. **真实数据写入** — `data/leads/entities/<key>.json` 字段 cheap_audit / predict_grade / phase 全在
2. **Discord 真实发出** — fetch #website-leads thread 验证 5 stage message
3. **Asset 完整** — `clients/<slug>/v2/` 文件齐 (master.md + 5 hyperlinks)
4. **Phase 正确** — D → archived, A/B → 触发 detailedAudit, C → backlog
5. **Queue dedup** — 重复 entityKey 不入队两次
6. **Crash resume** — kill -9 后 jsonl 能 resume
7. **doctor 全绿** — lead-journey-doctor + 5 doctor + linter

## 循环规则

1. 跑完所有 entry · 不中途修 bug
2. 收集 bug log (P1/P2/P3 + 根因 + 修复方案)
3. 批量修 + commit + reload daemons
4. 下一 cycle · 直到 0 bug
5. 0 bug 后 · 更新文档 · 清理干扰 · 才能开 bulk run

## 报 PASS 的硬证据

- entity JSON 字段 dump
- Discord thread message screenshot / fetch
- `ls clients/<slug>/v2/` 输出
- doctor stdout (全绿)

## 不能省略

- 跑完清 `/tmp/cycle*.log` 和 `data/leads/queues/*.jsonl`
- `npm run ops:sop-audit` 0 冲突（若 script 存在）
- MEMORY.md 冲突条目标 superseded

## 文档更新目标（实际存在的）

- `docs/v3/BACKLOG.md` — D43 任务勾选
- `docs/v3/LEAD-JOURNEY.md` — 新流程（cheap-audit-queue → predict-grade → detailed-audit-queue）
- `docs/v3/M1-PRD.md` / `M2-PRD.md` — 若 stage 流程变了
- `docs/v3/SOP-1-FLOW.md` / `SOP-2-FLOW.md` — cheap-audit-queue + predict-grade 新 owner
- `docs/v3/CUSTOMER-FOLDER-STRUCTURE.md` — 若 asset 结构变
- `docs/v3/DECISIONS-LOG.md` — D43 决策记录
- `~/.claude/projects/-Users-matthew-profitslocal/memory/MEMORY.md` — 冲突条目

（注：`V3_UPGRADE_PLAN.md` / `PHASE_1_TASKS.md` / `docs/v2/` 都不存在，跳过）

## Cycle 1 result (2026-05-14)

- A/B/C done · 0 P1 bugs in code · 2 P2 doctor bugs fixed (see DECISIONS-LOG D43)
- D skipped (no fixture)
- All 6 doctors green
- Spec bug: C used `--slug` (invalid for `pl:single-enrich`) — table updated above
- Dedup verified by code inspection (in-process Set in cheap-audit-queue.js)
- Crash-resume not exercised (queue idle at crash window)

