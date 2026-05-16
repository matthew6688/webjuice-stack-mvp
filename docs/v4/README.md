# V4 · Pipeline Redesign · 将来计划

> **状态**: 计划阶段 · 暂不执行 · Matthew 2026-05-16
> **重命名说明**: 从 `cycle-28/` → `v4/` · 这是 V4 整体重设计 · 不在 V3 周期内
> **目的**: 把现有 lead 筛选+审计+建站 pipeline 重构为 **handoff-driven** 架构 · 数据从 Stage 0 开始累积进 `handoff/` 目录 · LLM 只在 build decision 时跑 · 节省 80% LLM 成本

> **当前 V3 立刻要做的工作**: 见 [`docs/v3/HANDOFF-STRUCTURE.md`](../v3/HANDOFF-STRUCTURE.md) (handoff 文档结构 · 已在推进)

---

## 文档导航

| 文档 | 内容 |
|---|---|
| [README.md](./README.md) (本文) | 执行摘要 + 18 天计划 + 决策记录 |
| [PIPELINE-ARCHITECTURE.md](./PIPELINE-ARCHITECTURE.md) | Stage 0-5 详细 · routing 规则 · `handoff/` 目录 schema |
| [DOCUMENT-TEMPLATES.md](./DOCUMENT-TEMPLATES.md) | master.md + final-handoff.md + internal-audit.html 三个最终文档结构 |
| [LLM-CASCADE-A.md](./LLM-CASCADE-A.md) | 4-tier cascade (Codex → Claude → Qwen27b → Qwen9b) + acceptance criteria + bench 数据 |
| [EXECUTION-PLAN.md](./EXECUTION-PLAN.md) | 10 个 phase · 每段 validation gate · 依赖链 |

**Live mockup**: https://customer-summaries.pages.dev/mockups/ (3 个文档实际渲染样例)

---

## 1 分钟概述

当前 pipeline 问题:
- LLM 在 Stage 1 就跑 · 1000 leads 烧 $50 · 但 90% 后续被 archive · 浪费 $45
- master.md 是销售向 + build 向 + audit 向**三用一文件** · 难维护
- 没有 logo / photos / reviews 系统化收集 · OD build 用 demo 占位
- review_count 单维度筛选 · 误杀新 biz · 不分 STARTER vs REDESIGN
- audit findings 跟 build 没闭环 · 找出的问题没保证修

新设计:
- **5 个 Stage · LLM 推迟到 Stage 3** (build decision 前才跑)
- **`handoff/` 目录** 渐进式累积 · 每个 Stage 加文件
- **Route A/B 分流** · STARTER (无网站) vs REDESIGN (有网站)
- **Cascade A** · cloud-first (Codex/Claude 订阅 · marginal $0) · local fallback (Qwen 27b/9b)
- **3 个最终文档** 分工: master.md (sales) · final-handoff.md (build) · internal-audit.html (sales 话术)
- **Verification 闭环** · build 后跑 verification check 每条 audit issue · 3-tier escalation

成本对比 (1000 leads):
| | 现状 | 新设计 |
|---|---|---|
| Stage 1 LLM | $50 (跑每 lead) | $0 (纯 Tinyfish · 90% archive 不烧) |
| Stage 2-3 LLM | ~$80 (vision + brief 全跑) | ~$50 (vision + customer-summary 只 30% 跑) |
| Stage 4 build | ~$150 (per lead) | ~$50 (只 build worth 的) |
| **总** | **~$280** | **~$100** (省 64%) |

---

## 决策记录 · Matthew 2026-05-16

| # | 决策 | 选项 |
|---|---|---|
| 1 | Stage 0.5 加 GBP 字段全提取 + ABN/WHOIS/Wayback | ✅ 同意 |
| 2 | Cascade A 顺序: Codex → Claude → Qwen27b → Qwen9b (cloud first · 订阅 marginal $0) | ✅ 同意 |
| 3 | Generated reviews 不标 placeholder (内部用) | ✅ 同意 |
| 4 | GBP Photo API 默认关 (付费) · 接口留 | ✅ 同意 |
| 5 | LLM 跑时机 · Stage 1 不跑 · 推迟到 Stage 3 build decision 前 | ✅ 同意 |
| 6 | master.md 保留 · 销售向累积 · 不被 handoff 取代 | ✅ 同意 |
| 7 | 6 大类 audit issue 体系 · 复用现有 detailed-audit.js 30 rules · 加 5 个缺的 | ✅ 同意 |
| 8 | Stage 1 score 阈值 30/15/5/0 (deep_audit / qa-pending / minor / archive) · 可配置 | ✅ 同意 |
| 9 | Verification 失败 · 3-tier escalation (auto-retry / section regen / qa-pending) | ✅ 同意 |
| 10 | AU-only 锁定 (ABN 是 AU-specific) | ✅ 同意 |

---

## 18 天执行计划 · 10 Phase · 每段独立 validation gate

```
Phase 1 (2天) · Foundation
  Stage 0.5 enrichment · GBP 全字段 + ABN/WHOIS/Wayback + filter-config.json
  ✓ Gate: 10 entities · core-facts.json 完整 · ABN/WHOIS 成功率 ≥ 80%

Phase 2 (2天) · Light Audit
  light-audit.js wrapper · issuePriorityScore() · 路由 (deep_audit / qa-pending / archive)
  ✓ Gate: 同 10 entities · routing 准确率 ≥ 80% vs operator 人工评分

Phase 3 (2天) · Handoff Directory
  handoff/ 目录创建 · Stage 0-1 raw 数据沉淀 · logo URL 探测
  ✓ Gate: 5 entities · raw/* 8 个文件齐 · 无遗漏

Phase 4 (1天) · LLM Cascade A
  4-tier cascade module · acceptance criteria · 自动 fallback + trace
  ✓ Gate: mock cloud down · 自动 fallback 到 local · 5 leads 全成功

Phase 5 (3天) · Content Generation
  Stage 3 LLM 生成 services / about / faq / page-map / reviews / photos AI / logo skill 调用
  ✓ Gate: 5 entities · handoff/content/* 完整 · 人工抽查 services/faq 合理

Phase 6 (2天) · Audit Findings + Fix Matrix
  detailed-audit.js 加 5 detector · audit-findings.json schema · issue-fix-matrix.json LLM 生成
  ✓ Gate: 5 entities · 每条 issue 有 fix_prescription + verification · 无 data_missing

Phase 7 (2天) · Build Wire
  final-handoff.md aggregator · pl-build-from-reference 改用 handoff · backward-compat fallback master.md
  ✓ Gate: 1 new entity 全 pipeline 成功 · 1 old entity master.md fallback 成功

Phase 8 (2天) · Verification 闭环
  pl:verify-handoff-fixes · 3-tier escalation · verification-report.json 集成 audit HTML
  ✓ Gate: 1 build 后 verify · ≥ 80% issue pass · break 后 qa-pending 正确路由

Phase 9 (1天) · Document Templates
  master.md / final-handoff.md / internal-audit.html 模板上线 (按 DOCUMENT-TEMPLATES.md)
  ✓ Gate: 跟 mockup 渲染对齐

Phase 10 (1天) · Cleanup
  Bug G race fundamental · Cycle-doctor pathId scan · Project card backfill · Discord buttons
  ✓ Gate: goals-doctor 9/9 · 0 G5 dup · Round 0-bug
```

**总 18 工作日 (3-4 周 · 单人 full-time)**

---

## 不在 V4 范围内 (deferred)

- Filter-config Phase 2 · dry-run replay CLI (改完看影响)
- Filter-config Phase 3 · audit trail (decision profile version)
- A/B split testing (entityKey hash · 50/50 路由 · 跑 2 个 profile)
- Tinyfish search LLM noise filter (非澳洲结果过滤)
- 多国扩展 (UK · NZ · 等 ASIC 等价 API)

这些等 V4 上线运行 1-2 周后 · 看 metrics 再做。

---

## 文档版本

- v1 · 2026-05-16 · Matthew + Claude · 初版完整
