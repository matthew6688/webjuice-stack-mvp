# SOP-0 · Task System · 统一入口与调度

**版本**: v0.3 (P0-P2 全部完成 · dispatcher P3 在做)
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
| `intake` | `pl:pipeline-batch-step` | SOP-1 主入口 |
| `enrich` | `pl:run-enrichment-batch` | SOP-1 step 3，需 entity_ref |
| `audit` | `pl:run-audit-pipeline` | SOP-2 |
| `dedup` | `pl:dedup-audit` 或 `pl:dedup-merge` | SOP-X-Dedup |
| `photos` | `pl:download-places-photos` + `pl:places-enrich` | G-13 |
| `image-extract` | `pl:ingest-image` | SOP-1 §2.1 |
| `ops` | (varies / null) | health-check / cron / admin |

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

### 4.4 Entity-driven auto-dispatch (P5)

```
data/leads/entities/*.json 写入 (mergeLeadIntoEntity)
  → if enrichment_status='pending'
  → 直接调 createTask({ kind:'enrich', target_entity_key: ... })
  → fs.watch → dispatcher → ...
```

**Push-based · 不 scan entity store**（之前 v0.1 设计有 scan，废弃）。

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
| **P3** | `pl-task-dispatcher.js` (fs.watch + cron + flock) | ⏳ | 92% |
| **P4** | 3 CLI 加 `--task-id` (intake / enrich / audit) + shared `appendProgress` helper | ⏳ | 95% |
| **P5** | `discovery-store.js` createTask on thin-contact | ⏳ | 95% |
| **P6** | `/admin/tasks` + `/admin/cron` 页面 | ⏳ | 88% |
| **P7** | E2E smoke 3 路 + retention archive (>30d → `data/tasks/_archive/YYYY-MM/`) | ⏳ | 85% |
| **P8** | 老 `core/discord-tasks/` archive + 9 caller scripts 清理 + doc v0.3 锁定 | ⏳ | 92% |

完成 7/12 (P0-P2) · 剩 ~10h (P3-P8)。

### 7.1 Deploy / 运维（listener daemon · P2.4）

```bash
# 安装 (一次)
cp scripts/cli/pl-task-listener.launchd.plist ~/Library/LaunchAgents/ai.profitslocal.task-listener.plist
launchctl bootstrap gui/$UID ~/Library/LaunchAgents/ai.profitslocal.task-listener.plist

# 状态
launchctl list | grep profitslocal
tail -f data/tasks/_logs/task-listener.log

# 重启 (pick up code changes)
launchctl kickstart -k gui/$UID/ai.profitslocal.task-listener

# 停 / 卸载
launchctl bootout gui/$UID/ai.profitslocal.task-listener

# 前台调试 (foreground)
npm run pl:task-listener
# 或允许 bot-authored thread (E2E smoke):
LISTENER_ALLOW_BOTS=1 npm run pl:task-listener
```

Logs:
- stdout: `data/tasks/_logs/task-listener.log`
- stderr: `data/tasks/_logs/task-listener.error.log`

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
| 2026-05-12 | 旧 `core/discord-tasks/` | **P8 archive 整 dir** | 渐进迁移 | 9 callers 都是 test/setup，迁完直接归档 |
| 2026-05-12 | 历史 2 task 迁移 | **不迁** | 写迁移脚本 | 价值低；新系统从空开始 |
| 2026-05-12 | Discord client lib | **discord.js v14.26.4** | eris / raw WS | 32K star · 维护活跃 · forum + reactions 都原生 · ESM 友好 |
| 2026-05-12 | Listener daemon | **launchd KeepAlive** | systemd / pm2 / nohup | macOS native · 与 Hermes plist 模式一致 · 崩了自动重启 · `launchctl kickstart -k` 一行重启 |
| 2026-05-12 | Bot-authored thread | **skip by default** + `LISTENER_ALLOW_BOTS=1` smoke flag | 永远 process | 防 listener 自己发的 reply 二次触发自身 = 无限循环 |
| 2026-05-12 | Listener log path | **`data/tasks/_logs/task-listener.{log,error.log}`** | `~/.profitslocal/logs/` | 与 task 数据一起 → 一处看完整链路 |

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
