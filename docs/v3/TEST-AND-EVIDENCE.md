# V3 测试 + 硬证据 + 验收标准

> Matthew memory rule `feedback_bundle_work_with_evidence.md`:
> "every block must produce explicit hard evidence before counting as done"
>
> 这文档是 M1 + M2 所有 deliverable 的**验收硬标准**。
> 每个 deliverable 都有 4 项: TEST + EVIDENCE + AUDIT + 验收命令。
> 单条命令 `npm run v3:validate-m1` / `v3:validate-m2` 跑全套 → 出 PASS/FAIL。

---

## 通用规则 (4 项 hard evidence)

每个 deliverable 必须有：

1. **TEST**: 一个 `.mjs` 文件 · 含 N 个 assertion
2. **EVIDENCE**: 一个产物文件 (json/log/screenshot) · 跑完留盘
3. **AUDIT**: self-audit checklist · commit 前我自己过
4. **VERDICT 命令**: 一条 npm script · 退出码 0 = PASS

整 M1/M2 验收: `npm run v3:validate-m1` (或 m2) 跑所有 deliverable 的 VERDICT · 输出汇总。

---

## M1 验收标准 (6 deliverable)

### M1-D1 · text similarity + 5-key dedup scoring

**TEST 文件**: `scripts/v3/test-m1-d1-dedup-scoring.mjs`

**12 个 mock pair assertion**:

| # | A vs B | 预期分 | 期望 verdict |
|---|---|---|---|
| 1 | 完全同 (place_id 同 · 不进 dedup-detector) | n/a | auto-merge at intake |
| 2 | 同 phone + 同 name | 35+20=55 | 30-60 → LLM 判 |
| 3 | 同 phone + 同 domain | 35+25=60 | ≥60 → auto-merge |
| 4 | 同 phone + 同 email | 35+30=65 | ≥60 → auto-merge |
| 5 | 同 phone + name fuzzy 0.85 | 35+(20×0.85)=52 | 30-60 → LLM |
| 6 | 同 email + 同 address | 30+15=45 | 30-60 → LLM |
| 7 | 仅 name fuzzy 0.95 | 20×0.95=19 | <30 → 放行 |
| 8 | 仅 address 同 | 15 | <30 → 放行 |
| 9 | name fuzzy 0.85 + address 同 | (20×0.85)+15=32 | 30-60 → LLM (边界) |
| 10 | name fuzzy 0.95 + address 同 | (20×0.95)+15=34 | 30-60 → LLM |
| 11 | 同 phone + 同 name + 同 address | 35+20+15=70 | ≥60 → auto-merge |
| 12 | 全空 (no signals) | 0 | <30 → 放行 |

**EVIDENCE 文件**: `data/qa/m1-d1-dedup-scoring.json` · 含 12 case 的 actual vs expected + verdict

**AUDIT checklist** (commit 前):
- [ ] 12 case PASS
- [ ] text-similarity.js 单元覆盖率 ≥ 90%
- [ ] 阈值 60/30 不 hardcode (env override 可用)
- [ ] place_id 仍然在 mergeLeadIntoEntity 第 0 道防线 auto-merge

**VERDICT**: `npm run v3:test-m1-d1` → 退 0 = PASS

---

### M1-D2/D7 · 统一 discoveryScore

**TEST 文件**: `scripts/v3/test-m1-d2-discovery-score.mjs`

**6 个 assertion**:

| # | 输入 | 预期 |
|---|---|---|
| 1 | gosom-style entity (websiteStatus=https · phone · review_count=100 · rating=4.5) | score ≥ 25 |
| 2 | places-api-style 同商家 (websiteStatus=空 · 其他同) | score ≈ ±5 of #1 (null-safe 派生 websiteStatus) |
| 3 | image_lead entity (signals 极少) | score = 0 (no signals to score) |
| 4 | single_enrich entity (基础字段) | score ≥ 15 (phone + website) |
| 5 | no website entity | score 含 NO_WEBSITE bonus +40 |
| 6 | empty entity (一切空) | score = 0 (no crash) |

**EVIDENCE 文件**: `data/qa/m1-d2-score-cross-source.json` · 4 sourceType 的同样商家 (mock) 算分对比

**AUDIT**:
- [ ] 6 case PASS
- [ ] null-safe (没字段不 crash)
- [ ] classifyWebsiteStatus 复用 maps-scraper-discovery.js 函数
- [ ] 4 入口 (pl:scrape-docker / pl:places-search-intake / pl:single-enrich / pl:ingest-image) 都调

**VERDICT**: `npm run v3:test-m1-d2`

---

### M1-D3 · Hermes skill profitslocal-website-intake

**TEST 文件**: `scripts/v3/test-m1-d3-skill-discovery.mjs`

**4 个 assertion**:

1. SKILL.md exists at `~/.hermes/profiles/marketer/skills/b2b-marketing/profitslocal-website-intake/SKILL.md`
2. SKILL.md YAML frontmatter has: `name`, `description`, `read_when`, `allowed-tools: Bash`
3. SKILL.md `description` mentions 4 入口 (intake/places/single/image)
4. Old webjuice-outbound-pipeline moved to `.archive/`

**EVIDENCE 文件**: `data/qa/m1-d3-skill-smoke.md` · 含
- SKILL.md path + size
- archive 后的旧 skill 路径
- Hermes chat smoke 5 句话测试日志 (我本地手测 · 不强制 CI):
  - "find brisbane plumbers" → 期望调 pl:pipeline-batch-start
  - 多引号 "cafe sydney" "cafe melbourne" → pl:places-search-intake
  - "Joe Plumbing 0412345678" → pl:single-enrich
  - "audit https://maps.app.goo.gl/..." → audit
  - "find dentist in cairns" → batch (cairns no longer in regex list · LLM 抽 work)

**AUDIT**:
- [ ] 4 file assertion PASS
- [ ] 手测 5 句话 chat smoke 至少 3/5 路由正确 (LLM 不稳定 60% 接受)
- [ ] 旧 skill archive · 不被 Hermes load

**VERDICT**: `npm run v3:test-m1-d3` (CI 部分) + 手测 chat 5 句话 (manual)

---

### M1-D4 · pl:ingest-image parseArgs --key=value

**TEST 文件**: `scripts/v3/test-m1-d4-parseargs.mjs`

**6 个 assertion**:

| # | argv | 预期 parse |
|---|---|---|
| 1 | `--business-name 'Joe Plumbing'` | `{businessName: "Joe Plumbing"}` |
| 2 | `--business-name='Joe Plumbing'` | `{businessName: "Joe Plumbing"}` (等号也行) |
| 3 | `--phone=0412345678 --niche=plumber` | both parsed |
| 4 | `--dry-run` (no value) | `{dryRun: true}` |
| 5 | `--phone 0412 --phone=0413` | last wins (etc) |
| 6 | image-prep 风格 listener 输出 `--business-name=Joe's plumbing` (有引号撇号) | 正确 parse |

**EVIDENCE 文件**: `data/qa/m1-d4-parseargs.json`

**AUDIT**:
- [ ] 6 case PASS
- [ ] pl-ingest-image.js import 自 `_pl-shared.js` 共享 parseArgs (不是 local)
- [ ] 不破坏现有 --key value 语法

**VERDICT**: `npm run v3:test-m1-d4`

---

### M1-D5 · bulk-archive stale entities

**TEST 文件**: `scripts/v3/test-m1-d5-bulk-archive.mjs`

**5 个 assertion** (集成测试):

1. Before: count entity with `status=queued_for_audit + no V2 phase` = 94
2. backup tarball exists (`data/leads/entities-backup-YYYYMMDD.tar.gz`)
3. dry-run output lists 94 entityKeys (no write)
4. commit run: 94 entity phase → ARCHIVED, archive_reason='v2-stale-cleanup'
5. After: count stuck = 0

**EVIDENCE 文件**:
- `data/qa/m1-d5-bulk-archive-report.json` (before/after counts + list of 94 entityKeys)
- `data/leads/entities-backup-YYYYMMDD.tar.gz` (backup proof)

**AUDIT**:
- [ ] Backup created before commit
- [ ] dry-run 不修改 entity
- [ ] commit 后 stuck count = 0
- [ ] 每 entity 加 history event (cleanup log)

**VERDICT**: `npm run v3:test-m1-d5` (auto-rollback after)

---

### M1-D6 · sop1-live-demo --validate-m1

**TEST 文件**: 改 `scripts/qa/sop1-live-demo.mjs` 加 `--validate-m1` mode

**5 case 验收**:

| # | 入口 | 输入 | 期望 |
|---|---|---|---|
| 1 | batch-maps | `find brisbane plumbers --count 3` | 3 entity 入库 + 3 master.md skeleton · 30 秒内 |
| 2 | places-api | `"cafe brisbane" --limit 2` | 2 entity (places_search source) · 都有 phone |
| 3 | single-enrich | name+phone+city | 1 entity place_chij... · 自动 chain audit task |
| 4 | image | 实际 image file + flags | 1 image_<slug>_<phone> entity |
| 5 | dedup | 上述 entity 跑 dedup-detector | 0 high-conf suspect (因为都是不同商家) |

**EVIDENCE 文件**: `data/qa/m1-d6-live-demo-2026-XX-XX.md` (timeline + entity_keys + master.md paths)

**AUDIT**:
- [ ] 5/5 case PASS
- [ ] 每个 entity 入库 30 秒内 master.md skeleton 写出 (现 hook 验证)
- [ ] discoveryScore 同商家不同入口算分一致 (±5)

**VERDICT**: `npm run v3:test-m1-d6` (运行时间 ~10 min · 真跑 OD daemon + ollama)

---

### M1 总验收 · `npm run v3:validate-m1`

跑顺序:
```bash
npm run v3:test-m1-d1   # dedup scoring 12 case
npm run v3:test-m1-d2   # discovery score 6 case
npm run v3:test-m1-d3   # skill discovery 4 + 5 manual
npm run v3:test-m1-d4   # parseArgs 6 case
npm run v3:test-m1-d5   # bulk archive 5 case
npm run v3:test-m1-d6   # live demo 5 case
```

**汇总输出** `data/qa/m1-validation-summary.json`:
```json
{
  "overall": "PASS|FAIL",
  "tested_at": "2026-05-XX",
  "deliverables": {
    "M1-D1": {"status": "PASS", "tests": 12, "passed": 12},
    "M1-D2": {"status": "PASS", "tests": 6, "passed": 6},
    ...
  }
}
```

**M1 算 done 的条件**: overall=PASS · all 6 deliverable PASS · 任 1 FAIL → M1 不通过 · 修复重测。

---

## M2 验收标准 (8 deliverable)

### M2-D1 · rescore --all-niches + 4h cron

**TEST 文件**: `scripts/v3/test-m2-d1-rescore-all.mjs`

**5 assertion**:

1. `npm run scoring:rescore-v2 -- --all-niches --dry-run` 输出 distinct niches list (6 个 after normalize)
2. Real run 写 N 个 JSON to `data/v2/fixtures/rescore/<niche>-<ts>.json`
3. Normalize map applied: 'roofing' merged into 'roofer'
4. Empty niche entities skipped (20 个)
5. Hermes cron `0 */4 * * *` 装 + 跑 1 次 last_run = ok

**EVIDENCE**:
- `data/qa/m2-d1-rescore-output/<niche>-summary.json` × N
- `~/.hermes/.../sop1-rescore-cron.log`

**VERDICT**: `npm run v3:test-m2-d1`

---

### M2-D2 · docker reviews + Places fallback + adapter 🔑

**TEST 文件**: `scripts/v3/test-m2-d2-reviews-cascade.mjs`

**6 assertion**:

1. A grade entity · docker 路径 · 拿到 ≥ 5 reviews (实测 8)
2. C/D entity · skip reviews (no fetch · no fixture write)
3. docker fail mock · 切 Places fallback · 拿到 ≤ 5 reviews
4. Format adapter: docker `{Name,Rating,Description}` → `{author_name,rating,text}` 转换正确
5. reviewAnalysis fixture written compatible with master-md-builder
6. 时间 < 5 min/per entity (timeout 安全)

**EVIDENCE**:
- `data/qa/m2-d2-reviews-comparison.json` (docker vs Places · 同商家)
- `data/v2/fixtures/reviews/<entityKey>.json` (1 真客户)

**VERDICT**: `npm run v3:test-m2-d2`

---

### M2-D3 · C-grade Discord thread + cold-outreach queue

**TEST**: `scripts/v3/test-m2-d3-c-grade-thread.mjs`

**4 assertion**:

1. C-grade persistLeadGrade → Discord openLeadThread called (mock · 不真发)
2. cold-outreach-queue.json 加 entry · status=pending
3. 同 entity 调两次 · 队列只 1 个 (dedup)
4. A/B grade 不进 cold-outreach 队列 (各自走个性化)

**EVIDENCE**: `data/qa/m2-d3-c-grade-test.json` + queue.json before/after

**VERDICT**: `npm run v3:test-m2-d3`

---

### M2-D4 · pl:c-grade-batch-send + dry-run env flag

**TEST**: `scripts/v3/test-m2-d4-batch-send.mjs`

**5 assertion**:

1. Default `C_GRADE_BATCH_LIVE` 未设 → dry-run mode · stdout 10 dummy emails · 不 sendOutbound
2. `C_GRADE_BATCH_LIVE=1` + mock agentic-inbox · 10 emails 都发 (mock 返回 ok)
3. 真发后 entity.contact_log 追加 · queue.status=sent
4. Limit `--limit 5` 只取 5 个 · 队列剩 5 个 pending
5. C-grade template HTML 渲染 OK (无空 placeholder · 无 broken link)

**EVIDENCE**:
- `data/qa/m2-d4-batch-send-dryrun.txt` (10 真 emails 长啥样)
- `data/qa/m2-d4-batch-send-after.json` (queue + contact_log 状态)

**VERDICT**: `npm run v3:test-m2-d4` (含 dry-run + mocked live)

---

### M2-D5 · 30-day staleness

**TEST**: `scripts/v3/test-m2-d5-staleness.mjs`

**3 assertion**:

1. Fresh fixture (today's mtime) · 跑 audit · stage 1 reuse cache (log "reuse cached fixture")
2. Stub fixture mtime 31 天前 · 跑 audit · stage 1 refetch (log "refetch (stale 31d)")
3. `AUDIT_STALENESS_DAYS=7` env override · 8 天前 fixture 也 refetch

**EVIDENCE**: `data/qa/m2-d5-staleness-log.txt`

**VERDICT**: `npm run v3:test-m2-d5`

---

### M2-D6 · master.md 5 required section + reorder

**TEST**: `scripts/v3/test-m2-d6-master-md.mjs`

**6 assertion**:

1. Empty audit data · master.md 仍含 5 required section header
2. 五/六/七 章数据空 · 输出 "**TBD · audit 不完整**" 占位
3. 七、销售切入点 位置移到 一、速览 之后 (检查 line order)
4. 22 章 conditional 数据满时仍全部输出
5. Frontmatter `od_status` 字段可空 (M2 不写 · M3 写)
6. 真客户 (rich-and-rare-restaurant) 渲染前后 diff 合理 (人审)

**EVIDENCE**:
- `data/qa/m2-d6-master-md-empty.md` (空 audit 输出)
- `data/qa/m2-d6-master-md-full.md` (满 audit 输出)
- diff against 现有 master.md (regression check)

**VERDICT**: `npm run v3:test-m2-d6`

---

### M2-D7 · pl:od-invoke-prep · 从 master.md 自派生 (无 hardcode)

**TEST**: `scripts/v3/test-m2-d7-od-prep.mjs`

**5 assertion**:

1. rich-and-rare entity · 输出 source-url='https://richandrare.com.au'
2. business-type 含 niche (restaurant)
3. tone = "Match brand voice from existing site; if none, refined-professional default for niche"
4. scope = "Full concept with 3-4 key pages"
5. No website entity (image_lead) · tone fallback to "refined-professional default"

**EVIDENCE**: `data/qa/m2-d7-od-prep-outputs.json` (3 entity × 4 flag)

**VERDICT**: `npm run v3:test-m2-d7`

---

### M2-D8 · Forum tag set

**TEST**: 检查 `data/discord/website-tasks-forum-tags.json` 含 14 个 tag (无新增)

**EVIDENCE**: `data/qa/m2-d8-tag-check.json`

**VERDICT**: `npm run v3:test-m2-d8`

---

### M2 总验收 · `npm run v3:validate-m2`

跑顺序 同 M1。汇总到 `data/qa/m2-validation-summary.json`。

**M2 算 done**: overall=PASS · 全 8 deliverable PASS · 任 1 FAIL → M2 不通过。

---

## Audit 自审 checklist · commit 前我必跑

```
□ 每 deliverable VERDICT 命令 PASS
□ 没 breaking change main branch 代码 (仅 v3-modular)
□ 老回归 SOP-0 test still PASS (npm run qa:test-sop0-regression)
□ 老回归 SOP-1 sync test PASS (npm run qa:test-sop1-doc-sync)
□ npx astro build PASS · 172 page (admin UI 不破)
□ git diff --stat 看变动 · review
□ Hermes daily SOP-0 health ping 仍 ok (cron last_run 检查)
□ OD daemon healthy (curl :7466/api/health)
□ Commit msg 含 deliverable id + EVIDENCE 文件路径
```

---

## 信心指数 (实在的)

| 维度 | 当前 | 目标 |
|---|---|---|
| 决策完整度 | **95%** (13/13 + multi-LLM 改) | 95% |
| PRD 完整度 | 90% | 95% |
| 测试脚本 written | 0% (本文档定义但未实装) | 100% |
| Hard evidence artifact spec | **95%** (这文档定义完) | 95% |
| Audit checklist | **95%** | 95% |
| 跑过 dry-run sanity check | 0% | 100% |

**综合信心 · 准备 implement**: 当前 **75%** → 写完测试脚本后 90% → 跑 dry-run 后 95% → 然后才真开干。

## 实施前最后 step (~3h)

1. **写 6+8=14 个 test .mjs 文件** (~150 LOC 每 = 2 工程小时)
2. **写 v3:validate-m1/m2 汇总 runner** (~50 LOC · 30 min)
3. **本地空跑** dry-run mode · 验测试本身可跑 (30 min)
4. **commit + push** v3-modular · 你审 hard evidence spec

Then M1 实装 9-10h + M2 实装 19h · 严格按 TEST + EVIDENCE 跑。

---

## 我现在做什么

1. 这文档 push 到 v3-modular (✅ 即将)
2. 写 14 test files + validator runner (~3h)
3. 然后再开 M1 D1 (text similarity)

**不实装任何 production 代码** 直到所有 test scaffolding 就绪。
