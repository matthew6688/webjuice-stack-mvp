# SOP-0 · Task System · 统一入口与调度

**版本**: **v1.2** (P0-P8 + P6.X + race-fix + vision fallback chain + admin nav · 2026-05-12)
**Operator guide**: [`SOP_0_OPERATOR_GUIDE.md`](SOP_0_OPERATOR_GUIDE.md)
**最近更新**: 2026-05-12
**配套页面**: [`/admin/scoring/sop-0-doc`](/admin/scoring/sop-0-doc) · [`/admin/tasks`](/admin/tasks) (P6 待建) · [`/admin/cron`](/admin/cron) (P6 待建)
**Owner 范围**：所有 SOP 之"前"的统一入口 / 任务模型 / 路由 / 调度协议。它不**做**业务（业务在 SOP-1..5），它**驱动**业务。

> Matthew 2026-05-12："这部分也是一个 SOP，因为它是我们所有东西的入口。"
> Matthew 2026-05-12："我要的是全自动的方案，我不想用pull。"

---

## 0. 一句话

> Matthew 把活儿（一句话 / 图 / PDF / admin 表单）丢进 Discord forum `#website-tasks` → SOP-0 listener (ProfitsLocal Handoff bot) 用本地 ollama 路由出 task → 写 `data/tasks/<id>.json` + PATCH forum tag → fs.watch 驱动 dispatcher → spawn target CLI → 进度回写同一 thread + admin。**全自动 · 不 pull · 流水一样**。

---

## 1. 设计原则（不可妥协）

| # | 原则 | 不这么做的代价 |
|---|---|---|
| 1 | **全自动 push 模式** · 任务到位即跑，不周期性 pull queue | Matthew 等不及 |
| 2 | **统一 Discord 入口** · 1 个 forum channel · 文字 / 图 / PDF 都走这里 | 入口散开 → 没人知道在哪儿丢活儿 |
| 3 | **单一 task 模型** · 所有任务统一 schema · 1 个 dispatcher | per-domain dispatcher 各跑各的 → 状态漂移 |
| 4 | **Discord ↔ admin 双向可见** · 每 task = 1 forum thread；admin 同步 mirror | operator 看不到 admin 改了什么 → 信息断层 |
| 5 | **失败用 tag 标记，不另设队列** · `human` tag = 队列 | 把失败放新 channel → 又一个看的地方 |
| 6 | **task = entity 的元信息**，**不是 entity 本身** | task 重复存 entity → 同步漂移 |
| 7 | **Local LLM 优先 · paid 不自动开火** | 钱不知不觉花出去；订阅过期 = 全瘫 |
| 8 | **Channel = forum (type 15)**，使用 Discord 原生 tag | text channel + emoji-prefix 是 hack，operator 不能按 tag filter |

---

## 2. Task 模型（v1 · 已落地）

### 2.1 文件

```
data/tasks/<task_id>.json          ← 单文件 flat，**不要** sub-dir
```

`task_id` = `YYYYMMDD-HHMMSS-rand6` (UTC · chrono-sortable → `ls` = 时间序)
例：`20260512-200400-a1b2c3`

### 2.2 Schema (v1, in code: `core/tasks/task-store.js`)

```json
{
  "schemaVersion": 1,
  "task_id":      "20260512-200400-a1b2c3",
  "created_at":   "2026-05-12T20:04:00Z",
  "updated_at":   "2026-05-12T20:04:00Z",
  "kind":         "intake",
  "status":       "pending",
  "source": {
    "platform":   "discord",
    "thread_id":  "1503...",
    "author":     "matthew",
    "message_id": null
  },
  "input": {
    "text":         "find roofers in brisbane",
    "attachments": []
  },
  "target": {
    "cli":               "pl:pipeline-batch-step",
    "args":              ["--niche", "roofer", "--city", "brisbane"],
    "target_entity_key": null,
    "timeout_ms":        300000
  },
  "result": {
    "entity_keys": [],
    "exit_code":   null,
    "duration_ms": null,
    "cost_usd":    null
  },
  "progress": [
    { "at": "...", "step": "router.resolved", "detail": "kind=intake provider=ollama" }
  ],
  "error": null,
  "discord": {
    "thread_id":         "1503...",
    "status_message_id": null
  }
}
```

`progress[]` = 环形 buffer，**最多 50 条**（老的 FIFO 裁）。

### 2.3 Status 状态机 (5 status, 4 valid 转换)

```
pending ──tryClaim──▶ running ──exit=0──▶ done
   │                      │
   │                      ├──exit≠0──▶ failed
   │                      └──>30min──▶ human  (timeout, dispatcher 主动设)
   │
   └──unknown kind──────────────────────▶ human  (router 没辙)

failed ──operator retry─▶ pending
human  ──operator ✅────▶ pending
human  ──operator 🗑────▶ done
done   ──TERMINAL─────────────────────  (不可恢复)
```

Code 强制：`canTransition(from, to)` + `transitionStatus()` 非法转换 throw。

### 2.4 并发安全

```
atomic write    : 写入用 tempfile + fs.renameSync (POSIX-atomic 保证)
claim race      : .claiming marker file via wx flag (exclusive create) → 同时只 1 个 winner
status check    : claim 前先 read，pending 才尝试 lock，pending 才写 running
                 → 三重 gate 防 double-spawn
```

Implementation: `core/tasks/task-store.js` `tryClaim()`。

---

## 3. 入口路由

### 3.1 触发源

| 源 | 触发 | 谁监听 |
|---|---|---|
| Discord forum `#website-tasks` 新 thread | MESSAGE_CREATE event | `pl-task-listener` (Handoff bot, P2.3 待建) |
| Discord thread 评论（已 task）| MESSAGE_CREATE in known task thread | 同上 → append progress / re-trigger |
| Admin `/admin/tasks` 表单 | HTTP POST | Cloudflare Worker → 写 `data/tasks/_pending-create/<uuid>.json` |
| Hermes cron tick | 周期触发 | Hermes spawn `pl:task-create --kind=ops ...` |
| 内部代码（如 `discovery-store.js` 检出 thin-contact） | 直接调 `createTask()` | core/tasks/task-store.js export |

### 3.2 LLM router · 默认 cascade

**当前默认链** (per Matthew 2026-05-12 · "local 能干就别让 paid 走自动 fallback"):

```
1. ollama qwen3.5:9b      (T0 local, ~3-4s on M2 mini, $0)
2. regex 8-class           (T0 local, ~10ms, $0, 永远不挂)

Paid CLIs (claude_cli/codex_cli) 默认 0 自动开火。
```

**Opt-in paid fallback** (operator 显式同意花钱)：

```bash
# 仅当 env 设置时启用，默认空 = 永不调 paid
INTENT_ROUTER_PAID_FALLBACK=claude_cli         → ollama → claude_cli → regex
INTENT_ROUTER_PAID_FALLBACK=claude_cli,codex_cli → ollama → claude_cli → codex_cli → regex
```

**Other env knobs**:

```bash
INTENT_ROUTER_OLLAMA_MODEL=qwen3.6:27b   # 换更大模型
OLLAMA_TEXT_MODEL=qwen3.5:9b              # 全局 ollama 默认
TEXT_PROVIDER=ollama                      # 强制单 provider，跳过 cascade
```

**Kimi CLI** 暂不入 cascade（kimi 是纯交互 TUI · 无 stdin→stdout）。等出 non-interactive mode 或我们写 ACP client，单独 P 实装。

Implementation: `core/tasks/intent-router.js` · `routeIntent({ text, attachments })`。

### 3.3 LLM router · 输出 schema

```json
{
  "kind":              "<one of 7 kinds>",
  "target_cli":        "pl:pipeline-batch-step" | ... | null,
  "args":              ["--niche", "roofer", ...],
  "target_entity_key": "place_chij..." | null,
  "confidence":        0..1,
  "provider":          "ollama" | "regex" | "claude_cli" | "codex_cli",
  "reasoning":         "<short string for debug>"
}
```

Regex chain 输出同 schema（regex 路径走 `viaRegex()` 适配 5-class → 7-kind）。

### 3.4 Kind → CLI 路由表

| kind | target_cli | 备注 |
|---|---|---|
| `intake` | `pl:pipeline-batch-start` | SOP-1 主入口 (注意：`pl:pipeline-batch-step` 是 POST UPDATES 用的，不是入口) |
| `enrich` | `pl:run-enrichment-batch` | SOP-1 step 3，需 entity_ref |
| `audit` | `leads:run-pipeline` | SOP-2 (注意：`pl:run-audit-pipeline` 不存在，实际是 `leads:` 命名空间) |
| `dedup` | `pl:dedup-audit` 或 `pl:dedup-merge` | SOP-X-Dedup |
| `photos` | `pl:download-places-photos` + `pl:places-enrich` | G-13 |
| `image-extract` | `pl:ingest-image` | SOP-1 §2.1 |
| `ops` | `ops:health-check` 或 null | health-check / cron / admin |

---

## 4. Dispatcher (P3 待建)

### 4.1 主驱动 = `fs.watch` (push)，cron 60s 为 safety net

```
fs.watch('data/tasks/') fires on JSON create/modify
  → dispatcher 检查事件文件 status === 'pending'
  → tryClaim() 拿到 task (atomic)
  → spawn target_cli with --task-id <id> 参数
  → 流式 stdout → appendProgress(taskId, ...)
  → PATCH thread tag pending → running
  → on exit: PATCH tag → done / failed
  → 超时 30 min: PATCH tag → human

cron 60s 兜底：扫所有 status='pending' 老 task（防 fs.watch 漏事件）
```

### 4.2 并发模型

- Global flock `data/tasks/.dispatcher.lock` → **同一时刻只一个 dispatcher tick 跑**
- 单 tick 内可 spawn 多个 CLI 并行（fire-and-forget · 由 CLI 自己回写）
- 1000 task/h 流量内绰绰有余；超过再考虑 sharding

### 4.3 注册到 Hermes cron

```bash
# Hermes 60s tick = safety net；fs.watch 是主路径
hermes cron create "every 60s" "node scripts/cli/pl-task-dispatcher.js tick"
```

Cron 列表在 `~/.hermes/cron/jobs.json` · admin viewer P6 待建。

### 4.4 Entity-driven auto-dispatch (P5 · 已落地)

```
data/leads/entities/<key>.json 写入 (mergeLeadIntoEntity)
  → if 新成为 thin-contact (no phone && no website) + enrichment_status='pending'
  → maybeSpawnEnrichTask(entityKey)
     · debounce: if any kind=enrich status∈{pending,running} → skip
     · 否则 createTask({kind:'enrich', target_cli:'pl:run-enrichment-batch',
                       args:['--skip-approval'], target_entity_key:<key>})
  → fs.watch → dispatcher claim → spawn → 处理全队列 pending entities → done
```

**Push-based · 不 scan entity store**（v0.1 的 scan 设计废弃）。

**为什么 debounce**：`pl:run-enrichment-batch` 一次跑会处理所有 pending entities（不限 1 个）。10 entities 同时变 thin-contact → 不需要 10 个 task，1 个 batch 跑就清了。debounce 防 task 灾难。

**为什么 best-effort try/catch**：task-store 任何错误**绝不破坏** entity 写入。SOP-0 是 SOP-1 的下游通知，不该反向阻塞。`SOP0_DEBUG=1` 可看错误。

---

## 5. Discord ↔ Admin 双轨

### 5.1 Forum tag native (replaces v0.1 的 emoji-prefix hack)

**Channel**: `#website-tasks` = forum (type 15) · ID `1503702990761099419`
**Tags**: 12 个 (7 kind + 5 status)，IDs 持久化在 `data/discord/website-tasks-forum-tags.json`

| 类别 | tag |
|---|---|
| Kind (任务创建时锁定) | `intake` `enrich` `audit` `dedup` `photos` `image-extract` `ops` |
| Status (state machine 切换) | `pending` `running` `done` `failed` `human` |

每 task = 1 forum thread。状态变化 = PATCH thread `applied_tags`。Operator 在 forum view 按 tag filter 浏览（e.g. "所有 human"）。

### 5.2 Listener bot · ProfitsLocal Handoff (1501742351716978738)

- 不再用 Hermes website-agent listen `#website-tasks`（同 token 不能两个 gateway）
- Hermes `~/.hermes/profiles/website-agent/config.yaml` 已删除 `1501072883001065614`
- Handoff bot Discord Developer Portal 已开 MESSAGE_CONTENT intent (Matthew 2026-05-12)

### 5.3 Admin pages (P6 待建)

| 页面 | 用途 |
|---|---|
| `/admin/tasks` | 列表 + 详情 · filter by status/kind/age · 重跑按钮 · 手动 create 表单 |
| `/admin/cron` | 列 `~/.hermes/cron/jobs.json` · create/pause/delete via Hermes API |

---

## 6. 失败处理 · tag-based (不另设仓库)

```
CLI exit ≠ 0       → status='failed'      · tag 'failed'       · thread reply 错误摘要
LLM router 没辙     → status='human'       · tag 'human'        · reasoning 写入 error 字段
running > 30 min   → status='human'       · tag 'human'        · 'stale' 标
```

Matthew 在 forum 看到 `human` tag → 一个 reaction (✅) = 重跑，(🗑) = 放弃。**reaction listener 在 listener 进程内监听**（同 WS connection · 免新 proc）。

---

## 7. 阶段化交付

| P | 范围 | 状态 | 信心 |
|---|---|---|---|
| **P0** | Forum 转换 + 12 tag + Handoff bot intent + Hermes config 清理 | ✅ done 2026-05-12 | 100% |
| **P1** | `core/tasks/task-store.js` + 29 assertion 全过 | ✅ done 2026-05-12 | 100% |
| **P2.1** | `core/tasks/intent-router.js` + 19 assertion 全过 (live ollama verified) | ✅ done 2026-05-12 | 100% |
| **P2.2** | smoke test (合并 P2.1) | ✅ done | — |
| **P2.3** | `pl-task-listener.js` (discord.js v14 + intent-router + reaction listener) | ✅ done 2026-05-12 · live-verified | 100% |
| **P2.4** | launchd plist `ai.profitslocal.task-listener` · KeepAlive · auto-restart | ✅ done 2026-05-12 · daemon running | 100% |
| **P2.5** | E2E smoke — combined into P2.3 verification (catch-up routed thread, task created, tag PATCHed, reply posted, latency ~9s) | ✅ done | — |
| **P3** | `pl-task-dispatcher.js` (fs.watch + 60s cron + flock + spawn target_cli + tag PATCH + thread reply) | ✅ done 2026-05-12 · E2E verified | 100% |
| **P4** | ~~3 CLI 加 `--task-id`~~ → **dispatcher stdout tee** · throttled appendProgress · 0 CLI 改动 | ✅ done 2026-05-12 · live verified | 100% |
| **P5** | `discovery-store.js` createTask on thin-contact (push trigger, debounced) | ✅ done 2026-05-12 · 257ms E2E verified | 100% |
| **P6** | `/admin/tasks` + `/admin/cron` · 选 path B (Cloudflare Tunnel + local HTTP API + live admin) | ✅ done 2026-05-12 · `tasks.profitslocal.com` live · Bearer auth · 4 daemon | 100% |
| **P7** | retention archive cron (>30d done/failed → `_archive/YYYY-MM/`) + Discord reaction listener (✅ retry / 🗑 abandon) — reactions 已在 P2.3 wired | ✅ done 2026-05-12 · 5 launchd 全活 | 100% |
| **P8** | 修订: ~~archive 整 dir~~ → 只标 `task-router.js` deprecated + 文档清边界 + v1.0 lock | ✅ done 2026-05-12 | 100% |

**完成 13/13 (P0-P8) · SOP-0 v1.0 锁定 2026-05-12**。

后续工作 (TODO):
- ✅ **P6.X**: image-extract 任务 attachment 下载 + 视觉 LLM 提取业务字段 — done 2026-05-12 (v1.1) + v1.2 fixes
- 🟡 **single-business-enrich kind** (Matthew Q5 2026-05-12): 部分业务信号 (phone/email/business-name) → 自动 search/enrich/补全 → 进 audit pipeline. 新 kind + 新 CLI. ~5-7h. **等 Matthew 拍板 scope**
- 🟡 **PDF / audio / docx 输入支持**: 本地 package 已有 (pdf-parse / whisper.cpp / mammoth); 不在 v1 范围. **等 Matthew 提优先级**
- 🟡 **vision fallback chain 扩展**: 当前 qwen3.6→gemma3 都失败仍 human; 可加 Tesseract OCR + text-LLM 提取 / claude-cli vision (T1 subs) 作末端 fallback
- **SOP-0 v2** (远期): 任务数据 cloud mirror / dispatcher 上 VPS 不依赖 Mac 在线

### 7.3 P7 retention + reactions

**Retention (新)**：`scripts/cli/pl-task-retention.js` · 默认 30 天 cutoff · 扫 `data/tasks/*.json` 中 `done`/`failed` · 超时移到 `_archive/YYYY-MM/<task_id>.json`. Idempotent · 0 移到任 N 次都安全.

调度 = launchd `ai.profitslocal.task-retention` · `StartCalendarInterval` 每天 03:00 本地时间. 不放 Hermes cron — 因为不需要 Hermes context · 纯 fs 操作.

```bash
# 手动 (任何时候安全)
npm run pl:task-retention                       # 30d default
npm run pl:task-retention -- --days 7           # 紧一点
npm run pl:task-retention -- --dry-run          # 看会移什么不动手
npm run pl:task-retention -- --statuses done,failed,human  # 覆盖默认
```

**Reactions (P2.3 已有，P7 verified)**：listener daemon 内 `MessageReactionAdd` handler

| 触发条件 | 动作 |
|---|---|
| Reaction on `human`-tagged thread + emoji `✅` + 非 bot user | task `human` → `pending` · tag swap · thread reply "retried by X" |
| Reaction on `human`-tagged thread + emoji `🗑` / `🗑️` + 非 bot user | task `human` → `done` · tag swap · thread reply "abandoned by X" · error 字段保留原因 |
| 其他 emoji / 非 human-tag thread / bot user | 静默 ignore |

**测试方式**：你在 Discord forum 找一个 `human`-tag thread (没有的话等失败 task 自然产生)，点 ✅ 或 🗑 reaction，dispatcher 会接管。所有事件落 `data/tasks/_logs/task-listener.log`.

### 7.4 与老 `core/discord-tasks/` 的边界 (P8 清理结果)

SOP-0 v1 **不删除** 老 `core/discord-tasks/`。原因：调研发现它的 5 个文件分别服务不同用例，**不是全 legacy**：

| 老文件 | 状态 | 仍服务什么 |
|---|---|---|
| `task-router.js` | 🟡 **deprecated** (头标了) | 旧 `route-website-task.js` shim + legacy test 还在 import；不再用于新 task |
| `task-log.js` | 🟢 **active** | `scripts/leads/image-lead-discovery.js` 用它写 `data/discord-tasks/<id>/task-log.jsonl` (不同 namespace) |
| `thread-title.js` | 🟢 **active** | `discord:sync-website-task-title` script 仍用 |
| `thread-sync.js` | 🟢 **active** | `discord:sync-website-task-thread` script 仍用 |
| `lead-ops-sync.js` | 🟢 **active** | `discord:sync-lead-ops-thread` script (lead-ops 工作流，不是 SOP-0) |

**清晰边界**：
- **SOP-0 own**: Discord forum `#website-tasks` (1503702990761099419) 进来的活儿 · 用 `core/tasks/` 模块 · 落 `data/tasks/<id>.json`
- **老 `core/discord-tasks/` own**: lead-ops thread sync · 图片 lead discovery · 旧 text channel task 路径 · 落 `data/discord-tasks/<taskId>/`

两条流水线**并行不相干**。`data/discord-tasks/` (2 个历史 task) 不迁移。

### 7.5 image-extract 自动化路径 (P6.X · v1.1)

**问题**: 你 2026-05-12 self-test 时发图给 #website-tasks，listener 路由对 (image-extract, conf 0.95) 但 `pl:ingest-image` 退出 1，因为 listener 没传 `--image <path>` `--niche` `--city` `--business-name`。

**解 (v1.1)**:

```
listener handleNewForumThread()
  → routeIntent (text + attachments)
  → if route.kind === 'image-extract' && has image attachment:
       prepareImageTask(task_id, attachments)
         1. downloadAttachments → data/inbox/<task_id>/<idx>.<ext>
         2. extractBusinessFromImage (vision Ollama qwen3.6:27b · 240s timeout)
         3. parse JSON { businessName, niche, city, phone, address, website, category }
         4. build args = [--image <path>, --niche X, --city Y, --business-name Z, ...]
       Patch task.target.args + task.input.attachments[].local_path
  → if prep ok → status=pending, dispatcher 接管
  → if prep fail (missing businessName/niche/city) → status=human
```

**Vision model 选择**：
- 默认 `qwen3.6:27b` (能识别中英文 + 高准确率)
- 可换 `gemma3:27b` via `SOP0_IMAGE_VISION_MODEL` env
- 不能用 `qwen3.5:9b` / `deepseek-r1` (无 vision 能力)

**输出 schema (vision LLM 返回)**:
```json
{
  "businessName": "Joe's Pizza",
  "niche":        "restaurant",
  "city":         "melbourne",
  "address":      "123 Bourke St, Melbourne VIC 3000",
  "phone":        "+61 3 1234 5678",
  "website":      "joespizza.com.au",
  "category":     "Pizza Restaurant"
}
```

如果 vision 缺 businessName / niche / city → task 自动转 `human` tag · operator triage。

### 7.6 当前全部 5 个 daemon

```bash
launchctl list | grep profitslocal
#  PID  EXIT  Label
#  -    0     ai.profitslocal.task-retention    # 每日 03:00 cron
#  ...  0     ai.profitslocal.task-listener     # Discord WS
#  ...  0     ai.profitslocal.task-dispatcher   # fs.watch spawn
#  ...  0     ai.profitslocal.sop0-tunnel       # cloudflared QUIC
#  ...  0     ai.profitslocal.task-api          # localhost:4040 REST
```

### 7.2 P6 架构（live admin via Cloudflare Tunnel）

```
profitslocal.com/admin/tasks/         (CF Pages static · gated by ADMIN_ACCESS_TOKEN)
  └─ client JS fetch ──Bearer SOP0_API_AUTH_TOKEN──▶ tasks.profitslocal.com
                                                       │
                                                       ▼
                                              Cloudflare Tunnel (sop0-admin)
                                                       │  QUIC · 4 edge connections (syd/bne)
                                                       ▼
                                              Mac mini :4040  pl-task-api daemon
                                                       │
                                                       ▼
                                              data/tasks/*.json
                                              ~/.hermes/profiles/*/cron/jobs.json
                                              data/discord/website-tasks-forum-tags.json
```

**4 个 daemon**（全部 launchd `KeepAlive`）：

| daemon | label | port/role |
|---|---|---|
| listener | `ai.profitslocal.task-listener` | Discord WS gateway |
| dispatcher | `ai.profitslocal.task-dispatcher` | fs.watch + spawn CLI |
| api | `ai.profitslocal.task-api` | localhost:4040 read-only JSON API |
| tunnel | `ai.profitslocal.sop0-tunnel` | cloudflared QUIC to CF edge |

**双 token 防御**（layered）：

| 层 | gate | token |
|---|---|---|
| CF Pages `/admin/*` | ADMIN_ACCESS_TOKEN cookie (existing middleware) | 已有 |
| Tunnel API | `Authorization: Bearer SOP0_API_AUTH_TOKEN` | 新 (32-byte base64url) |

`PUBLIC_SOP0_API_TOKEN` env var 在 build time 嵌入 admin page JS。因为 admin page 本身已被 ADMIN_ACCESS_TOKEN 关在门外，"看得到 JS = 已经过门" — bearer token 内嵌可接受。`/api/health` 不需 auth (公网 liveness probe)。

**Endpoints (read-only)**：
- `GET /api/health` (public)
- `GET /api/tasks?status=&kind=&archived=1&limit=` (Bearer)
- `GET /api/tasks/:id` (Bearer)
- `GET /api/cron` (Bearer)
- `GET /api/forum-tags` (Bearer)

写操作 (re-run / cancel / create cron) **不在 P6 v1 范围** — 仍走 Discord (reaction) 或 Hermes dashboard。

### 7.X · P4 实时进度观测

**Dispatcher 主动 tee subprocess stdout/stderr** → `task.progress[]` 追加 `cli.stream` 条目。
- 触发：每 `SOP0_STREAM_FLUSH_MS` (默认 5000ms) **或** buffer ≥ `SOP0_STREAM_FLUSH_BYTES` (默认 2048) 先到
- detail 字段 = 最近 200 字符 (ANSI 已剥)
- 完整 stdout 仍在 exit 时落 thread reply tail（1500 chars）
- **CLI 0 改动** — SOP-0 单向感知业务 CLI，不反向耦合

可见性：
- `data/tasks/<id>.json` 的 progress[] 实时长（每 5s 或 2KB）
- Discord thread = 仍只发 create / complete 两条（不 spam）
- `/admin/tasks` 页 (P6) = build-time 快照；要真活体需本地小 server

### 7.1 Deploy / 运维（listener + dispatcher daemons）

```bash
# 安装 (一次, 两个 daemon)
cp scripts/cli/pl-task-listener.launchd.plist   ~/Library/LaunchAgents/ai.profitslocal.task-listener.plist
cp scripts/cli/pl-task-dispatcher.launchd.plist ~/Library/LaunchAgents/ai.profitslocal.task-dispatcher.plist
launchctl bootstrap gui/$UID ~/Library/LaunchAgents/ai.profitslocal.task-listener.plist
launchctl bootstrap gui/$UID ~/Library/LaunchAgents/ai.profitslocal.task-dispatcher.plist

# 状态
launchctl list | grep profitslocal
tail -f data/tasks/_logs/task-listener.log
tail -f data/tasks/_logs/task-dispatcher.log

# 重启 (pick up code changes)
launchctl kickstart -k gui/$UID/ai.profitslocal.task-listener
launchctl kickstart -k gui/$UID/ai.profitslocal.task-dispatcher

# 停 / 卸载
launchctl bootout gui/$UID/ai.profitslocal.task-listener
launchctl bootout gui/$UID/ai.profitslocal.task-dispatcher

# 前台调试 (foreground)
npm run pl:task-listener
npm run pl:task-dispatcher          # 长跑 fs.watch + cron 60s
npm run pl:task-dispatcher -- tick   # 一次性扫，等所有 in-flight 完才退出

# 允许 bot-authored thread (E2E smoke):
LISTENER_ALLOW_BOTS=1 npm run pl:task-listener
```

Logs:
- listener:   `data/tasks/_logs/task-listener.{log,error.log}`
- dispatcher: `data/tasks/_logs/task-dispatcher.{log,error.log}`

---

## 8. 决定 log（架构选择历史）

按时间序，每条都有 "为什么没选 X" 写清楚。后人不会再问。

| 日期 | 决定 | 选 | 没选 | 理由 |
|---|---|---|---|---|
| 2026-05-12 | Listener bot | **ProfitsLocal Handoff** (1501742351716978738) | Hermes website-agent | 同 token 不能两 gateway；解耦 SOP-0 vs Hermes 命运 |
| 2026-05-12 | Channel type | **Forum (type 15) 1503702990761099419** | Text channel + emoji-prefix | Forum tag = 原生 UX，operator 一键 filter；text 是 hack |
| 2026-05-12 | task_id 格式 | **`YYYYMMDD-HHMMSS-rand6`** | `<intent-slug>-<msgId>` | Chrono-sortable，`ls` 即时间序，不依赖 Discord ID |
| 2026-05-12 | 文件结构 | **flat `data/tasks/<id>.json`** | sub-dir `<id>/task.json + log.jsonl` | 单文件够用；progress 进 JSON ring buffer |
| 2026-05-12 | LLM router | **ollama → regex (default)** | 直 Anthropic API · Claude CLI cascade | 本地免费 + 不依赖第三方订阅 (Matthew cost discipline) |
| 2026-05-12 | LLM router fallback | **paid env opt-in** | 自动 cascade 到 paid CLI | 防 operator 不知情花钱 |
| 2026-05-12 | Kimi 暂缓 | **TODO 单独 P** | 现在加入 cascade | Kimi CLI 纯交互 · 需 ACP client 或 web wrapper |
| 2026-05-12 | Dispatcher 驱动 | **fs.watch + cron 60s safety** | 纯 cron 60s | fs.watch 子秒延迟，cron 是漏事件兜底 |
| 2026-05-12 | 并发模型 | **Global flock 串行 dispatcher tick** | 多 dispatcher 并行 | 1000 task/h 内串行够用；并行 = 复杂 race |
| 2026-05-12 | Entity 触发 task | **直接调 `createTask()` push** | dispatcher scan entity store | Push 实时；scan 浪费 + 延迟 |
| 2026-05-12 | 失败处理 | **tag `human` + reaction 重跑** | `#failures` 新 channel | 失败留原 thread → 上下文不丢 |
| 2026-05-12 | 旧 `core/discord-tasks/` | ~~P8 archive 整 dir~~ → **保留 + 标 `task-router.js` deprecated** | 全 archive (会 break 现有 thread-title/lead-ops sync scripts) | P8 调研发现 5 个文件分别服务不同用例 · 4 个 active 不可动 · 只 task-router 真 superseded · 边界写进 doc §7.4 |
| 2026-05-12 | 历史 2 task 迁移 | **不迁** | 写迁移脚本 | 价值低；新系统从空开始 |
| 2026-05-12 | Discord client lib | **discord.js v14.26.4** | eris / raw WS | 32K star · 维护活跃 · forum + reactions 都原生 · ESM 友好 |
| 2026-05-12 | Listener daemon | **launchd KeepAlive** | systemd / pm2 / nohup | macOS native · 与 Hermes plist 模式一致 · 崩了自动重启 · `launchctl kickstart -k` 一行重启 |
| 2026-05-12 | Bot-authored thread | **skip by default** + `LISTENER_ALLOW_BOTS=1` smoke flag | 永远 process | 防 listener 自己发的 reply 二次触发自身 = 无限循环 |
| 2026-05-12 | Listener log path | **`data/tasks/_logs/task-listener.{log,error.log}`** | `~/.profitslocal/logs/` | 与 task 数据一起 → 一处看完整链路 |
| 2026-05-12 | CLI 映射 bug 修正 (P3 测试发现) | `intake → pl:pipeline-batch-start` (NOT `-step`); `audit → leads:run-pipeline` (`pl:run-audit-pipeline` 不存在) | LLM 之前 guess 的 | LLM 不知道 npm script 名字真实空间 → 必须在 prompt 显式列 |
| 2026-05-12 | Dispatcher one-shot 等 in-flight | **轮询 `inFlight` set，直到空才退出** (最长 2× DEFAULT_TIMEOUT_MS) | 1s setTimeout 后 hard-exit | P3 smoke 发现的 bug：parent exit 不会等 spawned child，child 完成但 task 卡在 running → 一旦发现，**立刻**修 + 写 decision log，不让它二次出现 |
| 2026-05-12 | Dispatcher 调 CLI 用 `npm run X --` | 直接 `spawn(scripts/cli/X.js)` | `npm run` 触发 package.json 的 `--env-file-if-exists` flag · 否则 .env.local 没加载 |
| 2026-05-12 | Subprocess 完成后回帖 | **stdout/stderr 合并 tail 1500 字符** + tag PATCH + post 到 thread | 不回帖 / 静默落 JSON | Operator 在 Discord 直接看到结果，不用切 admin |
| 2026-05-12 | P4 实时进度 | **dispatcher stdout tee → task.progress[]** (throttled 5s/2KB) | 3 个 CLI 各加 `--task-id` + import `appendProgress` | Matthew 原则: "为兼容老代码牺牲太多要敢于重新设计"。CLI 改动方案让业务 CLI 知道 SOP-0 = 反向耦合 / CLI 改 log 格式会 break SOP-0 / 30 LOC × 3。Tee 方案 dispatcher 单点 ~40 LOC，业务 CLI 0 改动，方向更对 |
| 2026-05-12 | Admin /admin/tasks 不实时 | **build-time 快照** + Discord 是实时端 | 客户端 5s 轮询 / Cloudflare worker / 本地 web server | 仓库 prod 是 Astro static · CF worker 读不到本地 `data/tasks/` · Discord thread 已是天然实时面板 · 真要本地活体 admin → P6 加 30 行 node http server (defer) |
| 2026-05-12 | catch-up `findByThreadId` 扫归档 | **`data/tasks/` + `_archive/` 都扫** | 只扫活动目录 | P3 E2E 测试发现的 bug：归档 task 后 forum thread 还活着 → 重启后 catch-up 当"未处理"重 route → 副本 task / 副本 batch metadata |
| 2026-05-12 | P5 entity→task 防爆 | **debounce** (任何 enrich pending/running 就跳过) | 每 entity 1 个 task | `pl:run-enrichment-batch` 一次跑处理所有 pending entities · 10 个 thin-contact 进来不需要 10 个 task · 一个 batch 跑就清 |
| 2026-05-12 | P5 错误处理 | **best-effort try/catch** + 可选 `SOP0_DEBUG=1` | throw 让 entity 写入失败 | SOP-0 是 SOP-1 下游 · 永远不该反向阻塞 entity merge |
| 2026-05-12 | P5 target_entity_key 不传 args | **`--skip-approval` only**，entity key 只记 metadata | `--limit 1 --entity-key X` 精确单 entity | batch CLI 设计为扫所有 pending；single-entity 模式会浪费 batch 设计意图 |
| 2026-05-12 | P6 admin 部署模型 | **B path · Cloudflare Tunnel + local HTTP API + live admin** | A path (build-time 静态) / G path (D1 镜像) | Matthew 偏好 live admin; CF Tunnel 一次设置永久 URL (tasks.profitslocal.com); 数据仍本地 (快); 无 cloud lock-in; "backup" 是独立工作 (Discord forum 已是 task 的 off-site trail) |
| 2026-05-12 | P6 auth 双 token 层 | **ADMIN_ACCESS_TOKEN (CF Pages middleware) + SOP0_API_AUTH_TOKEN (tunnel bearer)** | 单 token / CF Access dashboard 配置 | CF Pages 已有 middleware 现成 · CF Access API token 没权限 · 双层 token 即开即用 |
| 2026-05-12 | API 只读 | GET only · 写操作走 Discord (reactions) / Hermes dashboard | 全 CRUD | "写" 边界面更复杂、auth 要求更高、Discord/Hermes 已 cover 写路径 · YAGNI |
| 2026-05-12 | image-extract 任务 attachment 处理 | **TODO P6+** · 当前 listener 不下载 Discord 附件 | inline base64 / Cloudinary | Matthew 2026-05-12 self-test 时发图 → 路由对但 CLI 缺 args 退出 1 · 真实 gap · 单独 P6.X 工作 |
| 2026-05-12 | Retention 调度位置 | **launchd `StartCalendarInterval` 每天 03:00** | Hermes cron / dispatcher 内嵌 | 纯 fs 操作 · 不需 Hermes context · launchd 更可靠 · 与其他 SOP-0 daemon 同一管理面 |
| 2026-05-12 | Retention 默认 cutoff | **30 天** + `--days N` 覆盖 | 7 / 90 / 永不 | 30 天足够人肉回看常用窗口 · `_archive/YYYY-MM/` 仍可查 · 极端可以 `--days 365` 收紧 |
| 2026-05-12 | Reactions 不接现有 thread chat | **only `human`-tag + ✅/🗑** | 接所有 MessageCreate | SOP-0 是任务系统不是聊天 bot · 聊天交给 Hermes website-agent (其他 channel) · 避免无限循环 |
| 2026-05-12 | Thread-内对话不回复 | **故意** | bot 任意 reply | listener 只听 `ThreadCreate` · 现有 thread 评论 = 操作员自言自语 · 这是 feature 不是 bug |
| 2026-05-12 | SOP-0 v1.0 lock | **doc lock + 13/13 P 全 done** | 持续迭代不 lock | 主要功能稳定 · 5 daemon 跑通 · 进一步工作 (image attachment / cloud mirror) 进 TODO / v2 |
| 2026-05-12 | P6.X image 视觉提取放 listener | **listener 同步阻塞 ~10-60s vision** | dispatcher 端异步 / 中间专属 CLI | 用户已等 ollama route (~5s)，再加 vision 同一时段·避免 dispatcher 接到 task 后又"等条件" · 保持 dispatcher 简单 |
| 2026-05-12 | image-extract 失败转 human | **缺 businessName/niche/city → human tag** | retry / silent fail | operator 见 forum human tag 一秒决定·补字段 / 放弃·而不是看一堆 retry log |
| 2026-05-12 | v1.2 race-fix: prep 在 createTask **之前** | **prepImage → createTask → fs.watch (有序)** | prepImage → createTask 早写 → fs.watch 抢跑 → CLI 半空 args 失败 | 真实 bug · Matthew 2026-05-12 thread 1503742230933012550 发图，dispatcher 在 prep 完成前 spawn → exit=1 "Missing --image" |
| 2026-05-12 | v1.2 vision 多模型 fallback chain | **`qwen3.6:27b → gemma3:27b` field-merge** | 单一 qwen3.6:27b | Matthew 2026-05-12："所有文字识别都是一系列模型,前面解决不了按顺序 fallback" · 两个本地 vision 模型 field 互补 · 早停若 key fields 都有 |
| 2026-05-12 | v1.2 "received" 即时回帖 | **图任务 listener 先发📥 received 再开 vision** | vision 跑 30-60s 全程静默 | UX bug · 用户以为 bot 不响应 |
| 2026-05-12 | v1.2 admin nav "任务" tab | **AdminLayout `tasks` key 加入 nav 数组** | 只能直 URL 访问 / SOP tab 下 | operational view 该在 top nav · SOP tab 留给 reference docs |

---

## 9. 配置 / Env 总汇

| Env | 默认 | 含义 |
|---|---|---|
| `WEBSITE_TASKS_FORUM_CHANNEL_ID` | `1503702990761099419` | SOP-0 forum channel ID (.env.local) |
| `WEBSITE_TASKS_DISCORD_BOT_TOKEN` | (Handoff bot token) | Listener bot · MESSAGE_CONTENT intent enabled |
| `INTENT_ROUTER_OLLAMA_MODEL` | `qwen3.5:9b` | LLM router 模型，可换 `qwen3.6:27b` 等 |
| `INTENT_ROUTER_PAID_FALLBACK` | (empty) | `claude_cli,codex_cli` 等 · 显式 opt-in paid 才会触发 |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama API endpoint |
| `TEXT_PROVIDER` | (unset) | 强制单 provider，跳过 cascade |
| `SOP0_TASK_TIMEOUT_MS` | `300000` (5min) | 默认 task 超时 |
| `SOP0_DISPATCHER_TICK_MS` | `60000` | Cron safety tick 间隔 |
| `SOP0_STREAM_FLUSH_MS` | `5000` | Dispatcher tee 节流间隔（progress[] 写频率） |
| `SOP0_STREAM_FLUSH_BYTES` | `2048` | Dispatcher tee bytes 阈值（提前 flush） |
| `LISTENER_ALLOW_BOTS` | (unset) | `=1` 允许 bot-authored forum thread (仅 E2E smoke 用) |
| `SOP0_API_PORT` | `4040` | pl-task-api localhost 端口 |
| `SOP0_API_HOST` | `127.0.0.1` | pl-task-api bind 地址 (don't change unless 知道在干嘛) |
| `SOP0_API_AUTH_TOKEN` | (required) | Bearer token for tunnel API (32-byte base64url) |
| `PUBLIC_SOP0_API_TOKEN` | (= SOP0_API_AUTH_TOKEN) | Astro build-time embed for admin pages |
| `SOP0_API_ALLOWED_ORIGINS` | `https://profitslocal.com,https://tasks.profitslocal.com,http://localhost:4321` | CORS allowlist |
| `SOP0_IMAGE_VISION_CHAIN` | `qwen3.6:27b,gemma3:27b` | image-extract 多模型 fallback (逗号分隔，按顺序 try + field-merge) |
| `SOP0_IMAGE_VISION_MODEL` | (deprecated, use _CHAIN) | back-compat 单模型 override |
| `SOP0_IMAGE_VISION_TIMEOUT_MS` | `240000` (4min) | 每个 vision 模型调用超时 |

---

## 10. 跨 SOP 引用

- Entity schema → [SOP-X-Handoff](SOP_HANDOFF_CONTRACT.md)（task 只存 `target_entity_key`）
- `pl:pipeline-batch-step` / `pl:ingest-image` / `pl:run-enrichment-batch` → [SOP-1](SOP_1_INTAKE_DISCOVERY.md)
- `pl:run-audit-pipeline` → [SOP-2](SOP_2_LEAD_DISCOVERY_PIPELINE.md)
- `pl:dedup-*` → [SOP-X-Dedup](SOP_X_DEDUP.md)
- Discord 4-channel 架构 → [SOP overview §6](SOP_OVERVIEW.md#6-discord-4-channel-生命周期架构临时-owner--待-sop-x-discord-写完迁出)（待 SOP-X-Discord 接手）
- Hermes cron 运维 → [SOP-X-Tooling](SOP_X_TOOLING.md)（本 SOP own task-level 调度，不 own cron infra 本身）

---

## 11. 已知 TODO / 后续

- **kimi CLI 入 cascade**：等 kimi 出 non-interactive mode 或写 ACP client wrapper（独立 P）
- **Hermes api_server LLM endpoint**：调研 port 8642 为何不绑 + 怎么外部 HTTP 调用 · 通了之后加入 cascade
- **schemaVersion 升级协议**：参考 SOP-X-Handoff §6 + `places-quota-guard.js` v1→v2 模式
- **task retention 自动化**：>30 天 status=done/failed 的 archive 到 `data/tasks/_archive/YYYY-MM/`
- **task ↔ Hermes session ID 交叉链接**：cron-spawned task 怎么记录 Hermes session 来源
- **multi-stage chain**：CLI 跑完 optionally `createTask({next stage args})` — 已 precedent (`pl:pipeline-batch-step --finalize` calls `pl:dedup-audit`)
