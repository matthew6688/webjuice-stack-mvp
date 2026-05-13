# M2 · 完整 audit + master.md design-ready · PRD

> **范围**: entity → 初步筛选 (4h cron) → detailed audit (12-dim) → grade A/B/C/D → 22 section master.md → Discord forum thread → 入 SOP-2 队列等 OD 设计
> **不在范围**: OD 网站设计本身 (M3) · 销售外联 (M4) · 购后 (M5)
> **状态**: 草稿 · 等 Matthew 审 · 不实装

---

## 0. Goal (一句话)

每个 entity 在入库后 ≤ 4 小时内拿到 **design-ready master.md**：
- 完整 audit (12 维 + 视觉 + 评论 + 评分 + 销售素材)
- Grade A/B/C/D
- Discord forum thread 开 (3 类都开)
- 进 SOP-2 audit 队列 + master.md 22 章 (5 必出)

## 1. Success Criteria · 怎么算 M2 完成

| 验收项 | 测试方法 |
|---|---|
| **初步筛选 4h cron** | Hermes cron `0 */4 * * *` · 看 last_run + rescore JSON 4h 更新 |
| **A/B 跑 docker full reviews** | 真 audit 一个 A grade entity · master.md 第 6 章 "评论分析" 有 ≥ 20 条 (docker `extra_reviews:true`) · 不是 5 条 (Places) |
| **Places API fallback** | mock docker fail · 验自动 fallback Places · 仍写入 reviewAnalysis fixture |
| **3 grade 自动开 Discord thread** | A/B/C 三个 entity audit 完 · 都在 #websites-leads 看到 thread (forum tag 对) |
| **C-grade cold outreach batch 队列** | C entity audit 完 · 自动入 `data/v2/funnel/cold-outreach-queue.json` · 1 day 内 cron 跑 batch send |
| **Master.md 5 必出 section** | 任意 grade A/B/C entity 跑 audit 完 · master.md 含: H1 / 一、速览 / 二、销售切入点 / 七、漏水 / 八、Redesign 发力点 |
| **OD invoke payload 自动派生** | 跑 `pl:od-invoke-prep --entity-key X` · 输出 `{source-url, business-type, tone, scope}` · 全字段非空 |
| **30 天 staleness 自动 refetch** | 改 fixture mtime 到 31 天前 · 跑 audit · 应自动 refetch (不 reuse old) |
| **录屏 + 截图 + PSI 都在 master.md** | 任意 audit 完 master.md 第 12 章 PSI 数据 · 录屏 link · issue-*.png 出现 |

## 2. Current State (M2 完成度)

| 已建 | 状态 |
|---|---|
| `scripts/leads/run-audit-pipeline.js` (4 stage) | ✅ |
| `core/scoring/lead-grading.js` (A/B/C/D + T1/T2/T3) | ✅ IP 不动 |
| `core/scoring/detailed-audit.js` (rubric) | ✅ IP 不动 |
| 12 维 audit (`core/audit/*` + `core/scoring/*`) | ✅ 不砍任何 |
| `core/reports/master-md-builder.js` (22 章) | ✅ 但 section 顺序要改 |
| Master.md auto-refresh hook (audit 完) | ✅ adb094e5 |
| Discord thread open (A/B) | ✅ via `openLeadThread` in `core/funnel/lead-thread-sync.js` |
| **C 不开 Discord thread** | ❌ 现状如此 · **要改为 C 也开** |
| **Reviews 默认 Places API** (Stage 3b) | ❌ 当前实装 · **要改为 docker first · Places fallback** |
| **C grade cold outreach batch** | ❌ 设计有 next_action 文字 · 实装无 CLI |
| Rescore CLI (`scoring:rescore-v2`) | ✅ 但手动 |
| Audit fixture 缓存 + `--refetch` | ✅ 但**无 staleness 自动 refetch** |
| 录屏 (mobile-throttled.webm) | ✅ `site-fetch-full.js` 已做 |
| 针对性截图 (issue-*.png) | ✅ `issue-evidence.js` 已做 |
| OD invoke 4 flag (source-url/business-type/tone/scope) | ❌ 当前手填 · **要自动派生** |
| Pixel 8 + analytics 检测 | ✅ `tech-stack-detector.js` 已做 |
| Master.md section 顺序 (销售切入点要前移) | ❌ **要改** |
| `pl:c-grade-batch-send` CLI | ❌ **要建** |

## 3. Architecture

```
M1 出口 (entity 入库 + master.md skeleton + phase=AWAITING)
                  ↓
        🆕 Hermes cron · 每 4 小时
        `npm run scoring:rescore-v2 --all-niches`
                  ↓
        per-niche cheap-audit-v2 (Tinyfish + 10 规则) →
        写 data/v2/fixtures/rescore/<niche>-<ts>.json
                  ↓
        chain `npm run leads:run-pipeline --all-audit-candidates`
                  ↓ per entity, 4 stage:

Stage 1 · detailedAudit (Playwright + 12 dim)
   ├─ siteFetchFull → 12 维 fixture data
   ├─ 🆕 30 天 staleness 检查 · 老于 30 天自动 refetch
   ├─ detailedAudit() → audit_score + decision + issues + 录屏 + 截图
   └─ 🪝 自动 chain master.md refresh
              ↓
Stage 2 · visualAudit (Claude vision → Codex → ollama cascade)
   ↓
Stage 3a · gradeLead + persistLeadGrade
   ├─ 8 hard-skip → D auto-archive
   ├─ A/B → status=graded · phase=AWAITING · 🆕 openLeadThread (Discord)
   └─ 🆕 C → status=graded · phase=AWAITING · 🆕 openLeadThread (Discord)
                                              · 🆕 enqueue cold-outreach-queue
              ↓
Stage 3b · review mining (🆕 docker first · Places fallback)
   ├─ A/B: try `pl:scrape-docker --extra-reviews --entity-key X`
   │     → 抓 ALL reviews (T0 free)
   │     → 失败 fallback: fetchLeadReviews (Places API · T2 paid · 5 reviews max)
   └─ C/D: skip (省 cost)
              ↓
Stage 4 · build internal HTML report
              ↓
              ↓ all stages done · master.md 再 refresh 一次 · 22 章满
              ↓
Master.md design-ready · OD 可以读 · M3 接手
              ↓
🆕 pl:od-invoke-prep --entity-key X
   ↓ 从 master.md frontmatter 派生 OD 4 flag
   ↓ {source-url: latest.website, business-type: niche+category,
       tone: niche-default-map[niche], scope: "Full concept with 3-4 key pages"}
   ↓ 输出 JSON · M3 直接吃
```

## 4. Deliverables · M2 要写/改的代码

### D1 · 初步筛选 每 4 小时 cron

**改文件**: `scripts/scoring/rescore-v2-cli.js` (现有 · 加 `--all-niches` mode)

```bash
# 当前
npm run scoring:rescore-v2 -- --niche roofing

# V3 新加
npm run scoring:rescore-v2 -- --all-niches
# 遍历 entity store distinct niches · 每个 niche 跑一遍 · chain run-pipeline
```

**新 Hermes cron**:
```
schedule: '0 */4 * * *'  (00:00, 04:00, 08:00, 12:00, 16:00, 20:00)
script:   ops/v3/rescore-and-audit.sh
deliver:  discord:bot-logs (静默 healthy · 异常报警)
```

新文件 `ops/v3/rescore-and-audit.sh`:
```bash
#!/usr/bin/env bash
cd /Users/matthew/Developer/google-map-website
npm run scoring:rescore-v2 -- --all-niches >> ~/Library/Logs/v3/rescore.log 2>&1
# 自动 chain run-pipeline · 在 rescore-v2-cli.js 内部做
```

### D2 · docker-first reviews · Places fallback

**改文件**:
- `scripts/cli/pl-scrape-docker.js` (现有 · 加 `--extra-reviews` flag · gosom job body 设 `extra_reviews:true`)
- `core/reviews/fetch-reviews.js` (现有 · 加 `extractor: 'docker' | 'places'` arg)
- `scripts/leads/build-internal-report.js` (改 · A/B 默认走 docker · 失败 fallback Places)

**新逻辑** in build-internal-report.js:
```js
async function fetchReviewsWithCascade(entity, leadGrade) {
  if (!['A', 'B'].includes(leadGrade.investment_level)) return null;
  
  // Try 1: docker (T0 free · full reviews · 比 Places 多 10-20x)
  try {
    const dockerOut = await spawnSync('node', ['scripts/cli/pl-scrape-docker.js',
      '--niche', entity.latest.niche, '--city', entity.latest.city,
      '--keywords', entity.latest.name,
      '--extra-reviews', '--entity-key', entity.entityKey,
    ]);
    if (dockerOut.status === 0) {
      const fixture = readFixture('docker-reviews', entity.entityKey);
      if (fixture?.reviews?.length >= 5) return fixture;
    }
  } catch (err) {
    console.warn(`docker reviews failed: ${err.message}`);
  }
  
  // Try 2: Places API fallback (T2 paid · max 5)
  return await fetchLeadReviews({ entity });
}
```

**注意**: gosom 跑 extra_reviews 慢得多 (5 min vs 1 min) · 要加 ~10min timeout。

### D3 · C grade · 开 Discord thread + 入 cold-outreach 队列

**改文件**: `core/scoring/lead-grading.js` `persistLeadGrade` 函数

**改动 1** (line ~349): 解除 C 的 thread skip:

```js
// 改前
if ((grade.investment_level === 'A' || grade.investment_level === 'B')
    && !process.env.SKIP_LEAD_THREAD_OPEN) {

// 改后
if (['A', 'B', 'C'].includes(grade.investment_level)
    && !process.env.SKIP_LEAD_THREAD_OPEN) {
```

**改动 2** (新 block · 加在 openLeadThread 之后): C grade 入 cold-outreach 队列:

```js
if (grade.investment_level === 'C') {
  import('../funnel/cold-outreach-queue.js').then(({ enqueueColdOutreach }) => {
    enqueueColdOutreach(entityKey, { reason: 'C-grade auto-enqueue' });
  }).catch(err => console.warn(err.message));
}
```

**新文件**: `core/funnel/cold-outreach-queue.js` (~80 行)

```js
export function enqueueColdOutreach(entityKey, { reason }) {
  const queuePath = path.join(storeRoot, 'queues/cold-outreach.json');
  const queue = readJson(queuePath) || { schemaVersion: 1, items: [] };
  // dedup · 同 entityKey 已在队列不重复
  if (queue.items.some(it => it.entityKey === entityKey)) return;
  queue.items.push({ entityKey, enqueued_at: new Date().toISOString(), reason, status: 'pending' });
  writeJson(queuePath, queue);
}
```

### D4 · `pl:c-grade-batch-send` CLI + cron

**新文件**: `scripts/cli/pl-c-grade-batch-send.js` (~150 行)

**逻辑**:
- 读 `data/leads/queues/cold-outreach.json`
- 取 status='pending' 的项 (default limit 50/day · `--limit N` 覆盖)
- 每条:
  - 从 master.md 读 entity 基础信息
  - 用模板 (`core/funnel/email-template.js` C-grade template) 生成邮件
  - 调 `core/integrations/agentic-inbox.js sendOutbound` (--dry-run default 期间 dry-run)
  - 写 entity contact_log + 队列 status='sent'
  - Discord thread post (audit-c tag · 不是 outreach-active · 因为 C 不进 personalized 跟进)

**新 Hermes cron**: `0 9 * * *` (每天 09:00 · 跟 SOP-0 doctor 同 slot)
- script: `ops/v3/c-grade-batch-send.sh`
- deliver: bot-logs

### D5 · 30 天 staleness · audit fixture 自动 refetch

**改文件**: `scripts/leads/run-audit-pipeline.js`

**改 Stage 1 缓存检查逻辑** (line ~85):
```js
// 改前
if (!refetch && fs.existsSync(detailedPath)) {

// 改后
const STALENESS_DAYS = Number(process.env.AUDIT_STALENESS_DAYS || 30);
const isStale = (filePath) => {
  if (!fs.existsSync(filePath)) return true;
  const ageMs = Date.now() - fs.statSync(filePath).mtimeMs;
  return ageMs > STALENESS_DAYS * 86400 * 1000;
};

if (!refetch && fs.existsSync(detailedPath) && !isStale(detailedPath)) {
```

同样改 Stage 2 visual audit · Stage 3b reviews fixture。

### D6 · Master.md 22 section · 重排 + required marker

**改文件**: `core/reports/master-md-builder.js`

**改 1 · section 顺序** (Matthew 2026-05-13 拍):

```
原                                  V3
H1                                  H1
内部分级 · 运营优先看这段           内部分级 · 运营优先看这段
一、店家现状速览                     一、店家现状速览
一(a) GMB 视觉素材                   🆕 二、推荐销售切入点 ← 上移
二、客户访问页面                    三、店家 GMB 视觉素材 (原一(a))
三、视觉审计                        四、客户访问页面
四、客户在 Google 评论              五、视觉审计
五、当前漏水                        六、客户在 Google 评论
六、Redesign 发力点                 七、当前漏水
七、推荐销售切入点 (原位)           八、Redesign 发力点
...                                 ...
```

**改 2 · required marker**: 5 个 section 必出 (即使数据空也输出占位):

```js
const REQUIRED_SECTIONS = [
  'h1',                          // 标题永远有
  'one_business_summary',        // 一、店家速览
  'two_sales_angles',            // 二、销售切入点 (新位置)
  'seven_current_issues',        // 七、当前漏水
  'eight_redesign_pivots',       // 八、Redesign 发力点
];

// 在 buildMasterMd 出口 · check 5 个 required 都 push 进去了
// 不够则塞占位 "TBD · audit 数据未就绪"
```

### D7 · OD invoke prep · 从 master.md 派生 4 flag

**新文件**: `scripts/cli/pl-od-invoke-prep.js` (~100 行)

```bash
npm run pl:od-invoke-prep -- --entity-key place_xxx
# 输出:
{
  "ok": true,
  "entity_key": "place_xxx",
  "od_invoke_args": {
    "client": "<slug>",
    "source-url": "https://...",       # entity.latest.website
    "business-type": "restaurant - steak and seafood",  # niche + category
    "tone": "Luxury / refined",        # niche default map
    "scope": "Full concept with 3-4 key pages"  # default
  },
  "command": "npm run open-design:run-concept -- --client <slug> --source-url ... ..."
}
```

**niche → tone 默认 map** (扩展用):
```js
const NICHE_TONE_MAP = {
  restaurant: 'Luxury or warm · depends on rating ≥ 4.5',
  cafe: 'Warm · approachable',
  plumber: 'Trust · reliable · 24/7',
  roofer: 'Trust · weather-tough · QBCC',
  cafe: 'Warm · social · Instagram-friendly',
  dentist: 'Clean · professional · gentle',
  // ... 扩展
};
```

### D8 · Discord forum tag set 升级

**改文件**: `data/discord/website-tasks-forum-tags.json`

**当前**: 14 个 tag (3 grade + 8 phase + 3 modifier)

**加 1 个**: `audit-c-cold` (C grade 进 cold outreach 队列但还没发的过渡 tag)

或: 复用 `audited-C` + 添加 modifier tag `cold-pending`。

**优先复用现有**: `audited-C` + 不加新 tag · 因为 C 阶段流程简单 (audit → batch send → archive)。

### D9 · M2 完整 E2E 测试套

**新文件**: `scripts/qa/test-m2-pipeline.mjs` (~250 行)

**测**:
- 跑 1 个真 audit (用 rich-and-rare-restaurant 测试客户) · 验所有 12 维 fixture 写盘
- 验 master.md 22 章 (含 5 required) 在 audit 完后 30 秒内更新
- 验 录屏 + 截图 + PSI 都进 master.md
- 验 Discord thread 在 #websites-leads 创出 (mock listener · 不真发)
- 验 OD invoke prep 输出 4 flag

---

## 5. 不在 M2 范围

- OD 设计本身 (`open-design:run-concept` · M3)
- 客户 preview 网站 deploy (`<slug>-dev.pages.dev` · M3)
- Preview bottom banner (M3)
- email 真发 (CF Access token + agentic email · M4)
- 修改次数限制 / approval flow (M5)
- Customer dashboard (M5)
- ABN / lat-lng dedup signals (V3.1 backlog)

## 6. Open Issues (5% 不确定)

1. **rescore --all-niches mode 实装**: 当前 CLI 单 niche · 加 mode 写 distinct niches 循环。问题: niche field 不规范 (有"plumber" "plumbers" "Plumbing" 等)。先 normalize 还是先跑？建议跑前 grep distinct + manual map 一次。
2. **docker --extra-reviews 实测时间**: 没真跑过 extra_reviews:true 的 gosom job。如果 > 10 min · timeout 要调。M2 实装前先单跑一次测时间。
3. **C-grade batch send 真发 vs dry-run**: 当前 pl:email-send 默认 dry-run · `pl:c-grade-batch-send` 是直接 dry-run 还是真发？我倾向 dry-run 一周 (看哪些 entity 进了队列 · 模板 OK 不) · 然后再真发。需 Matthew 拍。
4. **30 天 staleness env**: AUDIT_STALENESS_DAYS=30 写死还是按 niche 不同？(roofer 可能 90 天 · cafe 30 天)。建议先 30 天全 niche · backlog 加 per-niche。
5. **OD invoke 失败的 fallback**: 当 OD 跑不通 · M2 出口的 master.md 怎么办？建议 M2 仍出 master.md · 但标 `od_status: 'failed'` · M3 重试时再更新。

## 7. Acceptance Criteria · M2 done

```
1. 跑 test-m2-pipeline.mjs --validate-m2 → 全 PASS
2. Hermes cron `0 */4 * * *` rescore-and-audit · 第一次 4 小时后:
   - 所有 entity status=audit_candidate 都进 detailed audit
   - 至少 1 个 A/B/C/D · 全 4 grade 都跑过一遍
3. A grade entity master.md 含:
   - 22 section 中 ≥ 18 (其余 conditional 缺数据正常)
   - 5 required 必出
   - 第 6 章 (Google 评论) 有 ≥ 20 reviews (docker)
   - 第 12 章 PSI 数据完整 (mobile + desktop)
   - 录屏 link 在 frontmatter assets.video_url
   - 至少 5 issue-*.png 截图链接
4. C grade entity master.md 含:
   - 5 required section
   - 第 6 章评论 SKIPPED (省 cost · 正确行为)
   - cold-outreach-queue.json 含此 entityKey · status='pending'
   - Discord #websites-leads thread 已开 · tag=audited-C
5. D grade entity:
   - phase=ARCHIVED · 没开 thread (正确 skip)
   - 没建 cold-outreach 队列
6. 跑 pl:od-invoke-prep --entity-key X 输出 4 flag · 全非空
7. 改 fixture mtime 到 31 天前 · 跑 audit · stage 1 报 "refetch (stale)" 不 reuse
```

## 8. Rollback Plan

每 deliverable 独立 commit · 出错单独 revert:
- D1 (rescore 4h cron): hermes cron rm 0552a0bf3348 · 回手动
- D2 (docker-first reviews): revert build-internal-report.js · 回 Places-only
- D3 (C grade thread): revert lead-grading.js · 回 A/B 才开 thread
- D4 (c-grade-batch-send): 删 CLI · cold-outreach queue 不变 (积累但不发)
- D5 (staleness): revert · 回 always-reuse-cache
- D6 (section reorder): revert master-md-builder.js · 回原顺序
- D7 (od-invoke-prep): 删 CLI · M3 手填 4 flag
- D8 (tag): JSON 不动 · 用现有
- D9 (test): 删了不影响生产

## 9. Dependencies

| 上游 | 状态 |
|---|---|
| M1 完成 (entity 进库 + master.md skeleton) | M1 完成才能开 M2 实装 |
| Hermes cron 系统 | ✅ 在跑 (SOP-0 / OD 都用了) |
| `scripts/scoring/rescore-v2-cli.js` | ✅ 存在 · 加 --all-niches mode |
| `core/reviews/fetch-reviews.js` | ✅ 存在 · 加 fallback 逻辑 |
| Google Places API key | ✅ `.env.local` 配着 |
| Cloudinary 上传 (录屏 + 截图) | ✅ 配着 |

## 10. Effort Estimate

| 子 deliverable | 工时 |
|---|---|
| D1 · rescore --all-niches + Hermes cron 4h | 3h |
| D2 · docker-first reviews + Places fallback | 3h (含 extra_reviews 真测) |
| D3 · C-grade Discord thread + queue | 1.5h |
| D4 · pl:c-grade-batch-send + cron | 3h |
| D5 · 30 天 staleness check | 1h |
| D6 · master.md 22 section 重排 + 5 required | 2h |
| D7 · pl:od-invoke-prep + niche-tone map | 2h |
| D8 · forum tag set 升级 | 30 min |
| D9 · 测试套 | 3h |
| **总** | **~19h** (2.5 工作日) |

## 11. Timeline (按 2.5 工作日)

- 第 1 day morning: D5 + D6 (staleness + section 重排 · master.md 出口完善)
- 第 1 day afternoon: D3 + D8 (C grade thread + tag) + D1 cron (4h rescore)
- 第 2 day morning: D2 (docker-first reviews · 含真测 extra_reviews 时间)
- 第 2 day afternoon: D4 + D7 (c-grade batch send · od invoke prep)
- 第 3 day morning: D9 (测试套) + end-to-end 验证 + commit + push

---

## 12. 我现在需要 Matthew 决的 5 件事

回我 5 个字母 即可:

1. **rescore --all-niches 先 grep distinct niches + manual normalize map** · OK? (避免 plumber vs plumbers 跑两次)
2. **docker --extra-reviews 真测时间未知** · M2 实装前先单跑 5 min smoke 看时间 · OK?
3. **C-grade batch send 先 dry-run 1 周再真发** · OK? (避免直接发出可能模板还差)
4. **30 天 staleness 全 niche 统一** · OK? (per-niche 后期再说)
5. **OD invoke 失败 fallback · 仍出 master.md 标 od_status=failed · M3 重试** · OK?

回完我开干 M2 实装。

---

## 13. M1 + M2 顺序 + 阻塞关系

```
今天:
  Matthew 审 M1 PRD + M2 PRD · 回开关 + 5+5 = 10 个 Q
  → 我 commit + push v3-modular branch (PRDs)

Day 1:
  我开干 M1 (9-10h) · v3-modular branch
  完了跑 sop1-live-demo --validate-m1
  Matthew sign-off

Day 2-3:
  我开干 M2 (19h) · v3-modular branch
  Day 3 跑 test-m2-pipeline
  Matthew sign-off
  
Day 4 (后):
  merge v3-modular → main
  V3 M1+M2 上线 · pivot M3 (OD 设计 + 发布)
```

总: ~4 工作日完成 M1+M2 闭环。
