# V2 Admin UI 重做 + 浏览器测试 evidence

测试日期：2026-05-11
设计语言：editorial / 锐边 / 暖米色 / Georgia serif + system sans

## 3 个页面浏览器验证

### `/admin/v2/` — V2 Overview
HTTP 200, 9138 bytes deployed live.

**渲染元素**（已截图验证）：
- Header: eyebrow `V2 Overview` + h1 `Discord-first 销售闭环` + lede + right-aligned count `82 Entities 总数`
- 4-tile summary strip: 可成交 A+B+C (8, primary highlight)、Audit 已完成 (10)、有/无网站 (79/2)、今日成本 ($0 ↔ $0)
- **Grade 分布** 横排 5 tile，每 tile 含 Georgia serif 大字母 + 数字 + 说明：
  - A=4 (mint background)
  - B=3 (sky background)
  - C=1 (peach background)
  - D=2 (coral-soft background)
  - ?=72 (lilac background, ungraded)
- **Lifecycle phase** ledger: `_unset` 82 + 说明 "尚未推送 entity 到 git，admin 看不到新状态（H.9）"
- **Deferred metrics** chips: email_open_rate / email_reply_rate / demo_click_rate / proposal_to_payment_rate / avg_cac / avg_production_time
- Footer: Last refreshed timestamp + Discord forum link + admin 老页面链接

### `/admin/v2-leads/` — Lead 看板
HTTP 200, ~17 KB deployed live.

**渲染元素**：
- Header: eyebrow `V2 Leads · Discord-driven` + h1 `Lead 看板` + lede + count `10 Graded`
- 5-tile summary strip: A 全攻 4 / B 试探 3 (primary) / C 批量 1 / D 自动归档 2 / 活跃 phase 0
- Section heads: `就绪 · A 全攻 4` / `就绪 · B 试探 3` / `就绪 · C 批量 1` / `对话中` / `归档`
- Each section: table with 10 columns (商家 / 分类·城市 / Grade chip / Phase chip / Audit / 口碑 / 信号 emoji / 上次接触 / 客户时间 / → Discord)
- **Fixed bug**: legacy `.admin-table th { position: sticky; top: 127px }` was misaligning V2 page headers. Override added (`.v2-leads-table th { position: static }`)
- **紧急操作 · CLI 救援** section: 4-card grid with grade-d colored chip backgrounds + monospace commands
- Footer

### `/admin/v2-leads/<entityKey>/` — Lead 详情页
HTTP 200, ~10 KB per entity. 8 static pages built (one per graded entity).

**渲染元素** (FIX MY ROOF Total Roof Restorations 验证)：
- Header: eyebrow `← V2 LEADS` link + h1 (Georgia serif big) + lede `29 Darien St, Bridgeman Downs QLD 4035`
- Right-aligned status pills: `A/T3` (mint border) + (no phase since git entity has no phase) + (Discord link if entity.discord_thread_id committed)
- **NEW: Reports & Evidence strip** (citrus tinted background, highest visibility position):
  - **5 typed tiles** with type-specific colored borders:
    1. Internal Audit Report — coral border (📊)
    2. Master Narrative (master.md HTML) — blue border (📄)
    3. Desktop screenshot — green border (🖼️)
    4. Mobile screenshot — green border (🖼️)
    5. Mobile 4G walkthrough (webm) — dashed blue border (🎥)
  - **Per-issue evidence (6)** collapsible details:
    - issue-generic-logo-background.png
    - issue-homepage-title-clear.png
    - issue-missing-primary-cta.png
    - issue-phone-visible-above-fold.png
- **Profile card** (left, 2-col data grid 14 fields, same as Discord embed):
  - "PROFILE CARD · DISCORD 同源" eyebrow
  - 2-col meta grid with dt/dd pairs: PHONE / PRIMARY EMAIL / BACKUP EMAIL / WEBSITE / DECISION MAKER / SOCIAL / 客户本地 / etc.
- **Right aside** (3 mini blocks):
  - Assets count + list (or "未注册 manifest" empty state)
  - Recent history (7 entries) with time + event + from→to + note
  - 紧急 CLI commands list

## CLI 全套验证（9 个 LIVE）

| CLI | 测试输入 | 实测结果 |
|---|---|---|
| `pl:list --grade A` | — | 4 leads, sorted by graded_at desc |
| `pl:kpi` | — | 82 entities · 8 sellable · by_phase {_unset: 80, replied: 1, needs-human: 1} |
| `pl:show <key>` | FIX MY ROOF | 完整 markdown 含 17:11 AEST locale 时间 |
| `pl:context <key>` | FIX MY ROOF | 1357 chars, < 3KB 上限 |
| `pl:advance <key> --to needs-human` | (noop 测试) | from→to=needs-human, noop:true |
| `pl:variant list` | — | 3 variants returned |
| `pl:email-draft <key> --variant audit-led` | B grade | T1 haiku, 13.7s, subject="Gutter and Roof Repairs — 3 design gaps costing leads" |
| `pl:reply-handle "Too expensive..."` | B lead | class=objection-price, playbook=reframe_value_or_offer_smaller_tier |
| Hermes cron list --all | — | 2 jobs paused: pl-reply-poll (every 5m) + pl-daily-tick (0 9 * * *) |

## 单元测试: 11/11 PASS

```
✓ test-v2-leads-blueprint        ✓ test-set-entity-phase
✓ test-forum-helpers             ✓ test-locale
✓ test-asset-manifest            ✓ test-lead-thread-sync
✓ test-persist-lead-grade-hook   ✓ test-reply-classifier
✓ test-variant-picker            ✓ test-daily-tick
✓ test-outreach-provider-event
```

## Live Discord thread

`https://discord.com/channels/1493925728570310756/1503256064244842547`
- Thread: [roofing] [A] FIX MY ROOF Total Roof Restorations
- 17 messages, 2 applied tags
- Profile card pinned + edited (PATCH) on every phase transition

## 部署

```
PR #7 merged to main → CF Pages live deploy (52s)
3 subsequent commits push directly to main:
  - a4ab8e72 V2 closed loop
  - 5f3e9c95 V2 admin UI rebuild — adopt brand design language
  - 2192e073 V2 lead detail: Reports & Evidence strip
  - 6273a17d V2 leads table: fix sticky-th
```

All pages deployed and verified rendering correctly on production at <https://profitslocal.com/admin/v2*>.

## 设计语言诚实自评

Before：generic Tailwind tables with gray-300 borders and rounded-md cards — Bootstrap circa 2014.

After：matches existing `local-style-2026-05-08` aesthetic:
- Eyebrow + h1 + lede header pattern
- admin-summary-strip horizontal stat tiles (no individual cards)
- 锐边 ink-black borders (var(--pl-line))
- Warm cream + paper backgrounds
- Georgia serif for numbers + business names
- System sans for body, monospace for keys/commands
- Brand color tokens for chips (mint A / sky B / peach C / coral-soft D / lilac modifier)

Confidence: matches V2_LEADS_DESIGN_LANGUAGE_2026-05-08 baseline. Could iterate further on responsive breakpoints if user has feedback.
