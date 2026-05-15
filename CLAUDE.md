# CLAUDE.md · google-map-website-v3 (V3 ProfitsLocal)

## 强制铁律

### Rule 0 · 跟 Matthew 说话用人话 (强制)

不许用工程术语 / 技术黑话问 Matthew 问题。

不许用: "normalize" "dispatcher" "terminal-state" "contract" "lint" "三层防御" "B.body.deprecated" 之类。

要用: "审完打分前" "中间状态" "操作员手动补" "Discord 上看不见" "发布之前" 之类。

例:
- ❌ "Q5 · 三层防御 cycle-25 我只做了 1 层 (intent-router normalize)"
- ✓ "之前那个 bug · 我只补了 1 层 · 没补另外 2 层 (限制 LLM 不能选错 · 加监控发现这种事)"

报告内部技术细节可以用专业词。**问 Matthew 决定的时候必须人话**。

### Rule 11 · cycle-doctor 是 done gate (强制 · cycle-26)

任何 "cycle done" 必须满足:
1. `npm run test:cycle26` exit 0
2. `npm run lint:messages` exit 0
3. `npm run cycle:doctor` exit 0 (端到端实跑 · 不只静态)

报 PASS 必须贴这 3 个命令的完整 stdout (含 exit code)。少 1 个不算 done。

pre-commit hook 自动检查 1+2 · 想 bypass 必须 `--no-verify` (紧急情况才 OK · 否则违规)。

### Rule 13 · 每个 bug-fix 必须有 RED test (强制 · cycle-26 Matthew 2026-05-15)

修 bug 时必须:
1. 先写测试 · 它会因为 bug 存在而 FAIL (RED)
2. 修代码 · 测试由 RED → GREEN
3. 测试加入 `test:cycle26` runner · 永远防回归

违反案例 (cycle-26 P9b · 2026-05-15):
- 发现 zombie thread (locked=true · archived=false) · 直接修 archiveAndLockThread
  + 写 pl:rearchive-zombies CLI · **但没加 TDD test**
- Matthew 抓住: "为什么不能把这要求加到 TDD · 才能 100% validate?"
- 补救: test 26 · 9 assertions

**违反流程不允许 commit**:
- 修 bug ≠ 写新代码 (新代码可以先 spec 再 test 再 impl · 这是 Rule 12)
- 修 bug = 第一步必须有 test 复现 bug · 然后再修

报告 bug fix 必须贴出对应 test 文件名 + assertion 数 + 之前 RED / 之后 GREEN.

### Rule 14 · 6 个核心 goal 永远 validate (强制 · cycle-27 · Matthew 2026-05-15)

不能再让你点出 bug 我才发现 · 不能再 react。每次 commit / 更新都必须自动 self-check 6 个 goal:

```
G1 · master.md 在线可访问 (HTTP 200)
G2 · audit HTML 可访问 (customer-facing + internal-audit)
G3 · profile card 数据是最新的 (含 grade · phase · deploy URL)
G4 · Stage 1-9 message 在 lead/project thread 都在
G5 · 不重复 thread (1 entity = 1 active visible thread) + 不重复 entity (V2/V3 dup)
G6 · 所有 deploy URL 真 HTTP 200 (no dead link)
```

**强制流程**:
1. 任何 commit 涉及 entity / Discord / build / publish 路径必须跑 `npm run pl:goals-doctor`
2. exit 0 才能 commit (pre-commit hook 强制)
3. `--quick` 模式 (file-only) 跑得快 · 当 pre-commit gate
4. 不带 flag 跑全 mode (含 Discord + HTTP 网检) · 当 post-deploy 验证
5. 任何 0 → N violation 必须在 commit 前修

**违反案例** (cycle-27 · 2026-05-15 Matthew):
- profile-card audit-gate bug · Brisbane Roof Restoration 看上去「card 没更新」· 我没主动发现
- V2/V3 dup entity · North Brisbane Metal Roofing 同名两个 entity · 我没主动发现
- project thread Stage 1-8 history 丢失 · VIP Roofing · 我没主动发现
- Stage 9 message 重复 3 次 · 我没主动发现

每个都是 react · 不 proactive。Rule 14 强制要求每次 commit 必跑 6 goal 检查 · 防止再犯。

报告 commit 必须贴 `pl:goals-doctor` 输出 (per-goal pass/fail + entity count).

### Rule 12 · TDD 节奏 (强制 · cycle-26)

新功能 / 大重构 (≥ 5 文件改动) 必须按以下顺序:
1. 先在 `core/contracts/` 写"应该长什么样"的 spec (常量 + 类型)
2. 写测试文件 `scripts/test/test-cycle{N}-*.mjs` · **跑一遍全 fail**
3. 给 Matthew 看测试 + fail 状态 · 他点头才动业务代码
4. 改业务代码 · 测试逐个由 fail → pass
5. 5/5 pass + lint + cycle-doctor exit 0 才算 cycle done

不许"先改完代码再补测试"。测试是 spec 不是事后证明。

### Rule 8 · Plan 前必须读代码 · 不许凭印象 (强制)

任何 plan / proposal / 给 Matthew 的方案 · 涉及下列任何一项 · **必须先 grep + 读源码** · 不许凭"我记得"或"我之前看过":

- 工具/provider 用什么 (Firecrawl / Tinyfish / Playwright / Firecrawl-vs-Tinyfish-vs-Playwright)
- Stage / phase / state 数量与名字
- API endpoint / 环境变量名
- 函数签名 / 参数顺序
- file path / 模块结构

违反案例 (cycle-26 plan · 2026-05-15):
- 我说 "Stage 2 用 Firecrawl + 抓首页" — 实际读 `core/audit/site-fetch-full.js` 第 4-11 行注释明确是 Playwright (T0 本地)
- 我没读 ENTITY_PHASE enum · 凭印象列了 11 个 phase 中部分是猜的
- 我说"design-ready"是对的 — Matthew 反问后我才确认这个命名本身就有歧义

强制流程:
1. plan 列出每个技术点
2. 每个点旁标注 source: 文件:行号
3. 任何"我记得"全部展开成 `grep` + `read`
4. 给 Matthew 看 plan 时 · 标注哪些是代码确认、哪些是我推测

### Rule 1 · Root cause first (强制)

任何问题/bug · **必须找 root cause** · 不允许打补丁覆盖。

**违反案例 (cycle-25 · 2026-05-15)**:
- 症状: 投 intake task 后 `#lead-discovery-runs` 没出现 batch thread
- 我第一反应: 在 normalize 加 `if kind=intake && cli=scrape-docker → pipeline-batch-start` (补丁)
- **真 root cause**: intent-router 的 LLM prompt 把 `pl:scrape-docker` (internal step) 和 `pl:pipeline-batch-start` (entry CLI) 并列暴露给 LLM · LLM 选错没人拦
- 正确修法 (三层防御):
  1. LLM prompt 只暴露 entry CLI · 删 internal step
  2. Normalize 覆盖 (补丁层 · defense in depth)
  3. Dispatcher 守门 · 内层 CLI 缺必需参数 (e.g. `--batch-id`) 直接 fail + alert

**处理 bug 的强制流程**:
1. 复现 · 抓 evidence
2. 追到**最深一层** "如果这里改了 · 还会从别的路径复发吗？"
3. 三层防御: prompt/config + normalize/runtime check + monitor/doctor 报警
4. 写测试或加 doctor check 防回归
5. **Discord 上看不到 = 没做** · 任何涉及 Discord 视觉的 fix 必须 fetch Discord API verify (见 docs/v3/SOP-VERIFICATION-VIA-DISCORD-API.md)

### Rule 2 · No silent failure

如果 `task.status=done · exit=0` · 但用户在 Discord 上没看到预期输出 · 这是 silent failure · doctor 必须发现。

每条 pipeline 都要有 **Discord-side checkpoint** + doctor cron 验证 (不只 task 文件验证)。

### Rule 3 · Don't lie about completion

- 不能凭 `task.status=done` 报 PASS
- 不能凭自己 render 的 mock 当 evidence
- PASS 必须贴 4 组 raw Discord API 输出 (title · messages · channel scan · embed fields)

---

## 现行 cycle (cycle-25 · 2026-05-15)

- 清场 done (25 leads + 5 projects + 2 discovery threads archived · 175 task files 归档 · 55 entities reset)
- intent-router LLM-routing-to-internal-CLI bug 发现 · normalize 已打补丁 · LLM prompt + dispatcher guard 待加
- intake-doctor 缺 "Discord batch thread 存在" check · 待加

## 上 cycle 重点 (cycle-23/24)

- 排除式筛选 (3-layer · niche-aware) 取代 predict-grade · `core/leads/exclusion-filter.js`
- D-grade audit pipeline bail (Stage 4-7 skip)
- snapshot 字段精度核对 100% pass (description-only embed 兼容)
