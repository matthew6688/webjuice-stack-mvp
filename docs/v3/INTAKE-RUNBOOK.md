# V3 Intake Runbook · 4 入口 × 端到端验证

> **作用域**: 从 Discord 命令发布 → routing → CLI → entity → master.md → audit → grade → Discord display 的完整测试 runbook。
> **目的**: Matthew 任何时刻都能照单跑全套 · 验证 SOP-1 → SOP-2 → SOP-3 链路 healthy。
> **owner**: 跨 M1+M2+M3 · 是 V3 的"端到端 smoke test"。
> **status**: D36 (2026-05-14) 第一版。

---

## 0. TL;DR · 完整链路一屏

```
Discord 命令
   ↓ Listener (intent-router · 4 provider cascade)
Task 创建 + Discord ack
   ↓ Dispatcher (fs.watch · 200ms)
Spawn 1 of 4 CLIs:
   • pl:pipeline-batch-start (intake)         · gosom docker
   • pl:places-search-intake (places-intake)  · Google Places
   • pl:single-enrich (single-enrich)         · Places find + details
   • pl:ingest-image (image-extract)          · vision LLM OCR
   ↓
Entity 写盘 + 8-key dedup
   ↓ enqueueMasterMdRefresh (fire-and-forget)
build-master-md (skeleton · 3 章)
   ↓ (auto-trigger · M2 队列 OR manual)
leads:run-pipeline (M2 audit)
   ├─ Stage 1 detailedAudit (12 dim · 39 rules · Playwright)
   ├─ Stage 2 visual (vision LLM cascade)
   ├─ Stage 3a grade ABCD (8 hard-skip + investment level)
   ├─ Stage 3b reviews (docker → places cascade)
   └─ Stage 4 internal HTML + evidence
   ↓ master.md 22 章满 · phase=design-ready
grade-router (auto):
   ├─ A/B/C → openLeadThread OR openProjectThread (D34/D35)
   └─ D → archive + skip_reasons
   ↓
M3 (manual or auto-hook):
   • pl:build-from-reference (demo HTML)
   • pl:build-customer-audit
   • pl:publish-demo (CF Pages)
   ↓
#website-projects thread updated · profile card 7-section pinned
```

每 checkpoint 自动:
- `appendThreadMessage` → 发进度到 Discord thread
- `refreshThreadAndPost` → upsert profile card

---

## 1. 4 入口测试矩阵

| # | Kind | Sample command | 期望路径 |
|---|---|---|---|
| 1 | `intake` (batch-maps) | "find brisbane plumbers --count 2" | listener → intent-router → `pl:pipeline-batch-start` → gosom docker → N entities → dedup → master.md skeleton → audit-queue |
| 2 | `places-intake` | `places search "roofer brisbane" "roofer sydney"` | listener → router → `pl:places-search-intake` → Google Places API → entities → dedup → master.md → audit-queue |
| 3 | `single-enrich` | `enrich "Joe Plumbing" +61 7 1234 5678 sydney` | listener → router → `pl:single-enrich` → Places find + details → entity → master.md |
| 4 | `image-extract` | 上传名片图 + 任意文字 | listener → vision LLM OCR → preparedImage → `pl:ingest-image` → entity (or human gate if 缺字段) |

每入口跑 N 个商家 → 验证从 0 → master.md 22 章 + Discord 全链路通。

---

## 2. Pre-Flight (跑测试前必查)

### 2.1 Daemon 状态
```bash
launchctl list | grep ai.profitslocal
# 期望: 5 daemon (listener · dispatcher · api · tunnel · v3.task-dispatcher · intake-doctor-daily)
# 全 pid > 0 (intake-doctor-daily 因 calendar interval · pid 可能 -)
```

### 2.2 Doctor 全绿
```bash
npm run pl:sop0-doctor             # 5/5 ✅
npm run pl:intake-doctor           # 5/5 ✅
npm run pl:lead-journey-doctor     # 10/10 ✅
```

### 2.3 Discord channels env
```bash
grep -E "DISCORD_CHANNEL_ID|DISCORD_BOT_TOKEN" .env.local | sed 's/=.*/=<SET>/'
# 期望: 6 个 channel ID + 2 bot token
```

### 2.4 Recent activity (避免脏数据干扰)
```bash
ls data/leads/entities/ | wc -l    # 当前 entity 数 (基线 · 测后看新增)
ls data/tasks/*.json 2>/dev/null | wc -l   # 任务队列 (期望 < 5 · 不应积压)
```

---

## 3. 每个测试 · 8 checkpoint (统一 SOP)

### Checkpoint A · Discord 命令发出
**操作员**: 在 `#website-tasks` forum 开 thread · 第一条 message 是命令。

**期望**: 1-2s 内 Discord 收到 listener 回的"📥 任务已创建"消息。

**Log**:
```bash
tail -f data/tasks/_logs/task-listener.log | grep "thread"
# 期望: "route → kind=X provider=Y conf=Z cli=W"
```

### Checkpoint B · Task 文件创建
**期望**:
- `data/tasks/<id>.json` 出现
- status: `pending`
- kind 正确 · args 含 --niche --city (intake 路径) 或 --query (places)

**Log**:
```bash
ls -t data/tasks/*.json | head -1 | xargs cat | jq '.kind,.status,.target.cli,.target.args'
```

### Checkpoint C · Dispatcher 接 task
**期望**: fs.watch 触发 · spawn CLI · status 变 `running`。

**Log**:
```bash
tail -f data/tasks/_logs/v3-dispatcher.log | grep -E "fs.watch|spawn"
# 期望: "fs.watch fired · maybe-pending <id>" + "spawn pl:<cli>"
```

### Checkpoint D · CLI 跑完
**期望**:
- task status → `done` (or `failed` / `timeout`)
- entity JSON 写盘 (新建 OR merge)
- Exit code 0

**Log**:
```bash
tail -f data/tasks/_logs/v3-dispatcher.log | grep -E "done|exit"
# 期望: "done <id> (Nms exit=0)"
```

**Entity 验证**:
```bash
ls -t data/leads/entities/*.json | head -3
# 期望: 至少 1 个新文件 (intake 多个)
```

### Checkpoint E · Master.md skeleton
**期望**: `clients/<slug>/v2/master.md` 出现 · 3 章 (一、二、三) · phase=AWAITING_AUDIT。

**Log**:
```bash
# 任务积压
node -e "import('./core/tasks/task-store.js').then(m =>
  console.log('build-master-md pending:',
    m.listTasks({ kind: 'ops' }).filter(t =>
      ['pending','running'].includes(t.status) &&
      t.target?.cli === 'leads:build-master-md').length))"
# 期望: 0 (v3 dispatcher 应快速消化)
```

**File**:
```bash
ls -lt clients/*/v2/master.md | head -3
```

### Checkpoint F · Discord display update
**期望**:
- 如果 entity 已有 thread (project_thread_id 或 discord_thread_id):
  - `appendThreadMessage` 发 "📄 master.md 已重建 · NKB · M sections"
  - `upsertProfileCard` 刷新顶部 7-section card

- 如果 entity 没 thread:
  - 等待 audit + grade · 由 grade-router 触发 openLeadThread/openProjectThread

**验证**: 去 Discord 频道看新消息。

### Checkpoint G · Audit pipeline (M2)
**触发**: 手动 `npm run leads:run-pipeline -- --entity-key <key>` 或 Hermes cron。

**期望** (4 stage):
- Stage 1: `audit_score` 在 master.md frontmatter (0-100)
- Stage 2: `visual_freshness` 等 3 dims
- Stage 3: `entity.scoring.grade` ∈ {A,B,C,D}
- Stage 4: `clients/<slug>/v2/internal-audit-report.html` 出现
- Discord: D35 hook 发 "✅ Audit pipeline 完成 · 总分 X..."

**Log**:
```bash
npm run leads:run-pipeline -- --entity-key <key> 2>&1 | tee /tmp/audit.log
```

### Checkpoint H · Grade router + Discord channel 切换
**期望**:
- A/B/C → `entity.discord_thread_id` (#website-leads) 写入
- 如果已有 demo URL (`cf-pages-deploy.json`) → 改 `project_thread_id` (#website-projects)
- D → `setEntityPhase('archived')` + archive_reason

**验证**:
```bash
python3 -c "
import json
e = json.load(open('data/leads/entities/<key>.json'))
print('phase:', e.get('phase'))
print('grade:', e.get('scoring',{}).get('grade'))
print('leads thread:', e.get('discord_thread_id'))
print('projects thread:', e.get('project_thread_id'))"
```

---

## 4. 完整测试场景 · 4 入口 × 1 entity

### 4.1 Test #1 · intake (batch-maps · gosom docker)

**前提**: docker daemon up · gmaps-scraper-web container running

**步骤**:
```bash
# 1. Pre-flight
npm run pl:intake-doctor

# 2. Discord 发命令
# 在 #website-tasks 开新 thread · 输入:
"find brisbane plumbers --count 1"

# 3. 等 60-120s · 监控 v3-dispatcher.log
tail -f data/tasks/_logs/v3-dispatcher.log

# 4. 验证 Checkpoint A-H 顺序
```

**期望产出**:
- 1+ 新 entity in `data/leads/entities/place_chij*.json`
- 1+ 新 master.md in `clients/*/v2/master.md`
- Discord task thread reply "✅ ...完成 · 找到 N 个客户"

### 4.2 Test #2 · places-intake (Google Places API)

**前提**: `GOOGLE_PLACES_API_KEY` 在 .env.local · 月度 quota 未耗

**步骤**:
```bash
# Discord:
'places search "roofer brisbane"'

# 等 60-180s
```

**期望产出**:
- 10-20 new entities (Places returns top results)
- 多个 master.md 同时建

### 4.3 Test #3 · single-enrich (单店)

**步骤**:
```bash
# Discord:
'enrich "Joe Plumbing Brisbane" +61 7 3123 4567'
# 或贴 Maps URL:
'https://maps.app.goo.gl/abc123'
```

**期望产出**: 1 entity (place_id 或 phone_*)

### 4.4 Test #4 · image-extract (名片图)

**步骤**:
```bash
# Discord forum thread · 上传名片图 + 任意 text (例 "Sydney plumber")
```

**期望产出**:
- vision LLM OCR 抽 niche + city + business name
- 如果全抽到 → entity 创建 · phase=AWAITING_AUDIT
- 如果缺关键字段 → human gate · thread 改 `human` tag · 提示操作员补字段 (Bug B fixed)

---

## 5. Checkpoint 自动发 Discord thread (per Matthew · D35 hooks 实装)

每个 CLI 末尾已加 hook · 自动:
- `appendThreadMessage(entityKey, msg)` 发进度
- `upsertProfileCard(entityKey)` 刷新顶部 card

| Stage | Hook 在 | 发什么 |
|---|---|---|
| build-master-md 完 | `scripts/leads/build-master-md.js` | "📄 master.md 已重建 · NKB · M sections · audit_score X" |
| Audit pipeline 完 | `scripts/leads/run-audit-pipeline.js` | "✅ Audit pipeline 完成 · 总分 X · 视觉 N/10 · decision" |
| Customer audit 完 | `scripts/cli/pl-build-customer-audit.js` | "📋 客户 audit HTML 已重建 · NKB · Ss" |
| Optimize internal 完 | `scripts/cli/pl-optimize-internal-report.js` | "📊 内部 audit 优化版 · N 轮" |
| Publish-demo 完 | `scripts/cli/pl-publish-demo.js` | 自动 open thread + post demo URL |
| Grade-router 重 grade | `core/leads/grade-router.js` | "📊 Grade 更新 → X" |

**没 thread 的 entity** (M1 出口前): hook 自动 skip · channel='none' · 不报错。

---

## 6. 已知 Bug + 历史 fix (背景)

| Bug ID | 描述 | 状态 |
|---|---|---|
| Bug A | ollama router 漏 niche/city | ✅ fixed (NICHE/CITY_KEYWORDS + normalizeArgsForKind) |
| Bug B | image-extract human-gate UX 沉默 | ✅ fixed (listener detailed message) |
| Bug C | v3 worktree task 孤儿 | ✅ fixed (D30 per-worktree dispatcher) |
| Bug D | docker daemon down 神秘 fetch failed | ✅ fixed (pl-scrape-docker auto-recover) |
| Bug E | `--count` flag 命名误导 | ✅ doc fix (gosom depth · 非结果上限) |
| Bug F | build-master-md 积压 114 | ✅ D30 闭环 |

---

## 7. 测试结果模板 (跑完填这个)

```
Test #N · <kind> · 时间 YYYY-MM-DD HH:MM
─────────────────────────────────────────
Pre-flight       · doctor 5/5 ✓
Checkpoint A     · ✓ Discord ack · N秒
Checkpoint B     · ✓ task <id> · kind=X · args 完整
Checkpoint C     · ✓ dispatcher pickup · spawn pl:<cli>
Checkpoint D     · ✓ exit 0 · entity 写盘
Checkpoint E     · ✓ master.md skeleton · phase=AWAITING_AUDIT
Checkpoint F     · ✓ Discord thread 更新
Checkpoint G     · audit pipeline 完成 · score=X · grade=Y
Checkpoint H     · grade-router · phase=design-ready · thread in #website-projects

Bugs found:
  - (none) OR list
Resolved:
  - ...
```

---

## 8. 故障 runbook

| 现象 | 诊断 | 修 |
|---|---|---|
| Discord 命令无 ack | listener daemon down | `launchctl kickstart -k gui/$UID/ai.profitslocal.task-listener` |
| task 卡 `pending` | dispatcher 不在 / 错 worktree | `launchctl list \| grep dispatcher` · 检查 v3 plist |
| `--niche required` exit 1 | router 没抽 niche | 看 task progress · 调 cascade env: `INTENT_ROUTER_CASCADE=codex_cli,claude_cli,ollama,regex` |
| docker scraper fail | docker daemon / 容器停 | `open -a Docker` 或 `docker start gmaps-scraper-web` |
| Places API 429 quota | 月度 quota 用完 | 加 `GOOGLE_PLACES_API_KEY_2` backup |
| Vision LLM null | 全 cascade 失败 | 看 visual-adapter log · ollama 启 `ollama serve` |
| Discord thread 没更新 | hook 失败 | 看 stdout · refreshThreadAndPost 内 try/catch (fire-and-forget · 不阻塞主链) |
| master.md 缺章 | M2 没跑全 | 重跑 `npm run leads:run-pipeline -- --entity-key X --refetch` |

---

## 9. 实测记录 (Round 1 · 2026-05-14)

### Test #1 · intake (docker) · `--niche electrician --city devonport --count 1`
- ✅ docker daemon up · gmaps-scraper-web running
- ✅ Returned 12 leads (depth=1 of "electrician in devonport")
- ✅ Entity count: 14 → 26 (+12)
- ✅ Each entity has phone · website · rating · location

### Test #2 · places-intake · `"panelbeater hobart" --limit 2`
- ✅ Places API 调通 · 2 candidates returned
- ✅ Duration 4.9s
- ✅ Auto-opened batch thread in `#lead-discovery-runs` (URL: https://discord.com/channels/.../1504298672920334527)
- ✅ 2 new entities + 2 master.md skeleton built (v3 dispatcher 消化)
- ⚠️ Bug G1 fixed in this round: `display-vocab.js` 加 `car_repair` → `汽修` 映射

### Test #3 · single-enrich · `--name "Sydney Plumbing Services" --phone +61 2 9876 5432`
- ✅ Places find · resolved to "Sydney Plumbing and Drainage" (different biz · API found best match)
- ✅ Duration 1.3s · cost ~$0.017
- ✅ Entity created · phone + website + address 全
- ✅ **Auto-chained audit task** spawned + completed (task_id 20260514-015412-b450c1 · 7 progress events)
- ⚠️ Bug G2 fixed in this round: `nicheLabel()` 加 4 层容错 (direct · underscore · first-word · substring) · "plumbing services" 现 → 水管

### Test #4 · image-extract
- ⏭ 跳过 (需手动上传图片)
- ✅ 提供 sample dir: `data/qa/sample-images/` · 有 README + roofing-flyer-1.notes.md
- 待 Matthew drag 实际 jpg 进 · 然后 `npm run pl:ingest-image -- --image-path data/qa/sample-images/roofing-flyer-1.jpg`

### Audit pipeline · per-stage Discord 验证 · brisbane-roof
- ✅ `npm run leads:run-pipeline -- --entity-key place_chijwdbif... --refetch`
- ✅ 5 stage messages posted (1 启动 + Stage 1/2/3/4 各 1)
- ✅ Stage 1 · contact extraction wired: `contact_us_url` 抽到 (`/contact/`) · email/social 空 (homepage 数据有限 · 需 crawl /contact 页面才全 · backlog P2 多页 scrape 时一起做)
- ✅ Stage 3 · grade router 改 grade C (re-grade · 触发 D35 refreshThreadAndPost)
- ✅ Stage 4 · internal HTML report 重建

### Bugs found + fixed in Round 1
| # | Bug | Status |
|---|---|---|
| G1 | display-vocab 缺 car_repair · auto_repair · smash_repair niche | ✅ fixed |
| G2 | nicheLabel "plumbing services" → "其他" 漏 (要单词 key) | ✅ fixed (4 层容错) |
| D37-1 | audit pipeline 只发 1 条 summary 而非 4 stage 单独 | ✅ fixed (per-stage hook) |
| D37-2 | email/contact_us/social_links 不写回 entity | ✅ fixed (contact-extraction.js) |

### 待办 Round 2 (backlog)
- Test #4 image-extract · Matthew 提供图片后跑
- 多页 scrape (about / services / contact 页 fetch + extract logo + page copy)
- 跨多个 entity 跑 audit pipeline · 确认 batch 模式 Discord 不刷屏

---

## 10. 相关文档

- [README.md (SoT)](./README.md)
- [SOP-1-FLOW.md](./SOP-1-FLOW.md) · 详细 intake 节点
- [SOP-2-FLOW.md](./SOP-2-FLOW.md) · 详细 audit 节点
- [SOP-3-FLOW.md](./SOP-3-FLOW.md) · 详细 publish 节点
- [LEAD-JOURNEY.md](./LEAD-JOURNEY.md) · lead lifecycle 12 阶段
- [TOOL-STACK-PRD.md](./TOOL-STACK-PRD.md) · 工具 + cascade
- [SKILLS-INDEX.md](./SKILLS-INDEX.md) · 相关 skill
- [DISCORD-LIVE-E2E-2026-05-13.md](./DISCORD-LIVE-E2E-2026-05-13.md) · 上一轮 4 input live test (Bug A+B 发现)
