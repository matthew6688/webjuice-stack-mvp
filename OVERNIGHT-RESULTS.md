# OVERNIGHT RESULTS · 2026-05-28 → 2026-05-29

> Plan: `OVERNIGHT-PLAN.md` · Codex consensus: R45 + R46

---

## 总结

打通了"造完孤立"问题的核心：建立了 `site-ctx.json` 中间契约，让 master.md 的数据真正流入 composer。

---

## Block A · pl:extract-site-ctx ✅ DONE

**新文件**: `scripts/cli/pl-extract-site-ctx.js`
**新命令**: `npm run pl:extract-site-ctx -- --slug <slug> [--force] [--write-content]`

- 零 LLM · 纯 deterministic parse
- 读 master.md YAML frontmatter + core-extract.json → 写 site-ctx.json
- 包含: business facts · services · suburbs · reviews · trust signals · brand · narrative drafts
- `--write-content` 同时写 `reviews.json` + `coverage.json` 到 handoff content 目录

**3 客户结果**:
| 客户 | reviews | suburbs (verified) | services |
|---|---|---|---|
| vicwest-roofing | 5 real | 38 verified | 6 |
| a-j-roofing-solutions | 0 (no GBP reviews) | 3 verified | 5 |
| mark-squire-roof-restorations | 0 (no review text) | 18 verified | 6 |

---

## Block B · Content Files (reviews.json + coverage.json) ✅ DONE

`--write-content` 标志写出 2 个新内容文件:
- `handoff/od-package/content/reviews.json` — 真实 Google 评论，composer 可直接读
- `handoff/od-package/content/coverage.json` — 郊区列表，含来源标记

vicwest 获得 5 个真实评论。a-j / mark-squire 没有评论文字，跳过（composer 继续用 formula）。

---

## Block C · Composer 接入 reviews.json + coverage.json ✅ DONE

**修改文件**: `scripts/cli/pl-compose-editorial.js`

新增 2 个 reader 函数:
- `readPreparedReviews(odContentDir)` — 读 reviews.json
- `readPreparedCoverage(odContentDir)` — 读 coverage.json

**优先级链**:
- reviews: `reviews.json`(≥3 items → REAL, no placeholder) → real_facts.testimonials → formula
- coverage: `coverage.json`(≥3 suburbs) → mergeSuburbs formula

**ctx-snapshot.json 更新**: 新增 `reviews` 和 `coverage` source 跟踪

---

## Block D · 3 客户全量验证 ✅ DONE

| 客户 | R44 基线 | R46 结果 | 变化 | 评论状态 |
|---|---|---|---|---|
| vicwest-roofing | 91 · A · SHIP | **91 · A · SHIP** | 持平 | REAL (4) ← 之前 PLACEHOLDER |
| a-j-roofing-solutions | 83 · B · SHIP | **89 · A · SHIP** | **+6pt** | PLACEHOLDER (0 reviews) |
| mark-squire-roof-restorations | 93 · A · SHIP | **93 · A · SHIP** | 持平 | PLACEHOLDER (0 review text) |

**a-j 涨 6pt** — 原因: coverage.json 现在有 4 个真实郊区，之前 formula 不知道

---

## Block E · 文档 ✅ DONE

- `docs/v3/CANONICAL.md` → v1.6 · 新增 site-ctx.json + composer content priority chain 锁定行
- `docs/v3/INFRASTRUCTURE-INVENTORY.md` → 新增 pl:extract-site-ctx 条目 + 更新 composer 读取列表 + 新增 reviews.json / coverage.json writer 列
- `OVERNIGHT-PLAN.md` → 计划文件（本 session 写的）
- `OVERNIGHT-RESULTS.md` → 本文件

---

## 未完成（留给下次）

1. **`pl:llm-single-page-copy` 完整 LLM 版** — 用 site-ctx.json + pl-local-trade-page-spec + pl-au-trade-voice → 生成全部 11 个 section 的 copy 文件。本次做了 deterministic 部分，LLM prose generation 留下次。
2. **`master.md` 内容就位度 section 更新** — 显示 reviews.json / coverage.json 状态。
3. **Task #66** — vicwest live deploy + outreach + Stripe。

---

## 新的完整流水线命令

```bash
# 完整建站流程（R46 后）
SLUG=vicwest-roofing

npm run pl:extract-site-ctx-full -- --slug $SLUG   # master.md → site-ctx.json + reviews/coverage
npm run pl:compose-editorial -- --slug $SLUG       # compose → index.html
npm run pl:audit-v4 -- --slug $SLUG \
  --output-dir clients/$SLUG/v2/editorial-output --tier fast

# 如果需要 LLM 重新生成 copy（hero/services/about/faq）
npm run pl:enrich-handoff -- --slug $SLUG
```

*written 2026-05-28 overnight*
