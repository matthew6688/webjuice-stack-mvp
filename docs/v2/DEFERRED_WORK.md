# Deferred Work

更新日期：2026-05-11

> 已经讨论 / 设计过、但暂时不优先做的事项。每条带触发条件 — 满足条件再启动。
> 顺序不代表优先级，只是登记顺序。

## 1. /admin/queue 重整 + 三页定位重构

**背景：** 2026-05-10 讨论确认 queue 与 leads 数据同源，重叠太多。当系统自动化为主时 queue 不必独立成页。

**决策：** 短期不动。queue 保留现状，等核心 audit/outreach 流程跑通有真实业务量后再做。

**待做（合并落实时执行）：**
- 把 queue 从 admin nav 移除，路由保留 30 天兼容
- /admin/leads 加 "需动作" filter view 承接 queue 列表功能
- /admin overview 重做：12 KPI + "需动作" 提醒区
- 把 queue-operations.jsonl 单独迁到 /admin/operations-log 作审计日志

**触发条件：** Block D（detailed audit）+ Block F（internal audit report）+ Block G（端到端）跑完后启动。

参考讨论：本会话 2026-05-10。

## 2. /admin/sources（Lead 进货渠道总管）

**背景：** lead 来源越来越多 — Hermes AI agent / Chrome extension / 第三方 skill / 定时 Maps 搜索 / 手工 — 需要统一承接 + 配置中心。

**决策：** 设计已确认，等核心 audit 跑通再做。

**待做：**
- 4 个 webhook 入口（Cloudflare Pages functions）：
  - `POST /api/intake/lead` 通用
  - `POST /api/intake/hermes` Hermes agent 专用
  - `POST /api/intake/chrome-ext` Chrome 扩展
  - `POST /api/intake/scrape-result` 外部 skill 批量回报
  - 鉴权：单 `INTAKE_API_KEY` 共用即可
- 统一 body schema 基于 V2 PRD `business_profile`
- 进来后流程：dedupe → discovery store entity → cheap audit V2 → 写 provenance
- `data/admin/scrape-schedules.json` 调度配置
- GitHub Actions cron `.github/workflows/scrape-schedule.yml` 每 30 min 触发到期任务
- **关键约束：调度用 random 时间间隔，不是固定每日**（避免被 Google 反爬识别为机器人 + 模拟真实人工节奏）。例如 8-72 小时随机区间，每个关键词独立 jitter
- 与本地 Maps search skill 配合（不依赖外部付费 API）
- /admin/sources 页面三 tab：Schedules / Webhooks / Manual + Run history

**触发条件：** 等第一个外部 skill（Hermes / Chrome ext）想推 lead 进来时启动。

## 3. /admin/operations-log

**背景：** queue 移除后 `data/leads/queue-operations.jsonl` 的事件流需要可视化页面给审计用。

**触发条件：** 与上面 #1 一起做。

## 维护规则

- 任何"讨论过但推迟"的设计决策，必须落到这份文档
- 启动一条时，把它移到对应的 PHASE 计划文档（PHASE_1_TASKS.md / PHASE_2_TASKS.md）
- 不要让推迟的事项消失在聊天记录里
