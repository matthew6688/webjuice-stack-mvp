# V2 Discord-first 闭环 — 单一待办清单

**这是 future pickup 时的唯一入口**。所有 PRD / TASKS / NEXT_STEPS 里散落的 ☐ 项汇总在此。

更新日期：2026-05-11
关联：
- [DISCORD_OUTREACH_PRD.md](DISCORD_OUTREACH_PRD.md) — 设计 + 决策
- [DISCORD_OUTREACH_TASKS.md](DISCORD_OUTREACH_TASKS.md) — 已完成的 dev 阶段任务
- [NEXT_STEPS.md](NEXT_STEPS.md) — 完整 P0-P4 路线图

---

## ✅ 本周追加完成

- **V2 Queue admin page** (`/admin/v2-queue/`) — Discovery 漏斗 [904ebcaf](../../../../commits/904ebcaf)
  - 4 阶段 funnel（scored / queued_for_audit / ready_for_outreach_brief / manual_review）
  - Bottleneck hero 自动识别最堵的关 + CLI 推一推
  - Hermes cron card grid
  - Skip reasons breakdown
  - Recent discovery events feed
- **V2 test matrix** [2bdff782](../../../../commits/2bdff782) — 21 cases, 含 LIVE Discord sync sandbox
- **Bug fix**: pl:* CLI 之前 6 个漏 `--env-file-if-exists=.env.local`，导致 Discord token 没加载、setEntityPhase hook 静默失败 — [0179c9bd](../../../../commits/0179c9bd)

## 🚦 当前可立刻启用（你的动作，无需我介入）

| # | 任务 | 时长 | 命令 |
|---|---|---|---|
| **U.1** | Roll Cloudflare Global API Key（之前在聊天贴出）| 1 min | CF dashboard → My Profile → API Tokens → Change Key |
| **U.2** | 启用 `pl-reply-poll` cron（every 5m） | 30s | `hermes cron resume f5c76d685a1d` |
| **U.3** | 启用 `pl-daily-tick` cron（daily 9am） | 30s | `hermes cron resume 71a491d0d6bc` |
| **U.4** | 发第一封真 cold outreach | 5 min | `npm run pl:email-draft -- <key>` → review → `npm run pl:email-send -- <key> ... --no-dry-run` |

---

## 🟡 等你回来决定的（需要拍板才动）

### B.1 — Hermes cron 是否自动注册到每个新 grade=A/B lead？
- **背景**：P2.1.b per-lead heartbeat cron。当前 `persistLeadGrade` 不自动注册 cron；只能手动 `registerLeadCron(entityKey)`
- **决定项**：
  - (a) 自动注册：grade=A 落地 → 4h cron paused；grade=B → 12h paused
  - (b) 半自动：注册但默认 active（生产模式直接跑）
  - (c) 手动：你按需触发
- **影响**：你启用所有 cron 后，A lead 数量 × 6 次/天 = 心跳频次。50 lead = 300 cron tick/day = $0（qwen3.5:9b）
- **我的推荐**：(a) 自动注册 paused，启用前一周一个一个验证

### B.2 — 给客户发送邮件的 `from:` 地址用什么？
- **背景**：当前 `from: hi@profitslocal.com`（mailbox owner）。这个地址收一切回信
- **决定项**：
  - 用 `matthew@profitslocal.com`？建立 alias？
  - 还是 `hello@profitslocal.com` / `outreach@profitslocal.com` 更专业？
- **影响**：要在 Cloudflare Email Routing 加 destination + 在 agentic-inbox 加 mailbox
- **我的推荐**：先用 `hi@`，规模化时再分

### B.3 — Variant 数量 + 评测方法
- **背景**：当前 3 个种子 variant；picker 是 round-robin
- **决定项**：
  - 多少个 variant 同时跑？建议 < 5 直到 TrackLayer 接入
  - 没有 open/click 数据前，评测只能靠 reply rate — 样本要多大才有意义？
- **影响**：等 P3 TrackLayer 之后再做认真的 bandit；现在 round-robin 够
- **我的推荐**：保持 3 个种子；积累 30+ reply 后再加 4-5 个

### B.4 — Reply auto-draft 触发时机（P2.4）
- **背景**：当前 reply 来了 → 分类 + 推 Discord 通知；**不自动起草回应**
- **决定项**：
  - (a) 立即起草（成本：每 reply $0.05 haiku）→ 推到 thread + ✅/❌ 按钮
  - (b) 心跳时起草（4h 内一起处理）→ 减少 spam
  - (c) 完全手动（操作员自己调 pl:reply-handle）
- **影响**：(a) 反应快但贵；(c) 节省但慢
- **我的推荐**：(b) — 跟 heartbeat 合并

### B.5 — TrackLayer fork 时机
- **背景**：当前邮件追踪开/点击/落地页行为为 0
- **决定项**：什么时候投入 1-2 天做这个？
- **触发条件建议**：
  - ≥ 30 次真实 send 后（信号有意义）
  - 或开始 A/B test 真要数据时
- **我的推荐**：先攒 2-4 周数据再启动

### B.6 — 客户分类 (niche) 扩展到 roofing 之外
- **背景**：当前所有 entity.latest.niche = "roofing"；reply-playbook + variants 都按 roofing 模板
- **决定项**：什么时候 + 怎么扩到其他 niche？restaurant？dental？plumber？
- **影响**：每个 niche 需要新的 variants + audit 模板 + niche-specific playbook
- **我的推荐**：roofing 跑通 5+ paid customer 再考虑

---

## 🔵 闭环健壮性（我可以做，等你 say go）

### H.1 — P1.4 Emergency action POST handlers（1.5h）
- 当前 admin 只暴露 copy-paste 命令
- 加 3 个按钮 → POST `/api/admin/pl-advance` → 内部 spawn `npm run pl:advance`
- 保持 D8 "admin 不直接写 entity" — 走 CLI 中转

### H.2 — P2.1.b Per-lead heartbeat cron（2h）
- `persistLeadGrade` hook → 自动注册 `lead-<key>` cron（4h/12h）
- prompt 已就位（用 qwen3.5:9b 经评测验证）
- 验证 1-2 周决策质量后再启用 active 模式
- **依赖 B.1 决定**

### H.3 — P2.4 Reply auto-draft（3h）
- 同 P2.3 路由 — haiku for B/C, sonnet for A
- 加 Discord ✅/✏️/❌ 按钮交互（用 Discord button component）
- **依赖 B.4 决定**

### H.4 — Profile card 4 个占位字段填充
- `decision_maker` / `backup_email` / `social_links` / `est_value` 当前是 — / 占位
- 来源：enrichment-gate 已有 social_links 数据；其他需要手工或新 enrichment
- 改进：[profile-card.js:renderProfileCard](../../core/funnel/profile-card.js) 拉 enrichment 数据

### H.5 — pl-reply-poll 优化
- (a) 分页：当 inbox > 100 时 limit=50 会丢历史。改成游标分页
- (b) 强 thread_id 匹配：现在 `outbound_message_ids` 已开始记录，可以提升匹配强度

### H.6 — Discord PATCH retry / fail recovery
- 当前 fire-and-forget 错误只 console.warn
- 改：失败入 `data/leads/discord-retry-queue.jsonl`，daily-tick 时重试 ×3

### H.7 — Hermes cron 健康监控
- 每次 tick 写 `data/leads/cron-health.jsonl`
- KPI 页面读，操作员能看到"reply-poll 上次成功 X 分钟前"

### H.9 — Admin pages SSR runtime（根本解决 entity 快照问题）⚠ 长期必做
- **背景**：当前 admin 是 static build，entity 状态变化要 commit + push + 重 deploy 才在 live 显示
- **现状决策**：暂走 D — admin 是部署时快照，真推进在 Discord（D8）
- **长期方向**：改 CF Pages Functions SSR
  - entity 数据迁到 R2（JSON blob）或 D1（SQLite）
  - admin pages 改成 CF Functions handler，运行时读
  - 实时反映 phase/thread_id/signals 变化，无需重新 deploy
- **时机**：当 admin 真成为日常工作面，或 entity 数量 > 200 时（git 太重）
- **依赖**：先做 H.8 push hook（webhook 写 R2 而不是 git）

### H.8 — agentic-inbox push hook（替代 pull）
- 当前 pull 5min 延迟
- 加 1 个 hook 到 agentic-inbox worker `receiveEmail` 函数末尾，POST 到 profitslocal webhook
- 这是另一个 repo 改动；按 D13 决定保留为可选

---

## 🟣 长尾扩展（远期）

### L.1 — SMS 链路
- Twilio 或 Cloudflare SMS
- entity.latest.phone 已有
- 路由：reply-playbook 加 `recommended_channel: 'sms' | 'email'`

### L.2 — 多国 timezone 表
- 当前 `data/geo/au-city-tz.json` 22 城
- 扩 US / CA / UK：每国一个 JSON

### L.3 — Variant bandit 选择（epsilon-greedy → Thompson）
- 当 sends > 50 切 epsilon-greedy（10% explore）
- 当 sends > 500 切 Thompson sampling
- 现成的 [variant-picker.js](../../core/outreach/variant-picker.js) 已留 hook 注释

### L.4 — Lead funnel admin 图表
- 按天聚合 conversion rate per stage
- Recharts 或 D3 嵌入 admin v2 页面

### L.5 — Master.md 自动重生成
- grade 落地时同步更新 master.md
- 让 email body 引用最新 audit 数据

### L.6 — Audit narration 中文化
- 现有 audit findings 中英混杂
- 内部用 T0 qwen3.5:9b 翻译

---

## 🐛 已知缺陷（不阻塞但记下）

| 缺陷 | 影响 | 修复方向 |
|---|---|---|
| Reply 仅靠 sender_email 匹配可能撞车（同 gmail 不同 entity）| 低（一般情况下唯一）| 等 `outbound_message_ids` 累积后切 thread_id 优先 |
| CF Access token 过期/被 revoke | pl:email-send 失败 stderr 报错 | 已防御：失败不 advance phase；可加监控告警 |
| Discord PATCH 502/503 偶发 | 单次 update 失败 | H.6 retry queue |
| pl-reply-poll 不分页 | inbox > 100 邮件时丢历史 | H.5 (a) |
| Profile card 4 占位字段（decision_maker / backup_email / socials / est_value）| 视觉空白 | H.4 |
| Variant picker round-robin 无适应性 | 早期可接受；规模化后浪费 | L.3 bandit |
| 邮件追踪 0 信号（open/click/visit） | autoresearch loop 缺数据 | P3 TrackLayer fork |

---

## 📊 状态快照（pickup 时先看这里）

```
dev 阶段任务:       42/48 (87.5%)  ✓ 关键路径全 LIVE 验证
NEXT_STEPS P1:      3/4   ✓ 主要闭环健壮性已做
NEXT_STEPS P2:      3/4   ✓ LLM 评测 + 路由 + skill 清理已做
NEXT_STEPS P3:      0/4   - TrackLayer 待启动
NEXT_STEPS P4:      0/5   - 长尾

pl:* CLI:           14 个
Test:               11/11 PASS
Astro build:        123 pages ✓
Hermes cron:        2 paused（reply-poll every 5m + daily-tick 9am）
Hermes skills:      40 active（slash 注册恢复）
LLM 路由:            T0 qwen3.5:9b 默认；A grade → sonnet；B/C → haiku
真邮件:              ✓ 实测发出 + 收到 + 回信 ingest
```

## 🎯 Pickup 起手清单

下次回来时按这个顺序看：

1. 读这个文件（你正在读）✓
2. 看 [DISCORD_OUTREACH_PRD.md §12 决策记录](DISCORD_OUTREACH_PRD.md) 复习 D1-D15 历史决定
3. 看 [data/qa/p2-llm-routing-decision.md](../../data/qa/p2-llm-routing-decision.md) 确认成本模型
4. 决定先做 🟡 (B.1-B.6) 还是直接做 🔵 (H.1-H.8)
5. 如果只有 30 min，做 U.1-U.4（启用生产）
