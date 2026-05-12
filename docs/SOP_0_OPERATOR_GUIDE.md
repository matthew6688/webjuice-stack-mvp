# SOP-0 Operator Guide · 怎么用

**版本**: 配套 SOP-0 v1.2 · 2026-05-12
**目标读者**: Matthew + 未来协作者
**配套文档**: [`SOP_0_TASK_SYSTEM.md`](SOP_0_TASK_SYSTEM.md) (架构 + 决定 log)

---

## 0. 一句话

任何活儿丢进 Discord forum `#website-tasks`（手机 / 桌面都行）→ 系统自动路由 → 自动跑 → 结果回帖。

---

## 1. 三个面板

| 面板 | 看啥 | URL / 入口 |
|---|---|---|
| **Discord forum** (live ops) | 任务实时进度 · 状态 tag · CLI 输出 | Discord `#website-tasks` |
| **Admin `/admin/tasks`** (cross-device) | 任务历史 · filter · 详情 | `https://profitslocal.com/admin/tasks?token=<ADMIN_ACCESS_TOKEN>` |
| **Discord thread** (single task) | 该 task 全过程消息 · ✅/🗑 reaction 重跑/放弃 | 点 forum 任一 thread |

Admin 全设备能访问，本地 / 出差都行（tasks.profitslocal.com 由 Cloudflare Tunnel 提供）。

---

## 2. 7 个 task kind 怎么触发

每个 kind 都是在 `#website-tasks` 新开 forum thread。listener 自动路由。

### 2.1 `intake` · 批量找客户

```
新开 thread → 写："find brisbane roofers"
             或："谷歌搜索 melbourne 餐厅"
             或："我想搜 roofing 的客户，墨尔本"
```

自动跑 `pl:pipeline-batch-start --niche roofer --city melbourne`。结果是个新的 batch 在 `#lead-discovery-runs` channel 开 thread 跑 stage 0。

### 2.2 `audit` · 审计一个已有 entity

```
"audit place_chij..."  ← 把 entityKey 贴上
"run audit on this lead: place_chij..."
```

跑 `leads:run-pipeline --entity-key <key>` — Playwright + 6 维 39 规则 + visual + grade。

### 2.3 `enrich` · 补全联系方式

通常**自动触发**（thin-contact entity 进库时 SOP-0 push）。手动也行：

```
"enrich pending leads"
"补一下还缺电话的客户"
```

### 2.4 `dedup` · 去重检查

```
"dedup check"
"清理重复"
```

跑 `pl:dedup-audit` → 写 `data/leads/dedup-review-queue.json` → 你去 `/admin/v2-leads/dedup-review` 决策。

### 2.5 `photos` · 下载商家照片

```
"download photos for place_chij..."
```

跑 `pl:download-places-photos` → 落 Cloudinary。$0.007/photo (Places Photos API)。

### 2.6 `image-extract` · 图片识别商家

```
新 thread → 附一张照片（名片 / 招牌 / GBP 截图）+ 一句话："这是个新客户"
```

**Listener 立刻发 "📥 Received, OCR/extract starting..."**
然后 vision LLM 提取 JSON: `{businessName, niche, city, phone, address, website, category}`
默认走 **fallback chain**：`qwen3.6:27b` → `gemma3:27b`（field-by-field 合并）
完成发 "🔍 OCR/extract done · X · niche/city"
然后 dispatcher 跑 `pl:ingest-image` 落 entity。

**字段缺关键 (businessName / niche / city) → 自动 `human` tag**，你点 ✅ 重跑或 🗑 放弃。

### 2.7 `ops` · 系统维护

```
"run health check"
"check disk usage"
"健康检查"
```

跑 `ops:health-check` 类 admin 任务。

---

## 3. 状态机 + Tag

```
pending  ──claim──▶  running  ──exit=0──▶  done   (✓ 绿)
   │                    │                            
   │                    ├──exit≠0──▶  failed (✗ 红)
   │                    └──>30min──▶  human  (⚠ 黄)
   │
   └──unknown───────────────────▶  human

human ──你 ✅──▶ pending  (重跑)
human ──你 🗑──▶ done    (放弃)
```

Discord forum tag 实时反映状态。点 forum view 顶部"filter by tag"可以筛 "所有 human" / "所有 running" / etc.

---

## 4. 怎么验证 task 正常运行

### 4.1 看 Discord thread

每个 task 在它自己的 forum thread 里至少有 2 条 bot 消息：
- `Task created <id>` (起手)
- `✓ task done in X.Xs` (结束) 带 CLI stdout 尾

中间长任务可能有多条 `cli.stream` 中间报告（图任务则有 OCR 进度）。

### 4.2 看 `/admin/tasks`

filter by status=running / failed / human。点 task_id 看详情 + 完整 progress timeline。

### 4.3 看 JSON 文件（终极真值）

```bash
ls data/tasks/                  # 活跃 task
ls data/tasks/_archive/         # 归档 task
cat data/tasks/<task_id>.json   # 完整 schema
```

### 4.4 看 daemon log

```bash
tail -f data/tasks/_logs/task-listener.log     # Discord → task
tail -f data/tasks/_logs/task-dispatcher.log   # task → CLI spawn
tail -f data/tasks/_logs/task-api.log          # tasks.profitslocal.com API
tail -f data/tasks/_logs/sop0-tunnel.log       # Cloudflare Tunnel
tail -f data/tasks/_logs/task-retention.log    # 每日 03:00 归档
```

### 4.5 自测 cheatsheet

| 想测 | 怎么做 |
|---|---|
| listener 还活着? | `launchctl list \| grep profitslocal` |
| Discord intent 通? | 自己 @ProfitsLocal Handoff 发条 ping，看 listener log |
| ollama 通? | `curl localhost:11434/api/tags` |
| 路由结果? | `npm run pl:task-listener` 前台跑，看 `route → kind=…` |
| CLI 能跑? | `npm run <cli> -- <args>` 手动验 |
| Tunnel 通? | `curl https://tasks.profitslocal.com/api/health` |

---

## 5. 出错怎么办

### 5.1 task 长时间 `pending` 不动

→ dispatcher 挂了。`launchctl kickstart -k gui/$UID/ai.profitslocal.task-dispatcher`

### 5.2 task `human` tag 出现

→ 路由失败或 image prep 失败。看 thread 的 reason，**你 ✅ 重跑**或 **🗑 放弃**。

### 5.3 image-extract 一直走 human

→ 图片里没有清晰 niche/city。手动补：去 `/admin/tasks/#<task_id>` 看 vision 抓到啥。或换张更清晰的图重发。

### 5.4 forum thread 完全没 bot 回复

→ listener 挂或没收到事件。检查：
- `launchctl list | grep listener` 确认 PID
- listener log 最后一行时间戳
- 重启：`launchctl kickstart -k gui/$UID/ai.profitslocal.task-listener`

### 5.5 admin `/admin/tasks` 401 错误

→ Bearer token 配错。检查 CF Pages env var `PUBLIC_SOP0_API_TOKEN` == `.env.local` 里 `SOP0_API_AUTH_TOKEN`。

---

## 6. 高级 · 环境变量

完整列表见 `SOP_0_TASK_SYSTEM.md` §9。常用：

| Env | 干啥 |
|---|---|
| `INTENT_ROUTER_OLLAMA_MODEL=qwen3.6:27b` | 换路由模型 |
| `SOP0_IMAGE_VISION_CHAIN=qwen3.6:27b,gemma3:27b` | 图片视觉 fallback 链 |
| `SOP0_STREAM_FLUSH_MS=5000` | progress[] flush 频率 |
| `LISTENER_ALLOW_BOTS=1` | 测试时让 bot-author thread 也触发 (smoke 用) |

修改 → 改 launchd plist `EnvironmentVariables` → `launchctl kickstart -k <label>` 重启。

---

## 7. 操作员每周自查

- [ ] `launchctl list | grep profitslocal` → 5 个 daemon 全 OK
- [ ] `/admin/tasks` 翻看 `human` tag → 决策
- [ ] `data/tasks/_logs/*.error.log` 有无新错（应该都是空）
- [ ] disk: `du -sh data/tasks/` → < 500MB (retention 应该每天清)

---

## 8. 文件 / 目录速查

```
data/tasks/<id>.json                    每个 task 的真值
data/tasks/_archive/<YYYY-MM>/          retention 归档
data/tasks/_logs/                       5 daemon 的 log + error log
data/inbox/<task_id_or_pre>/0.png       Discord attachment 本地拷贝 (image-extract)
data/discord/website-tasks-forum-tags.json   forum tag ID ↔ name 映射
~/.cloudflared/                         tunnel 配置 + cert
~/Library/LaunchAgents/ai.profitslocal.*.plist   5 daemon 的 launchd plist
```
