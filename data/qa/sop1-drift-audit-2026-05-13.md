# SOP-1 漂移审计 · 2026-05-13

**Auditor**: Claude (read-only audit, no files modified)
**Repo**: `/Users/matthew/Developer/google-map-website`
**Scope**: docs/SOP_1_* · docs/SOP_HANDOFF_CONTRACT.md · docs/SOP_X_DEDUP.md · admin/scoring/sop-1*.astro · core/leads/* · scripts/cli/pl-*

## Summary

- **Total drift items**: 23
- **Critical (会让代码跑错 / 会让用户被误导)**: 9
- **Cosmetic (文案过时但不致命)**: 14

**最致命的 3 条**：
1. **B-2 / 反向漂移**：Handoff Contract §2.1 把 `phase` / `phaseChangedAt` 列为"✅ 必填"，但 **真实 entity 文件里这俩字段根本不存在**（核查 `place_chij-2w2g_dzkwsrlwbtsw5scjk.json`）— SOP-2 / Discord 任何依赖必填的代码都会爆。
2. **E-1**：Handoff §3 说 status 是"8 个值"并列了 `archived` / `paid`，但代码 `DISCOVERY_ENTITY_STATUS` 实际是 **9 个值** 且**完全不含 `archived` / `paid`**，反而有 `promoted` / `contacted` / `ready_for_outreach_brief` —— 状态机文档完全是错的。
3. **F-1**：sop-1.astro sync banner 把 G-13 / G-14 列为"还没做"，但 SOP_OVERVIEW.md §G-table + SOP_1_INTAKE_DISCOVERY.md §3.6.3 都明确写"done 2026-05-12"。Banner 误导。

---

## A. 流程步骤数 / 顺序 / 名称漂移

### A-1 [Critical] sop-1.astro Step 3b "仅评级 B 及以上" 出现在 SOP-1 流程图里
**doc/admin 说**: `src/pages/admin/scoring/sop-1.astro:191` — "Places 补全 ... 仅评级 B 及以上"
**代码做**: Step 3b grade≥B 触发条件依赖 SOP-2 audit 的 grade 输出；SOP-1 文档自己 §3.6.3 也写"自动：grade ≥ B 之后回流（SOP-2 → SOP-1 调）"。**这意味着 3b 不是 SOP-1 自驱动**。
**影响**: 流程图把"依赖 SOP-2 输出"的步骤画进 SOP-1 的 4 步主链，让读者误以为 SOP-1 自己会判 grade。
**Evidence**: `src/pages/admin/scoring/sop-1.astro:189-194` "flow-step-badge 仅评级 B 及以上" · `docs/SOP_1_INTAKE_DISCOVERY.md:181-185` "grade ≥ B 之后回流（SOP-2 → SOP-1 调）"

### A-2 [Cosmetic] flow-section header 说 "1 个分岔判断" 实际上有 2 个 (thin-contact + 3b/3a)
**Admin 说**: `sop-1.astro:124` "2 个入口 · 4 步 · 1 个分岔判断"
**实际**: 流程图本身只画了 thin-contact 一个 decision diamond，3b/3a 是并列分支不是 decision —— 但 header 措辞含糊，3a/3b 实际上**互斥的两条路**（doc 说 3a if thin / 3b if !thin），逻辑上是同一个 decision 的两条 branch。OK，措辞可保留但说"1 分岔出两路" 更准确。

### A-3 [Cosmetic] sop-1.astro Step 4 文案说 "出口承诺：已去过重 + 联系方式补到位"，但忽略了 schema 必填校验 (Handoff §1.1 第 3 点)
**Admin 说**: `sop-1.astro:206` "出口承诺：已去过重 + 联系方式补到位"
**Doc**: `docs/SOP_HANDOFF_CONTRACT.md:49-55` 出口承诺有 4 条（含 schema 合规 + batch_id stamp）
**影响**: 操作员视角缺失。

---

## B. 字段名 / 字段定义漂移

### B-1 [Critical] 去重字段 — 文档说 3 key，Matthew 期望 8 key
**Doc 说**: `docs/SOP_X_DEDUP.md:19-27` "3 把唯一性钥匙：place_id / phoneDigits / websiteDomain"
**Matthew 期望** (per task brief): 8 字段（公司名 + 地址 + 邮箱 + 电话 + 域名 + placeID + ABN + lat/lng）
**代码做**: `core/leads/dedup-detector.js:45` `buckets = { place_id, phone, domain }` — 跟 doc 一致是 3 key
**Gap 清单 (5 个还没做)**:
  - 公司名模糊匹配 — `SOP_X_DEDUP.md:31` 明确写 "v2 再加"
  - 地址 — 完全没做
  - email — `SOP_X_DEDUP.md:33` "大多数 lead 没采集到，先不做"
  - ABN — 完全没做
  - lat/lng 半径匹配 — 完全没做
**影响**: 现状 vs Matthew 的目标差 5 个字段。doc 和代码同步，但都跟 Matthew 的实际目标错位。

### B-2 [Critical] Handoff §2.1 把 `phase` / `phaseChangedAt` 列为必填 (✅)，但真实 entity 没这俩字段
**Doc 说**: `docs/SOP_HANDOFF_CONTRACT.md:77-78` `phase` / `phaseChangedAt` 都标 "✅ 必填"
**代码做**: 真实 entity `data/leads/entities/place_chij-2w2g_dzkwsrlwbtsw5scjk.json` 顶层 keys 只有 `[schemaVersion, entityKey, firstSeenAt, lastSeenAt, status, lastStatusAt, identifiers, latest, runs, history, notes]` — **没有 phase / phaseChangedAt / batches[] / merged_from / merged_into / archivedAt**。
**Evidence**: 见上 — 抽样 1 个 entity 直接 cat 出来缺
**影响**: 任何"依赖 phase 必填"的下游代码会爆。SOP-2 / Discord 流读 `entity.phase` 时一片 undefined。
**注**: `core/leads/discovery-store.js:55-64 ENTITY_PHASE` 定义 8 个 phase 值，但只在 `setEntityPhase()` 显式调用时写入（§5 注释证实："Phase is set explicitly by setEntityPhase; never derived implicitly from status"）— 所以新 entity 默认无此字段，但 doc 没写"显式 setter 才有"。

### B-3 [Critical] Handoff §2.5 + SOP-1 §5 说 `batches[]` 是 G-3 必装 ✅，但真实 entity 没这字段
**Doc 说**: `docs/SOP_1_INTAKE_DISCOVERY.md:250` "`batches[]` ... 最多 20，de-dup" · `docs/SOP_HANDOFF_CONTRACT.md:172-174` "字符串数组，最多 20"
**代码**: 真实 entity 抽样 → `batches: None`（字段不存在）。
**Evidence**: 抽样 entity 顶层 keys 中无 `batches`
**影响**: SOP-1 G-3 标 ✅ done 但实际历史 entity 没回填；新跑的 batch 可能写入但老数据没 migration。需要 backfill 或在 doc 里标"仅新 entity (≥ 2026-05-12) 有"。

### B-4 [Critical] Handoff §2.3 把 `latest.batch_id` 标 "⚠️ G-3 新增"，但真实 entity 没这字段
**Doc 说**: `docs/SOP_HANDOFF_CONTRACT.md:115` "`batch_id` ... ⚠️ G-3 新增"
**代码**: 抽样 entity `latest.batch_id: None`
**Evidence**: 见 B-3
**影响**: 同上 — backfill 缺。

### B-5 [Cosmetic] `latest.sales_signals.best_contact_time` (G-14) 已实现但 Handoff §2.3 表格里完全没列
**Doc 说**: G-14 done — `docs/SOP_OVERVIEW.md:268` · SOP-1 §3.6.3 提到写到 `entity.latest.sales_signals.best_contact_time`
**Handoff Contract**: §2.3 字段表完全没列 `sales_signals` 这一行（grep `sales_signals` 在 SOP_HANDOFF_CONTRACT.md 0 命中）
**影响**: SOP-2 / 销售脚本不知道这字段存在。

### B-6 [Cosmetic] `enrichment_status: 'partial'` 行为漂移
**Doc 说**: `docs/SOP_1_INTAKE_DISCOVERY.md:209` "`partial` 备用值 — 当前未自动写入"
**实际代码**: `docs/SOP_HANDOFF_CONTRACT.md:147-152` real-test 逻辑里**主动写 `partial`**（`hasContact|hasSocial` 为 false 但 `succeeded > 0` 时）
**两份 doc 互相矛盾**。`pl-run-enrichment-batch.js` 实际行为需要回头核（未核到具体源码，但 Handoff §2.3.2 显式写了规则）。
**Evidence**: `SOP_1_INTAKE_DISCOVERY.md:209` vs `SOP_HANDOFF_CONTRACT.md:147-152`

### B-7 [Cosmetic] sop-1.astro Step 3a 文案说"都搜不到 → 标 unenrichable"，跳过了 `partial` 中间态
**Admin 说**: `src/pages/admin/scoring/sop-1.astro:182` "都搜不到 → 标成 `enrichment_status: 'unenrichable'`"
**代码**: 实际还有 `partial`（succeeded > 0 但无 contact）
**影响**: 操作员不知道 partial 存在。

---

## C. CLI 名称 / 参数漂移

### C-1 [Critical] `pl:dedup-undo` 文档存在，package.json 不存在
**Doc 说**: `docs/SOP_X_DEDUP.md:114-116` §4.3 "`pl:dedup-undo --loser K2`"
**代码**: `package.json` grep `pl:dedup-undo` → 无；`scripts/cli/` 无 `pl-dedup-undo.js` 文件
**影响**: 操作员误合并无法撤销。文档里写的"可撤销"承诺没兑现。

### C-2 [Cosmetic] doc 说 `pl:scrape-docker` 是新主入口，但 package.json 把它注册为不带 `--env-file` 加载
**Doc 说**: `docs/SOP_1_INTAKE_DISCOVERY.md:94-96` "1 行命令跑完全链路 `npm run pl:scrape-docker -- ...`"
**package.json**: `"pl:scrape-docker": "node scripts/cli/pl-scrape-docker.js"` — 唯一没用 `--env-file-if-exists=.env.local` 的 pl: 脚本
**影响**: 如果 scrape 也依赖 env 变量（如 Discord webhook for batch posting），会读不到。

### C-3 [Cosmetic] doc 提到 `pl:rebuild-niche-shards` 在 sop-1.astro 命令行卡片里，但 SOP-1 主文档完全没解释该命令
**Admin 说**: `src/pages/admin/scoring/sop-1.astro:278` 列出 `pl:rebuild-niche-shards`
**Doc**: grep `rebuild-niche-shards` in SOP_1_INTAKE_DISCOVERY.md → 0 命中
**影响**: 用户点进去找不到这个命令是干嘛的。

### C-4 [Cosmetic] doc §10.1 说 `pl:run-enrichment-batch` "实测 6/6 条路都跑通"，但 enrichment 实际是 **5 条路 + 1 条可选 reverse_phone**
**Admin 说**: `sop-1.astro:103` "实测 6/6 条路都跑通"
**代码**: `core/leads/enrichment.js:260-267` — 5 routes 默认 + 1 条 `reverse_phone` 仅当 entity 有 phone 时加；real-test entity Regan Brothers 有 phone → 6 条都跑了，所以测试结果说 "6/6" 是这个特例。
**影响**: 一般 thin-contact entity 没有 phone → 只跑 5 条 ≠ "6/6"。文案应改 "5-6 条" 或 "默认 5 条 + reverse-phone 当有 phone"。

---

## D. 流程图未更新 / 已删除分支仍在画

### D-1 [Critical] **sop-1.astro 3B 分支 不应在 SOP-1 流程图里** (已确认)
**Admin 说**: `src/pages/admin/scoring/sop-1.astro:188-196` 把 Step 3b "Places 补全 仅评级 B 及以上 `pl:places-enrich`" 画进 SOP-1 4 步主流程
**Doc**: `docs/SOP_1_INTAKE_DISCOVERY.md:181-184` Step 3b 的两个触发条件之一就是 "grade ≥ B 之后回流（SOP-2 → SOP-1 调）" —— grade 由 SOP-2 写
**影响**: 把跨 SOP 的回流步骤画成 SOP-1 主链一环，违反 SOP-1 / SOP-2 边界。
**Fix 建议**: 把 3b 移出 decision branch，改画成"SOP-2 回流挂钩"或单独标注"可选 · 由 SOP-2 触发"。

### D-2 [Cosmetic] decision diamond 文案 "缺联系方式吗？" 后面 3a / 3b 分支语义错误
**Admin 说**: `sop-1.astro:169-197` — decision = `!phone && !website`；**是 → 3a 5 路 search**；**否 → 3b Places 补全**
**Doc 实际语义**: 3a 跑给 thin-contact 的 entity 来补，3b 是给已有 grade≥B 的 entity 加 Places 增强 —— **两条路目的不同**，不是同一个 if/else 的两个 branch
**影响**: 流程图错把 3a/3b 画成 thin-contact 的"二选一"，实际是两个独立判定。

### D-3 [Critical] 流程图 Step 2 dedup 说"电话或域名撞上 → 进人工复核队列"，但代码 dedup-detector 还会 surface place_id 撞库
**Admin 说**: `sop-1.astro:160` "3 个判重信号：place_id / phoneDigits / websiteDomain ... 电话或域名撞上 → 进人工复核队列"
**Doc 说**: `docs/SOP_X_DEDUP.md:22` "place_id 一致 → 自动合并（无需操作员）"
**代码**: `dedup-detector.js:147-148` 注释 "For place_id groups: these should NEVER appear in v1 because mergeLeadIntoEntity already auto-merges by place_id. **If they do, it's a data anomaly → still surface to operator**"
**影响**: 流程图说只有 phone/domain 会入 queue，但代码实际 place_id 异常也会 surface — 是 doc 漏写了"异常 fallback"。

---

## E. 状态字段写法漂移

### E-1 [Critical] **status enum 完全错乱** — Handoff Contract §3 vs 实际代码差 4 个值
**Doc 说**: `docs/SOP_HANDOFF_CONTRACT.md:201-212` "8 个值：discovered / scored / queued_for_audit / manual_review / queued_for_enrichment / skipped / archived / paid"
**代码实际** (`core/leads/discovery-store.js:38-48` `DISCOVERY_ENTITY_STATUS`):
```
DISCOVERED, SCORED, QUEUED_FOR_AUDIT, QUEUED_FOR_ENRICHMENT,
READY_FOR_OUTREACH_BRIEF, PROMOTED, SKIPPED, MANUAL_REVIEW, CONTACTED
```
**Diff**:
- Doc 里有的、代码里没有：`archived` · `paid`
- 代码里有的、Doc 里没有：`ready_for_outreach_brief` · `promoted` · `contacted`
- `merged` (set by `pl:dedup-merge`) — doc 完全没列
**影响**: SOP-2 按"queued_for_audit"筛 OK，但任何枚举校验代码都会爆。
**Evidence**: `core/leads/discovery-store.js:38-48` 9 keys · `SOP_HANDOFF_CONTRACT.md:204-212` 8 行
**Note**: 文档自己 §3 说 "8 values (`DISCOVERY_ENTITY_STATUS`, core/leads/discovery-store.js#L21)" 引用的行号也错（实际定义在 L38-48）。

### E-2 [Critical] `phase` 状态机被 doc 写成"必填"，代码默认不写
**Doc 说**: `docs/SOP_HANDOFF_CONTRACT.md:79` `phase` ✅ 必填
**代码**: `discovery-store.js:53-54` 注释 "Phase is set explicitly by setEntityPhase; **never derived implicitly from status**" → 新 entity 默认无 phase
**Evidence**: 见 B-2 抽样
**影响**: schema 校验工具（如未来的 `pl:handoff-verify`）按 doc 必填校验全部 entity 都会失败。

### E-3 [Cosmetic] phase 值在 doc / 代码 大小写格式不一致
**Doc 说**: `SOP_HANDOFF_CONTRACT.md:222-229` 列大写 `AWAITING`/`OUTREACH_ACTIVE` · `SOP_1_INTAKE_DISCOVERY.md` 同
**代码**: `discovery-store.js:55-64` ENUM 字面值是小写连字符 `awaiting` / `outreach-active`
**影响**: 操作员 / 销售按 doc 复制粘贴 "AWAITING" 写入会变 invalid phase。
**Evidence**: `discovery-store.js:56` `AWAITING: 'awaiting'` etc.

### E-4 [Cosmetic] Handoff §3 引用源码行号 #L21 错误，实际是 L38
**Doc 说**: `SOP_HANDOFF_CONTRACT.md:203` "(`DISCOVERY_ENTITY_STATUS`, `core/leads/discovery-store.js#L21`)"
**代码**: 实际 enum 定义在 L38
**影响**: 看 doc 跳源码会跳错位置。

### E-5 [Cosmetic] dedup-merge 写入新 status 值 `'merged'`，但 enum / doc 都没注册
**Doc**: `SOP_X_DEDUP.md:59-60` §2.2 step 7 "`loser.status = 'merged'`（新 status 值）" — 自己也标注"新"
**代码**: `DISCOVERY_ENTITY_STATUS` enum 没列 `merged`；`dedup-detector.js:55` 过滤 `if (e.status === 'merged') continue;` —— 字符串硬编码
**影响**: 任何按 enum 做的校验 / 枚举生成 UI 会漏掉 merged 这条。

---

## F. 已标"完成"但代码未实装

### F-1 [Critical] **sync banner G-13 / G-14 标"还没做"，但其他文档说 done**
**Admin 说**: `src/pages/admin/scoring/sop-1.astro:106` "还没做 — G-11 抓取兜底链路 · **G-13 店面图同步到客户档案** · **G-14 营业时间用于推销时段判断** · G-6.1 ..."
**其他 Doc 说**:
- `docs/SOP_1_INTAKE_DISCOVERY.md:351-352` G-13/G-14 都 ❌ pending（**与 sync banner 同步，但 doc 自己 §3.6.3 又说 G-13/G-14 已实装**！）
- `docs/SOP_OVERVIEW.md:264, 268` G-13 done 2026-05-12 · G-14 done 2026-05-12
- 代码: `core/leads/sales-contact-time.js` 存在（G-14） · `scripts/cli/pl-download-places-photos.js` 存在（G-13）
**影响**: **三方互相矛盾**。banner 误导操作员"还没做"，但其实已经做完。这是 Matthew 明确点名的 drift。
**Evidence**:
- Banner: `sop-1.astro:106`
- SOP-1 内部冲突: `SOP_1_INTAKE_DISCOVERY.md:351-352` (❌) vs `:189-194` (已实装描述)
- 真相: `SOP_OVERVIEW.md:264` "✅ G-13 ... done 2026-05-12" + `:268` "✅ G-14 ... done 2026-05-12"
- 代码证据: `core/leads/sales-contact-time.js` 文件存在 + `pl:download-places-photos` 在 package.json:23

### F-2 [Cosmetic] sync banner 说 "isThinContact 判断器源码在 core/leads/thin-contact.js" — 已实装 ✅
**核查**: `core/leads/thin-contact.js` 存在，`isThinContact` 导出。OK — **同步**。

### F-3 [Critical] G-3 `batches[]` + `latest.batch_id` 标 ✅ 但抽样 entity 缺
见 B-3 / B-4. 同一漂移。可能 SOP-1 §9 G-3 ✅ 仅对**新 entity** 有效，旧 entity 没 backfill；doc 没说明。

---

## G. 已标"仍待 / TODO"但代码已实装（反向漂移）

### G-1 [Critical] G-13 已 done 但 `SOP_1_INTAKE_DISCOVERY.md:351` 仍标 ❌
**Doc 说**: `SOP_1_INTAKE_DISCOVERY.md:351` "| G-13 Places photos → master.md asset library | ❌ |"
**实际**: `SOP_OVERVIEW.md:264` done 2026-05-12 · `package.json:23` `pl:download-places-photos` 注册 · SOP-1 文档自己 §3.6.3 (`:192-194`) 描述了它
**Fix**: SOP-1 §10.2 把 G-13 行删除 + 移到 §10.1

### G-2 [Critical] G-14 已 done 但同处仍标 ❌
**Doc 说**: `SOP_1_INTAKE_DISCOVERY.md:352` "| G-14 opening_hours → sales-time signal | ❌ |"
**实际**: `core/leads/sales-contact-time.js` 存在 · `SOP_OVERVIEW.md:268` done · SOP-1 §3.6.3 (`:189-190`) 描述
**Fix**: 同上

### G-3 [Cosmetic] G-12 Places API 多账号 rotation 已 done，SOP-1 §10.2 仍列为 ❌
**Doc 说**: `SOP_1_INTAKE_DISCOVERY.md:350` "G-12 Places API 多账号 rotation | ❌"
**实际**: `SOP_OVERVIEW.md:262` "✅ G-12 ... done" · `pl-places-enrich.js:79` "G-12: select first key with capacity remaining (multi-key rotation)"
**Fix**: 删除该行 / 移 §10.1

### G-4 [Ambiguous] G-18 Hermes cron 状态
**Task brief 说**: "G-18 (Hermes cron) 实际上 SOP-0 v1.7 已做掉"
**实际查证**:
- `core/funnel/hermes-cron.js` 存在 (wrapper / API)，但只用于"paused per-lead heartbeat jobs" (DISCORD_OUTREACH_PRD §9.3)，**不是** ops:health-check 注册
- `SOP_OVERVIEW.md:263` "🔵 G-18 ... Hermes cron 注册 ops:health-check (daily) · 92% 信心 · **低优**"
- `SOP_1_INTAKE_DISCOVERY.md:354` ❌
- sync banner `sop-1.astro:106` "还没做 ... G-18"
**结论**: Hermes cron **wrapper** 已存在，但 G-18 = "把 ops:health-check 注册成 daily cron"这一具体动作**未做**。Doc 与 banner **一致**。**Matthew 的提示需要澄清** — 可能他指的是 SOP-0 v1.7 把 Hermes cron 骨架做了（`SOP_OVERVIEW.md:73` "Hermes cron 骨架"），但没注册具体 job。
**建议**: 把 SOP-1 §10.2 G-18 改 "🔵 cron 骨架已建（SOP-0 v1.7） · ops:health-check job 未注册"。

---

## H. 其他不一致

### H-1 [Critical] SOP-1 doc §2.1 说 entityKey 格式 `image_<slug>_<phone>`，代码 fallback 是 `image_<slug>_nophone`
**Doc 说**: `SOP_1_INTAKE_DISCOVERY.md:39` "`image_<slug>_<phone>`" · §2.1 (`:300`) "image-lead 没 phone → 用 `image_<slug>_unknown` 兜底 key"
**代码**: `core/leads/discovery-store.js:91-93` `return \`image_${safeKey(\`${name}_${phone || 'nophone'}\`)};` —— 用的是 `'nophone'` 不是 `'unknown'`
**影响**: 操作员按 doc 找 `image_acme-roofing_unknown` 找不到 entity。
**Evidence**: `discovery-store.js:91-93`

### H-2 [Cosmetic] gosom CSV bridge "3 个字段重命名" 在 sop-1.astro / sop-1-doc 完全没渲染
**Doc 说**: `SOP_1_INTAKE_DISCOVERY.md:118-125` website→web_site / longitude→longtitude / descriptions→description
**Admin sop-1.astro**: 完全没提
**影响**: 操作员看 admin 不会知道有这个字段陷阱（`longtitude` 拼写错误尤其坑）。

### H-3 [Cosmetic] Handoff §0 (`SOP_HANDOFF_CONTRACT.md:12`) 说"schema 唯一定义在 `core/leads/discovery-store.js`" — 但 schemaVersion / fields 实际散在 normalize / mergeLeadIntoEntity / inferStatus / 多个文件
**Doc 说**: schema 唯一定义在 discovery-store.js
**代码**: `core/leads/discovery-store.js:38-66` 定义 enum + phase ✅ · 但 `latest.contact_identity` shape 实际由 `core/leads/enrichment.js` 生成 (`:145-158`) · `latest.places_enrichment` 由 `pl-places-enrich.js` 生成 · `latest.sales_signals` 由 `core/leads/sales-contact-time.js` 生成
**影响**: "唯一定义"说法误导。

### H-4 [Cosmetic] image-lead V1 路径 `scripts/leads/image-lead-discovery.js` 文档引用但实际位置可能漂移
**Doc 说**: `SOP_1_INTAKE_DISCOVERY.md:45` "V1 (`scripts/leads/image-lead-discovery.js`)"
**代码**: `core/leads/image-lead-discovery-v2.js` 存在；V1 路径 `scripts/leads/image-lead-discovery.js` **未验证**（建议跑 `ls scripts/leads/`）
**影响**: 如果 V1 真删了，doc 还保留路径就是死链。

### H-5 [Cosmetic] sop-1.astro 命令行卡片说 "完整列表见详细文档 §9"，但 SOP-1 文档 §9 是"工具实现状态"表，不是 CLI 列表
**Admin 说**: `sop-1.astro:279` "完整列表见 详细文档 §9"
**Doc**: `SOP_1_INTAKE_DISCOVERY.md` §9 (`:312-323`) 是 "G-1/G-2/G-3/G-6/G-6.1/G-4/G-5 工具实现状态"表 —— **不含完整 CLI 列表**
**影响**: 用户跳转后找不到完整 CLI 清单。完整 CLI 清单需查 `SOP_X_TOOLING.md` 或 `package.json`。

### H-6 [Cosmetic] sop-1.astro Discord forum tag 颜色 emoji 与 doc 不完全一致
**Doc 说**: `SOP_1_INTAKE_DISCOVERY.md:228` "🔵 in-progress · ⏸️ paused · ✅ completed · ⚠️ partial-failed · 🔁 retry-pending · ❌ aborted"
**Admin sop-1.astro**: 完全没渲染 forum tag 信息
**影响**: 操作员在 admin 看不到 batch tag 含义。

### H-7 [Cosmetic] `--swap-tag` 参数命名: doc §4.3 说 `--finalize --swap-tag completed`，代码确认 ✅ 同步
**Evidence**: `SOP_1_INTAKE_DISCOVERY.md:227` · `scripts/cli/pl-pipeline-batch-step.js:13,40`. OK — **同步**.

---

## 修复优先级建议

**P0 (本周必修)**：
1. **E-1** 修 Handoff §3 status enum 跟代码对齐（最高破坏性）
2. **D-1** 把 sop-1.astro 流程图 3b 分支移出主链（Matthew 已点名）
3. **F-1 / G-1 / G-2** 把 G-13 / G-14 在 sop-1.astro sync banner + SOP-1 §10.2 改成 ✅
4. **B-2 / E-2** 修 Handoff §2.1 `phase` 必填 → 改可空 + 注明"setEntityPhase 写入"
5. **C-1** 要么实装 `pl:dedup-undo`，要么从 doc 删除该承诺

**P1 (下一轮)**：
6. **B-1** Matthew 8 字段去重决策——是 v2 加，还是改预期？doc 标清。
7. **H-1** entityKey image fallback 文案 `nophone` vs `unknown` 选一个
8. **E-5** `merged` 加入 DISCOVERY_ENTITY_STATUS enum

**P2 (Cosmetic)**：A-2 · A-3 · B-5 · B-6 · B-7 · C-2 · C-3 · C-4 · D-2 · D-3 · E-3 · E-4 · G-3 · G-4 · H-2~H-6

---

**审计完成**: 2026-05-13 · 23 条 drift · 9 critical · 14 cosmetic · 0 文件被修改
