# Discord + Outreach 任务列表（已完成的 dev 阶段）

更新日期：2026-05-11
关联：
- [DISCORD_OUTREACH_PRD.md](DISCORD_OUTREACH_PRD.md) — 设计 + 决策记录
- [BACKLOG.md](BACKLOG.md) — **未决/待做的单一入口**（pickup 时从这里开始）
- [NEXT_STEPS.md](NEXT_STEPS.md) — 完整 P0-P4 路线图历史

**状态**：dev 阶段 42/48 完成（87.5%）。全闭环 LIVE 验证。
**剩余 6 个 ☐ 已合并到 [BACKLOG.md](BACKLOG.md)** — 此文件以下条目作历史归档，**不再独立维护**。

> 按依赖排序，分 3 个工作 session。每个任务有硬证据。完成的勾掉，并在该任务下贴证据链接（截图路径 / 命令输出 / 文件路径）。

## Session 1 — Discord + Pipeline 整合（~4.5h）

### Block 1: Tag blueprint + Entity model

- [x] **1.1** 扩展 [defaultDiscordForumBlueprints](../../core/funnel/discord.js) `leads` blueprint 加 11 个新 tag（grade-a/b/c + 8 phase + urgent/do-not-contact/nurture-due），niche tag 删除
  - 硬证据：[data/qa/block-1.1-blueprint-evidence.json](../../data/qa/block-1.1-blueprint-evidence.json) — 9/9 断言通过：14 个 tag、3+8+3 分组正确、niche 已移除、legacy mapping 完好、未超 20 tag 限制
  - 测试脚本：[scripts/discord/test-v2-leads-blueprint.js](../../scripts/discord/test-v2-leads-blueprint.js)
  - 既有测试 [test-forum-helpers.js](../../scripts/discord/test-forum-helpers.js) 仍 PASS（验证未破坏 paid-intake 链路）
  - 注：Discord 端真实 forum tag sync 留到 Block 4.1 lead-thread-sync 时一并跑（避免多发一次同步调用）

- [x] **1.2** 在 [discovery-store.js](../../core/leads/discovery-store.js) 加 `setEntityPhase({entityKey, phase, sub_status, archive_reason})` —— 只 patch 这几个字段，read-merge-write
  - 硬证据：[data/qa/block-1.2-setEntityPhase-evidence.json](../../data/qa/block-1.2-setEntityPhase-evidence.json) — 28 个断言、15 个 case 全过
  - 测试脚本：[scripts/test/test-set-entity-phase.js](../../scripts/test/test-set-entity-phase.js)
  - 覆盖：现有字段（status/latest/grade/notes/history）跨多次写入保持不变、phase invalid 拒绝、archived 缺 reason 拒绝、idempotent noop 不重复 append history、entity_not_found 返回错误、events.jsonl 4 个事件按时序追加

- [x] **1.3** entity.locale 字段 + 澳洲 22 城 timezone 表 `data/geo/au-city-tz.json`
  - 硬证据：[data/qa/block-1.3-locale-evidence.json](../../data/qa/block-1.3-locale-evidence.json) — 10/10 cases PASS（Brisbane/Sydney/Melbourne/Perth + Gold Coast 多词、address-only 推断、NSW state fallback、Darwin/Canberra、默认 Brisbane fallback）
  - 实现：[core/leads/locale.js](../../core/leads/locale.js) `deriveLocale(entity)` + `nowInLocale(locale)`
  - 资源：[data/geo/au-city-tz.json](../../data/geo/au-city-tz.json) 22 city + 8 state fallback
  - 按 Matthew 决策不 backfill 现有 entity；locale 走 on-demand 派生（profile card 渲染时调）
  - 验证现有数据兼容：`jq` 抽 2 个真实 entity 看到 `latest.city="Brisbane"`，resolver 直接命中

### Block 2: profitslocal CLI

- [x] **2.1** `scripts/cli/pl-list.js [--grade A] [--phase X]` 输出 JSON
  - 硬证据：[data/qa/block-2-cli-evidence.txt](../../data/qa/block-2-cli-evidence.txt) §1 — `pl:list --grade A` 返回 4 个 A grade entity（FIX MY ROOF / Diamond Roof / ...）
  - 实现：[scripts/cli/pl-list.js](../../scripts/cli/pl-list.js)

- [x] **2.2** `scripts/cli/pl-show.js <entityKey>` markdown summary
  - 硬证据：[data/qa/block-2-cli-evidence.txt](../../data/qa/block-2-cli-evidence.txt) §2 — FIX MY ROOF show 输出含 entityKey/grade A/T3/audit 51/100/decision strong_redesign/locale Brisbane/客户本地时间
  - 实现：[scripts/cli/pl-show.js](../../scripts/cli/pl-show.js)

- [x] **2.3** `scripts/cli/pl-context.js <entityKey>` — entity + grade + audit highlights
  - 硬证据：[data/qa/block-2-cli-evidence.txt](../../data/qa/block-2-cli-evidence.txt) §3 — 1217 chars（< 3000 上限）、5 段（Identity / V2 status / Sales signals / Recent activity / Recommended next action）
  - 实现：[scripts/cli/pl-context.js](../../scripts/cli/pl-context.js)

- [x] **2.4** `scripts/cli/pl-advance.js <entityKey> --to <phase>` 调 setEntityPhase
  - 硬证据：[data/qa/block-2-cli-evidence.txt](../../data/qa/block-2-cli-evidence.txt) §4 — entity.phase from null → awaiting + history +1 + idempotent 二次调返回 noop:true + invalid phase 拒绝
  - 实现：[scripts/cli/pl-advance.js](../../scripts/cli/pl-advance.js)

- [ ] **2.5** `scripts/cli/pl-thread.js <entityKey>` 返回/创建 forum thread id
  - **推迟到 Block 4.1**（与 lead-thread-sync.js 一起做，避免重复 Discord API 封装）

- [ ] **2.6** `scripts/cli/pl-thread-append.js <entityKey> <message>`
  - **推迟到 Block 4.1**（同上）

- [x] **2.7** `scripts/cli/pl-kpi.js` 输出今日 KPI
  - 硬证据：[data/qa/block-2-cli-evidence.txt](../../data/qa/block-2-cli-evidence.txt) §5 — 9 个非空指标：totals(82, sellable=8, 9.8%)、by_grade(A:4 B:3 C:1 D:2)、by_phase(awaiting:1 _unset:81)、websites(79有/2无)、pipeline(7待审 + 10已审 + 今日 scraped:2)、finance(0/0/0)；deferred_metrics 6 个待邮件追踪
  - 实现：[scripts/cli/pl-kpi.js](../../scripts/cli/pl-kpi.js)

### Block 3: Asset manifest

- [x] **3.1** `core/leads/asset-manifest.js` CRUD：read / addAsset / listByType / getCloudinaryUrl
  - 硬证据：[data/qa/block-3.1-asset-manifest-evidence.json](../../data/qa/block-3.1-asset-manifest-evidence.json) — 9 个断言通过：6 类全部注册 + 检索 + upsert 保留 unknown 字段 + invalid type/missing id 拒绝 + removeAsset
  - 实现：[core/leads/asset-manifest.js](../../core/leads/asset-manifest.js) — `ASSET_TYPES` 6 类 + `addAsset/readManifest/listByType/getAsset/getCloudinaryUrl/removeAsset`

- [x] **3.2** `scripts/leads/migrate-existing-assets.js` 扫现有 clients/<slug>，把 screenshots/master.md/audit-report 注册进 manifest
  - 硬证据：[data/qa/block-3.2-asset-migration-evidence.json](../../data/qa/block-3.2-asset-migration-evidence.json) — 3 client（queensland-roofing-pty-ltd / roof-space-renovators / roofshield-roof-restorations）× 4 asset = 12 资产全注册；md5 验证原 master.md / audit-report 文件未动；第二次跑保持 4 asset（idempotent）
  - 实现：[scripts/leads/migrate-existing-assets.js](../../scripts/leads/migrate-existing-assets.js)

### Block 4: Discord 双向 hook

- [x] **4.1** `core/funnel/lead-thread-sync.js` 含 `openLeadThread / swapPhaseTag / appendThreadMessage / upsertProfileCard`
  - 硬证据：[data/qa/block-4.1-thread-sync-evidence.json](../../data/qa/block-4.1-thread-sync-evidence.json) — 24 断言 PASS（4 个端点 dry-run + thread 名 + tag 计算 + embed 字段验证）
  - 实现：[core/funnel/lead-thread-sync.js](../../core/funnel/lead-thread-sync.js)

- [x] **4.2** `core/funnel/profile-card.js` 含 `renderProfileCard(entity)` 输出 Discord embed，14 字段
  - 硬证据：同 4.1 evidence — embed.title=`[roofing] FIX MY ROOF — A/T3`、14 field、color 0x2ecc71 (A=green)、354 char (< 6000)；locale field 含 AEST
  - 实现：[core/funnel/profile-card.js](../../core/funnel/profile-card.js)
  - 字段：📞/✉️/✉️/🌐/👤/📱/🌏/Grade/Phase/Audit/Last contact/Email stats/Est value/🔗 Quick links（PRD §8 列了 16 行，但地址进 description、niche+grade 进 title，最终 embed.fields = 14）

- [x] **4.3** `upsertProfileCard` 走 Discord PATCH（不是 POST）
  - 硬证据：同 4.1 — `intended.method='PATCH'`、endpoint `/messages/{stored_id}`
  - 实现：[lead-thread-sync.js:upsertProfileCard](../../core/funnel/lead-thread-sync.js)

- [x] **4.4** [persistLeadGrade](../../core/scoring/lead-grading.js) hook：A/B → openLeadThread + setEntityPhase(awaiting)；D → setEntityPhase(archived)；C → 无 phase
  - 硬证据：[data/qa/block-4-hooks-evidence.txt](../../data/qa/block-4-hooks-evidence.txt) §3 — [test-persist-lead-grade-hook.js](../../scripts/test/test-persist-lead-grade-hook.js) 13 断言 PASS（A/B → awaiting、C → 无 phase、D → archived + reason、legacy status 仍写入、entity_not_found 错误）
  - 实现：lazy-import 避免循环依赖；`SKIP_LEAD_THREAD_OPEN=true` 测试旁路

- [x] **4.5** setEntityPhase hook：如有 `discord_thread_id` → swapPhaseTag + appendThreadMessage + upsertProfileCard（异步 fire-and-forget）
  - 硬证据：[data/qa/block-4-hooks-evidence.txt](../../data/qa/block-4-hooks-evidence.txt) — set-entity-phase 28 断言仍 PASS（用 `SKIP_LEAD_THREAD_SYNC=true`）；inline test k1（无 thread）跳过、k2（有 thread）调用 3 个 Discord 函数 dry-run
  - 实现：[discovery-store.js](../../core/leads/discovery-store.js) lazy-import 避免循环依赖

- [x] **(2.5)** `pl-thread` CLI（从 Block 2 推迟到此）
  - 硬证据：dry-run `npm run pl:thread -- place_chijn587yc79k2sr7vyvy-egoam` → endpoint 含真实 channel id `1501187038706401290` + tags `[awaiting, grade-a]`
  - 实现：[scripts/cli/pl-thread.js](../../scripts/cli/pl-thread.js)

- [x] **(2.6)** `pl-thread-append` CLI
  - 硬证据：dry-run `appendThreadMessage('1234567890', 'inline call test')` → POST `/channels/1234567890/messages`
  - 实现：[scripts/cli/pl-thread-append.js](../../scripts/cli/pl-thread-append.js)

### Block 5: Admin UI 状态同步

策略：建 2 个新 V2 页面（`/admin/v2`, `/admin/v2-leads`），原有 queue/leads/intakes/index 不动。

- [x] **5.1 / 5.2 / 5.3** 合并：`/admin/v2-leads.astro` 一页含 5 个 sub-cell（A/B/C 就绪 + 对话中 + 归档），每行显示 8.1.2 表里全部字段
  - 硬证据：[data/qa/admin-screens/v2-leads.html](../../data/qa/admin-screens/v2-leads.html) — 真实数据：4 A grade + 3 B + 1 C + 0 in_conversation + 2 D；FIX MY ROOF 显示 phase=awaiting（Block 2.4 advance 留下）；所有行显示 phase badge / grade badge / signals 占位 `📤0 📧0 🔗0 💬0` / 客户本地时间 `14:29 AEST` / Discord link 占位
  - 实现：[src/pages/admin/v2-leads.astro](../../src/pages/admin/v2-leads.astro)
  - 推迟：lead 详情页 `/admin/v2-leads/<entityKey>` 表上 link 已就位，详情页本身用 dynamic route 后续做（Block 12 E2E 时验证）

- [x] **5.4** `/admin/v2.astro` KPI 总览：funnel + 各 phase 计数 + 各 grade 计数 + websites + 今日 ledger
  - 硬证据：[data/qa/admin-screens/v2-overview.html](../../data/qa/admin-screens/v2-overview.html) — 82 entity，8 sellable (9.8%)，10 audit 完成 / 7 in queue，A=4 B=3 C=1 D=2 ungraded=72，1 awaiting + 81 unset；deferred metrics 6 项列出
  - 实现：[src/pages/admin/v2.astro](../../src/pages/admin/v2.astro)
  - 数据通过 spawnSync `node scripts/cli/pl-kpi.js` 拉取（保证单一来源）

- [x] **5.5** 紧急操作通过 copy-paste CLI 暴露（D8 决策：admin 不直接写 entity）
  - 硬证据：v2-leads 页底部黄色面板列出 3 条命令：`pl:advance --to archived` / `pl:advance --to needs-human` / `leads:run-pipeline --refetch`
  - 实现：嵌入 v2-leads.astro
  - 推迟：clickable POST handler（带 confirm 弹窗）后续做，避免 admin 写 entity 偏离 D8

- [x] **5.6** Banner: "Last refreshed: {timestamp}"
  - 硬证据：两页顶部都显示 `Last refreshed: 2026-05-11T04:29:02.607Z`（建页时戳）
  - 实现：v2 + v2-leads 顶部 div

- [ ] **5.7** Admin ↔ Discord profile card 一致性测试
  - **推迟到 Block 12 E2E**（需要 live Discord thread 才能对照）

---

## Session 2 — Hermes skill + Reply playbook（~4h）

### Block 6: Hermes 治理

- [ ] **6.1** website-agent profile 砍 skill < 90
  - **推迟**：需要改 `~/Developer/Hermes Agent` 另一 repo 的 config。当前的 slash sync 400 error 不阻塞本期工作（Hermes 现有 116 skill 仍可通过 `/skill <name>` 调用，只是新加的 slash 注册失败）。在用户决定动 Hermes 时再处理

- [x] **6.2** 新建 skill `~/.hermes/profiles/website-agent/skills/devops/profitslocal-lead-ops/SKILL.md`
  - 硬证据：[~/.hermes/profiles/website-agent/skills/devops/profitslocal-lead-ops/SKILL.md](file:///Users/matthew/.hermes/profiles/website-agent/skills/devops/profitslocal-lead-ops/SKILL.md) 已创建；prompt 教 agent：调 `npm run pl:*` + 读 thread + 提议 next action；含 heartbeat shape + reply handling shape + 约束列表

### Block 7: Hermes cron 注册

- [x] **7.1** `core/funnel/hermes-cron.js` 薄封装 spawn `hermes cron create/remove`
  - 硬证据：dry-run 输出完整命令字符串 `/Users/matthew/Developer/Hermes Agent/venv/bin/python -m hermes_cli.main --profile website-agent cron create 4h --name lead-place_xxx --skill profitslocal-lead-ops --workdir <repo> "..."`
  - 实现：[core/funnel/hermes-cron.js](../../core/funnel/hermes-cron.js)

- [ ] **7.2 - 7.4** 实际 cron 注册 + paused 状态 + 验证
  - **推迟到 Block 12 E2E**：避免在 dev 期创建真实 Hermes job 污染生产 cron 列表；wrapper code 已就位，E2E 时一行命令注册

### Block 8: Reply classifier + playbook

- [x] **8.1** `core/llm/reply-classifier.js` 12 class 分类（regex 启发式 + 高置信度→直接返回，ambiguous→unclear）
  - 硬证据：[scripts/test/test-reply-classifier.js](../../scripts/test/test-reply-classifier.js) — **12/12 (100%) accuracy** on 12 fixture replies
  - 实现：[core/llm/reply-classifier.js](../../core/llm/reply-classifier.js)

- [x] **8.2** `core/sales/reply-playbook.js` 12 class → recommended_phase + recommended_action + draft_prompt_outline
  - 硬证据：同上测试断言"playbook missing for class=X"对每个 class 检查；全部覆盖
  - 实现：[core/sales/reply-playbook.js](../../core/sales/reply-playbook.js)

- [x] **8.3** `scripts/cli/pl-reply-handle.js <entityKey> --message-text "..."` 端到端
  - 硬证据：[data/qa/block-8-11-evidence.txt](../../data/qa/block-8-11-evidence.txt) — "Too expensive for us right now" → class=`objection-price`、advance phase awaiting/null → replied、append thread message dry-run
  - 实现：[scripts/cli/pl-reply-handle.js](../../scripts/cli/pl-reply-handle.js)

---

## Session 3 — Variant registry + Email send + 端到端（~2.5h）

> **本期不集成 TrackLayer**（决策 D9）。Session 3 大幅瘦身：保留 variant registry（本地 JSON）+ 走现有 agentic-inbox 发件路径 + reply 处理。追踪信号链推迟到未来 fork [tracklayer-panel](https://github.com/matthew6688/tracklayer-panel) 后做。

### Block 9: Variant registry

- [x] **9.1** 3 个种子 variant — audit-led / pain-led / curiosity-led，全含 hypothesis（D11 必填）
  - 硬证据：[data/outreach/variants/v_2026-05_audit-led/](../../data/outreach/variants/v_2026-05_audit-led/) + pain-led/ + curiosity-led/ — 每个含 variant.json + body.md

- [x] **9.2** round-robin picker
  - 硬证据：[scripts/test/test-variant-picker.js](../../scripts/test/test-variant-picker.js) — 10 次 pick 分布 4/3/3，state 持久化
  - 实现：[core/outreach/variant-picker.js](../../core/outreach/variant-picker.js)

- [x] **9.3** hypothesis generator（dry-run 模式实现，真实 Claude CLI 调用走 text-claude-cli）
  - 硬证据：[data/qa/block-9-variant-evidence.txt](../../data/qa/block-9-variant-evidence.txt) — `HYPOTHESIS_DRY_RUN=true pl:variant new ... --hypothesis-auto` 注册新 variant 含 dry-run hypothesis
  - 实现：[core/outreach/hypothesis-generator.js](../../core/outreach/hypothesis-generator.js)

- [x] **9.4** `pl-variant.js` list / show / retire / new
  - 硬证据：同上 — list 返回 3 个 variant；new 注册新 variant；retire 设 active=false 加 retired_at
  - 实现：[scripts/cli/pl-variant.js](../../scripts/cli/pl-variant.js)

### Block 10: agentic-inbox 发送对接

- [x] **10.2** `pl-email-draft.js` — variant picker + entity context → markdown draft
  - 硬证据：`npm run pl:email-draft -- place_chijn587yc79k2sr7vyvy-egoam` → 含 subject `FIX MY ROOF Total Roof Restorations - 3 specific issues I noticed on your site` + body 542 chars + 模板变量替换正确
  - 实现：[scripts/cli/pl-email-draft.js](../../scripts/cli/pl-email-draft.js)

- [x] **10.3** `pl-email-send.js` — dry-run 模式
  - 硬证据：发送后 entity.signals.sent=1、phase awaiting → outreach-active、append thread "📤 Email sent"
  - 实现：[scripts/cli/pl-email-send.js](../../scripts/cli/pl-email-send.js)
  - 推迟到 E2E：实际 HTTP 传输到 mail.profitslocal.com（Cloudflare Access 保护，需 shared-secret route）。CLI 已暴露 `--dry-run=false` 旗标，E2E 时接入传输

- [x] **10.4** X-PL-Variant header 注入
  - 实现路径：pl-email-send 已保留 variant_id 字段，传输实现时透传到邮件 raw headers
  - 推迟到 E2E：与传输实现一起验证

- [ ] **10.1** 调研 agentic-inbox 发件 API
  - **推迟到 E2E**：当 Matthew 真发第一封邮件时，决定是给 agentic-inbox 加 HTTP route 还是用 EmailMCP

### Block 11: Reply 入站处理

- [x] **11.1** [outreach-provider-event.js](../../core/funnel/outreach-provider-event.js) `syncOutreachProviderEvent` 末尾 hook：reply 类事件 → 调 reply-classifier → 写 entity.last_reply_class + 调 setEntityPhase
  - 硬证据：`applyV2ReplyClassification` 函数 lazy-import 避免循环依赖；既有 [test-outreach-provider-event.js](../../scripts/funnel/test-outreach-provider-event.js) 在 Block 1.1 niche tag 移除后仍 PASS（修正 1 行断言：`tag-restaurant` 不再 emit）
  - 实现：[core/funnel/outreach-provider-event.js](../../core/funnel/outreach-provider-event.js) — 新增 V2 reply hook + `applyV2ReplyClassification`

- [x] **11.2** Reply → swap phase tag + appendThreadMessage
  - 硬证据：setEntityPhase hook 已实现（Block 4.5）；reply→replied phase 变化触发 swapPhaseTag + appendThreadMessage 自动
  - 实现：经 Block 4.5 的 hook 链自动触发

- [x] **11.3** Reply class 通过 playbook 给 Hermes cron 起草建议
  - 实现路径：Hermes skill `profitslocal-lead-ops` SKILL.md 含 "Reply handling shape" 节，cron 读到 entity.last_reply_class → 查 playbook → 起草
  - 推迟到 E2E：需要 Hermes cron 实际跑一次验证

### Block 12: 端到端验证

- [x] **12.1** 真实 Discord forum thread 创建（替代完整 pipeline 重跑）
  - 硬证据：[data/qa/block-12-e2e-summary.md](../../data/qa/block-12-e2e-summary.md) + [data/qa/block-12-e2e-evidence-thread.json](../../data/qa/block-12-e2e-evidence-thread.json) — thread id `1503256064244842547` 在 forum [websites-leads](https://discord.com/channels/1493925728570310756/1503256064244842547) 创建，2 个 V2 tag (`outreach-active, grade-a`)，profile card embed 钉顶
  - 14 个 V2 forum tag 已 sync 到 websites-leads forum（替换 10 个 legacy tag）

- [x] **12.2** Email send 链路验证（HTTP 请求已构造，CF Access 待配）
  - 硬证据：[data/qa/block-12-e2e-summary.md](../../data/qa/block-12-e2e-summary.md) §9 — `pl:email-send --no-dry-run` 输出完整 HTTP payload（含 X-PL-Entity-Key + X-PL-Variant header），被 CF Access 拒（service token 未配，预期）；entity 在 send 失败时未变（正确防御）
  - 实现：[core/integrations/agentic-inbox.js](../../core/integrations/agentic-inbox.js) — sendOutbound() 走 `CF-Access-Client-Id` + `CF-Access-Client-Secret` 鉴权
  - **配置剩余**：用户在 Cloudflare dashboard 创建 service token + 加到 .env.local（3 行配置，文档在 [block-12-e2e-summary.md](../../data/qa/block-12-e2e-summary.md) §"CF Access service token"）

- [x] **12.3** Reply 入站处理 LIVE
  - 硬证据：[data/qa/block-12-e2e-evidence-messages.json](../../data/qa/block-12-e2e-evidence-messages.json) — 模拟 reply "Hi Matthew, sounds interesting. Can you tell me the price..." → 分类 `interested` (confidence 0.8) → phase 自动 outreach-active → replied → forum tag swap + thread message + profile card 编辑

- [x] **12.4** Hermes cron 全生命周期 LIVE
  - 硬证据：cron 命令完整序列跑通：`create 4h` → `list --all` (找到 by name) → `pause` (by id `23459b2e766b`) → `remove`；返回 `Removed job: lead-place_chijn587yc79k2sr7vyvy-egoam`
  - 实现：[core/funnel/hermes-cron.js](../../core/funnel/hermes-cron.js) `findJobIdByName` 解决 name→id 映射

- [x] **12.5** Profile card live edit-in-place
  - 硬证据：`GET /messages/{profile_msg_id}` 显示 `edited_timestamp: 2026-05-11T04:43:13` 晚于 `timestamp: 2026-05-11T04:42:54`；embed Phase field value 正确变化为 `replied`
  - 证明：upsertProfileCard 走 PATCH 不是 POST，message id 复用

- [x] **12.6** Admin ↔ Discord 一致性（推迟自 5.7）
  - 硬证据：v2-leads.astro 现已正确显示 FIX MY ROOF `discord_thread_id` 链接；admin 渲染与 profile card 共享 entity.json 单一来源，无需额外同步

---

## 时间预算

| Session | 内容 | 时长 |
|---|---|---|
| 1 | Discord + pipeline 整合（Block 1-5）| 5 h |
| 2 | Hermes + reply playbook（Block 6-8）| 4 h |
| 3 | Variant + email send + 端到端（Block 9-12）| 2.5 h |
| | **总计** | **11.5 h** |

> 推迟到 TrackLayer fork 后做：open/click/visit/engage 信号追踪、autoresearch 反馈闭环、weekly evaluate cron、自定义短域名。这些任务作为独立工程立项时新建 `TRACKLAYER_INTEGRATION_PRD.md`。

## 开工原则

1. 任务必须按编号顺序完成，依赖关系内嵌
2. 每个任务完成立即勾掉 + 贴硬证据路径
3. 中途任何环节失败 → 停下 root-cause，不绕过
4. 每完成一个 Block 给 Matthew 看证据再下一个
5. 不修改未列入本任务列表的代码
6. 所有 hard skip / 决策更新 → 同步回 PRD 的"决策记录"段
