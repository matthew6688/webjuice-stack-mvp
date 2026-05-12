# Hermes Agent · 深度调研报告

调研日期：2026-05-13
版本：v0.13.0 (v2026.5.7) · "Tenacity Release"
方法：跑过每个 `hermes <cmd> --help` · 读 RELEASE_v0.7~v0.13.md · 读 ~/.hermes/skills/ 49 个 skill
覆盖：35 个顶级 subcommand · 主要二级命令 · 7 个 profile 当前状态

---

## 一、CLI 全表 · 35 subcommands

| # | 子命令 | 一句话用途 | 我们用没用 | 应该用？ |
|---|---|---|---|---|
| 1 | `chat` | 交互式 chat session（可 --resume / --continue / --worktree / --skills 预载） | 用 | ✓ |
| 2 | `model` | 选 inference provider + 默认 model | 用 | ✓ |
| 3 | `fallback` | 配 fallback provider 链（rate-limit/overload 自动降级） | ✓ 已配 codex 链 | ✓ |
| 4 | `gateway` | Messaging gateway 管理（启停 + Telegram/Discord/WhatsApp/...） | 用（Discord） | ✓ |
| 5 | `setup` | 交互式 wizard（model/tts/terminal/gateway/tools/agent 分段） | 部分用 | — |
| 6 | `whatsapp` | QR 码配 WhatsApp | 没用 | 可考虑 |
| 7 | `slack` | 生成 Slack manifest（每个 gateway 命令注册成 slash） | 没用 | 暂跳过 |
| 8 | `login` / `logout` / `auth` | OAuth 登录 + pooled credential 池 + spotify PKCE | 部分用 | ✓（多 key 池） |
| 9 | `status` | 查所有组件状态（--all/--deep） | 用 | ✓ |
| 10 | `cron` | 调度任务（cron/每隔/once） | ✓ 1 个 SOP-0 心跳 | ✓✓✓ 大幅扩用 |
| 11 | `webhook` | 动态 webhook 订阅（HTTP POST → agent / 直发） | ✗ 未启用 | ✓✓✓ 立刻启用 |
| 12 | `kanban` | 多 profile 任务板（SQLite + heartbeat + 自动 dispatch） | ✓ 知道但用得浅 | ✓✓✓ |
| 13 | `hooks` | shell 脚本生命周期 hook（pre/post tool_call, on_session_start） | ✗ 没配 | ✓✓ |
| 14 | `doctor` | 诊断 + --fix | 偶尔用 | — |
| 15 | `dump` / `debug` | 导出 setup summary / 上传 log 给支持 | 没用 | — |
| 16 | `backup` / `import` | zip ~/.hermes/（--quick 只备 critical） | 没用 | ✓ 接入 CI |
| 17 | `checkpoints` | shadow git 快照（write_file/patch 前自动）；v2 真·prune | 没用 | ✓（pruning） |
| 18 | `config` | show/edit/set/check/migrate | 偶尔用 | — |
| 19 | `pairing` | DM pairing 码（用户授权） | 没用 | ✓ 对外开放时 |
| 20 | `skills` | 浏览/搜/装/检查/卸/audit/publish/snapshot/tap/config | 装过几个 | ✓✓ |
| 21 | `plugins` | git URL 安装的插件 | 没用 | ✓ |
| 22 | `curator` | 后台 auxiliary-model 维护 skill 库（自动 prune/合并） | 没用 | ✓ |
| 23 | `memory` | 外置 memory provider（honcho/mem0/byterover/holographic/hindsight/retaindb/openviking） | 没用（built-in MEMORY.md OK） | 评估 |
| 24 | `tools` | 启/停 toolset（per platform）+ MCP tool toggle | ✓ 用 | ✓ |
| 25 | `computer-use` | macOS cua-driver（UI 自动化） | 已装 | ✓ |
| 26 | `mcp` | MCP server 管理 + `mcp serve` 把 Hermes 自己当 MCP 暴露 | ✗ 无 MCP server | ✓✓✓ |
| 27 | `sessions` | SQLite session 库（list/export/delete/prune/rename/browse） | 偶尔用 | ✓ |
| 28 | `insights` | 30 天 token / cost / tool pattern / activity 分析 | 没用 | ✓✓ 财务可见 |
| 29 | `claw` | OpenClaw 迁移 | 不相关 | — |
| 30 | `acp` | 把 Hermes 当 Agent Client Protocol server 跑（VS Code/Zed/JetBrains） | 没用 | 可选 |
| 31 | `profile` | 多 profile（list/use/create/clone/export/import/install/update） | ✓ 7 个 profile | ✓ |
| 32 | `dashboard` | Web UI（默认 localhost:9119，--tui 可在浏览器跑 chat） | 没用 | ✓✓ |
| 33 | `logs` | tail / filter agent.log / errors.log / gateway.log | 偶尔 | ✓ |
| 34 | `version` / `update` / `uninstall` / `completion` | 维护类 | 用 | ✓ |

---

## 二、深度功能解读

### 1. kanban — 远比"任务板"强

不是简单 todo。是 **durable multi-agent collaboration board**（v0.13 主打功能）。

实际能力（用 `--help` 验证）：

- **任务创建** `hermes kanban create "title" --body BODY --assignee <profile> --workspace scratch|worktree|dir:<path> --skill X --skill Y --parent <id> --priority --triage --idempotency-key K --max-runtime 30m --max-retries 1 --json`
  - `--workspace worktree`：自动开 git worktree（多 agent 并行同 repo 无冲突）
  - `--skill X`：强制 worker 载入 skill X（即 cron+kanban 都能定向调用 skill）
  - `--idempotency-key`：去重，重复 create 同 key 不会建新卡片 ← **对我们 SOP-1 dedup 是天然契合**
  - `--triage`：先放 triage 列，由 `kanban specify` 用 LLM 补全规格再 promote → todo
  - `--max-runtime`：到点 SIGTERM 重新排队（防 worker 跑飞）
- **boards** `hermes kanban boards {list,create,switch,rename,rm}` — **支持多 board**，"一安装多 kanban"。每个 board 自己 DB + workspace 目录 + dispatcher loop。→ **每个客户/项目一个 board 可行**。
- **dispatch** `hermes kanban dispatch [--max N] [--failure-limit 2]` — 单次扫一遍：reclaim stale workers / promote ready / spawn workers。`hermes kanban daemon` 已 DEPRECATED，dispatcher 现在跑在 gateway 里（即 `hermes gateway start` 自带 dispatcher）。
- **notify-subscribe** `--platform discord --chat-id <id> --thread-id <tid> --user-id <uid> <task_id>` — **订阅单个 task 的所有事件流到 Discord 频道/线程**。这是把 kanban 变成 Discord 工单系统的钥匙。
- **specify** `hermes kanban specify [--all] [task_id]` — 用 LLM 把 triage 列卡片扩成完整规格，--all 一次扫全 triage。**relevant：我们可以把 raw lead drop 进 triage，让 specifier 写出 audit 规格。**
- **context** `hermes kanban context <task_id>` — 打印一个 task 的完整 context（用于 handoff 或 inspection）。
- **link / unlink** — 父子任务依赖图，子任务 ready 才会触发。
- **watch / tail** — 实时事件流 / 单 task 事件流（Ctrl+C 退出）。
- **diagnostics** — 列当前 board 上的 active diagnostics（distress signals）。
- **hallucination gate** — v0.13 加：worker 声明已完成但实际没产物 → 不放过。

**对我们的直接映射**：

| 我们的概念 | kanban 实现 |
|---|---|
| 每个客户一个 workspace | `boards create` 一个 board / customer |
| Lead 去重（SOP-1） | `--idempotency-key place_id` |
| Audit 流程：raw → enriched → audited → proposal | `link` 父子依赖；每阶段一个 task |
| 不同 agent 干不同活 | `--assignee enricher / outreacher / website-agent` |
| 任务结果通知 Discord 线程 | `notify-subscribe --platform discord --thread-id` |
| Lead 先收集再细化 | `--triage` + `kanban specify --all` |
| 并行 build 多个网站 | `--workspace worktree`（per-task git worktree） |

### 2. cron — 比想象的强

`hermes cron create <schedule> [prompt] --name N --deliver TARGET --repeat N --skill S --script PATH --no-agent --workdir DIR`

- **schedule** 支持 `30m`、`every 2h`、标准 cron `0 9 * * *`
- **--deliver**: `origin / local / telegram / discord / signal / platform:chat_id`（即 cron 结果直送 Discord 频道）
- **--skill** 可重复：定时把某个 skill 注入 prompt 让 agent 用
- **--script** + **--no-agent**: 经典 watchdog 模式 —— 纯 shell 脚本上 cron，stdout 空则静默，非空 verbatim 发到 deliver target。**零 LLM 成本** ← 我们的 SOP-0 心跳已经在用这条
- **--workdir**: 自动注入该目录的 AGENTS.md / CLAUDE.md / .cursorrules ← cron job 看到的就是项目上下文
- **prompt-injection 扫描** v0.13 起：包含 skill 内容在内的完整 prompt 都过安全扫
- 与 kanban 关系：cron 不直接建 kanban 卡，但 cron 里的 prompt 可以让 agent 调 kanban 工具

**当前我们只有 1 个 cron job**（`SOP-0 daily 09:00 heartbeat`）。

### 3. webhook — **当前完全未启用**

`hermes webhook subscribe <name> --prompt 'Templated {payload.field}' --events evt1,evt2 --skills s1,s2 --deliver discord --deliver-chat-id <id> --secret HMAC --deliver-only`

- HTTP server 集成在 gateway 内，路径 `/webhooks/<name>`
- `--deliver-only`：**零 LLM 推送** —— webhook payload 模板化后直发 Discord，相当于免费的"通知中转"
- HMAC `--secret`（不填自动生成）
- `--events` 过滤事件类型
- 启用方式：`hermes gateway setup` 或在 profile config.yaml 加 `platforms: webhook: enabled: true, extra: {host, port: 8644, secret}`

**业务用法**：
- Stripe / 支付 webhook → 自动建 kanban 卡 + Discord 通知
- 表单提交（Cloudflare Pages Form / Tally）→ 触发 `audit` skill + assign 给 outreacher
- GitHub PR events → 触发 review agent
- Cloudflare Worker cron → POST → 让 Hermes 干活
- 我们 admin UI 里的"加客户"按钮 → 直接 POST webhook 触发 enricher

### 4. MCP — 双向

`hermes mcp {serve, add, remove, list, test, configure, login}`

- **`hermes mcp serve`** —— **把 Hermes 当 MCP server 暴露**，其他 agent（Claude / Cursor）能调用 Hermes 的全部 conversation。即我们可以从 Claude Code 里直接呼叫 marketer / website-agent profile。
- **`hermes mcp add <name> --url URL` / `--command npx --args ...`** — 装 MCP server，支持 OAuth + header auth + preset。v0.13 加 SSE transport + OAuth 转发 + image result MEDIA tags。
- **目前我们 `mcp list` 显示 No MCP servers configured** —— 一个 MCP server 都没装。

**应装清单**：
- filesystem MCP（结构化文件操作）
- sqlite MCP（直接查我们的 leads DB）
- 自己写一个 `profitslocal-leads` MCP（SOP-1 dedup / scoring / lead 查询）暴露给 Hermes → 所有 profile 都能调
- GitHub MCP / Stripe MCP / Cloudflare MCP

### 5. Skills — 已装 49 个 + curator 自动维护

格式（看 `dokobot/SKILL.md`）：YAML frontmatter（name / description / read_when[] / emoji / homepage / compatibility / allowed-tools / metadata） + Markdown 正文。可以有 `references/` + `scripts/` 子目录（如 `web-access/`、`google-workspace/`、`domain-intel/`）。

**关键点**：
- `read_when[]` —— LLM 用这个列表决定何时触发 skill（类似 Claude Code 的 trigger description，更结构化）
- `compatibility` —— 列出需要的二进制 / 环境（如 `dokobot --version`）
- `allowed-tools` —— 限定该 skill 只能用哪些 tool（白名单）
- `[[as_document]]` 指令（v0.13）—— skill 内容可强制走"附件"通道（Discord/Telegram 支持平台原生 doc）
- `curator` 自动评分、合并、归档 idle skill；bundled/hub skill 永远不动；archive 可还原；`hermes curator backup` 自动 tar.gz 整库

**对我们已有的 SOP**：
- 每个 SOP 可以是一个 skill（`audit/`、`scoring/`、`distill/`、`outreach-personalize/`）
- 已装但未用的关键 skill：`himalaya`（IMAP/SMTP CLI email）、`google-workspace`、`xitter`、`linear`、`notion`、`domain-intel`、`duckduckgo-search`、`parallel-cli`、`smart-search`、`web-access`、`huashu-design`、`mcp/native-mcp`、`mcp/mcporter`、`opencli-*`
- `curator` 可以替代我们自己造的 skill ownership 检查（部分）

### 6. computer-use — macOS

`hermes computer-use {install, status}` 装 `cua-driver` 二进制。
- 已显示 `computer_use 🖱️ enabled` 在 toolset list
- 只有 macOS。可在 macOS 控制鼠标键盘
- **不能直接控 Android**（需配 ADB scrcpy 走 terminal toolset；或加 Android-specific MCP）

### 7. memory + checkpoints

**memory** providers（择一）：honcho · openviking · mem0 · hindsight · holographic · retaindb · byterover；built-in 是 MEMORY.md + USER.md（永远开）。`hermes memory setup` 交互式选。
- 我们已用 built-in（`~/.claude/projects/.../memory/MEMORY.md`），未上外置
- 评估：上 mem0 / honcho 让 per-customer memory 更结构化（向量检索）

**checkpoints v2**（v0.13 rewrite）：write_file / patch / terminal 前自动 shadow-git 快照；可 `hermes checkpoints status / prune / clear`；有 max_snapshots=50 / 500MB cap / 7 day retention / 24h min_interval。**未启用我们这边**——config show 显示 `enabled: true`，但实测目录 ~/.hermes/checkpoints 没几个项目。

### 8. sessions

SQLite 集中存 session（不是 transcript 文件）：`list / export / delete / prune / stats / rename / browse`（interactive picker）。
- **`browse`** 是隐藏宝石：交互式 fuzzy 搜索过往 session、按标题恢复
- v0.13: gateway 重启自动恢复中断会话；`/update` 不打断；source-file reload 也续

### 9. Multi-profile — 我们已有 7 个

| Profile | Model | Gateway | 当前用途（推断） |
|---|---|---|---|
| `default` | kimi-for-coding | stopped | 兜底 |
| `curator` | kimi-for-coding | running | 维护 skill 库 |
| `distributor` | kimi-for-coding | running | 分发？（Discord 上有 bot） |
| `enricher` | kimi-for-coding | running | 补全 lead（有 alias） |
| `marketer` ◆ | kimi-for-coding | running | 当前 active profile（营销） |
| `outreacher` | kimi-for-coding | running | 外联文案 |
| `prospector` | kimi-for-coding | running | 找新 lead |
| `website-agent` | gpt-5.4-mini | running | 建站（唯一非 Kimi） |

每 profile 独立 config.yaml / .env / auth.json / SOUL.md。可 `--clone` / `--clone-all` 从现有 profile 派生；可 `profile install <git_url>` 装"distribution"（发布版 profile）；profile 之间通过 **kanban + gateway dispatcher** 协作（`--assignee outreacher` 就分到那个 profile 的 worker）。

`hermes gateway list` 一行看所有 profile 的 gateway 状态。

### 10. Gateway + Adapters — 20 个平台

支持平台（v0.13 起 20 个）：CLI · Discord · Telegram · WhatsApp · Slack · iMessage(BlueBubbles) · WeChat(Weixin) · WeCom · QQBot · Tencent 元宝 · Matrix · Mattermost · DingTalk · Feishu · IRC · Teams · Google Chat · SMS(Twilio) · Signal · API server (Open WebUI compatible)。
- 都通过 `hermes gateway setup` wizard 配
- v0.13: `allowed_channels / chats / rooms` whitelist 跨 Slack/TG/Mattermost/Matrix/DingTalk
- v0.13: Discord role-allowlists guild-scoped（CVSS 8.1 闭口）
- `slack manifest` 自动生成所有 gateway 命令到 Slack slash command 注册清单

**Discord forum threads**：gateway 已有"home channel notification"针对 kanban 卡的逐平台开关，`notify-subscribe --thread-id` 直发到 thread。

### 11. Tools toolsets 一览（我们已开）

```
✓ web · browser · terminal · file · code_execution · vision · image_gen · tts ·
  skills · todo · memory · session_search · clarify · delegation · cronjob ·
  messaging · computer_use
✗ video · moa · rl · homeassistant · spotify · yuanbao
```
- **delegation**（启用）：agent 之间 sub-task 转交工具
- **clarify**（启用）：agent 主动澄清问题（关键，避免猜）
- **messaging**（启用）：跨平台发消息工具（agent 自己能往 Discord 发）
- **session_search**：在历史 session 里搜（语义 + 关键词）
- **moa**（mixture of agents）—— 现关，可考虑开
- **video**（关）—— `video_analyze` v0.13 加，Gemini 视频理解，建站演示视频审计可用

### 12. Plugins

`hermes plugins install <git_url>` —— git 仓库即 plugin。可注册 slash command / dispatch_tool / pre_tool_call veto / transform_tool_result / transform_terminal_output / image_gen backend / dashboard tab。v0.11+ 大扩面。

→ 我们可以把 4 个 IP 能力（SOP-1 dedup / scoring / distill / audit）发成 plugin，全 profile + 社区共用。

### 13. Dashboard / Insights / Hooks / Curator

- `hermes dashboard` —— localhost:9119 web UI；--tui 把交互 chat 也搬进浏览器；--insecure 可暴露到 LAN（**别开**）
- `hermes insights --days 30 --source discord` —— token、cost、tool 使用、活动趋势分析。**财务可视化**直接拿去用，不用自己造
- `hermes hooks` —— shell 脚本生命周期 hook，**当前我们 0 个 hook**。可在 pre_tool_call 注入策略（如"调 Firecrawl 之前先查 ledger"）
- `hermes curator` —— 后台维护 skill 库；archive/prune/restore/backup/rollback；自动 tar.gz 备份

---

## 三、销售业务相关功能逐项核查

| 业务需求 | Hermes 直接支持？ | 怎么用 |
|---|---|---|
| 发邮件（事务/外联） | ✓ `himalaya` skill (IMAP/SMTP) | 已装；要 `~/.config/himalaya/config.toml` |
| 收邮件 + parse + classify | ✓ himalaya search/read | 配 cron 拉收件箱 → assign kanban |
| SMS 发/收 | ✓ Twilio SMS adapter 内置 | gateway setup 选 sms；webhook signature 已修 |
| 语音通话（Vapi-like） | △ Google Meet plugin（v0.12）能 join/transcribe/speak/follow-up；TTS 用 ElevenLabs/xAI Custom Voices | 不是 Vapi 风格 inbound，但可外呼 |
| 日历 / 预约 | ✓ google-workspace skill（含 Calendar） | 已装于 productivity/ |
| CRM 联系人 | △ Notion / Linear skill；无原生 | 用 kanban + 客户 board 替代 |
| 自动回复规则 | ✓ `webhook --deliver-only` + cron + hooks | 模板化推送零 LLM |
| Drip / nurture | ✓ cron 系列 + `--repeat` + idempotency-key | per-lead 一组 cron |
| A/B 路由 | △ 通过 plugin 的 `pre_tool_call` veto / `transform_llm_output` hook | 自己实现 |
| 持久化任务状态（lead 在阶段 X） | ✓ kanban + 父子 link + memory | kanban 卡是状态机 |
| 定时提醒（3 天无回复 ping 我） | ✓ cron + `--repeat` + webhook callback | 标准模式 |
| 跨渠道路由（邮件回 → 转 Discord） | ✓ `messaging` toolset + 任意 adapter 互发 | agent 调用 send_message tool |
| 文件/文档生成（Word/PPT/PDF） | ✓ ocr-and-documents / nano-pdf / powerpoint skill（productivity/） | 已装 |
| 截图 / UI 验证 | ✓ browser toolset + Camofox（v0.7） + computer_use | 已开 |
| 搜索（多 provider） | ✓ v0.13 split web tools：search/extract/browse 各选 backend；SearXNG native；Firecrawl/Tavily/Exa/Parallel | 我们 5-tier 路由可下沉到 hermes web config |

---

## 四、我们没在用但应该用的 TOP 10（按 ROI 排）

1. **webhook server** —— 当前 0 订阅。表单/Stripe/GitHub/Cloudflare → 自动建 kanban 卡 + Discord 推送，零 LLM 成本可用。立即收益最大。
2. **kanban boards per customer** —— 我们已有 marketer 单 board。`boards create` 一客户一 board，workspace 隔离 + Discord thread 订阅。直接对齐 master.md per-customer 架构。
3. **kanban --idempotency-key + --triage + specify** —— 完美替代我们自造的 SOP-1 dedup。raw lead drop 进 triage 列，`specify` 用 LLM 写 audit 规格再 promote。
4. **`hermes mcp serve`** + 自写 `profitslocal-leads` MCP —— 把 SOP-1/scoring/distill 暴露成 MCP，Claude Code、所有 7 个 profile 共用。停止在每个 profile 里 reimplement。
5. **hermes dashboard + insights** —— /admin 部分功能（cost/token visibility）现成；`insights --days 30` 直接拿。
6. **hooks (pre_tool_call)** —— shell 脚本注入 ledger check（任何 paid call 前查 ledger 余额），policy 强制比 LLM 强。
7. **cron `--workdir`** —— 把项目 AGENTS.md / .cursorrules 自动注入 cron prompt；停止手抄 context。
8. **kanban `--workspace worktree`** —— 并行多客户网站 build（多 agent 同 repo 无冲突）。
9. **plugins** 发布 4 个 IP 能力 —— scoring / distill / audit / dedup 各一 plugin，git URL 装。社区+多 profile 共用。
10. **`himalaya` skill** —— 已装但没配。3 行 config.toml 即可让 outreacher 真的发邮件 / 拉收件箱。

---

## 五、不适合我们 / 跳过

- `claw` — OpenClaw 迁移，不相关
- `whatsapp` — 商业账号 + Meta verification 麻烦；Discord 已够
- `slack manifest` — 没用 Slack
- `homeassistant` / `spotify` / `yuanbao` toolset — 业务无关
- `acp` — 编辑器集成；除非 Matthew 想在 Zed 里调 hermes，否则跳
- `memory` 外置 provider — built-in MEMORY.md 当前够用；上 mem0/honcho 之前先证明 RAG 价值
- `computer-use` 全自动化网页 — Dokobot + Camofox + browser toolset 都已能做，computer_use 留给真·桌面 app（PSed 等）
- `tts` ElevenLabs 大手笔 — 除非做语音电台，先用 OpenAI TTS gateway 免费版

---

## 六、版本历史亮点（v0.7 → v0.13）

| 版本 | 日期 | 主题 | 对我们关键 |
|---|---|---|---|
| **v0.7** 4/3 | The Resilience Release | pluggable memory · credential pool 轮转 · Camofox anti-detect 浏览器 · inline diff · gateway 硬化 · secret 出口扫描 | credential pool（多 key 轮转 = 我们 ledger rotation 自带） · Camofox（替代 Browserbase） |
| **v0.8** 4/8 | The Intelligence Release | background process 完工通知 · /model 跨平台切 · 自优 GPT/Codex tool-use · Gemini native · 不活动超时（不是墙钟） · approval 按钮 · MCP OAuth2.1 PKCE · centralized logs | 不活动超时 → 长 task 不被砍 · approval 按钮 → Discord 审批 |
| **v0.9** 4/13 | The Everywhere Release | Termux/Android · iMessage(BlueBubbles) · WeChat/WeCom · Fast Mode `/fast` · 后台 watch_patterns · pluggable context engine · proxy 全平台 | watch_patterns（pattern-match 触发） · 上 iPhone/Android |
| **v0.10** 4/16 | Nous Tool Gateway | 订阅自带 web search + image_gen + TTS + browser | 如果上 Nous Portal 订阅，4 个 paid tool 包月 |
| **v0.11** 4/23 | The Interface Release | Ink TUI 重写 · transport ABC · AWS Bedrock 原生 · 5 新 inference (NIM, Arcee, Step, GeminiCLI OAuth, Vercel) · GPT-5.5 over Codex · QQBot · plugin 大扩面 · `/steer` mid-run 提示 · shell hooks · **webhook direct-delivery** | shell hooks · webhook deliver-only · /steer |
| **v0.12** 4/30 | The Curator Release | autonomous curator · 自我改进 loop · ComfyUI/TouchDesigner-MCP bundled · LM Studio first-class · 4 新 provider · pluggable gateway platforms · Teams plugin · 元宝 · Spotify native · Google Meet plugin · `hermes -z` 一发 prompt · update --check | curator 自动维护 skill · `hermes -z` 脚本管道用法 · Google Meet 拉会 |
| **v0.13** 5/7 | **The Tenacity Release** | **durable multi-agent kanban** · `/goal` 跨轮目标锁 · video_analyze · xAI Custom Voices · 7 语言 i18n · Google Chat (20th platform) · session 自恢复 · cron `no_agent` 模式 · 8 个 P0 安全 · checkpoints v2 · post-write delta lint · MCP SSE + OAuth forwarding · `[[as_document]]` skill 指令 · 100 新启动 tip | kanban 全部新能力 · cron --no-agent · video_analyze 审计建站演示 · checkpoints v2 真 prune |

---

## 七、给 V3 的建议

### 应立刻采用（5 个）

1. **kanban-per-customer + Discord thread 订阅** —— 每客户一 board；raw lead 进 triage；`specify` 写 audit 规格；`notify-subscribe` 直发客户 Discord 线程。**这一项替代 master.md 的 50% 状态管理。**
2. **webhook server** —— 启用 `gateway setup` 里的 webhook，部署到 `webhooks.profitslocal.com`。Cloudflare Form / Stripe / GitHub / 内部 admin UI 直接 POST，零 LLM 推送 + 触发 agent 二选一。
3. **`hermes mcp serve` + 自写 leads MCP** —— 把 SOP-1 dedup / scoring / distill / audit 暴露成单一 MCP。Claude Code + 全 7 profile + 未来插入的任何 agent 复用同一套实现。
4. **hooks + `--workdir`** —— pre_tool_call hook 检查 ledger；cron `--workdir /Users/matthew/Developer/google-map-website` 自动注入项目规则。
5. **`hermes -z` 嵌入 admin 后端** —— admin UI 的"重审"按钮直接 `hermes -z "audit lead X"` shell-out，stdout 写回数据库。停止 reimplement agent runtime。

### 应停止造（Hermes 已有的 5 个）

1. **SOP-1 dedup 自研** —— 用 `kanban create --idempotency-key place_id` 自带。停掉自建去重表。
2. **per-customer state machine（master.md 状态字段）** —— 用 kanban 卡 status（todo/running/blocked/done）+ 父子 link 替代。
3. **手写 ledger / cost tracker** —— `hermes insights --days N` 自带 token/cost/tool 分析。改成 insights JSON export → 我们 admin 展示层即可。
4. **手写 cron 通知器** —— `hermes cron --no-agent --deliver discord:CHAN` 零代码搞定。
5. **多 profile 协作的自造 dispatcher** —— gateway 自带 kanban dispatcher，多 worker / heartbeat / reclaim / retry 全自动。

### 留给我们造（不可替代 4 个）

1. **lead 评分模型 + audit rubric**（业务 IP）—— Hermes 不知道本地商家怎么评分，必须自写。但**封装成 MCP server / plugin** 让 Hermes 调用，不要 reimplement 在每个 profile。
2. **per-customer master.md 内容（HTML + 视频 + slide 输出）** —— hyperframes / huashu-design 渲染管线我们已建好，Hermes 是 driver 不是 renderer。
3. **行业知识 + 本地化数据**（中文报告 typography 规范、proposal 文风、华人商家 personas）—— 这些是 SOUL.md + skill prompt，不可替。
4. **/admin UI 业务视图**（leads 卡片、audit 评分可视化、stage 卡片）—— Hermes dashboard 是 agent-centric，我们需要 customer-centric 视图。但**数据后端**改用 hermes 的 SQLite（state.db / kanban.db / response_store.db），不要自建。

---

## 附：当前 Hermes 状态摘要

- 版本：v0.13.0
- Active profile：marketer
- Profiles：7 个（curator/distributor/enricher/marketer/outreacher/prospector/website-agent + default）
- Gateway：6 个 profile 在跑（marketer/curator/distributor/enricher/outreacher/prospector/website-agent）
- 当前 kanban board：default（空）
- 当前 cron job：1 个（SOP-0 daily 09:00 心跳，deliver discord）
- 当前 webhook：未启用（platforms.webhook.enabled = false）
- 当前 MCP server：0
- 当前 hooks：0
- 已装 skill：49 个（含 dokobot, himalaya, google-workspace, xitter, linear, notion, domain-intel, huashu-design 等）
- API keys：仅 Kimi + Anthropic 配了（其他 18 个未设）
- Fallback chain：openai-codex/gpt-5.4 → openai-codex/gpt-5.4-mini
- TUI / Dashboard：未常驻
- Curator：未跑过（skill 库未自动维护过）

报告结束。
