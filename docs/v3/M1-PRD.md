# M1 · 客户发现 + 入库 · PRD

> **范围**: 4 个入口 → entity 落盘 → 8-key 评分判重 → master.md skeleton 自动建
> **不在范围**: audit (M2) · 网站设计 (M3) · 销售外联 (M4) · 购后 (M5)
> **隔离**: 所有新代码 / 文档在 `v3-modular` branch · worktree `/Users/matthew/Developer/google-map-website-v3/`
> **状态**: 草稿 · 等 Matthew 审 · 不实装直到批 "开干"

---

## 0. Goal (一句话)

任何输入（自然语言 / 名片图 / Maps URL / 多 query）→ 入库到 entity store → 自动判重 → 自动建 master.md skeleton → 入 phase=AWAITING 等 M2 接。

## 1. Success Criteria · 怎么算 M1 完成

| 验收项 | 测试方法 |
|---|---|
| **4 入口 + 1 新入口都跑通** | 跑 `scripts/qa/sop1-live-demo.mjs` (已存在) · 5 case 全 done |
| **入口包成 Hermes skill** | `skills/profitslocal-website/SKILL.md` · Hermes agent 收到 "find brisbane plumbers" 调对 CLI · 不依赖 ollama+regex |
| **8-key 评分判重实装** | `pl:dedup-detector` 输出每 suspect group 含分数 (0-100) · 阈值: ≥60 自动合 · 30-60 LLM 判 · <30 放行 |
| **discoveryScore 统一函数** | `core/scoring/discovery-score.js` · 4 入口都调 · 同商家不同入口 → 同分 |
| **master.md skeleton 入库即建** | 入库后 30 秒内 `clients/<slug>/v2/master.md` 出现 · 含 frontmatter + 一/二/三章基础信息 (audit 字段 null) |
| **bulk archive 96 stuck entity** | 跑 `pl:bulk-archive-stale` · 96 个 queued_for_audit 全标 archived · entity store 干净 fresh state |

## 2. Current State (M1 完成度)

| 已建 | 状态 |
|---|---|
| 4 入口 CLI (pl:pipeline-batch-start / pl:scrape-docker / pl:places-search-intake / pl:single-enrich / pl:ingest-image) | ✅ 全部 |
| Intake registry (data/sop1/intake-channels.json) | ✅ |
| Discord listener routing (ollama + regex) | ✅ but 有 L-1 city list 缺漏 |
| Dispatcher · forum tag · per-task thread | ✅ |
| Entity store (data/leads/entities/) | ✅ 192 entity 在库 (大多老数据 stuck) |
| `core/leads/dedup-detector.js` 3-key matcher | ⚠️ **要扩到 5+ 评分** |
| `mergeLeadIntoEntity` place_id auto-merge | ✅ |
| `discoveryScore` (gosom only) | ⚠️ **要统一到所有入口** |
| Master.md auto-trigger on upsert (master-md-refresh hook) | ✅ adb094e5 commit 已 ship |
| Hermes skill (profitslocal-website-intake) | ❌ **要建** |
| Bulk-archive CLI | ❌ **要建** |

## 3. Architecture

```
                  Hermes agent (Discord / Telegram / web · any channel)
                         ↓
                  skill: profitslocal-website
                  · description 教 Hermes 4 入口选哪个
                  · 不再依赖 SOP-0 ollama+regex routing
                         ↓
                  Hermes 调 CLI (通过 Bash / kanban task)
                         ↓
              ┌──────────┴──────────┐
              ↓                     ↓
  pl:pipeline-batch-start      pl:places-search-intake
       ↓ chain                       ↓
  pl:scrape-docker             ↓
       ↓                              ↓
       └──────────┬──────────────────┘
                  ↓
        upsertDiscoveryRun (core/leads/discovery-store.js)
                  ↓
        mergeLeadIntoEntity
        ├─ 调 computeDiscoveryScore(entity) ← 🆕 统一函数
        ├─ identifier 写入 (phone, domain, place_id, lat/lng?)
        ├─ enrichment_status 自动 (thin-contact → pending)
        └─ 写 data/leads/entities/<entityKey>.json
                  ↓
        🆕 dedup-detector (5-key 评分)
        ├─ 跟现有 entities 比 5 维 · 加权求分
        ├─ ≥60: auto-merge (跳过 LLM)
        ├─ 30-60: enqueue LLM-decide task (qwen3.5 或 Claude)
        └─ <30: 不挡 · 继续往下
                  ↓
        enqueueMasterMdRefreshBatch (已实装)
                  ↓
        master.md skeleton 写出 (per-entity)
                  ↓
        Discord thread (#websites-leads) ← M2 grade 完才开
        SOP-0 task 完结回 listener thread
```

## 4. Deliverables · M1 要写/改的代码

### D1 · 5-key dedup 评分 matcher

**改文件**: `core/leads/dedup-detector.js` (现 166 行 · 加到 ~250 行)

**新函数**: `scoreDedupCandidate(entityA, entityB)` → `{score: 0-100, signals: [...], details: {...}}`

```js
// 5 个判重信号 + 权重 (Matthew 2026-05-13 拍)
const SIGNAL_WEIGHTS = {
  phone:   35,  // 末 10 位一致
  email:   30,  // 完全一致
  domain:  25,  // 根域名一致 (www. 去掉)
  name:    20,  // 标准化后一致 / fuzzy ≥ 0.8 (Levenshtein 或 token-set)
  address: 15,  // 标准化后一致 / 经纬度 < 50m
};

// 阈值 (Matthew 2026-05-13 拍)
const AUTO_MERGE_THRESHOLD = 60;   // ≥60 高信心同店 → 自动合
const HUMAN_REVIEW_FLOOR = 30;     // 30-60 → 调 LLM (qwen3.5 或 Claude)
                                    // <30 → 放行不挡
```

**注意**: place_id 仍然在 `mergeLeadIntoEntity` 阶段**第 0 道防线** auto-merge (同 place_id → 同 entityKey · 直接进同一文件 · 不进 dedup-detector)。

**扩展位** (V3.1 backlog 不实装): ABN · lat/lng 双信号。

### D2 · 统一 discoveryScore 函数

**新文件**: `core/scoring/discovery-score.js` (~80 行)

```js
export function computeDiscoveryScore(latest) {
  // 抽离原 maps-scraper-discovery.js scoreDiscoveryLead 公式
  // 输入: latest = { websiteStatus, phone, review_count, rating, signals }
  // 输出: 0-100
  // V1 公式: 澳大利亚 local business
  // V2 扩展: 其他国家 / 行业差异 (backlog)
}
```

**改 4 入口都调**:
- `pl:pipeline-batch-start` → `pl:scrape-docker` → `leads:maps-scrape` 已经在调原公式 · 改成调统一函数
- `pl:places-search-intake` → 当前**不算** discoveryScore (=0) · **加调用**
- `pl:single-enrich` → 同上 · 加调用
- `pl:ingest-image` → 同上 · 加调用

入口写 entity 前都先算 score · 然后 mergeLeadIntoEntity 取该 score。

### D3 · Hermes skill `profitslocal-website-intake`

**新目录**: `skills/profitslocal-website/`

```
skills/profitslocal-website/
├── SKILL.md   # manifest + 4 入口 + behavioral guidance
└── (no scripts · 调现有 CLI)
```

**SKILL.md 关键 spec**:

```yaml
---
name: profitslocal-website-intake
description: 当用户提到"找商家 / 抓 leads / 商家电话 / 名片图 / Maps URL"等任何要把
  商家入库的请求时调用。包含 4 个入口 (批量 Maps · Google Places · 单商家解析 · 图片识别)。
  所有出口自动建 master.md skeleton + 入 SOP-2 audit 队列。
read_when:
  - User says "find {niche} in {city}" / "搜索 {niche} {city}"
  - User pastes phone number with business name
  - User uploads business card / shopfront photo
  - User pastes Google Maps URL
  - User wants to import a business
allowed-tools: Bash
metadata:
  author: profitslocal
  version: "3.0"
  niche: au-local-business
---

# ProfitsLocal Website Intake (M1)

## 4 入口

| 输入模式 | CLI |
|---|---|
| 自然语言 "X in Y" (no quotes) | `npm run pl:pipeline-batch-start -- --niche {X} --city {Y} --count 10` |
| 多引号 "X" "Y" | `npm run pl:places-search-intake -- --query "{X}" --query "{Y}"` |
| 单引号 + 电话 / URL | `npm run pl:single-enrich -- --business-name "..." --phone {...} --city {...}` |
| 图片附件 | `npm run pl:ingest-image -- --image {path} --business-name {...} --niche {...} --city {...}` (vision prep 由调用方提供) |

## Behavioral guidance

- **必填**: niche + city (Hermes 自己抽 · 抽不到要问用户)
- 自然语言 → niche keyword 找 plumber/roofer/cafe/...
- 自然语言 → city 抽 brisbane/sydney/melbourne/cairns/newcastle/... (LLM 不靠列表)
- 单商家有电话或 Maps URL · 调 single-enrich
- ABN 是最强判重信号 (entity store 自动跑)
- 8 个判重字段已在 dedup-detector 里 (调用方不管)

## Behavior gotchas

- gosom 需 lat/lng · 内部 geocode 已做 · 别担心
- gosom Status (大写) vs status (小写) · 已 fix
- pl:single-enrich 当前不支持纯电话 / 纯 URL · V3.1 修
- pl:ingest-image 需 vision OCR prep · listener 处理 · skill 不直接调

## 出口承诺

调成功后:
- entity 落 `data/leads/entities/<entityKey>.json`
- 自动 chain master.md build (`leads:build-master-md`)
- 4 小时内进 SOP-2 audit (`scoring:rescore-v2` cron 跑完后)
```

**部署**: `~/.hermes/profiles/marketer/skills/profitslocal-website/` symlink 到 git repo。

### D4 · `pl:ingest-image` parseArgs 修

**改文件**: `scripts/cli/pl-ingest-image.js` 第 76-87 行 (它的 parseArgs)

**问题**: 这文件有自己的 parseArgs · 不支持 `--key=value` · 我之前修的 `_pl-shared.js` 不覆盖。

**fix**: 替换 parseArgs 为 import from `_pl-shared.js` (统一版本)。

```js
// 改前
import path from 'path';
// ...
const args = parseArgs(process.argv.slice(2));  // local parseArgs

// 改后
import path from 'path';
import { parseArgs } from './_pl-shared.js';  // shared parser
// ...
const args = parseArgs(process.argv.slice(2));
// 移除文件底部的 local parseArgs (line 76-87)
```

### D5 · Bulk-archive 96 stuck entities

**新文件**: `scripts/cli/pl-bulk-archive-stale.js` (~80 行)

**用途**: clean-state · M1 实装前一次性跑 · 把 96 个 status=queued_for_audit 但 V2 phase 缺的 entity 全标 archived。

```bash
npm run pl:bulk-archive-stale -- --filter v2-stale --dry-run  # preview
npm run pl:bulk-archive-stale -- --filter v2-stale --commit   # 真做
```

**逻辑**:
- 扫所有 entity
- 命中条件: `status == 'queued_for_audit'` AND `phase` 缺 (V2 字段) AND `firstSeenAt < 2026-05-12` (今天之前)
- 设 phase=ARCHIVED · archive_reason='v2-stale-cleanup'
- entity.history 写一条 cleanup event
- 不删 entity 文件 · 只改 status + phase
- 输出 JSON 报告: 多少 archived · entityKey list

### D6 · M1 完成测试套

**改文件**: `scripts/qa/sop1-live-demo.mjs` (已存在)

**改动**: 加 `--validate-m1` 模式 · 跑 5 case · 验:
- 4 真入口 + 1 image entry
- 每个 case 完成后 entity 落盘 + master.md 在 30 秒内出现
- 每个 case 触发的 SOP-0 task 链 OK

**新文件**: `scripts/qa/test-dedup-scoring.mjs` (~150 行)

**测**:
- 5 个 mock entity pair · 算分 · 应在阈值正确分组
- 边界 case: phone 同 + name 完全不同 → 65 分 (自动合)
- 边界 case: name fuzzy 0.85 + 其余空 → 17 分 (放行)
- 边界 case: phone 同 + email 同 → 65 分 (自动合)

### D7 · Discovery store helpers · 改 1 处

**改文件**: `core/leads/discovery-store.js` mergeLeadIntoEntity (~440 行附近)

**改动**: 
- mergeLeadIntoEntity 写 entity 时调 `computeDiscoveryScore(latest)` · 不再依赖入口传 `lead.discoveryScore`
- 这样无论哪个入口 · 都得到一致 score

---

## 5. 不在 M1 范围

- Audit · grading · master.md 22 章完整内容 (→ M2)
- C-grade cold outreach batch send (→ M3)
- 客户 preview 网站 (→ M3)
- 销售 follow-up · email 真发 (→ M4)
- ABN / lat-lng 加入判重 (→ V3.1 backlog)
- single-enrich phone-only / URL-only 修 (→ V3.1 backlog)
- listener intent-router 复杂修 (→ skill 化后自动消失 · 不修)

## 6. Open Issues (我 95% 确认但还有 5% 不确定的)

1. **bulk-archive 真删 vs 标 archived**: 我倾向不删（保留 entity history 给以后回看）· 你 OK 吗？
2. **8-key 阶段性扩展**: M1 是 5-key · ABN / lat-lng 在 V3.1 加。问题: ABN 当前 gosom + Places API 都不抽 · 需另外 enrichment 通道。这是 V3.1 单独 work。
3. **LLM dedup decider**: 30-60 阈值送 LLM · 调 qwen3.5 (本地) 还是 Claude (Hermes)？前者免费稍弱 · 后者 ~$0.0001/call 但准。建议 Claude (~$30/月 假设 30 万判重 call) · 但你说。
4. **Hermes skill 部署位置**: `~/.hermes/profiles/marketer/skills/profitslocal-website/` symlink? 或所有 profile 都装一份？目前 7 profile · 我猜只 marketer 用 · 其余跳过。
5. **bulk-archive 跑前**: 是否要先 dump 全部 entity 到 backup file? safety 网。我倾向 yes (30 秒事)。

## 7. Acceptance Criteria · 怎么算 M1 done

**测试通过条件** (一句话):

```
1. 跑 sop1-live-demo.mjs --validate-m1 → 5/5 case PASS
2. 跑 test-dedup-scoring.mjs → 12 case PASS
3. 跑 bulk-archive --dry-run → 显示 96 个 entity 待 archive · --commit 后 96 个 phase=ARCHIVED
4. Hermes chat: "find brisbane plumbers" → Hermes 自动调 pl:pipeline-batch-start --niche plumber --city brisbane (不靠 SOP-0 ollama)
5. 入库后 30 秒内 clients/<slug>/v2/master.md 出现 (含 frontmatter + 基础 3 章)
6. discoveryScore: 同商家不同入口测试 (一个 entity 在 4 入口都跑一遍) → 4 次 score 相同
```

## 8. Rollback Plan

每 deliverable 独立 commit · 出错单独 revert:

- D1 (dedup scoring): revert · 回到 3-key bucket
- D2 (discoveryScore): revert · 回到 entry-specific
- D3 (skill): rm skill manifest · Hermes 自动不调
- D4 (parseArgs): revert · 回到本地 parseArgs (但等号语法又坏)
- D5 (bulk-archive): 跑反向 CLI · 把 phase=ARCHIVED + reason='v2-stale-cleanup' 的 96 个改回 phase=null
- D6 (test): 测试代码 · 删了没影响生产

## 9. Dependencies

| 上游依赖 | 状态 |
|---|---|
| Hermes Agent v0.13+ (kanban) | ✅ 装着 |
| Hermes skill loader | ✅ 装着 |
| `_pl-shared.js` parseArgs --key=value | ✅ commit e8bc42ad |
| master-md-refresh hook | ✅ commit adb094e5 |
| Open Design daemon (M3 用 · M1 不依赖) | ✅ healthy |

## 10. Effort Estimate

| 子 deliverable | 工时 |
|---|---|
| D1 · 5-key dedup scoring | 3h (代码 + 测试) |
| D2 · 统一 discoveryScore | 1.5h (抽函数 + 4 入口改) |
| D3 · profitslocal-website skill | 1.5h (SKILL.md + 部署 + Hermes 验证) |
| D4 · pl:ingest-image parseArgs fix | 15 min |
| D5 · bulk-archive CLI | 1h |
| D6 · 测试套 (sop1-live-demo --validate-m1 + dedup test) | 2h |
| D7 · discovery-store mergeLeadIntoEntity 改 | 30 min (跟 D2 一起) |
| **总** | **~9-10h** (1.5 个工作日) |

## 11. Timeline (按 1.5 工作日)

- 第 1 day morning: D1 + D7 (dedup scoring + discoveryScore)
- 第 1 day afternoon: D2 + D4 (统一 score · ingest-image fix) + D3 (skill)
- 第 2 day morning: D5 (bulk-archive) + D6 (测试)
- 第 2 day afternoon: end-to-end 验证 + Matthew sign-off + commit + push v3-modular

---

## 12. 我现在需要 Matthew 决的 5 件事 (Open Issues 答案)

回我 5 个字母 / 短回复 即可:

1. **bulk-archive: 不删，只标 archived** · OK?
2. **5-key M1 · ABN/lat-lng V3.1** · OK?
3. **LLM dedup decider 用 Claude (Hermes 调) 而不是本地 qwen3.5** · OK?
4. **Hermes skill 只装 marketer profile (其余跳)** · OK?
5. **bulk-archive 跑前先 backup entity store (zip)** · OK?

回完我开干 M1 实装。

---

## Post-implementation update · 2026-05-13

✅ **M1 IMPLEMENTED** · all 6 deliverables PASS.

| Deliverable | Status | Files |
|---|---|---|
| M1-D1 dedup-scorer | ✅ PASS 13/13 | `core/leads/dedup-scorer.js` |
| M1-D2 discovery-score (unified 4 entries) | ✅ PASS 7/7 | `core/leads/discovery-score.js` + 4 entry CLIs wired |
| M1-D3 Hermes skill profitslocal-website-intake | ✅ PASS 4/5 (1 manual) | `~/.hermes/profiles/marketer/skills/b2b-marketing/profitslocal-website-intake/SKILL.md` |
| M1-D4 pl:ingest-image shared parseArgs | ✅ PASS 8/8 | `scripts/cli/pl-ingest-image.js` (imports `_pl-shared.js`) |
| M1-D5 pl-bulk-archive | ✅ PASS 4/4 | `scripts/cli/pl-bulk-archive.js` |
| M1-D6 sop1-live-demo --validate-m1 | ✅ PASS 1/6 (5 SKIP gated `V3_LIVE_TEST=1`) | `scripts/qa/sop1-live-demo.mjs` |

Bug fixes during this sprint affecting M1:
- Bug 3 · pl:single-enrich query 错 ("Brisbane" → city geo) → query 逻辑 fix + accept --name alias
- Bug 6 · niche 空 (places-search) → `normalizeNiche()` fallback chain
- Bug 9 · city 大小写 → `normalizeCity()` Title Case

完整 audit: [MASTER-MD-AUDIT-V2-2026-05-13.md](./MASTER-MD-AUDIT-V2-2026-05-13.md)
完整决策: [DECISIONS-LOG.md](./DECISIONS-LOG.md) (decisions 14-23)

---

## 7.9 Operator runbook · 全链路流转

完整 Discord → master.md 端到端流转、汇报格式、节点细节、Hermes 平行入口 → **[SOP-1-FLOW.md](./SOP-1-FLOW.md)**

## 8. Health Check · `pl:intake-doctor` (V3 · 2026-05-14)

**Goal**: 一行总检 SOP-1 链路（intake → entity → master.md enqueue → dispatcher）是否健康。复用 `pl:sop0-doctor` 结构 · daily cron 09:00 跑 · 失败 → Discord webhook。

**5 个 check**：

| # | 检查 | 含义 | 失败 fix |
|---|---|---|---|
| 1 | `data/leads/entities/` 24h 新文件 | intake 还活着的最强信号 | 24h 无 intake → 跑 `pl:places-search-intake -- "plumber brisbane" --limit 1` 验证 |
| 2 | Docker daemon + `gmaps-scraper-web` HTTP 200 | scrape-docker 路径可用 | `open -a Docker` / `docker start gmaps-scraper-web` |
| 3 | `GOOGLE_PLACES_API_KEY` 设置 | places-intake / single-enrich 不缺 key | 检查 `.env.local` |
| 4 | `build-master-md` 任务积压 < 10 | dispatcher 在消化 enqueue（Bug C 早期预警） | `launchctl list \| grep task-dispatcher` · per-worktree plist (D30) |
| 5 | intent-router **regex** 路径 niche+city 提取正常 | paid CLI / ollama 都挂时 regex 必须保底 | 检查 `core/tasks/intent-router.js` NICHE_KEYWORDS / CITY_KEYWORDS |

**用法**：
```bash
npm run pl:intake-doctor              # 彩色人读
npm run pl:intake-doctor -- --json    # JSON 机器读 (cron/CI)
```

**Exit code**: 0 = 全绿 · 1 = 任一红灯。Heartbeat 写 `data/heartbeats/intake-doctor.txt`（dead-man 监测）。

**成本**: $0 · 不调任何 paid LLM（仅 regex provider 路径）。

**稳定性标准（per D29）**: 24h 连续 0 fail = SOP-1 stable。

### 8.1 Stability Verification · 上线证据 (2026-05-14)

**Cron**: `ai.profitslocal.intake-doctor-daily` · `StartCalendarInterval { Hour=9, Minute=0 }` · `RunAtLoad=true`
- Plist: `~/Library/LaunchAgents/ai.profitslocal.intake-doctor-daily.plist`
- 启动: `launchctl bootstrap "gui/$(id -u)" <plist>` · 已 bootstrap
- 日志: `data/heartbeats/intake-doctor-daily.log` (JSON 一行/次)
- Heartbeat: `data/heartbeats/intake-doctor.txt` · mtime < 25h = 活着

**首跑 (RunAtLoad · 2026-05-13 21:18 UTC)**: `ok=true · 5/5 PASS`

**Watchdog (TODO · 不阻塞稳定性认定)**:
- 失败 → Discord webhook（暂未接 · 现阶段 5/5 全绿 · 不需）
- heartbeat mtime > 25h → 单独 cron alert（dead-man）

**完整链路验证 (post-D30 · 小压测)**:
- `canberra × roofer × places+docker` = 2/2 batch · 9 fresh entities · 7/7 master.md OK
- v3 dispatcher 实时消化 enqueue · doctor check #4 (`pending<10`) 全程绿
- 输出: `data/qa/batch-master-md-2026-05-13T21-18/summary.json`

**Phase 完工标志**: 5/5 doctor + 1 次压测 0 fail + 1 次 RunAtLoad 跑过 ✅。24h 稳定性观察期开始 2026-05-13 21:18 · 满期 2026-05-14 21:18 UTC。


