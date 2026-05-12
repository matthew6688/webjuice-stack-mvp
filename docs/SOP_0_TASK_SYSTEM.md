# SOP-0 · Task System · 统一入口与调度

**版本**: v0.1-draft
**最近更新**: 2026-05-12
**配套页面**: [`/admin/scoring/sop-0-doc`](/admin/scoring/sop-0-doc) (本文档 viewer) · [`/admin/tasks`](/admin/tasks) (运行时 viewer · 待建 P7) · [`/admin/cron`](/admin/cron) (cron 管理 · 待建 P7+)
**Owner 范围**：所有 SOP 之"前"的统一入口 / 任务模型 / 调度协议。它不**做**业务（业务在 SOP-1..5），它**驱动**业务。

> Matthew 2026-05-12："这部分也是一个 SOP，因为它是我们所有东西的入口。"

---

## 0. 一句话

> Matthew 把活儿（一句话 / 图 / PDF / admin 表单）丢进 Discord `#website-tasks` → SOP-0 把它拆成 task → 自动落到对应 CLI（SOP-1 ingest / SOP-2 audit / ...）→ 进度 / 失败 / 结果 全部回写同一个 forum thread。**全自动 · 不 pull · 流水一样**。

---

## 1. 设计原则（不可妥协）

| # | 原则 | 不这么做的代价 |
|---|---|---|
| 1 | **全自动 push 模式**：任务到位即跑，不要"周期性 pull queue" | Matthew 等不及 / lag spike |
| 2 | **统一 Discord 入口**：1 个 channel · 文字 / 图 / PDF / 表单都走这里 | 4 channel 散开 → 没人知道在哪儿丢活儿 |
| 3 | **单一 task 模型**：所有任务统一 schema · 1 个 dispatcher | per-domain dispatcher 各跑各的 → 状态漂移 |
| 4 | **Discord ↔ admin 双向可见**：每 task = 1 forum thread；admin 同步 mirror | operator 在 Discord 看不到 admin 改了什么 → 信息断层 |
| 5 | **失败用 tag 标记，不另设队列**：`needs-human` tag = 队列 | 把失败放新 channel → 又一个看的地方 |
| 6 | **task = entity 的元信息**，**不是 entity 本身**：task 文件指向 entityKey，entity 还在 `data/leads/entities/` | task 重复存 entity → 同步漂移 |

---

## 2. Task 模型

### 2.1 文件

```
data/pipeline/tasks/<task-id>.json
```

`task-id` = `YYYYMMDD-HHMMSS-<6chars random>` (chrono sortable · 与 entity 解耦)

### 2.2 Schema

```json
{
  "task_id":     "20260512-200400-a1b2c3",
  "created_at":  "2026-05-12T20:04:00Z",
  "created_by":  { "platform": "discord", "user_id": "...", "channel": "#website-tasks" },
  "kind":        "intake" | "enrichment" | "audit" | "dedup" | "photos" | "image-extract" | ...,
  "input": {
    "type":        "text" | "image" | "pdf" | "form" | "entity-ref",
    "raw":         "Bluey's Fancy Restaurant New Farm",
    "attachments": ["https://cdn.discordapp.com/..." ],
    "entity_ref":  null
  },
  "target_entity_key": null,   // resolved 后填入；初次可空
  "target_cli":  "pl:pipeline-batch-step",  // dispatcher 路由结果
  "args":        ["--niche", "restaurant", "--city", "brisbane"],
  "status":      "pending" | "running" | "complete" | "failed" | "needs-human",
  "discord": {
    "thread_id":   "1503...",   // 该 task 自动开的 forum thread
    "tags":        ["intake", "running"]
  },
  "progress": [
    { "at": "...", "step": "router.resolved", "detail": "kind=intake" },
    { "at": "...", "step": "cli.spawned",     "detail": "pl:pipeline-batch-step" },
    { "at": "...", "step": "cli.complete",    "detail": "entity=place_chij..., 1 lead merged" }
  ],
  "result": {
    "entity_keys":   ["place_chij..."],
    "exit_code":     0,
    "duration_ms":   8421,
    "cost_usd":      0,
    "log_excerpt":   "..."
  },
  "error": null,
  "schemaVersion": 1
}
```

### 2.3 Status 状态机

```
pending  ──router 决策──▶  running  ──CLI exit 0──▶  complete
   │                          │
   │                          └──CLI exit ≠ 0──▶  failed
   │                                                │
   └──unrecognized input────────────────────────────┴──▶  needs-human
```

- `needs-human` = operator 在 Discord 用 reaction 或 admin 改 status 手动晋升
- 任何 status 变化 → 同步写到 Discord thread tag + admin progress 行

---

## 3. 入口路由（Router）

### 3.1 触发源

| 源 | 触发 | 谁监听 |
|---|---|---|
| Discord `#website-tasks` 新消息 (@website-agent + 内容) | MESSAGE_CREATE event | Hermes website-agent gateway → POST `pl:task-ingest` |
| Discord forum thread 评论（已有 task） | MESSAGE_CREATE event in known task thread | 同上 → append progress / re-trigger |
| Admin `/admin/tasks` 表单 | HTTP POST `/api/tasks` | Astro API endpoint → 写 task file |
| Hermes cron tick | 周期触发（autoresearch / health-check / etc.） | dispatcher 直接 spawn task w/ kind=cron |

### 3.2 输入类型识别

```
text + 含 URL                → kind=image-extract OR intake (LLM 判一下)
text 纯文字                  → kind=intake (默认)
attachment image/*           → kind=image-extract
attachment pdf               → kind=pdf-ingest (待建)
text 含 entityKey 关键字     → kind=audit | enrichment | photos (LLM 判)
text 含 'health' | 'cron'    → kind=ops (低优)
```

LLM router 用 cheap claude haiku，prompt 限 200 tokens。**失败 → tag `needs-human`**。

### 3.3 CLI 路由表

| kind | target_cli | 备注 |
|---|---|---|
| `intake` | `pl:pipeline-batch-step` | SOP-1 主入口 |
| `enrichment` | `pl:run-enrichment-batch` | SOP-1 step 3，需 entity_ref |
| `image-extract` | `pl:ingest-image` | SOP-1 §2.1 |
| `audit` | `pl:run-audit-pipeline` | SOP-2 |
| `dedup` | `pl:dedup-audit` 或 `pl:dedup-merge` | SOP-X-Dedup |
| `photos` | `pl:download-places-photos` + `pl:places-enrich` | G-13 |
| `cron` | （pre-resolved） | Hermes cron 直接 spawn |

---

## 4. Dispatcher（Hermes cron 驱动）

### 4.1 主 tick (60s)

```
1. scan data/pipeline/tasks/*.json where status='pending'
2. for each task:
     a. resolve target_cli (run router if not set)
     b. spawn subprocess with args
     c. set status='running' · pipe stdout to progress[] · pipe to Discord thread
     d. on exit: update status + result + tags
3. scan stale tasks (status='running' > 30 min) → mark needs-human
```

### 4.2 Entity-driven auto-dispatch (Phase 3+)

```
1. scan data/leads/entities/*.json
2. filter entities where enrichment_status='pending' AND no active task
3. for each: synthesize task { kind: 'enrichment', target_entity_key: ... }
4. enqueue (status='pending') → 主 tick 接手
```

→ Matthew 的"流水一样"：entity 进 store → 自动生成 enrichment task → 自动跑 → 自动写 contact_identity → 自动 graduate 到 SOP-2 → ...

### 4.3 注册到 Hermes cron

```bash
hermes cron create "every 60s" "node scripts/cli/pl-task-dispatcher.js tick"
hermes cron create "every 5m"  "node scripts/cli/pl-task-dispatcher.js entity-scan"
```

Cron 列表在 `~/.hermes/cron/jobs.json`。`/admin/cron` 提供 web 视图 + create / pause / delete（P7+）。

---

## 5. Discord ↔ Admin 双轨

### 5.1 每 task → 1 forum thread

- Task 创建时：在 `#website-tasks` 自动开 forum thread，标题 = 第一行 input
- 状态变化 → tag 同步 (`pending` / `running` / `complete` / `failed` / `needs-human`)
- progress 每条 → thread reply (节流：≥ 5s 间隔 或 ≥ 1 个有意义事件)
- Result entity → thread pin 一条 deeplink `/admin/v2-leads/<entityKey>`

### 5.2 Admin `/admin/tasks` (P7)

- 列表：所有 task · filter by status / kind / age
- 详情：schema 全展 + progress timeline + Discord thread 链接 + 重跑按钮
- 表单：创建 task（手动模式，给 Discord 不在身边时用）

### 5.3 Admin `/admin/cron` (P7+)

- 列出 `~/.hermes/cron/jobs.json` 全部
- 表单：create / pause / resume / delete
- 状态：每 job 最近 N 次 run 的 exit code + 时间

---

## 6. 失败处理（tag-based · 不另设仓库）

```
CLI exit != 0          → status='failed'   · tag 'failed'   · thread reply 错误摘要
LLM router 没辙        → status='needs-human' · tag 'needs-human'
stuck (running > 30m)  → status='needs-human' · tag 'stale'
```

Matthew 在 Discord thread 看到 `needs-human` tag → 一个 reaction (✅) 表示"我看过了，重跑"或 (🗑) 表示"放弃"。dispatcher 监听 reaction → 改 status。

**不另开 `#failures` channel**。失败堆在原 thread，靠 tag filter 看（forum view "tag = needs-human"）。

---

## 7. 阶段化交付（P1-P8）

| P | 范围 | 估时 | 信心 |
|---|---|---|---|
| **P1** | 本文档 + ownership registry §1.X 提为 §1.0 + admin sop-0-doc 页 | 2h | 95% |
| P2 | Task 模型（schema + 文件 IO + status 状态机） | 4-5h | 90% |
| P3 | Dispatcher CLI + Hermes cron 注册 | 5-6h | 85% |
| P4 | 2 个现有 CLI 加 `--entity-key` mode（unify entry） | 2h | 95% |
| P5 | Discord inbound listener（website-agent hook） | 5-8h | 70% |
| P6 | 附件下载 + 路由（image / PDF → Cloudinary） | 2-3h | 80% |
| P7 | `/admin/tasks` viewer + `/admin/cron` viewer / setter | 3-4h | 90% |
| P8 | E2E smoke + Discord progress polish | 2-3h | 85% |

总计 ~25-31h。Matthew 已批准走 A/B/A 三个架构 Q。

---

## 8. 跨 SOP 引用

- Entity schema → 见 [SOP-X-Handoff](SOP_HANDOFF_CONTRACT.md)（task 只存 `target_entity_key`，不存 entity 字段）
- `pl:pipeline-batch-step` / `pl:ingest-image` / `pl:run-enrichment-batch` → 见 [SOP-1](SOP_1_INTAKE_DISCOVERY.md)
- `pl:run-audit-pipeline` → 见 [SOP-2](SOP_2_LEAD_DISCOVERY_PIPELINE.md)
- `pl:dedup-*` → 见 [SOP-X-Dedup](SOP_X_DEDUP.md)
- Discord 4-channel 架构 → 见 [SOP overview §6](SOP_OVERVIEW.md#6-discord-4-channel-生命周期架构临时-owner--待-sop-x-discord-写完迁出) (待 SOP-X-Discord 接手)
- Hermes cron 运维（健康 / 监控） → 见 [SOP-X-Tooling](SOP_X_TOOLING.md)（本 SOP 只 own task-level 调度，不 own cron infra 本身）

---

## 9. TODO

- [ ] **P1**：本文档 v0.1 + registry + admin viewer 页 — *正在做*
- [ ] **P2**：task schema 落地 · `core/tasks/task-store.js` + JSON IO
- [ ] **P3**：dispatcher CLI + cron 注册
- [ ] **P4-P8**：依次
- [ ] schemaVersion 升级协议（参考 SOP-X-Handoff §6）
- [ ] task retention 策略（complete > 30 天归档到 `data/pipeline/tasks/archive/YYYY-MM/`）
- [ ] task 命名一致性（vs Hermes 自己的 session ID — 两个不冲突，但 cross-link 怎么记）
