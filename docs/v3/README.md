# V3 · Module-by-Module Design · current status 2026-05-13

> **Branch**: `v3-modular` · worktree `/Users/matthew/Developer/google-map-website-v3/`
> **GitHub**: https://github.com/matthew6688/webjuice-stack-mvp/tree/v3-modular
> **原则**: 每模块 95% 信心 → PRD → 实装 → E2E + bug fix

## 模块状态

| 模块 | 范围 | 状态 | 验证 |
|---|---|---|---|
| **M1** · 入库 + dedup + master.md skeleton | 6 deliverable | ✅ **DONE** | `npm run v3:validate-m1` → 16/16 PASS |
| **M2** · audit + 22-section master.md + grade router + customer audience | 10 deliverable | ✅ **DONE** | `npm run v3:validate-m2` → 46/46 PASS |
| **M3** · reference-adapter handoff (V3 default · 替代 freeform OD prompt) | 核心模块 + CLI 已建 | ⚠️ HALF DONE | `pl:build-from-reference` works · 还没 hook 进 audit pipeline · 还没 publish |
| **M4** · outreach (email / sms / voice / appointment) | — | ❌ NOT STARTED | — |
| **M5** · paid lifecycle (Stripe → approval → domain → revision) | — | ❌ NOT STARTED | — |

## 累计 assertion · `v3-modular`

| Suite | Pass |
|---|---|
| v3:validate-m1 | 16/16 |
| v3:validate-m2 | 46/46 |
| v3:e2e (M1+M2 集成) | 29/29 |
| v3:e2e-4-entry (真入口 → master.md) | 18/18 |
| reference-adapter-handoff contract | 6/6 |
| deep-e2e-reference-adapter (claude CLI live) | 11/11 |
| qa:test-sop0-regression | 16/16 |
| qa:test-sop1-doc-sync | 28/28 |
| **总** | **170+ PASS · 0 FAIL** |

## Bug fix 历史 · 19 个 bug 处理 (18 fixed · 1 cosmetic 待)

完整说明: [MASTER-MD-AUDIT-V2-2026-05-13.md](./MASTER-MD-AUDIT-V2-2026-05-13.md)

| # | Bug | 严重度 | 状态 |
|---|---|---|---|
| 1 | 10 客户 master.md 缺 3 必出 section | 🔴 | ✅ |
| 2 | 5 客户 visual_freshness=NULL · vision audit silent fail | 🔴 | ✅ |
| 3 | pl:single-enrich query 错 ("Brisbane" → city geo) | 🔴 | ✅ |
| 4 | evidence_count 永远 0 (不读磁盘 dir) | 🟠 | ✅ |
| 5 | queensland evidence dir 空 (Playwright 未装) | 🟠 | ✅ |
| 6 | places-search-intake niche 空 | 🟠 | ✅ |
| 7+10+14 | duplicate `## 二、/三、/四、/五、` headers | 🟡 | ✅ |
| 8 | 必出 section 出现在附录后 | 🟡 | ✅ |
| 9 | city 大小写不一致 | 🟡 | ✅ |
| 11 | "未明确决策类型: undefined" | 🟢 | ✅ |
| 12 | 附录链接到不存在的 HTML | 🟢 | ⚠️ 待修 (cosmetic) |
| 13+16 | Vision model 字段写死 ollama · 真用 claude/codex | 🟢 | ✅ |
| 15 | 6/10 客户 vision audit 没跑 (=Bug 2 expand) | 🟠 | ✅ |
| 17 | reviews 卡 5 条 · docker 未 retro-fit | 🟠 | ✅ |
| 18 | GMB photos 14/15 客户 0 张 | 🟠 | ✅ |
| 19 | video_url=null 即使 .webm 在磁盘 | 🟢 | ✅ |

## 真客户 master.md 状态 · 10 个 audit 完整

| Customer | audit | visual | evidence | reviews | photos | video |
|---|---|---|---|---|---|---|
| brisbane-roof-restoration-experts | 70 | 4 | 6 | 5 (places) | 6 | local |
| brisbane-roofing-solutions-... | 69 | 4 | 8 | 119 (docker) | 6 | local |
| diamond-roof-tiling-restoration | 55 | 3 | 7 | 65 (docker) | 6 | local |
| fix-my-roof-total-roof-restorations | 51 | 3 | 8 | 128 (docker) | 6 | local |
| gutter-and-roof-repairs | 69 | 4 | 7 | 150 (docker) | 6 | local |
| hurricane-digital-seo-brisbane | 64 | 6 | 9 | 181 (docker) | 6 | local |
| queensland-roofing-pty-ltd | 23 | 4 | 10 | 35 (docker) | 6 | local |
| roof-space-renovators | 65 | 5 | 5 | 221 (docker) | 6 | cloudinary |
| roofshield-roof-restorations | 53 | 4 | 6 | 51 (docker) | 6 | local |
| weatherproof-restorations | 61 | 7 | 7 | 136 (docker) | 6 | local |

## 关键模块/文件 (代码-文档同步)

### Code

| 文件 | 作用 | 加入时间 |
|---|---|---|
| `core/leads/dedup-scorer.js` | M1-D1 · 5-key weighted dedup scoring | M1 |
| `core/leads/discovery-score.js` | M1-D2 · unified discovery score (4 entries) | M1 |
| `core/leads/discovery-store.js` | entity persist + mergeLeadIntoEntity · M1-D2 wired + auto master.md refresh | M1 |
| `core/leads/grade-router.js` | M2-D3 · grade ABCD 路由 (C → Discord + cold queue) | M2 |
| `core/leads/audit-stage1.js` | M2-D5 · 30-day staleness check | M2 |
| `core/leads/reviews-adapter.js` | M2-D2 · docker → places review cascade · normalize | M2 |
| `core/leads/reference-adapter-handoff.js` | **M3 default OD handoff** (替代 freeform prompt) · FAMILY_REGISTRY | M3 |
| `core/reports/master-md-builder.js` | 22-section master.md + ensureAllRequiredSections + ensureRequiredOrder + countEvidenceOnDisk + localVideoPath | M2 + bug fixes |
| `core/reports/autoresearch-loop.js` | M2-D9 · 5-round customer-audience report | M2 |
| `core/reports/generator.js` | M2-D9 · internal/customer audience preambles | M2 |
| `core/reviews/fetch-reviews-local.js` | gosom docker wrapper · -extra-reviews · 拿全 review history | pre-M1 (extended in Bug 17) |
| `core/llm/vision-adapter.js` | claude_cli → codex_cli → ollama cascade · provider 自动 fallback | pre-M1 |
| `scripts/cli/pl-build-from-reference.js` | M3 CLI · 调 claude CLI 出 demo HTML to clients/<slug>/v2/concept/reference-adapter/ | M3 |
| `scripts/cli/pl-c-grade-batch-send.js` | M2-D4 · C-grade batch email send · dry-run default | M2 |
| `scripts/cli/pl-bulk-archive.js` | M1-D5 · stale entity bulk archive · createBackup() | M1 |
| `scripts/cli/pl-ensure-v2-structure.js` | M2-D10 · v2/{sales,marketing,outreach,funnel,intake}/ | M2 |
| `scripts/cli/pl-od-invoke-prep.js` | M2-D7 · 从 master.md 自派生 OD 4-flag payload | M2 |
| `scripts/cli/pl-single-enrich.js` | 4 entry · 接受 --name / --business-name · 拒绝 city-only (Bug 3 fix) | pre-M1 (bug-fix) |
| `scripts/cli/pl-scrape-docker.js` | 4 entry · gosom docker + geocode pre-step · `--env-file-if-exists=.env.local` | pre-M1 (bug-fix) |
| `scripts/cli/pl-ingest-image.js` | 4 entry · 从 image OCR 入库 · 用 shared parseArgs | pre-M1 (M1-D4 fix) |
| `scripts/cli/pl-places-search-intake.js` | 4 entry · Places API textSearch | pre-M1 |
| `scripts/v3/refit-docker-reviews.mjs` | Bug 17 · 重抓 reviews via docker | Bug 17 fix |
| `scripts/v3/enrich-photos-for-all.mjs` | Bug 18 · places-enrich + GMB photos download | Bug 18 fix |
| `templates/roofing/families/classic-premium-roftix/reference-site/` | M3 reference HTML + HANDOFF-BOUNDARIES.md + 5 真图 | round 0 |

### NPM scripts · 一键命令

```bash
# M1/M2 validators
npm run v3:validate-m1       # 16/16 unit · 6 deliverable test
npm run v3:validate-m2       # 46/46 unit · 10 deliverable test
npm run v3:e2e               # M1+M2 cross-module E2E · 29 step
npm run v3:e2e-4-entry       # 真跑 4 SOP-1 entry → master.md · 18 step
npm run v3:validate-all      # 三个一起跑

# M3 reference adapter
npm run pl:build-from-reference -- --slug <customer-slug>
# 3 min · ~$0.30 · output: clients/<slug>/v2/concept/reference-adapter/index.html + assets/

# Bug fix scripts (可复用 · 维护用)
node scripts/v3/refit-docker-reviews.mjs --all-stale     # 把 source!=docker AND count<8 全部用 docker 重抓
node scripts/v3/enrich-photos-for-all.mjs --limit 6      # 自动找无 photo_refs 的 entity 跑 places-enrich + 下载 6 张

# 标准 master.md 操作
npm run leads:build-master-md -- --entity-key <key>
npm run leads:run-pipeline -- --entity-key <key>          # audit Stage 1-4 (cheap + visual + reviews)
npm run leads:build-internal-report -- --entity-key <key> # internal HTML + 捕获 issue evidence PNG
```

## 已撤回的方案 · 历史决策

| 撤回 | 原因 | 当前替代 |
|---|---|---|
| 288-variant vision-LLM autoresearch | overengineering · 不需要探这么多组合 | reference HTML adapter (M3 default) |
| 4 templates 让 OD 跨模板组合 | OD 弱在 design decision · 强在 content adapt | 1 reference per niche · OD 只 swap content |
| freeform OD prompt (V2) | 自由参数太多 · 不稳定 | reference-adapter-handoff.js · 全部参数 locked |
| 建素材库 | =我们替 AI 做 design 决定 · 错向 | reference site = library of section instances |

## V3 docs 索引

| 文档 | 内容 |
|---|---|
| [M1-PRD.md](./M1-PRD.md) | M1 PRD · 6 deliverable spec |
| [M2-PRD.md](./M2-PRD.md) | M2 PRD · 10 deliverable spec (含 D9 customer audience + D10 v2 structure) |
| [TEST-AND-EVIDENCE.md](./TEST-AND-EVIDENCE.md) | 16 test contract + hard evidence standard + dry-run results |
| [DECISIONS-LOG.md](./DECISIONS-LOG.md) | 13 决策自决 + multi-LLM 改 |
| [PRE-IMPLEMENT-VERIFICATION.md](./PRE-IMPLEMENT-VERIFICATION.md) | 实装前 8 个 <95% 点核实 |
| [OD-HANDOFF-RESEARCH.md](./OD-HANDOFF-RESEARCH.md) | M3 handoff 研究 · approach C 验证过程 |
| [MASTER-MD-AUDIT-V2-2026-05-13.md](./MASTER-MD-AUDIT-V2-2026-05-13.md) | 19 bug 完整状态 + Matthew 4 问题答案 |
| [CUSTOMER-FOLDER-STRUCTURE.md](./CUSTOMER-FOLDER-STRUCTURE.md) | Pattern A (flat) vs Pattern B (v2/) 结构 |
| [M2-D9-CUSTOMER-AUDIENCE-REPORT.md](./M2-D9-CUSTOMER-AUDIENCE-REPORT.md) | autoresearch loop customer-audience integration |
| [WEBSITE-QUALITY-RND.md](./WEBSITE-QUALITY-RND.md) | website R&D 重排 · 撤回 prescribing framework |
| [WEBSITE-AUTORESEARCH-DESIGN.md](./WEBSITE-AUTORESEARCH-DESIGN.md) | 撤回的 288-variant 方案 (历史档案) |

## 隔离规则

- 新代码 · 新 docs · 新 scripts → `v3-modular` branch (当前 worktree)
- ops/hermes 修复 · 紧急 fix → main branch (`/Users/matthew/Developer/google-map-website/`)
- 跨 branch 同步: 实装稳定 + 真客户 batch 验证 后 PR `v3-modular` → `main`

## 工作目录切换

```bash
cd /Users/matthew/Developer/google-map-website-v3   # v3 worktree
cd /Users/matthew/Developer/google-map-website       # main worktree

git -C /Users/matthew/Developer/google-map-website-v3 branch --show-current   # → v3-modular
```

## 下一步 (待 Matthew 决)

| 选项 | 工作量 | 价值 |
|---|---|---|
| M3 hook · places-enrich + photos auto-trigger 进 audit pipeline | 4h | 新 entity 入库后全自动出 demo |
| Photo classification (vision LLM 标 type + quality) | 4h | reference-adapter swap stock 图为客户**真图** |
| M3 publish · `<slug>-dev.pages.dev` (CF Pages) | 3h | 客户能在线看 demo URL |
| reviews-adapter `_tryDocker/_tryPlaces` 真实现 | 2h | M3 audit pipeline 直接调 cascade |
| Bug 12 + T21 cleanup tech debt | 1h | 收尾 |
| M4 outreach 启动 | TBD | M3 完后 |
