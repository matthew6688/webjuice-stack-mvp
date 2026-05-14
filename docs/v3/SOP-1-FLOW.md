# SOP-1 · Discord → master.md 全链路运转文档

> **作用域**: 从 Matthew 在 Discord 发命令开始，到 `clients/<slug>/v2/master.md` 落盘结束。
> **不在范围**: master.md 之后的 audit (M2 · SOP-2) · 网站生成 (M3 · SOP-3)。
> **owner**: M1 PRD owns intake mechanics · 本 doc 是 Operator-facing runbook (节点 / 汇报格式 / 日志位置)。
> **status**: 当前生产实装 · 2026-05-14 verified live 5/5 doctor green。

---

## 0. TL;DR · 1 屏看懂

```
Discord forum thread
        │
        ▼
Listener daemon (ai.profitslocal.task-listener)
        │
        ▼
intent-router cascade: codex_cli → claude_cli → ollama → regex
        │
        ▼
createTask → data/tasks/<id>.json (status=pending)
        │
        ▼ (fs.watch · sub-second)
v3 Dispatcher daemon (ai.profitslocal.v3.task-dispatcher)
        │
        ▼
spawn `pl:places-search-intake` (or 3 路其他 CLI)
        │
        ▼
core/leads/discovery-store · upsertDiscoveryRun
   ├─ 8-key dedup
   ├─ write data/leads/entities/<key>.json
   └─ enqueueMasterMdRefresh (新 ops task)
        │
        ▼ (fs.watch 二次触发)
Dispatcher spawn `leads:build-master-md --entity-key X`
        │
        ▼
write clients/<slug>/v2/master.md (三章 skeleton)
        │
        ▼
renderDoneMessage → Discord reply (中文 humanized · 含 admin URL)
```

**端到端**: 10 商家 ~2-3 分钟 · 5 fresh 进入 audit 队列。

---

## 1. 入口 · Discord Forum

**频道**: `#website-tasks` (private forum channel)
**触发**: 任何人在该 forum 新开 thread · 第一条 message 内容即任务文本。

支持输入风格：

| 风格 | 示例 | 路由结果 (kind) |
|---|---|---|
| 自然语言 (en) | `find brisbane plumbers` | `intake` |
| 自然语言 (zh) | `搜索 sydney 屋顶公司` | `intake` |
| 显式 places | `places search "roofer brisbane"` | `places-intake` |
| 多 query 批 | `places: "roofer brisbane" "roofer sydney"` | `places-intake` (multi --query) |
| 单店补全 (phone) | `enrich +61 7 1234 5678` | `single-enrich` |
| 单店补全 (Maps URL) | `https://maps.app.goo.gl/...` | `single-enrich` |
| 名片图 | thread attachment + 任意文字 | `image-extract` |
| Audit 触发 | `audit place_chij...` | `audit` (SOP-2 入口) |

不支持 / 转人工：内容无法分类 → `kind=ops` + thread 打 `human` tag · 等 ✅ reaction 重试。

---

## 2. Listener daemon

**进程**: `ai.profitslocal.task-listener` (launchd · KeepAlive)
**源文件**: `scripts/cli/pl-task-listener.js`
**WorkingDirectory**: main worktree (`/Users/matthew/Developer/google-map-website`)
**日志**: `data/tasks/_logs/task-listener.log`

### 2.1 监听事件

| 事件 | 触发条件 | 动作 |
|---|---|---|
| `ThreadCreate` | 新 forum thread | 主路径 · 见下 |
| `MessageReactionAdd` | `human`-tagged thread 收到 ✅ / 🗑 | ✅ → 重新 routeIntent 重试 · 🗑 → status=archived |

### 2.2 ThreadCreate 主路径

1. `fetchStarterMessage()` 拿 thread 第一条 text + attachments
2. 跳过 bot-authored thread（防自循环 · `LISTENER_ALLOW_BOTS=1` 可覆盖）
3. 图片任务：先发 "📥 已收到 · OCR 启动中..." 占位（vision 慢 · 防客户等沉默）
4. 调 `routeIntent({ text, attachments })`
5. (image-extract only) 在 createTask **前** 跑 `prepareImageTask` · 防 dispatcher race
6. `createTask()` 落盘
7. `patchThreadTags()` 把 thread 打 `[<kind>, pending|human]` tag
8. `postThreadReply(renderTaskCreatedMessage)` 发 "已收到" 即时反馈

---

## 3. intent-router · 路由级联 (D27)

**位置**: `core/tasks/intent-router.js`
**默认级联**: `codex_cli → claude_cli → ollama → regex`
**Env 覆盖**: `INTENT_ROUTER_CASCADE=ollama,regex` (例)

| Provider | 工作方式 | 单次成本 | 角色 |
|---|---|---|---|
| `codex_cli` | OpenAI CLI 子进程 · JSON 结构化 prompt | $0.01-0.05 | 准确率最高 · paid-first |
| `claude_cli` | Claude CLI 子进程 | $0.01-0.05 | codex 失败兜底 |
| `ollama` | 本地 qwen3.5 · `/no_think` | $0 | T0 fallback · 永久免费 |
| `regex` | NICHE_KEYWORDS + CITY_KEYWORDS 词表 | $0 | **最后保底** · doctor #5 必须永远绿 |

### 3.1 输出 schema (route result)

```js
{
  kind:              'places-intake' | 'intake' | 'single-enrich' | 'image-extract' | 'audit' | 'ops',
  target_cli:        'pl:places-search-intake' | 'pl:pipeline-batch-start' | ...,
  args:              ['--query', 'roofer brisbane'],    // array of --flag value pairs
  target_entity_key: null | 'place_chij...',
  confidence:        0.85,
  provider:          'codex_cli' | 'claude_cli' | 'ollama' | 'regex',
  reasoning:         'codex_cli/llm-parse',
}
```

`normalizeArgsForKind()` 在 LLM 返回后兜底填 niche/city（防 LLM 漏字段 · D27 Bug A 修复）。

### 3.2 cascade 失败语义

- 任一 provider throw → 试下一个
- 所有 LLM 都失败 → regex 必兜（确保不静默 drop）
- regex 也 0 信心 → `kind=ops` + `target_cli=null` → status=human · 转人工

---

## 4. Task store

**位置**: `core/tasks/task-store.js`
**路径**: `data/tasks/<YYYYMMDD-HHMMSS-xxxxxx>.json`
**CWD-bound** (重要 · D30 per-worktree dispatcher 的根因)

### 4.1 Task JSON schema

```json
{
  "task_id":       "20260514-073812-abc123",
  "kind":          "places-intake",
  "status":        "pending",
  "created_at":    "2026-05-14T07:38:12Z",
  "updated_at":    "2026-05-14T07:38:12Z",
  "source":        {
    "platform":   "discord",
    "thread_id":  "1234567890",
    "author":     "matthew",
    "message_id": "9876543210"
  },
  "input":         { "text": "places search 'roofer brisbane'", "attachments": [] },
  "target":        {
    "cli":               "pl:places-search-intake",
    "args":              ["--query", "roofer brisbane"],
    "target_entity_key": null
  },
  "progress":      [
    { "ts": "...", "stage": "router.resolved",
      "msg": "kind=places-intake provider=codex_cli cli=pl:places-search-intake conf=0.85" }
  ]
}
```

### 4.2 Status 状态机

```
pending → running → done
               ↘
                 failed
               ↘
                 timeout → human
               ↘
                 human → (✅ reaction) → pending
                       ↘ (🗑 reaction) → archived
```

---

## 5. Dispatcher daemon

**进程**: v3 worktree → `ai.profitslocal.v3.task-dispatcher` (D30 · 新增)
**源文件**: `scripts/cli/pl-task-dispatcher.js`
**WorkingDirectory**: `/Users/matthew/Developer/google-map-website-v3`
**日志**: `data/tasks/_logs/v3-dispatcher.log` + `.error.log`

### 5.1 触发机制

- 主路径: `fs.watch('data/tasks/')` · sub-second pickup
- 兜底: `setInterval(60s)` 全扫 · 防 fs.watch 漏 event

### 5.2 spawn 规则

| 项 | 值 |
|---|---|
| 工作目录 | dispatcher 自身 cwd |
| Timeout | 240s (4 min · 长 audit 用 `--timeout-ms` 覆盖) |
| 日志缓存 | stdout/stderr 各保留最后 ~1200 char (tail) |
| 退出处理 | 见 §5.3 |

### 5.3 退出处理 → Discord 回报

| exit | 动作 | Discord 消息 |
|---|---|---|
| 0 | status=done | `renderDoneMessage` (✅ + duration + 业务摘要 + 技术细节折叠) |
| 非 0 | status=failed | `renderFailedMessage` (❌ + `humanize.explainFailure` 中文翻译) |
| timeout | status=timeout → human | `renderTimeoutMessage` (⏳ + 转人工 + reaction 操作提示) |

---

## 6. 4 路 intake CLI (M1 出口)

每条 CLI 都是独立子进程 · 共享同一 entity store + master.md hook。

| Kind | CLI | 用途 | 成本 | 速度 |
|---|---|---|---|---|
| `intake` | `pl:pipeline-batch-start` | docker scrape (gosom) batch | T0 free | 30-60s/batch |
| `places-intake` | `pl:places-search-intake` | Google Places API 官方 | ~$0.017/商家 | 60-180s/10 商家 |
| `single-enrich` | `pl:single-enrich` | 单店补全 (phone/URL → 全字段) | $0.005-0.02 | 10-30s |
| `image-extract` | `pl:ingest-image` | 名片图 vision OCR + extract | ~$0.005/图 | 20-70s |

doctor check #2 (Docker) + #3 (`GOOGLE_PLACES_API_KEY`) 守这层。

---

## 7. Discovery store · 持久化 + master.md trigger

**位置**: `core/leads/discovery-store.js#upsertDiscoveryRun`
**同步顺序**:

1. **8-key 评分判重** (`dedup-scorer` · phone / domain / name / coords / place_id / website / business-hours / address)
   - 得分 ≥60 → 自动 merge 到 canonical entity
   - 30-60 → LLM judge (codex/claude)
   - <30 → 新建 entity
2. **写 entity JSON** → `data/leads/entities/<key>.json`
3. **append events** → `data/leads/discovery-events.jsonl`
4. **update index** → `data/leads/discovery-index.json`
5. **fire-and-forget** `enqueueMasterMdRefreshBatch(entityKeys, { reason: 'intake' })`
   - 内部去重: 同 entityKey 已有 pending/running build-master-md task → 跳过
   - 失败不反向阻塞 SOP-1 主路径

### 7.1 Entity JSON 关键字段

```json
{
  "key":         "place_chij...",
  "kind":        "places",
  "latest": {
    "name":      "Brisbane Roof Restoration Experts",
    "phone":     "+61 7 ...",
    "address":   { "street": "...", "suburb": "...", "state": "QLD", "postcode": "..." },
    "place_id":  "ChIJ...",
    "website":   "https://...",
    "rating":    4.8,
    "review_count": 47,
    "hours":     [{"day":1,"open":"08:00","close":"17:00"}, ...],
    "photos":    [{"photo_reference":"...","width":1920,"height":1080}, ...]
  },
  "scoring": {
    "discoveryScore": 78,
    "signals":        { "has_website": true, "has_phone": true, ... }
  },
  "phase":   "AWAITING_AUDIT",
  "history": [ { "ts": "...", "event": "places-intake", "source": "pl:places-search-intake" } ]
}
```

---

## 8. build-master-md · M1 最终产出

**触发**: 由 `enqueueMasterMdRefresh` 写出第二个 task → dispatcher 接 → spawn `scripts/leads/build-master-md.js --entity-key X`
**位置**: `core/reports/master-md-builder.js` (实际渲染逻辑)
**单 entity 耗时**: 0.2-2s

### 8.1 三章 skeleton (M1 出口 · 22 章满版在 M2 完成)

```markdown
---
slug:        brisbane-roof-restoration-experts
entityKey:   place_chij...
sources:     [places]
phase:       AWAITING_AUDIT
created:     2026-05-14T07:38:14Z
---

# Brisbane Roof Restoration Experts

## 一、商家基本信息
- 名称: ...
- 联系: ...
- 地址: ...
- 营业时间: ...
- 评分 / 评论数: ...

## 二、现状网站审计
(待 M2 audit pipeline 填)

## 三、改造建议
(待 M2 audit + M3 design 填)
```

### 8.2 落盘位置

```
clients/<slug>/v2/master.md      # 唯一最终产出
```

Slug 派生规则: `latest.name` toLowerCase + 非字母数字替 `-` + 去前后 `-` + slice(0, 80)。

---

## 9. Discord 回报 · 格式样本

### 9.1 任务创建 (`renderTaskCreatedMessage`)

```
🔎 **Places 官方搜索** · 已收到
· 在做: 通过 Google Places API 搜索 → `pl:places-search-intake`
· 参数: `--query roofer brisbane`
· 预计 1-3 分钟出结果 · 完了我会回这里告诉你

_技术细节: task=20260514-073812-abc123 · kind=places-intake · routed-by=codex_cli_
```

### 9.2 完成 (`renderDoneMessage`)

```
✅ **Places 官方搜索** · 完成 · 用时 142.3s
· 找到 18 个客户 · 看清单: https://admin.profitslocal.com/discovery
· 后续: 5 个新客户 master.md 已建 → 进入 audit 队列

<details><summary>技术细节</summary>

[pl:places-search-intake] query="roofer brisbane"
[places] found 18 results · 5 fresh · 13 dedup-merged
[discovery] enqueueMasterMdRefreshBatch · 5 entities
[done] exit=0 · duration=142.3s
</details>
```

### 9.3 失败 (`renderFailedMessage`)

`humanize.js#explainFailure` 把 stderr 翻译成 friendly 中文：

```
❌ **Places 官方搜索** · 失败
· 原因: Google API key 月度配额用完 · 检查 GOOGLE_PLACES_API_KEY_2 后备 key
· 详情: https://admin.profitslocal.com/tasks/...
```

常见 friendly 映射：
| stderr 关键字 | friendly |
|---|---|
| `--niche required` | "router 漏了 niche · 检查 intent-router NICHE_KEYWORDS" |
| `--city required` | "router 漏了 city · 检查 intent-router CITY_KEYWORDS" |
| `GOOGLE_PLACES_API_KEY missing` | "Google API key 未配置 · 检查 .env.local" |
| `quota`/`429` | "API 月度配额用完 · 等下月 1 号 / 加 backup key" |
| `ENOTFOUND` | "网络不通 / DNS 失败 · 检查代理" |
| `docker daemon` | "Docker 没启 · `open -a Docker`" |

### 9.4 超时 (`renderTimeoutMessage`)

```
⏳ **Places 官方搜索** · 超时 · 跑了 240s 后被终止
· 已转人工 · 看 https://admin.profitslocal.com/tasks/... 决定 ✅ 重试 / 🗑 放弃
```

---

## 10. Hermes agent · 平行入口（不经 Discord）

**位置**: `~/.hermes/profiles/marketer/skills/b2b-marketing/profitslocal-website-intake/SKILL.md`
**用途**: Matthew 跟他的 personal Hermes agent 直接对话 · Hermes 加载这个 skill · 直接调 CLI · **不依赖 Discord/listener**。

### 10.1 触发样例

```
Matthew → Hermes: "帮我入库 brisbane 屋顶公司"
Hermes (loaded SKILL): npm run pl:places-search-intake -- "roofer brisbane" --limit 10
```

### 10.2 和 Discord 路径关系

| 项 | Discord 路径 | Hermes 路径 |
|---|---|---|
| 触发 | forum thread | 直接对话 |
| 路由 | intent-router cascade | Hermes 自己理解 + skill 指南 |
| 任务文件 | 写 data/tasks/ | 不写 (直接 stdout) |
| 适用 | 团队 / 外部入口 | Matthew 个人快速测 |
| 共享 | 同 CLI + 同 entity store + 同 master.md hook | 同上 |

---

## 11. 全部 asset 清单 · master.md 之前 / 网站之前

```
data/
├── tasks/<taskId>.json                  # 2 个 task (intake + build-master-md)
├── tasks/_logs/v3-dispatcher.log        # done/failed 一行记录
├── leads/entities/<key>.json            # entity 实体 (评分 + 联系 + photos refs)
├── leads/discovery-events.jsonl         # append-only 事件日志
├── leads/discovery-index.json           # entity 索引
├── leads/dedup-decisions.json           # 自动合并记录
├── leads/queues/cheap-site-audit.json   # 进 audit 队列等 M2
├── finance/ledger.jsonl                 # 成本 ledger (Places API cost 一行)
└── finance/places-quota.json            # API quota 用量统计

clients/<slug>/v2/
└── master.md                            # 唯一最终产出 · ~20KB · 三章 skeleton
```

**master.md 之后 + 网站之前**的 asset (screenshots / evidence / video / internal-audit / customer-audit) 属于 M2 / M3 → 见 SOP-2-FLOW.md / SOP-3-FLOW.md。

---

## 12. 关键时序数字 · 真实测试 (D29 5/5 doctor green)

| 阶段 | 耗时 |
|---|---|
| Discord ThreadCreate → listener routeIntent | < 1s |
| routeIntent (codex_cli LLM) | 5-15s |
| createTask + patchTags + first reply | < 2s |
| dispatcher fs.watch pickup | < 1s |
| `pl:places-search-intake` 跑 Places API (10 商家) | 60-180s |
| `enqueueMasterMdRefresh` 排队 | < 0.1s |
| `leads:build-master-md` 单 entity | 0.2-2s |
| renderDoneMessage 发回 Discord | < 1s |
| **总端到端 (10 商家 · 5 fresh)** | **~2-3 min** |

---

## 13. 健康检查 (`pl:intake-doctor`)

详见 M1-PRD §8。本 doc 中需知 doctor 5 个 check 与 SOP-1 节点的对应：

| Doctor check | 守哪一节点 |
|---|---|
| #1 entities/ 24h 新文件 | §7 discovery-store 写盘活着 |
| #2 Docker scraper HTTP 200 | §6 `intake` 路径 (gosom) |
| #3 `GOOGLE_PLACES_API_KEY` | §6 `places-intake` + `single-enrich` |
| #4 build-master-md 积压 < 10 | §5 dispatcher + §8 build-master-md 在消化 |
| #5 regex router niche+city OK | §3 cascade 末端保底 |

Daily cron: `ai.profitslocal.intake-doctor-daily` · 09:00 · JSON 输出 → `data/heartbeats/intake-doctor-daily.log`。
Heartbeat: `data/heartbeats/intake-doctor.txt` (dead-man · mtime < 25h)。

---

## 14. 故障 runbook

| 现象 | 诊断命令 | 修复 |
|---|---|---|
| Discord 没反应 | `launchctl list \| grep task-listener` | `launchctl kickstart -k gui/$UID/ai.profitslocal.task-listener` |
| 任务 stuck pending | `npm run pl:intake-doctor` (check #4) | 检查 v3-dispatcher 是否跑 (`grep v3.task-dispatcher`) |
| 路由错 (niche/city 漏) | 看 task progress `router.resolved` 字段 | 检查 intent-router NICHE/CITY_KEYWORDS · paid CLI 是否在 cascade 内 |
| `--niche required` 失败 | task 文件 args 看是否真漏 | 升级 cascade env: `INTENT_ROUTER_CASCADE=codex_cli,claude_cli,ollama,regex` |
| Places API 配额 | doctor check #3 | 加 `GOOGLE_PLACES_API_KEY_2` backup |
| Docker 容器停 | doctor check #2 | `pl:scrape-docker` 已内置 auto-recover (Bug D · 容器停自动 start) |
| master.md 没生成 | `ls clients/<slug>/v2/master.md` | dispatcher 是否积压 → 同 §5 修 |

---

## 15. 相关文档

- [M1-PRD.md](./M1-PRD.md) — M1 模块 PRD · §8 Health Check
- [DECISIONS-LOG.md](./DECISIONS-LOG.md) — D27 cascade · D29 doctor · D30 per-worktree dispatcher
- [SOP-DISCORD-HERMES-FLOW.md](./SOP-DISCORD-HERMES-FLOW.md) — Discord ↔ Hermes 协同设计
- [CUSTOMER-FOLDER-STRUCTURE.md](./CUSTOMER-FOLDER-STRUCTURE.md) — `clients/<slug>/v2/` 全文件清单
- [SOP-2-FLOW.md](./SOP-2-FLOW.md) — audit pipeline (M2) · ⚠️ 待写
- [SOP-3-FLOW.md](./SOP-3-FLOW.md) — publish pipeline (M3) · ⚠️ 待写
