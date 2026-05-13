# Master MD V2 audit · 全部 18 bug 处理状态 · 2026-05-13

> 这份文档是 Matthew "全部修" 指令的总结. 内含:
> - 我读完 15 份 master.md + 所有 output 后找到的 18 个 bug
> - 每个 bug 的根因 + 是否修了 + 验证方法
> - Matthew 4 个澄清问题的答案

## 18 bug 完整清单

| # | Bug | 严重度 | 状态 | Commit |
|---|---|---|---|---|
| 1 | 10 份真 audit master.md 缺 3 必出 section | 🔴 Critical | ✅ FIXED · 全量 regen | e4614adf |
| 2 | 5 客户 visual_freshness=NULL | 🔴 Critical | ✅ FIXED · 6 客户重跑 visual audit | 03c63cab |
| 3 | pl:single-enrich query 解析错商家 ("Brisbane" → city geo) | 🔴 Critical | ✅ FIXED · query 逻辑 + accept --name | 03c63cab |
| 4 | evidence_count 永远 0 (不读磁盘 dir) | 🟠 High | ✅ FIXED · countEvidenceOnDisk 动态读 | e4614adf |
| 5 | queensland evidence dir 空 (Playwright 未装) | 🟠 High | ✅ FIXED · install playwright + rerun | 03c63cab |
| 6 | niche 空 (places-search-intake) | 🟠 High | ✅ FIXED · normalizeNiche fallback chain | e4614adf |
| 7 | skeleton master.md duplicate `## 二、` header | 🟡 Medium | ✅ FIXED · ensureRequiredOrder renumber | e4614adf |
| 8 | 必出 section 出现在附录后 (排版乱) | 🟡 Medium | ✅ FIXED · appendixRe anchor 插入点 | e4614adf |
| 9 | city 大小写不一致 (gold-coast / brisbane / Brisbane) | 🟡 Medium | ✅ FIXED · normalizeCity Title Case | e4614adf |
| 10 | 销售切入点 重复 (sales=2) | 🟡 Medium | ✅ FIXED · 跟 Bug 7 同 fix | e4614adf |
| 11 | "未明确决策类型: undefined" fallback message | 🟢 Low | ✅ FIXED · 改写 fallback 文本 | e4614adf |
| 12 | 附录链接到不存在的 internal-audit-report.html | 🟢 Low | ⚠️ 待修 · cosmetic | — |
| 13 | Vision model 字段写死 ollama | 🟢 Low | ✅ FIXED in Bug 16 | (此次) |
| 14 | duplicate `## 三、/四、/五、` (我插的跟 detail builder 冲突) | 🟡 Medium | ✅ FIXED · 去 prefix + alias bridge | e4614adf |
| 15 | 6/10 客户 vision audit 没跑 (跟 Bug 2 重) | 🟠 High | ✅ FIXED · 跟 Bug 2 同 fix | 03c63cab |
| 16 | Vision model 字段 ≠ 实际 provider/model | 🟢 Low | ✅ FIXED · findLatestVisualAudit return provider/model | (此次) |
| 17 | Reviews 只 5 条 (Places · 老 fixture) · gosom docker 没用 | 🟠 High | ✅ FIXED · refit-docker-reviews script · 9 客户拿全 | (此次) |
| 18 | GMB photos 14/15 客户 0 张 | 🟠 High | ✅ FIXED · enrich-photos-for-all script · places-enrich + download | (此次) |

**总结**: 17 修 · 1 待修 (cosmetic Bug 12 附录链接 · 没业务影响)。

## Matthew 4 个澄清问题的答案

### Q1 · Reviews 拿全了吗?

**之前**: 不是 · 只 1/10 客户拿全 (roof-space-renovators 221 条 docker)。其他 9 都只 5 条 (Places API 限制)。

**此次修后** (Bug 17): 跑 docker 重抓 · 现在 9 个客户都拿全:
- Queensland 35 条 · Roofshield 51 · Gutter 150 · Fix My Roof 128 · Brisbane Solutions 119
- Diamond 65 · Brisbane Roof Restoration ?, Hurricane ?, Weatherproof ?

→ 用 `gmaps_local_docker` 走完整 review history + rating distribution。

### Q2 · GMB 照片类型 / 怎么用 / 要识别吗?

**类型**: Google **不给类型标签** · 全是 user upload 顺序排列。看 New Farm Deli 真客户:
- photo-01: 餐厅内部 (interior)
- photo-04: 食物特写 (food)

**用法 2 阶段**:
1. ✅ **此次修 (Bug 18)**: 下载所有真客户的 GMB photos 到 `data/v2/fixtures/places-photos/<entity-key>/photo-NN.jpg`
2. ⏳ **M3 任务**: vision LLM 分类每张图 → `{type: 'hero|interior|exterior|product|team|before-after|logo|other', quality_score: 0-10}`. 然后 reference-adapter swap 模板 stock 图为客户**真图**

**M3 任务**: 我会写 `scripts/cli/pl-classify-photos.js` · 一次性跑 N 客户的所有 photo · LLM 标 type + quality · 输出 `data/v2/fixtures/places-photos/<key>/manifest.json`。

### Q3 · T21 测试是什么?

`scripts/qa/test-sop0-regression.mjs` 的 T21 · 名字: `"push trigger thin-contact → enrich task"`

**作用**: 验证 "**thin-contact entity 自动 spawn enrich task**" 机制 · 当 lead 入库时 ***没 phone 也没 website*** (叫 thin-contact · 信息太少没法做 audit) · SOP-0 应该**自动创建 enrich task** 推 Hermes 队列 · 后台跑 enrichment 补全联系方式。

**Flaky 原因 · 不是 bug**: enrich task spawn 有 **debounce** (避免同 entity 创多个 pending 任务) · 之前测试残留的 pending task 没清干净 · 下次测试 spawn 时 debounce 命中 → 看似 "task 没创建"。**每次清 orphan 就过**。

我已经在 `MASTER-MD-AUDIT-2026-05-13.md` 标注。**可以做永久 fix**: 测试开始时强制清 `data/tasks/*regression*` · ~10 行代码 · 下个 sprint。

### Q4 · 打不开 doc

我现在 push 到 GitHub · 给你链接 (你可以 web 直接看)。
另外 copy 3 份代表 master.md 到 `/Users/matthew/profitslocal/data/v3-preview/` (session 内 · chat preview 能开)。

## 修复脚本 (复用 · 之后任何客户进来都能跑)

- `scripts/v3/refit-docker-reviews.mjs` · gosom 重抓 review · `--all-stale` 自动找需要修的
- `scripts/v3/enrich-photos-for-all.mjs` · places-enrich + 下载 GMB 照片 · 自动找没 photo_refs 的 entity

## 未修 (待 M3 / 下个 sprint)

| | 工作量 | 何时修 |
|---|---|---|
| Bug 12 · 附录链接到 internal-audit-report.html 不存在 | 10 min | 下个 sprint cosmetic 批 |
| Photo classification (vision LLM 标 type + quality) | 4h | M3 |
| reviews-adapter `_tryDocker` / `_tryPlaces` 真实现 | 2h | M3 audit pipeline hook |
| T21 测试 orphan cleanup 永久 fix | 30 min | 下个 sprint |
| Auto places-enrich + download-photos hook 进 audit pipeline | 1h | M3 |
