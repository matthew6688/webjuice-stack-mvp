# V2 Discord-first 销售闭环 — 路线图（历史归档）

更新日期：2026-05-11
关联：
- [DISCORD_OUTREACH_PRD.md](DISCORD_OUTREACH_PRD.md) — 设计 + 决策
- [DISCORD_OUTREACH_TASKS.md](DISCORD_OUTREACH_TASKS.md) — 已完成 dev 阶段任务
- [BACKLOG.md](BACKLOG.md) — **未决/待做的单一入口**（pickup 时从这里开始）

> 此文件作 P0-P4 完整路线图历史归档；新待办进 [BACKLOG.md](BACKLOG.md)。

## LLM 成本模型（D15 决策）

| 任务 | Tier | Cost / call | 备注 |
|---|---|---|---|
| **pl:reply-poll**（每 5 min）| 无 | **$0** | 纯 regex + HTTP + file I/O，**零 LLM 调用** |
| Reply 分类（regex 命中）| 无 | $0 | 12 class × pattern；fixture 100% |
| Reply 分类（unclear fallback）| T0 Ollama | $0 | qwen3.5:9b，~3s，~$0；预计 < 1% reply 触发 |
| Variant hypothesis 生成 | T0 Ollama | $0 | qwen3.5:9b，~4s，~300 tokens；本地 |
| Profile card 渲染 | 无 | $0 | 纯模板替换 |
| 当前 cold email body | 无 | $0 | 变量替换静态模板 |
| 未来 P2.3 AI body 个性化 | T1 claude_cli | $0 actual | 客户面向，质量优先 |
| 未来 P2.4 reply draft | T0 → T1 fallback | ~$0 | 大部分 T0；高价 lead 时切 T1 |
| 未来 audit narration | T0 | $0 | 内部用，本地够 |
| 未来 proposal page 文案 | T3 sonnet | $0.01-0.05 | 真客户合同前，质量第一 |

**每月成本估算**（每月 50 个 lead + 100 outbound + 30 reply）：
- pl:reply-poll × 8640 polls = $0
- Reply classifier × ~30 hits regex + ~1 Ollama = $0
- Variant 新建 × 4 hypotheses = $0
- 未来 AI body × 100 sends (T1 claude_cli) = $0 actual / 50K tokens 订阅扣
- **总：~$0 实际花费**

## 当前能力清单（已 LIVE 验证）

| 能力 | 状态 |
|---|---|
| Forum thread 自动开（A/B grade） | ✓ LIVE |
| Profile card 钉顶 + 实时编辑（14 字段） | ✓ LIVE |
| Phase swap → tag + 消息 + card 三联同步 | ✓ LIVE |
| 12 个 pl:* CLI | ✓ LIVE |
| Reply classifier（12 class，100% fixture 准确） | ✓ LIVE |
| Reply playbook（12 actions） | ✓ LIVE |
| Variant registry（3 seed + picker + hypothesis gen） | ✓ LIVE |
| Hermes cron（create/list/pause/remove） | ✓ LIVE |
| **真实发邮件**（CF Access service token）| ✓ LIVE |
| **Pull-mode reply ingest**（pl:reply-poll，every 5m）| ✓ LIVE（paused）|
| Admin v2 + v2-leads 页面 | ✓ LIVE |
| 10 unit test + astro build 全绿 | ✓ |

---

## 下一步任务列表（按优先级）

### P0 — 启用生产（任意时刻可做，~5 min）

- [ ] **P0.1** Roll Cloudflare Global API Key
  - CF dashboard → My Profile → API Tokens → Global API Key → **Change Key**
  - 旧 key 立刻失效；agentic-inbox service token 不受影响

- [ ] **P0.2** 启用 `pl-reply-poll` cron
  ```
  hermes cron resume f5c76d685a1d
  ```
  - 5 分钟内首次跑；之后 every 5m

- [ ] **P0.3** 选一个真 grade=A entity，跑完整 cold outreach
  ```
  npm run pl:email-draft -- <entityKey> --json > /tmp/d.json
  jq -r '.body' /tmp/d.json > /tmp/body.md
  npm run pl:email-send -- <entityKey> --to <real-email> \
    --subject "$(jq -r '.subject' /tmp/d.json)" \
    --body-file /tmp/body.md --variant v_2026-05_audit-led --no-dry-run
  ```

### P1 — 闭环健壮性（1-3h 每个）

- [x] **P1.1** Lead 详情页 `/admin/v2-leads/<entityKey>.astro`
  - 实现：[src/pages/admin/v2-leads/[entityKey].astro](../../src/pages/admin/v2-leads/[entityKey].astro)
  - 复用 `renderProfileCard` 函数（与 Discord 同一来源）
  - 渲染 profile card + asset manifest（带 CDN 链接）+ 最近 10 条 history + 紧急 CLI 命令
  - 8 个 lead 全部 build 成 static page；FIX MY ROOF 9299 bytes 验证 Phase: needs-human / Grade A/T3 / AEST 时区显示

- [x] **P1.2** Nurture daily cron + **P1.3** D-grade auto-archive timeout（合并实现）
  - 实现：[scripts/cli/pl-daily-tick.js](../../scripts/cli/pl-daily-tick.js) + Hermes cron `pl-daily-tick`（cron `0 9 * * *`，paused）
  - 硬证据：[scripts/test/test-daily-tick.js](../../scripts/test/test-daily-tick.js) 18 断言 PASS：
    - nurture 到期 → revived；未到期 → 不动
    - outreach 21d 无回应 → archived `no_response_25d`
    - `do_not_contact=true` 防御性保护
    - paid 永不动；idempotent 二次运行 0 candidates
    - `--timeout-days N` 自定义阈值；`--dry-run` 不写

- [ ] **P1.4** Entity 详情页 + emergency action button（POST handler）
  - 当前 admin 只暴露 copy-paste 命令；加 1 个 `[Mark needs-human]` 按钮调 `/api/admin/pl-advance` POST
  - 内部走 spawn `npm run pl:advance`，保持 D8 "单一来源" 不变

- [x] **P1.5** Reply classifier — **Ollama T0 fallback for unclear**（cheaper than Claude CLI）
  - 实现：[reply-classifier.js](../../core/llm/reply-classifier.js) `classifyReplyWithFallback`
  - 路由：regex 高置信度 → 直接返回（**$0**，99% 路径）；unclear → Ollama qwen3.5:9b（**$0**，~3s）
  - LIVE 验证：`"Hmm, thinking about it. timing might work soon"` → regex unclear → Ollama → `objection-timing` (0.85 confidence)
  - 改 D15 决策：本地 LLM 默认，CLI 仅作 fallback

### P2 — Hermes agent 自治（已部分完成）

- [x] **P2.1 LLM 评测** — heartbeat 跨 6 模型对比，选定 **qwen3.5:9b** 作本地默认
  - 证据：[data/qa/p2.1-heartbeat-eval-fix-my-roof.md](../../data/qa/p2.1-heartbeat-eval-fix-my-roof.md)
  - 关键发现：qwen3.5:9b（12s，$0）✓ 正确；qwen3.6:27b（211s）太慢；gemma3/deepseek-r1 决策错；haiku（6s）作 fallback
  - 实施：[pl:llm-eval](../../scripts/cli/pl-llm-eval.js) CLI 可重跑评测

- [x] **P2.2** Hermes skill 清理 — **117 → 40 skills**，slash 注册恢复
  - 证据：[data/qa/p2.2-hermes-skill-audit.md](../../data/qa/p2.2-hermes-skill-audit.md)
  - 操作：22 类无关 skill 移到 `~/.hermes/profiles/website-agent/_skills_disabled/`
  - 验证：gateway log `Registered /skill command with 40 skill(s)` — 无 30032 错误
  - `/skill profitslocal-lead-ops` 现在 Discord 自动补全可见

- [x] **P2.3 AI-generated email body** — sonnet (A) / haiku (B/C) / qwen3.5:9b (fallback)
  - 评测证据：[data/qa/p2.3-emailbody-eval-fix-my-roof.md](../../data/qa/p2.3-emailbody-eval-fix-my-roof.md)
  - 路由决策：[data/qa/p2-llm-routing-decision.md](../../data/qa/p2-llm-routing-decision.md)
  - 关键发现：本地模型在客户面向场景**编造数据**（虚构 WhatsApp 按钮、Chermside 等），sonnet 引用真实电话/URL/HTTP-only 等
  - 实施：[core/outreach/email-body-generator.js](../../core/outreach/email-body-generator.js) + [pl:email-draft](../../scripts/cli/pl-email-draft.js) 默认走 AI（`--static` 退回模板）
  - LIVE 验证：B grade → haiku 12s `$0.05`；A grade → sonnet 10s `$0.064`

- [ ] **P2.1.b Per-lead heartbeat cron**（自治闭环最后一环）
  - persistLeadGrade hook 加 `registerLeadCron(entityKey, grade)` 自动注册 4h/12h paused cron
  - prompt 用 T0 qwen3.5:9b（已验证可用）
  - 验证 agent 每 4h 读 thread + pl:context → 推荐 next action
  - 1-2 周观察决策质量

- [ ] **P2.4** Reply playbook draft 自动生成 — 推迟（D 决策，先攒数据）

### P3 — TrackLayer 集成（推迟，独立工程）

- [ ] **P3.1** Fork `tracklayer-panel` repo → profitslocal-specific version
  - 改 schema：campaign_id 限制到 profitslocal variant_id；contact_id 限制到 entity.entityKey
  - 改 dashboard UI：去掉 fengtalk-specific 内容
  - 部署独立 Cloudflare workspace + domain `track.profitslocal.com`

- [ ] **P3.2** agentic-inbox 集成 TrackLayer
  - 出门时调 TrackLayer `POST /api/v1/links` 包链接 + 插 pixel
  - 邮件头注入 `X-PL-Variant` + `X-PL-Entity-Key`（这两个 header 已经在 sendOutbound 准备好）

- [ ] **P3.3** profitslocal 端追踪信号 pull
  - 新建 `pl:signals-poll` CLI：调 TrackLayer `/contacts/{id}/signals?since=<last>` 拉 open/click/visit/engage 信号
  - 写到 entity.signals + 落事件 jsonl
  - 注册 cron every 5m（paused）

- [ ] **P3.4** Weekly evaluate_and_improve cron
  - 调 Openclaw runtime 跑 `evaluate_and_improve` skill per active variant
  - 解析 ab_test_plan → 推 `#outreach-experiments` 频道 → ✅ 后注册新 variant

### P4 — 长尾扩展

- [ ] **P4.1** SMS 链路（Twilio / Cloudflare SMS）
- [ ] **P4.2** 多国 timezone 表（澳洲 → 美/加/英）
- [ ] **P4.3** Bandit-style variant 选择（epsilon-greedy at >50 sends；Thompson sampling at >500）
- [ ] **P4.4** Lead funnel admin 图表（按天聚合 conversion rate per stage）
- [ ] **P4.5** Master.md 重生成器接入 V2（grade 落地时同步更新 master.md，让 email body 引用最新数据）

---

## 改进点（已知的待优化）

### 数据流
1. **Reply 匹配仅靠 sender_email 较弱** — 同一邮箱不同 entity 会撞车；P0.3 启用真实工作流后开始累积 `outbound_message_ids`，强匹配自然生效（**已修代码** 5/11）
2. **pl-reply-poll 不处理 outbound 自发邮件** — 当前 worker 把出站也存到 sent folder，poll 跑 inbox 不会撞；但如果未来加 forwarded/auto-reply 邮件可能误判
3. **CI webhook 路径 V2 reply hook 仍未真实跑过** — Block 11.1 写了 `applyV2ReplyClassification` 但 agentic-inbox 不发 inbound webhook（D13 决策走 pull 兜底）。如果以后改 push，这条路径会接管

### 错误处理
4. **CF Access 服务令牌过期/被 revoke** — pl:email-send 失败时仅打印 stderr，没自动回滚 entity 状态。**已修**：失败时不 advance phase
5. **Discord PATCH/POST 502/503** — 当前 fire-and-forget，错误只 console.warn。改进：失败入 retry queue（10 min 后重试 ×3）
6. **Hermes cron 跑失败** — 当前没监控；agent 卡住 5 min 无 response，operator 不会主动知道。改进：每次 tick 写 `data/leads/cron-health.jsonl`，KPI 页面读

### 性能
7. **profile card 渲染 reads asset manifest** — 每次 setEntityPhase 触发 3 次 Discord API + 1 次 manifest 读。当 lead 量 > 100 时可能 throttle。改进：批量 collect 后单次 PATCH
8. **pl-reply-poll 每次 scan 50 封邮件** — 当 inbox > 100 时分页；目前不分页可能丢

### 可视化
9. **Admin v2-leads 没有筛选/排序** — 只有 5 个固定 sub-cell。改进：加 phase × grade 筛选 dropdown + signals 排序
10. **Profile card 16 字段中 4 个仍是占位** — `decision_maker / backup_email / social_links / est_value` 来源未定。改进：从 enrichment-gate / 手工输入 fill in

### 实验
11. **Variant picker 永远 round-robin** — 即使 v_curiosity-led 明显垃圾也会继续投放。P4.3 epsilon-greedy 解决
12. **Hypothesis 写完没回测** — Phase A 没数据；接 TrackLayer 后 weekly evaluate cron 验证

---

## 推荐节奏

**接下来 1 周**：P0（5 min 启用）+ P1.2 nurture cron + P1.3 archive timeout（共 ~4h）→ 拿真实回信数据沉淀。

**第 2-3 周**：观察 1 周 pull-mode 表现，根据 unmatched 比例决定是否需要 push hook。同时 P2.1 + P2.3（AI body）让 cold outreach 个性化（~6h）。

**第 4 周后**：积累 ≥ 20 sends + ≥ 5 replies 后启动 P3 TrackLayer fork。在此之前 P3 都是过度投资。

---

## Definition of "成熟生产"

闭环成熟的标志：
1. 单次 pipeline 跑出新 grade=A lead → 5 min 内 forum thread 自动开 + cron 注册
2. Operator 在 Discord 内全程推进 1 个 lead 从 awaiting → paid，不打开 admin UI
3. 客户回信 → 5 min 内 thread 自动出现分类 + draft 回应（P2.4 之后）
4. 每周 evaluate_and_improve 自动生成实验报告（P3.4 之后）

---

## 一句话总结

**V2 Discord-first 销售闭环 dev 阶段已完成**。真实 Discord forum thread + 真实邮件 + 真实回信 pull 已 LIVE。
下一步是 **P0（启用） + P1（健壮性）+ 累积数据**，再决定 TrackLayer 投入时机。
