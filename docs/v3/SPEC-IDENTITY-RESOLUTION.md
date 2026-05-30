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

## 6 · 现状（extend, don't rebuild）
- ✅ tier0 `core/enrichment/identity-match.js`（codex R121 批准 · 25 测试）→ 将移入/被 `identity/resolve-identity.js` 编排。
- ✅ tier1 `core/llm/match-judge.js judgeEnrichmentMatches`（Matthew 2026-05-14 spec · yes/maybe/no）。
- ✅ 背景构建 `buildCoreExtract`（core-extract.json · 每条事实带 _sources · 绝不编造）→ 只吃 promotable=same 的页面。
- 🔨 缺口 = tier2 `judgePageIdentity`（读抓下来的首页正文核身份）。
- 真实数据验证 `scripts/test/validate-identity-match.mjs`（290 实体 × 42万牌照库）→ 升级成 gold-set `--validate`。
