# M2-D9 · Customer-audience report (via autoresearch loop)

> Matthew 反馈 2026-05-13: master.md 不变 · 但**派生文档要 LLM rewrite 给非技术受众**
> "可以用 autoresearch 业务逻辑去做 · 我们代码有这部分内容"

我研究后发现 · 这能力**已经存在** · 只是 M2 当前没启用 customer audience:

---

## 现成的 autoresearch loop (我们已写)

**核心**: `core/reports/autoresearch-loop.js`
- 多轮 LLM 生成 → critic → hallucination 检测 → 改进
- Max 5 轮 · $2 预算 · 95 分停
- 输入: `auditData + entity + reviews + audience`
- 输出: HTML + 评分 + history

**2 个 audience 已定义** (`core/reports/generator.js`):

| audience | 受众 | 风格规则 |
|---|---|---|
| `internal` | ProfitsLocal 销售操作员 | 信息密集 · 技术精确 · 每个 data 可追溯 |
| `customer` | **本地小商家 owner (roofing/restaurant/dental/etc.)** | **人话 · 5 分钟扫读 · 无 jargon · 不提价格 · 想约 30 分钟 walkthrough** |

**CLI**: `pl:report-optimize --audience customer --entity-key X`

---

## M2-D9 · 加进流水线

### 当前 M2 流水线

```
Stage 4 · build-internal-report.js
   └─ 输出 internal-audit-report.html (1 个 · audience=internal · 操作员看)
```

### V3 M2-D9 加一段

```
Stage 4a (现有) · 生成 internal report (操作员看)
   └─ clients/<slug>/v2/internal-audit-report.html

Stage 4b 🆕 · 用 autoresearch loop 改写 customer 版
   └─ npm run pl:report-optimize -- \
        --entity-key <key> \
        --audience customer \
        --generator-model claude_cli:sonnet \
        --critic-model claude_cli:haiku
   └─ clients/<slug>/v2/customer-facing-audit.html
```

**触发**: A/B grade 必跑 customer 版 (这俩走个性化销售)。C 跳过 (走 batch template)。

**Cost**: 1 lead × autoresearch 5 轮 × ~$0.30/轮 = **~$1.50/lead** · A/B 占比通常 ~20% · 100 lead × 20% = 20 customer reports/月 × $1.50 = **$30/月** · acceptable。

---

## 测试 + 硬证据

### TEST 文件: `scripts/v3/test-m2-d9-customer-audience.mjs`

**6 个 assertion**:

| # | 测试 | 期望 |
|---|---|---|
| 1 | 跑 1 个真 entity (A grade · rich-and-rare-restaurant) `--audience customer` | 输出 HTML 含 5 个 section · 无 "$" 字眼 |
| 2 | 同 entity 跑 `--audience internal` | 输出 HTML 信息密集 · 含数字 (audit_score / fired_triggers) |
| 3 | 两版字符长度比较 | customer 版 < internal 版 (人话更精简) |
| 4 | 复杂度 metric (Flesch reading-ease score) | customer ≥ 60 (容易读) · internal 可低于 60 |
| 5 | hallucination 检测 0 个 | 客户版不能编造数据 |
| 6 | 5 轮收敛 | 最后 score ≥ 85 (allow 不达 95 · plateau ok) |

### EVIDENCE 文件

```
data/qa/m2-d9-customer-audience/
├── rich-and-rare-internal-audit.html       (existing pattern)
├── rich-and-rare-customer-audit.html       (新 · 客户版)
├── comparison.md (含字符长度 / Flesch score / hallucination count)
└── autoresearch-history.json               (5 轮过程 + 评分曲线)
```

### AUDIT checklist

- [ ] customer 版 HTML 不含 "$" 或价格
- [ ] customer 版 HTML 不含技术 jargon (gtm.js / pixel / sitemap / etc.)
- [ ] customer 版 Flesch score ≥ 60 (Grade 7-8 阅读级别)
- [ ] hallucination 检测 = 0
- [ ] autoresearch 收敛 (score 单调升 OR plateau · 不应该震荡)
- [ ] 操作员人审 1 份 (我读完客户版能 5 分钟内懂)

### VERDICT 命令

`npm run v3:test-m2-d9` → 退码 0 = PASS

---

## 为什么这是 M2 不是 M3

| 阶段 | 产物 | 谁看 |
|---|---|---|
| M2 出口 | customer-facing-audit.html | **客户**第一次看 (preview website 嵌入) |
| M3 | preview website + banner | 客户在网站上看到这报告 |

→ customer audit 报告**是 M3 销售 banner 的 content** · 必须 M2 出。否则 M3 没东西塞 banner。

## 修改的 M2 总验收

加 `npm run v3:test-m2-d9` 到 `npm run v3:validate-m2` 序列里。

M2 deliverable 从 8 个 → **9 个**:
- D1-D8 (原)
- **D9 🆕 customer-audience report via autoresearch**

工时: D9 ~3h (CLI 已存在 · 主要写 test + integrate Stage 4b 进 pipeline)

---

## 信心指数更新

| | Before | After 找到 autoresearch 现成代码 |
|---|---|---|
| M2-D9 (新) | 不存在 | **90%** · 已有 loop · 已有 customer prompt · 加 integrate |

整 M2 平均: 85% → **86%** (D9 高信心拉高均值)。
