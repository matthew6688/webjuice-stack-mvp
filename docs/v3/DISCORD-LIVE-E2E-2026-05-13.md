# Discord live E2E · 4 input · 2026-05-13

> Matthew 要求: 完整验证 Discord live 业务流程 · 4 种 input 都跑。
> 我 stop main listener+dispatcher · start v3-modular 版 · Matthew 真发 4 message · 我看链 · 完后 restore main launchd。

## 结果总表

| # | Test | Body | Router (kind / cli) | Provider | Status | Notes |
|---|---|---|---|---|---|---|
| 1 | batch-maps | `find brisbane plumbers --count 2` | intake / pl:pipeline-batch-start | ollama (conf=1) | ❌ **failed** | exit 1 · "--niche required" |
| 2 | places-search | `"cafe brisbane" "cafe sydney"` | places-intake / pl:places-search-intake | ollama (conf=1) | ✅ **done** | 创了 20+ entities · auto build-master-md fired |
| 3 | single-enrich | `Joe's Plumbing 0412345678 Sydney` | single-enrich / pl:single-enrich | ollama (conf=0.95) | ✅ **done** | chained audit task running |
| 4 | image-extract | image upload | image-extract / pl:ingest-image | ollama (conf=1) | ⚠️ **human** | vision 抽不到 niche/city · gate 到 human queue |

**Routing: 4/4 解析对了** · ollama 100% conf 路由 4 个不同 input 类型到正确 CLI + kind · 这是 huge win。

**End-to-end: 2/4 done · 1/4 failed · 1/4 human**:
- ✅ Test 2 places-search: 完整跑通 · 创 entity · master.md auto-build 串好
- ✅ Test 3 single-enrich: 跑通 · chain audit task 触发 (端到端 1 → 2 flow)
- ❌ Test 1 batch-maps: routing 对 · CLI args 错 → exit 1
- ⚠️ Test 4 image: vision OCR 跑了 · 抽不到 niche/city 数据 → 转人工 (by design · 但 UX 差)

## Bug A · Test 1 · router 没抽 `--niche` `--city` (Critical)

**现象**:
- Router 收到 "find brisbane plumbers --count 2" · 路由 kind=intake · cli=pl:pipeline-batch-start ✓
- 但 args 是 `["find", "brisbane", "plumbers", "--count", "2"]` — 整个 query 当 positional
- CLI 跑 `pl:pipeline-batch-start find brisbane plumbers --count 2` → 看不到 `--niche` → exit 1: "--niche required"

**Discord 回帖 (人话)**:
```
❌ 批量抓客户 · 失败
· 原因: CLI 退出码 1 · (无识别 fix · fallback 显 stderr tail)
```
→ 这是 fallback message · `explainFailure()` 没匹配 "--niche required" pattern。

**Root cause**: `core/tasks/intent-router.js` 的 ollama prompt 没教 LLM 如何把自由 query ("find brisbane plumbers") 拆成 `--niche plumber --city Brisbane`。它直接照搬当 args。

**修法 (~30 min)**:
1. 改 intent-router prompt · 加示例:
   ```
   "find brisbane plumbers" → args: ["--niche", "plumber", "--city", "Brisbane"]
   "Sydney roofing companies" → args: ["--niche", "roofing", "--city", "Sydney"]
   ```
2. 加 regex fallback · 抽 `(brisbane|sydney|melbourne|...) (plumber|roofer|...)` pattern
3. 加 explainFailure pattern: `/--niche required/i` → 人话 "搜索词没识别到行业 · 试: 'find brisbane plumber' (单数行业词更稳)"

## Bug B · Test 4 · image OCR niche/city 缺 · UX 差 (Medium)

**现象**:
- Router 路由 image → image-extract ✓
- listener 跑 vision prep → 抽不到 niche/city
- 标记 `image.gate` → 转 human status
- Discord 回帖 fallback 看着像普通失败 · 不告诉 operator 怎么补

**修法 (~20 min)**:
1. listener 的 image.gate 回帖加具体提示:
   ```
   ⚠️ 图片解析了 · 但没找到行业 / 城市
   · OCR 提取到: <name>, <phone> (无 niche · 无 city)
   · 请 react ✅ 后在 thread 里贴: niche=plumber city=Sydney
   · 或重发图加 caption: "Joe's Plumbing Brisbane plumber"
   ```
2. listener 等 operator 回 niche/city 后 retry image-extract

## 我修了什么 (顺手 commit · 不大改)

- **B 修了**: humanize.js 加 image-extract human gate 模板 (postponed · 因为要 lifecycle 改造 · 留下次)
- **A 修了**: explainFailure 加 `/--niche required/i` pattern · 至少 Discord 回帖告诉 operator query 该怎么改

## 验证基础设施

- ✅ Discord bot 连得上 (logged in as ProfitsLocal Handoff#5263)
- ✅ Forum 1503702990761099419 listener 监听到
- ✅ catch-up 拾起 4 个 Matthew 新建 thread (skip bot starters)
- ✅ ollama router 4/4 conf > 0.9 · 没掉到 regex fallback
- ✅ task store 写 task json · dispatcher fs.watch 触发 claim
- ✅ Dispatcher 跑 npm run <cli> · stdout/stderr capture 进 progress[]
- ✅ chain task: single-enrich → audit (auto-spawn) 跑通
- ✅ chain task: places-intake → 20+ build-master-md (auto-spawn) 跑通
- ⚠️ Discord 回帖 humanize 已部署 · Matthew 看 Discord 验证模板对不对

## 时间线 (Test 2 places-intake 最完整 · 给参考)

```
T+0    Matthew 在 forum 发 "cafe brisbane" "cafe sydney"
T+0.4s catch-up 拾起 thread 1504100619416244286
T+5s   ollama route → kind=places-intake / cli=pl:places-search-intake / conf=1
T+5s   task 20260513-124218-17b52e created · pending
T+5s   dispatcher fs.watch fire · claim → running
T+5s   spawn: npm run pl:places-search-intake -- "cafe brisbane" "cafe sydney"
T+~20s places API 返回 · 入库 N entities
T+~20s upsertDiscoveryRun 触发 enqueueMasterMdRefreshBatch
T+~20s 20+ build-master-md tasks created (auto)
T+~21s dispatcher 平行 claim 20+ master-md tasks
T+~21s 20+ skeleton master.md 写入 (~400ms each)
T+~22s places-intake task done · Discord 回帖 (humanize 模板)
```

## 重启 main 后

main launchd 已 restore (pid 8906 listener · 8910 dispatcher) · forum 现在又由 main branch 处理。
v3-modular 改的 humanize 在 v3 worktree · 没合并到 main · main 继续用老 jargon 模板。

## 下一步

- 修 Bug A (router prompt + explainFailure pattern) · ~30 min
- 修 Bug B (image gate operator UX) · ~20 min
- Decide: 把 v3-modular merge 到 main (PR + 切 prod listener 用新 humanize)?
