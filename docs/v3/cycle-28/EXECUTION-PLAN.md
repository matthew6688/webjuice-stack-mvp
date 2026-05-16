# Execution Plan · Cycle-28 · 10 Phase × Validation Gate

> 总 18 工作日 (3-4 周 · 单人 full-time) · 每段独立 validation gate · 通过才进下一段

---

## 依赖图

```
Phase 1 ──┬─→ Phase 3 ─→ Phase 5 ─┬─→ Phase 7 ─→ Phase 8 ─→ Phase 9
          │                       │
Phase 2 ──┤                       │
          │   Phase 4 ─→─→─→─→─→  │
          │                       │
          └─→ Phase 6 ─→─→─→─→─→  ┘
                                          
Phase 10 (并行 · 不阻塞)
```

P1 + P2 可以并行 · P3 依赖 P1 · P4 独立 · P5 依赖 P3+P4 · P6 依赖 P1+P2 · P7 依赖 P5+P6 · P8 依赖 P7 · P9 依赖 P8 · P10 独立。

---

## Phase 1 · Foundation · Stage 0.5 Enrichment + filter-config

**目的**: 把硬数据来源 (ABN/WHOIS/Wayback/GBP-full) 接进来 · filter-config 外置阈值

**工作**:
1. `core/enrichment/abn-abr.js` · ABR API client (SearchByName · AbnDetails)
2. `core/enrichment/whois-rdap.js` · RDAP client (rdap.org)
3. `core/enrichment/wayback.js` · archive.org first snapshot probe
4. `core/enrichment/gbp-full-extract.js` · Places Details API 全字段提取 + Docker scraper 增强字段
5. `core/config/filter-config.json` · 外置 (rule weights · thresholds · profile)
6. `core/config/filter-config-loader.js` · 加载 + 兼容 fallback
7. `scripts/cli/pl-enrich-core-facts.js` · CLI · 单 entity 跑全 Stage 0.5
8. 写 handoff/raw/abn-record.json · whois-record.json · wayback-first-snapshot.json · gbp-full.json
9. 升级 handoff/core-facts.json (含 abn · domain_age · first_online)

**Validation Gate**:
- 拿 10 个真实 entities (含 5 个 has-website · 5 个 no-website)
- 跑 `pl:enrich-core-facts --all-active`
- ✓ 10/10 entities · core-facts.json 完整
- ✓ ABN reverse lookup 成功率 ≥ 80% (有的小 biz 没注册 ABN)
- ✓ WHOIS RDAP 成功率 ≥ 90%
- ✓ Wayback 成功率 ≥ 70%
- ✓ filter-config.json 加载 + missing config fallback OK

**预估**: 2 工作日

---

## Phase 2 · Light Audit · Stage 1 Wrapper

**目的**: light-audit.js wrapper · 用 Tinyfish 数据跑 text-detector 子集 · 出 issue_priority_score

**工作**:
1. `core/scoring/light-audit.js` · 调 detailed-audit.js 但只跑 text-detectable rules (18 个)
2. `core/scoring/issue-priority-score.js` · 通用 helper · audit JSON → weighted score
3. `core/leads/route-classifier.js` · 输入 entity + audit → Route A/B/STARTER + verdict
4. 扩展 detailed-audit.js 加 5 个缺的 detector (under Phase 6 · 这里只接 stub)
5. `scripts/cli/pl-light-audit.js` · CLI · 单 entity 跑 Stage 1

**Validation Gate**:
- 拿 10 个真实 entities (Phase 1 同批)
- 跑 `pl:light-audit --all-active`
- ✓ 10/10 entities · issue-priority-score 0-50 范围内
- ✓ routing 准确率 ≥ 80% vs operator 手工评分
- ✓ STARTER 特殊路径正确 (无网站 → STARTER · 网站 dead → STARTER)

**预估**: 2 工作日

---

## Phase 3 · Handoff Directory + Raw Data Sink

**目的**: handoff/ 目录创建 · Stage 0-1 数据沉淀进去 · 不动现有 master.md

**工作**:
1. `core/handoff/dir-setup.js` · 创建 handoff/ + raw/ + design/ + content/ + structure/
2. `core/handoff/raw-writer.js` · Stage 0/0.5/1 写 raw/* 8 个文件的统一入口
3. `core/handoff/logo-url-detector.js` · 从 markdown + Tinyfish 提取 favicon · og:image · header img URL
4. wire 进现有 Stage 0 · 0.5 · 1 (改 4-5 处)

**Validation Gate**:
- 拿 5 个新 entities (跑全 Stage 0-1 链)
- ✓ 5/5 entities · handoff/raw/ 含 8 个 JSON
- ✓ logo-source-urls.json 至少有 favicon 候选 (没找到也写空数组)

**预估**: 2 工作日

---

## Phase 4 · LLM Cascade A Module

**目的**: 实装 4-tier cascade + acceptance criteria + 自动 fallback + trace

**工作**:
1. `core/llm/cascade-a.js` · 4-tier 实现 (Codex → Claude → Qwen27b → Qwen9b)
2. `core/llm/acceptance-criteria.js` · 输出判定 (≥9 段 · ≥800 字 · URL fidelity ≥80%)
3. `core/llm/cascade-trace-ledger.js` · 每次调用 trace 写 ledger
4. `scripts/cli/pl-cascade-test.js` · CLI · mock 输入 · 跑 cascade · 看 fallback 行为
5. `scripts/test/test-cycle28-cascade-a.mjs` · TDD · mock cloud-down · 验证 fallback 链

**Validation Gate**:
- 故意 mock cloud down (设 `ANTHROPIC_API_KEY=invalid`)
- 跑 5 leads · `pl:cascade-test`
- ✓ 5/5 fallback 到 local Qwen 27b · 成功输出
- ✓ trace 完整 (含每 tier 失败原因)
- ✓ acceptance 拒绝率 < 30%

**预估**: 1 工作日

---

## Phase 5 · Stage 3 Content Generation

**目的**: LLM cascade 生成全 handoff/content/* 内容

**工作**:
1. `core/handoff/content/customer-summary-builder.js` · 双语 9 段 (中英 1 call)
2. `core/handoff/content/services-extractor.js` · 从 markdown + GBP types 抽
3. `core/handoff/content/about-narrative-synthesizer.js`
4. `core/handoff/content/faq-generator.js` · niche typical
5. `core/handoff/content/page-map-decider.js` · LLM 决新站结构
6. `core/handoff/content/seo-strategy.js` · 长尾 target
7. `core/handoff/content/reviews/real-extractor.js` · 从 GBP + Tinyfish search 抽
8. `core/handoff/content/reviews/generated-fallback.js` · AI fallback (if real < 3 · 不标 placeholder)
9. `core/handoff/content/reviews/selector.js` · LLM 挑 top 3-5 混合 real + gen
10. `core/handoff/content/photos/ai-analysis.js` · Vision LLM · 每图 placement + issues
11. `core/handoff/content/photos/selector.js` · AI-approved · 按 placement 分子目录
12. `core/handoff/design/logo-skill-dispatcher.js` · 调 existing-logo-brand 或 logo-design skill
13. `core/handoff/design/brand-tokens-extractor.js` · 从 logo 提 primary/accent/font
14. `core/handoff/design/design-style-deriver.js` · LLM 推断 visual style
15. `scripts/cli/pl-stage3.js` · CLI · 单 entity 跑全 Stage 3

**Validation Gate**:
- 拿 5 entities (含 STARTER + REDESIGN)
- 跑 `pl:stage3 --entity-key X`
- ✓ 5/5 entities · handoff/content/* 全部文件齐 (~10 个)
- ✓ 人工抽查 services / faq / page-map · 80%+ 合理
- ✓ photos selected/ 按 placement 分类 (hero/gallery/etc)
- ✓ logo skill 调用成功 (existing 或 generated · 都有输出)
- ✓ reviews/real.json 有 deep-link URL · generated 不标 placeholder

**预估**: 3 工作日

---

## Phase 6 · Audit-Findings Schema + Issue-Fix Matrix

**目的**: detailed-audit.js 30 rules 输出扩展 schema · 加 5 新 detector · issue-fix-matrix.json LLM 生成

**工作**:
1. 扩展 detailed-audit.js · 每条 rule 输出 `{id, severity, what_observed, fix_prescription, fix_target, verification}`
2. 加 5 个新 detector:
   - `no_about_section_html` · rawHtml heading 找
   - `table_layout` · ≥ 5 `<table>` 无 role=presentation
   - `web2_design_markers` · gradient + sidebar + animated gif
   - `inconsistent_fonts` · head font-family ≥ 4
   - `mobile_nav_broken` · viewport mobile 但 nav 无 hamburger
3. `core/handoff/audit-findings-builder.js` · 把 detailed-audit 输出转 audit-findings.json schema
4. `core/handoff/issue-fix-matrix-builder.js` · LLM cascade · audit issue → page+section+verification 映射
5. `scripts/cli/pl-audit-findings.js` · CLI

**Validation Gate**:
- 拿 5 REDESIGN entities · 跑 Stage 2 deep audit + Stage 3 issue-fix-matrix
- ✓ 5/5 entities · audit-findings.json 每条 issue 有 fix_prescription + verification
- ✓ 0 个 `data_missing: true` (除非真没数据)
- ✓ issue-fix-matrix.json · 每条 issue 都映射到 page + section
- ✓ 5 个新 detector 触发率合理 (table_layout 多见于老站)

**预估**: 2 工作日

---

## Phase 7 · Build Wire · final-handoff.md aggregator

**目的**: final-handoff.md 聚合器 · pl-build-from-reference 改用 handoff · backward-compat

**工作**:
1. `core/handoff/final-handoff-aggregator.js` · 引用 handoff/* 全部 · 输出 final-handoff.md
2. 修改 `scripts/cli/pl-build-from-reference.js`:
   - 优先读 `handoff/final-handoff.md`
   - 缺 → fallback `master.md` (backward-compat)
3. 复制 `handoff/content/photos/selected/*` → `clients/<slug>/v2/concept/assets/`
4. 复制 `handoff/design/logo-*.svg` → `clients/<slug>/v2/concept/assets/`

**Validation Gate**:
- 1 个新 entity 全 pipeline (S0 → S4) · build 成功 · 用 final-handoff.md
- 1 个 cycle-27 老 entity 重 build · fallback master.md · 成功
- ✓ 新 build 输出 HTML 含 handoff 关键字段 (ABN · QBCC license · area pages)
- ✓ 老 build 不变 · 通过现有 cycle-26 fidelity 测试

**预估**: 2 工作日

---

## Phase 8 · Verification 闭环

**目的**: build 后跑 verification check · 3-tier escalation 失败处理

**工作**:
1. `scripts/cli/pl-verify-handoff-fixes.js` · 对每条 audit issue 跑 verification check
2. `core/handoff/verification-runner.js` · regex / DOM check / Lighthouse check 等
3. `core/handoff/verification-report-builder.js` · 输出 verification-report.json
4. 3-tier escalation:
   - Tier 1 · auto-retry build 1 次 (prompt 加 failed issues 反馈)
   - Tier 2 · section regen (只重生失败 section · 拼回)
   - Tier 3 · qa-pending (Discord 按钮 4 选 1)
5. 集成 internal-audit-report.html · 加 "Build 后 verification" 段

**Validation Gate**:
- 1 个新 build · 跑 verify
- ✓ ≥ 80% audit issue verified pass
- 故意 break (改 build prompt · 去掉电话) · 跑 verify
- ✓ Tier 1 retry · Tier 2 section regen · Tier 3 qa-pending 路由正确
- ✓ verification-report.json 集成 internal-audit-report.html · 显示完整

**预估**: 2 工作日

---

## Phase 9 · Document Templates 上线

**目的**: master.md / final-handoff.md / internal-audit-report.html 模板按 DOCUMENT-TEMPLATES.md 落地

**工作**:
1. 更新 `core/reports/master-md-builder.js` · 加 cycle-28 模板段 (优先级 badge · 数据完整度表 · 等)
2. 更新 internal-audit-report.html 生成器 · 加 STARTER 模式 + verification 闭环段
3. final-handoff.md 已在 Phase 7 落地
4. 给 master.md 加 `cycle-28-format-version: 1` 字段 · 老 entity 自动升级

**Validation Gate**:
- 跑 5 个 entities (含 STARTER + REDESIGN)
- ✓ 3 个文档生成 · 跟 DOCUMENT-TEMPLATES.md mockup 对齐
- ✓ Live deploy 链接全在 master.md 第 ⑦ 段

**预估**: 1 工作日

---

## Phase 10 · 遗留 Bug Cleanup (并行 · 不阻塞)

**目的**: cycle-27 遗留问题彻底修

**工作**:
1. **Bug G race fundamental fix** · `pl-publish-demo.js` 加 `forceArchiveLoop` (sleep 5s → verify-retry archive)
2. **G7 archived lead card backfill CLI** · 单独 ops · 用 force flag 调用 upsertProfileCard
3. **Cycle-doctor pathId scan** · `archiveLeadAsRejected` call site × `TERMINAL_FAIL_PATHS` 交叉验证 · 防 Bug D 重蹈
4. **Project-side profile card backfill** · upsertProjectProfileCard 加 force 路径 · 配合 backfill CLI
5. **Discord button wire into Stage 7 actual** · live 测 5 个真实场景 (approve · archive · reaudit · upgrade · qa_mark)

**Validation Gate**:
- 跑 1 个新 Round (Places + Docker)
- ✓ goals-doctor 9/9 · 0 G5 dup
- ✓ Round 全 0 bug (含 publish 链)

**预估**: 1 工作日

---

## 总时序

| 周 | Phases (并行) | 关键里程碑 |
|---|---|---|
| Week 1 | P1 + P2 + P4 | Stage 0.5 + light-audit + cascade 落地 |
| Week 2 | P3 + P6 | handoff dir + audit-findings schema |
| Week 3 | P5 | Stage 3 content generation 全套 |
| Week 4 | P7 + P8 + P9 + P10 | Build wire + verification + 文档 + cleanup |

---

## 决策跟踪 · 已锁定

参见 [README.md § 决策记录](./README.md#决策记录-matthew-2026-05-16) · 10 条决策已 ack。

---

## 风险 + 缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| ABR API rate limit | Phase 1 卡 | 缓存 · 同名 biz 不重查 |
| Tinyfish billing actually 非 free | 全 pipeline 涨 cost | Phase 1 同步确认 Tinyfish dashboard |
| Cascade A 全 cloud quota 用完 | Phase 4 fallback 跑不动 (local 慢) | 监控 daily token 用量 · 设警报 |
| 现有 master.md / build 链路 break | 生产 down | 全程 backward-compat · 老 entity 走老路径 |
| Logo skill 调用失败率高 | Phase 5 卡 | 默认 generated · existing 失败 fallback generated |
| Verification 闭环过严 · 大量 qa-pending | Phase 8 实际不 work | 起步 acceptance rate 设低 (50%) · 观察后调高 |

---

## 不在本 cycle 范围 (deferred)

- Filter-config Phase 2 (dry-run replay CLI)
- Filter-config Phase 3 (decision audit trail · profile version)
- A/B split testing (entityKey hash 路由两 profile)
- Tinyfish search LLM noise filter
- 多国扩展 (UK Companies House · NZ NZBN · 等)
- GBP Photo API 启用 (付费 · 默认关 · 接口已留)
- premium-logo skill 触发 (高 invest_tier 客户)
