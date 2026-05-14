# V3 Skills 索引

> **作用域**: 所有 Hermes / Claude skills 与 V3 业务的关系登记。
> **owner**: 跨模块 SoT · 任何新 skill 加进来必须更新本文档。
> **status**: D36 (2026-05-14) 第一版 · 清理 7 V2 leftover · 标记 2 stale-but-kept 后。

---

## 0. TL;DR

```
Hermes profile · 共 ~50 skills 跨多个 category
V3 直接相关 · 1 个 active (profitslocal-website-intake)
2 个 stale-but-kept (M4/M5 时重写参考)
7 个 archived to ~/.hermes/_archive-v2-skills-2026-05-14/ (V2 leftover)
其他 ~40 个 · 通用工具 (email/research/devops/etc.) · 不属 V3 业务但有用
```

---

## 1. V3 业务相关 skills (3 个)

### 1.1 ✅ Active

#### `profitslocal-website-intake`
- **Path**: `~/.hermes/profiles/marketer/skills/b2b-marketing/profitslocal-website-intake/`
- **Version**: **4.0** (D40 · 2026-05-14)
- **作用**: SOP-1 intake 入口 · 4 路 CLI 选择 (pipeline-batch-start / places-search-intake / single-enrich / ingest-image)
- **触发**: User 说 "find {niche} in {city}" · 贴 Maps URL · 上传名片 · 等
- **V3 状态**: SOP-1 主入口 · 但 Discord listener 99% 直接走 intent-router · 不调本 skill · 仅 Hermes 自然对话时加载
- **同步内容** (D40 update):
  - D37 contact extraction (audit 后自动抓 email/social/contact_us)
  - D38 audit 富信息 stage 消息 + 2-page crawl + auto-republish
  - D40 图片入口自动 multi-angle Places enrich + AI judgment
  - D40 admin URL 删除 + webhook fallback + business name display
- **维护契约 (强制)**: 加新 V3 decision 必须更新本 skill metadata.current_d + 加 "V3 DXX 自动行为" 节。代码改了 skill 不改 = Hermes 行为脱节。

### 1.2 ⚠️ Stale · keep for M4/M5 reference

#### `outbound-b2b-website-agency`
- **Path**: `~/.hermes/profiles/marketer/skills/b2b-marketing/outbound-b2b-website-agency/`
- **Last meaningful update**: May 4 (V2 era · 后续 V3 改造未同步)
- **Marker**: `ARCHIVED-V3-D36.md` (D36 标记 · 不再活跃)
- **Keep for**: M4 outreach 启动时参考 cold-email + GitHub secrets 模式
- **不要**: 在 V3 主路径调用 (用 M1-M3 模块代替)

#### `b2b-website-cloudflare-astro`
- **Path**: `~/.hermes/profiles/marketer/skills/devops/b2b-website-cloudflare-astro/`
- **Marker**: `ARCHIVED-V3-D36.md`
- **Keep for**: M5 paid customer domain provisioning (wrangler + GitHub secrets 模式)
- **V3 active 替代**: `pl:publish-demo` (`scripts/cli/pl-publish-demo.js`) · reference-adapter HTML 而非 Astro template

---

## 2. Archived (V2 leftovers · D36 删除)

**位置**: `~/.hermes/_archive-v2-skills-2026-05-14/`
**回滚**: `mv <name> back to original profile path` (per MANIFEST.json)

| Skill | 原因 |
|---|---|
| `profitslocal-lead-ops` | V2 lead 推进 · 引用 `docs/v2/` · V3 entity/M2 流程替代 |
| `profitslocal-restaurant-website-handoff` | V2 case.json/context-packet 架构 · 单 niche restaurant |
| `profitslocal-opa-bar-mezze-handoff` | 单客户 一次性 · 老案子 |
| `b2b-restaurant-menu-outreach` | restaurant niche · V3 主线 roofer |
| `local-business-preview-site-outreach` | V2 auto-gen + placeholder · reference-adapter 替代 |
| `restaurant-menu-outreach-pipeline` | 与上重复 · 餐厅 niche |
| `b2b-local-business-outreach-pipeline` | V2 餐厅 base · 已撤回 |

---

## 3. 通用工具 skills (Hermes profile · 不属 V3 业务但有用)

按 category 分类 · 不全列 · 列重要的:

### 3.1 Web access / scraping
- `~/.hermes/skills/dokobot` · `doko-search` · `doko-research` — Dokobot 搜索 / 研究
- `~/.hermes/skills/web-access` — generic web 访问
- `~/.hermes/skills/opencli-browser` · `opencli-adapter-author` · `opencli-autofix` — OpenCLI 浏览器
- `~/.hermes/skills/smart-search` — meta-search

### 3.2 Email / outreach
- `~/.hermes/skills/email/himalaya` — Email CLI (Himalaya)

### 3.3 Smart home / personal
- `~/.hermes/skills/smart-home/openhue` — Philips Hue 灯控
- `~/.hermes/profiles/marketer/skills/productivity/maps` — Maps
- `~/.hermes/profiles/marketer/skills/productivity/linear` — Linear task
- `~/.hermes/profiles/marketer/skills/productivity/notion` — Notion
- `~/.hermes/profiles/marketer/skills/productivity/airtable` — Airtable
- `~/.hermes/profiles/marketer/skills/productivity/powerpoint` — PowerPoint

### 3.4 Autonomous AI agents
- `~/.hermes/skills/autonomous-ai-agents/claude-code` — Claude Code SDK
- `~/.hermes/skills/autonomous-ai-agents/codex` — Codex CLI
- `~/.hermes/skills/autonomous-ai-agents/hermes-agent` — Hermes self
- `~/.hermes/skills/autonomous-ai-agents/opencode` — OpenCode

### 3.5 Design / UX
- `~/.hermes/skills/huashu-design` — design system
- `~/.hermes/profiles/website-agent/skills/design` · `design-brief` · `design-review` · `huashu-design` · `web-prototype` · `saas-landing` · `frontend-design` — 设计辅助

### 3.6 DevOps (跨项目通用)
- `~/.hermes/profiles/marketer/skills/devops/`:
  - `cloudflare-email-worker-agent` — CF worker for email
  - `cloudflare-pages-deploy` — generic CF Pages
  - `cloudflare-registrar-api` — domain registration
  - `find-scheduled-job` — schedule debug
  - `kanban-orchestrator` · `kanban-worker` — Kanban
  - `webhook-subscriptions` — Discord/Slack webhook
  - `android-sms-bridge` — SMS
  - `macos-self-hosted-hub` — macOS hub

### 3.7 Research / writing
- `~/.hermes/profiles/marketer/skills/yuanbao` — 元宝 (Tencent AI)
- `~/.hermes/profiles/marketer/skills/research/b2b-multi-country-market-scan`
- `~/.hermes/profiles/marketer/skills/note-taking/b2b-knowledge-base-domain-design`
- `~/.hermes/profiles/marketer/skills/productivity/teams-meeting-pipeline`

### 3.8 Claude built-in (`~/.claude/skills/`)
通用助理 skill · 不针对 ProfitsLocal:
- write · design · learn · think · hunt · health · read · check
- karpathy-guidelines (代码纪律 · 也适用 V3)
- andrej-karpathy-skills

---

## 4. 维护契约 (per Matthew · 必守)

### 4.1 加新 skill 时
- 更新本文档 §1 (V3 业务相关) 或 §3 (通用工具)
- commit 必带 docstring 说明加它的原因

### 4.2 V2 leftover 发现时
- 验证 V3 是否依赖 (grep imports / refs)
- 不依赖 → 移到 `~/.hermes/_archive-v2-skills-<YYYY-MM-DD>/`
- 写 MANIFEST.json 含 reason + recovery 命令
- 更新本文档 §2

### 4.3 月度审计 (TODO · 加 cron)
- 每月 1 号扫 SKILL.md mtime > 6 月 → 标 stale 候选
- 跨 V3 模块文档 grep skill 引用 → 找出 dead ref
- 报告到 Discord (`SPECIAL_ALERTS_DISCORD_WEBHOOK_URL`)

---

## 5. 与 V3 模块对应

| V3 模块 | Skill | 触发场景 |
|---|---|---|
| M1 intake (Discord 命令) | `profitslocal-website-intake` | Hermes 收到 intake 命令 |
| M2 audit | (无 skill · 直接 CLI · `npm run leads:run-pipeline`) | — |
| M3 publish | (无 skill · 直接 CLI · `npm run pl:publish-demo`) | — |
| M4 outreach (待启动) | TBD · 参考 `outbound-b2b-website-agency` (archived stale) | — |
| M5 paid (待启动) | TBD · 参考 `b2b-website-cloudflare-astro` (archived stale) | — |

V3 设计主路径用 **CLI 而非 skill** (直接 npm run · 不需 Hermes agent 介入)。Skill 只在 Matthew 跟 Hermes 自然语言对话时介入 (例: "帮我入库 brisbane 屋顶公司")。

---

## 6. 相关文档

- [README.md (SoT)](./README.md) · V3 source of truth
- [TOOL-STACK-PRD.md](./TOOL-STACK-PRD.md) · 第三方工具 + LLM cascade (D36 同步建)
- [INTAKE-RUNBOOK.md](./INTAKE-RUNBOOK.md) · 4 入口测试 runbook (D36 同步建)
- [DECISIONS-LOG.md](./DECISIONS-LOG.md) · D36 skill cleanup 决策
