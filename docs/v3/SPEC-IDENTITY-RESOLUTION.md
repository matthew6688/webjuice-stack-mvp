# SPEC · Identity Resolution ("is this our business?") — modular, reusable

> **状态**: PROVISIONAL / validation-stage（codex Round 122 · 2026-05-30）。**通过 gold-set 验证门之前不进 CANONICAL**。
> **作用**: 把"判断一条查来的资料/页面是不是我们这家客户"做成**一个分层模块**——便宜的死规矩在前，拿不准才用大模型；可复用、可测试优化、Hermes 能调，验证达标后升 SOP。
> **红线**: 绝不能把**别家公司**的资料当成"是同一家"写进客户档案（mis-attribution）。宁可丢、不挂人（全自动）。

---

## 1 · 模块结构（codex 批准）
```
core/enrichment/identity/
  resolve-identity.js          # 唯一入口 resolveIdentity(entity, candidate, opts) · 编排三档
  normalize-candidate.js       # (可选) 各 adapter 的 candidate 归一成统一形状
  prompts/page-identity.v1.md  # 版本化的 page-judge prompt/rubric (运行时读, 版本号写进结果+缓存)
  README.md                    # 契约 + 示例
core/llm/match-judge.js        # judgePageIdentity() 放这里(复用现成 cascade+cache, 不另起判官子系统)
```
- **判官都留在 `match-judge.js`**（已有 judgeEnrichmentMatches 等 6 个 + cascade + JSONL 缓存）。identity/ 只做编排，不拥有判官。
- prompt 版本化（`prompts/page-identity.v1.md`），结果/缓存里带 prompt 版本号 → 方便测试和优化。**不做成 freeform SKILL.md 当运行时输入**；以后要 rubric-as-artifact 就编译成结构化产物，不是散文。

## 2 · 分层编排（最便宜在前）
```
resolveIdentity(entity, candidate, opts):
  tier0 · deterministic  = identity-match (锚点: 电话/ABN/地址/域名)  → same | different | ambiguous
  tier1 · search_llm     = match-judge.judgeEnrichmentMatches (读 URL/标题/摘要) · 仅对搜索候选
  tier2 · page_llm       = judgePageIdentity (读 tinyfish 抓的首页正文) · 仅当 ambiguous 才抓正文
```
**裁决契约（codex 加严）**:
```js
{
  status: 'same' | 'different' | 'ambiguous',
  confidence,
  tier_used: 'deterministic' | 'search_llm' | 'page_llm',
  promotable: boolean,          // 只有 promotable===true && status==='same' 才能写 canonical / 喂 buildCoreExtract
  reason, evidence: [],
  deterministic?: {...}, llm?: {...}
}
```
**codex 主调整（防精度滑坡）**:
- tier1（看标题/摘要）**不得单独提升弱匹配** → 没有硬佐证就路由到 `ambiguous`。
- tier2（读正文）**只在有具体证据时**才提升：电话/ABN/地址/自有域名匹配，或 名字+行业+地域 紧贴且无冲突。
- 拿不准到 tier2 还拿不准 → `ambiguous` → 丢弃（rather-miss，不挂人）。

## 3 · 验证 / 优化门（升 SOP 的前提）
把 `scripts/test/validate-identity-match.mjs` 升级成对 **hand-labeled GOLD SET** 的 `--validate`：
- **Gold set**: 300-500 标注对（entity ↔ candidate ↔ 期望 same/different），**故意多放 hard negatives**（同名别家/目录/连锁）。约 100-150 true-same + 200-350 different/易混。
- **指标**（codex）:
  - `false_same_count` → **必须 = 0**（红线：零误认）
  - `precision_same_observed` → **= 1.0**（带置信区间报告，别号称"统计上 1.0"）
  - `recall_same` → baseline 后调，初始目标 **≥ 0.75**
  - `ambiguous_rate` · `tier 分布` · cost/latency/cache-hit · **按档分的 false_same**（page LLM 单独可见）
- **门**: false_same=0 才许升 SOP；否则停在 provisional。

## 4 · Hermes / 复用 / skill（codex 裁定）
- **复用**: 富集主路在 `pl:run-enrichment-batch` 内**进程内调用** `resolveIdentity()`。
- **Hermes**: **不让 Hermes 走独立 CLI 做常规富集**——常规走 batch。独立 `pl:resolve-identity` CLI 仅用于**验证/调试/cron 审计/定向重判**；只有当 Hermes 需要"给实体 X 重判身份"这种操作员命令时才加进 intent-router 白名单。
- **skill?**: **逻辑 = 模块+CLI，不是 skill**（skill 在本仓是 markdown/指针/编排，明确"不重新实现逻辑"）。只有 prompt 版本化（§1）。

## 5 · 落地顺序（codex）
1. **修死规矩的过度丢弃**：名字完全一致 + 州一致时，**不让"注册办公地址邮编不同"否决**（注册地址≠店面是常态；真实数据里 115 个这样误杀）。`L.J./LJ` 这类归一。
2. **先搭 gold-set harness**（哪怕初版小）再做重 prompt 调优。
3. **建 `judgePageIdentity`**（tier2 · 读正文）。
4. **接 `resolveIdentity` + 进程内富集调用**。
5. **加 `pl:resolve-identity` CLI**（验证/调试/cron）。
6. **扩 gold set + 调阈值/prompt**。
7. **SOP + canonical**：门过后写 `docs/v3/SOP-IDENTITY-RESOLUTION.md` + CANONICAL §0 行。

## 5.5 · ⚠️ 源感知守护（codex R125 · 必须在 resolveIdentity 落实）
`name_exact+state` 这个确定性 verifier **只对官方注册来源**（license / ABR）安全——注册名在一州内基本唯一。
**对任意 web/search/page 候选不安全**（那里的 state 是弱/推断的，GBP 商业名可能和别家注册名碰巧归一相等）。
→ `resolveIdentity` 必须**源感知**：只有 `source ∈ {license, abr}` 的候选才允许走 `name_exact+state` 确定性提升；
`source ∈ {web, search, page}` 的候选**不得**靠 name+state 单独提升，必须走 tier1/tier2 LLM 判官。

## 5.6 · tier2 judgePageIdentity 计划（codex R127/R130 · Matthew 决定：本地兜底/多源搜索/OpenCLI 登录态只读抓取）

### 窄接口（可复用 · 只做"分类是不是同一家", 不拥有搜索/抓取/写入）
```js
judgePageIdentity({ entity, page, sourceContext }) → {
  status:'same'|'different'|'ambiguous', confidence, promotable, evidence[], conflicts[],
  provider, model, prompt_version, fetch_via, source_url
}
```
放 `core/llm/match-judge.js`（复用 runCascade+cache）。prompt 版本化 `core/enrichment/identity/prompts/page-identity.v1.md`。搜索/抓取是**调用方**, 判官不碰。可复用于 enrichment / 社媒核实 / 官网确认 / 外部提及 / 未来 audit。

### 模型策略（Matthew 硬规矩 + codex）
- cascade: claude/codex → **本地 ollama（强制兜底）**。
- **用 `per-task-lab` 跑模型对比**（codex-cli vs claude-cli vs qwen3.5:9b vs qwen3.6:27b）, 对带标 page 案例按红线 false_same=0 评分。
- 选默认: 过红线 + 召回最好 + 成本/延迟最低; **本地若能过红线 → 默认本地**（便宜、不限流）, 云端做升级。
- **关键安全**: 若某本地模型**过不了红线**, 它仍可当 fallback, 但**只许返回 ambiguous/different, 绝不许 promote `same`**（"有本地兜底"不等于"兜底能造假阳"）。

### 登录态抓取（codex R130 · OpenCLI CLI adapter · 不是 pipeline skill）
**主路 = OpenCLI CLI 只读 adapter**（替代 R128 Playwright 专用 profile 方案）：
- 新 adapter: `core/enrichment/fetch/opencli-fetch.js`，只包装 OpenCLI CLI：`opencli --profile <leads> browser navigate <url>` + `browser read`/`browser extract` → `{ url, text, signals, fetch_via:'opencli' }`。
- **pipeline 只调 CLI**，不调 `opencli-browser` skill。skill 只允许 operator/agent ad-hoc research；Hermes/自动 batch 走 deterministic CLI adapter，避免把 skill 的 click/fill/interact 能力带进生产路径。
- wrapper 是强制边界：内部命令 allowlist 只包含 `navigate/read/extract`；任何 `click`/`fill`/`type`/`interact`/`eval`/`screenshot`/`tabs`/`cookies`/raw arbitrary args 一律拒绝。调用方不得传完整 OpenCLI 命令，只能传 `{ profile, url, mode }`。
- fetch cascade: Tinyfish fetch 先跑；OpenCLI **只对 allowlisted 登录墙/薄结果社媒域名**（FB/IG/LinkedIn）且 candidate 已由搜索发现时触发；它是 last-resort，不做发现、不扩链、不浏览 feed。
- dedicated profile: `AUTH_FETCH_PROFILE` / OpenCLI profile alias 指向一个**独立 Chrome profile**，只登录必要社媒账号，不使用 Matthew daily/full account。默认 env-gated off；CI 默认拒绝；profile/daemon/extension 状态不可用时直接降级。
- rate/ledger: 3-6/min + jitter；每次写 ledger（domain/url/time/status/profile alias/fetch_via/error class），**不写 cookie/header/storage/secret/正文全文**；输出只存薄摘要/DOM snapshot 中供身份判定的最小文本。
- **证据等级**：OpenCLI 结果只能作为弱支持证据；除非正文含电话/ABN/自有域名/地址等独立强标识，否则不得单独 promotable `same`。
- **unattended failure mode**：OpenCLI/Chrome/daemon/extension/profile/session 任何不可用、超时、登录失效、rate limited、blocked → 返回 `{ ok:false, reason }`；batch 不等待人工、不崩溃，tier2 保持 `ambiguous`/丢弃（rather-miss）。

### OpenCLI 启用前安全 review gate（必须过门再 wiring）
- **版本 pin**：固定 `@jackwener/opencli` 版本 + lockfile/安装来源；禁用自动升级；记录 extension release/version 与 CLI version 配对。升级必须重新 review diff 和跑 smoke。
- **源码/权限 review**：读 CLI browser adapter、daemon、extension manifest、profile 选择逻辑、network surfaces、local port binding/auth、logging、telemetry/update 行为；确认不会读取/导出 cookies/storage/headers，或若扩展权限允许则确认 wrapper/环境隔离足够承受。
- **profile blast-radius**：只用 dedicated OpenCLI/Chrome profile；只登录需要的社媒；不保存支付/密码/个人邮箱/日常账号；profile 目录在 repo 外、私有权限、可一键删除吊销。
- **hard wrapper**：adapter 不能 expose arbitrary subcommand；denylist 之外还要 positive allowlist；单元测试证明 forbidden verbs/args 被拒；生产路径不可 import/调用任何 interaction helper。
- **domain gate**：exact allowlist + canonical host normalization；拒绝短链、重定向到非 allowlist、data/file/chrome/about URLs、localhost；最多跟随一次安全重定向并重新检查 host。
- **content minimization**：不保存 screenshots、HTML dumps、cookies、localStorage、headers；DOM text 截断/脱敏后进入 judge；ledger 只记审计元数据。
- **runtime isolation**：固定 daemon port 或 profile context；仅 localhost；batch concurrency 低；timeouts 短；无人工 session reuse；失败即降级。
- **provenance/audit**：所有下游 facts 带 `fetch_via:'opencli'` + source URL + timestamp；OpenCLI-sourced `same` 决策必须可追溯到具体 text evidence/conflicts。
- **legal/ToS posture**：仅读取 operator 已登录后可看的 business profile/page content；不抓私信、followers、私人账号内容、后台管理页，且不做互动。

### 顺序（codex R127）
1. 定 page-identity 契约 + prompt + fixture schema + 小标注集。
2. 实现 `judgePageIdentity`（走 cascade + 本地兜底）。
3. 小集手动验证（抓 prompt/schema 问题）。
4. 模型对比（确定性评分 vs 标注）。
5. 锁定该任务的 provider 策略。
6. 建 `gatherCandidates(entity)`（真·多源 union: tinyfish search + ddg + …）。
7. 抓取 cascade: Tinyfish 先 → **OpenCLI dedicated-profile CLI adapter** 仅对被墙/太薄的登录社媒（§5.6 · NOT skill/dokobot/interaction）。
8. false-same 门稳了, 才把 tier2 接进 `resolveIdentity`。

## 6 · 现状（extend, don't rebuild）
- ✅ tier0 `core/enrichment/identity-match.js`（codex R121 批准 · 25 测试）→ 将移入/被 `identity/resolve-identity.js` 编排。
- ✅ tier1 `core/llm/match-judge.js judgeEnrichmentMatches`（Matthew 2026-05-14 spec · yes/maybe/no）。
- ✅ 背景构建 `buildCoreExtract`（core-extract.json · 每条事实带 _sources · 绝不编造）→ 只吃 promotable=same 的页面。
- 🔨 缺口 = tier2 `judgePageIdentity`（读抓下来的首页正文核身份）。
- 真实数据验证 `scripts/test/validate-identity-match.mjs`（290 实体 × 42万牌照库）→ 升级成 gold-set `--validate`。
