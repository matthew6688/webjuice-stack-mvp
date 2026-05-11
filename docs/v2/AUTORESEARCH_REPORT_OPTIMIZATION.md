# Autoresearch — Audit Report 自我优化框架

更新日期：2026-05-12
关联：
- [AUDIT_REPORT_SCHEMA.md](AUDIT_REPORT_SCHEMA.md) — 数据源 schema（不变量）
- 灵感：[karpathy/autoresearch](https://github.com/karpathy/autoresearch)

> 用 LLM-driven 自我优化循环（generate → critic → improve）持续提升两份 HTML 报告质量：**internal audit**（给我们看）+ **customer-facing**（给客户看）。最终比较 claude_cli vs local Ollama 是否可胜任。

---

## 1. 为什么需要 autoresearch 而不是直接写 prompt

直接写一个 system prompt → LLM 生成报告 → 完。**问题**：

- 写得好不好**完全主观**，没有 measurable rubric
- 不同 lead 数据形态不同（高 review vs 低 review，有 audit 信号 vs 缺失），单 prompt 处理不好长尾
- 改 prompt 时没有 baseline 对比，凭感觉

autoresearch loop 的本质：**把"主观好不好"变成"可测分数"**，然后让 LLM 自己改自己直到分数停涨。

```
Round N:
  1. Generator   audit_data + previous_critique → HTML report draft
  2. Critic      HTML draft → 10-criteria scorecard + 改进建议
  3. Stop 条件   分数连续 2 轮 < 5% 提升 OR 满分 / 触达预算
Round N+1:
  4. Generator 接 critique 改写
  Loop until stop.
```

## 2. 两份报告的 audience + 目的

### Internal Audit Report
- **谁看**：你 + AI agent + 销售时引用
- **目的**：决策辅助（要不要做这个 lead / 怎么定 grade / 哪 3 个 issue 是杀手 talking point）
- **风格**：信息密集、技术准确、可链接 fixture
- **失败模式**：缺信息 / 不能决策 / 数据不一致

### Customer-Facing Report
- **谁看**：客户老板（roofing/restaurant business owner）
- **目的**：让客户**主动想找你聊**（不是直接卖单，是 trigger conversation）
- **风格**：客户语言、视觉吸引、痛点共鸣、proof-based
- **失败模式**：太技术 / 太凶 / 太长 / 太 generic

**核心差异**：同一份 audit data，**internal 是 dashboard，customer 是 narrative**。

## 3. Rubric — Internal Audit Report（10 标准 × 10 分 = 100）

| # | 标准 | 满分 | 评估方法 |
|---|---|---|---|
| 1 | **6 维评分全部展示**（gbp/technical/ux/content/seo/visual）| 10 | 必须 6 个都呈现，可视化（radar 或 bar），数字精确 |
| 2 | **三级 issue 完整**（critical/major/minor）| 10 | 三级都列出，每条有 id + plain_language + customer_impact |
| 3 | **grade 决策可追溯**（A/B/C/D 怎么定的）| 10 | 报告底部显示 investment_reason + product_tier_reason，哪些信号导出 |
| 4 | **数据透明**（工程可查证）| 10 | 每个 issue 含 rationale 链接到 fixture，可链 raw audit JSON |
| 5 | **生意维度信号**（tech_stack / activity / domain_history / pagespeed）| 10 | 都呈现关键信号，非堆砌 |
| 6 | **优先级可扫**（顶部 3 大问题先看）| 10 | top-3 critical 视觉突出 + 一句话总结 |
| 7 | **review 分析整合**（trust strength / quotable / hooks）| 10 | reviews fixture 信号入报告 |
| 8 | **链接可 actionable**（master.md / screenshots / Discord thread）| 10 | 至少 3 个 deep link |
| 9 | **报告紧凑**（< 200KB HTML，5 min 扫完）| 10 | 文件大小 + 字数评估 |
| 10 | **数据不一致 0 处**（fixture vs HTML 一致性）| 10 | spot check 5 个数字一致 |

**Pass threshold**: ≥ 80/100 才算"可发布"。
**Self-improve trigger**: 任一 criterion < 6 → 必须改。

## 4. Rubric — Customer-Facing Report（10 标准 × 10 分 = 100）

| # | 标准 | 满分 | 评估方法 |
|---|---|---|---|
| 1 | **痛点共鸣**（用客户语言不用工程黑话）| 10 | 不含 "LCP/CWV/JSON-LD"，含 "页面加载慢 / 谷歌排不上"。每条 issue 含 customer_impact 改写版 |
| 2 | **业务相关**（引用客户名/niche/城市/评论数）| 10 | 顶部 hero 含 business name + city + 真实指标（review N / rating ★） |
| 3 | **结果导向**（每个 issue → "这让你每月失去 X 客户"）| 10 | 至少 3 个 issue 含 quantified lost-customer 估算 |
| 4 | **视觉吸引**（截图 + before/after 示意）| 10 | 含 desktop.png + mobile.png + 至少 2 个 evidence 截图 |
| 5 | **proof points**（引用客户自己 reviews 的 positive theme）| 10 | review.analysis.quotable_for_redesign 用上至少 2 段 |
| 6 | **CTA 单一明确**（一个 next step，不是多选）| 10 | 单一 button "Get 30-min walkthrough"，不是多选 |
| 7 | **5-min 扫描友好**（顶部 hero → 3 大问题 → 1 个 CTA）| 10 | 结构清晰 / 关键数字大字号 / 段落短 |
| 8 | **不吓唬**（不全部红色警告 / 不"你网站垃圾"）| 10 | 至少 1 个正面观察（如 reviews 强、域名老） |
| 9 | **隐含价值锚定**（不报价，但暗示价值大于 $X）| 10 | 不出现 "$399"，但出现 "每月可能多 N 客户" 或 "5x ROI" 语境 |
| 10 | **brand 一致**（profitslocal 设计语言：暖米色 + 锐边 + Georgia 字体）| 10 | 视觉与 admin V2 / 营销页一致 |

**Pass threshold**: ≥ 75/100（客户面向比 internal 难，标准放宽 5）。

## 5. Generator Prompt（核心模板）

### Internal 模板

```
你是 V2 audit 报告生成器。输入 audit_data（detailed_audit fixture）。输出**一份 HTML 报告**。

要求（每条都必须达到）：
1. 6 维评分用 SVG radar 或 bar chart 可视化
2. 三级 issue 完整 (critical/major/minor)，每条三段叙述 (fact/plain/impact)
3. 顶部 dashboard：audit_score + decision + grade + top-3 critical
4. 生意决策维度区：tech_stack / activity / domain_history / pagespeed
5. review 分析 sub-section
6. 链接：master.md / screenshots / Discord thread / fixture path
7. 不要 < div > 嵌套深度 > 4
8. 内联 CSS（自包含 HTML）
9. 使用品牌 token：--pl-cream / --pl-ink / --pl-coral / etc.
10. < 200KB

输出格式：纯 HTML（不要 markdown 包），含 <!DOCTYPE>。

[此处插入 audit_data JSON + reviews JSON + entity JSON]
```

### Customer 模板

```
你是销售面向 audit 报告生成器。输入同样的 audit_data。
**重写**给客户老板看 — 不是技术人员。

要求：
1. Hero 顶部：商家名 + city + 客观信号（"127 个 5 星评价 — 强口碑底子"）
2. 3 个 issue 用客户语言（"页面加载慢" 不是 "LCP 3.2s"）
3. 每个 issue 后跟 "这让你每月失去约 X 客户"（基于 review_count / niche / industry avg）
4. 含 1 个正面观察（reviews 强 / 域名 N 年 / etc.）
5. 引用 review.analysis.quotable_for_redesign 至少 2 段（客户原话 → "we鲲应该把这放进首页"）
6. Before/after 概念示意（不用真做，用 svg/css 示意）
7. 单一 CTA：「Book a 30-min walkthrough」
8. 不要出现：LCP / CWV / JSON-LD / schema / DOM / API / endpoint
9. 不报价（不写 $399）
10. brand 一致：--pl-cream 背景 + Georgia 标题 + 暖色 chip

输出：纯 HTML self-contained。

[audit_data + reviews + entity JSON]
```

## 6. Critic Prompt（评分 + 改进建议）

```
你是质量评审。读这份 HTML 报告，按 rubric 打分。

[insert rubric JSON]
[insert generated HTML]

输出 JSON ONLY:
{
  "total_score": 0-100,
  "criteria": [
    { "name": "...", "score": 0-10, "evidence": "...", "improvement": "如果 < 满分，给出具体修改建议" }
  ],
  "top_3_improvements": ["...", "...", "..."],
  "pass": true|false,
  "notes": "..."
}
```

## 7. Loop 控制

```python
# pseudo-code
def autoresearch_loop(audit_data, audience, model, max_rounds=5, budget_usd=2.00):
    history = []
    prev_score = 0
    
    for round in range(max_rounds):
        # Generate
        prompt = build_generator_prompt(audit_data, audience, history)
        html = llm_call(model, prompt, format='html')
        
        # Critic
        critique = llm_call(model, build_critic_prompt(html, rubric), format='json')
        score = critique['total_score']
        
        history.append({'round': round, 'html': html, 'critique': critique, 'score': score})
        save_round(round, html, critique)
        
        # Stop conditions
        if score >= 95:
            return history[-1]  # Excellent enough
        if round > 0 and score - prev_score < 3:
            return history[-1]  # Plateau
        if total_cost_usd >= budget_usd:
            return history[-1]  # Budget exhausted
        
        prev_score = score
    
    return history[-1]
```

**Stop 条件**：
- 分数 ≥ 95 (excellent)
- 连续 2 轮 < 3 分提升 (plateau)
- 总成本 ≥ $2 (budget cap，customer report 上 $0.50)
- max 5 rounds

## 8. 模型对比矩阵

跑同一个 entity（FIX MY ROOF 是 baseline，audit 完整 + 评论丰富）：

| Run | Model | Audience | 期望 |
|---|---|---|---|
| R1 | claude_cli sonnet | internal | T3 quality baseline |
| R2 | claude_cli sonnet | customer | T3 customer-facing |
| R3 | claude_cli haiku | internal | T1 是否够用 |
| R4 | claude_cli haiku | customer | T1 customer 是否够 |
| R5 | ollama qwen3.6:27b | internal | T0 (heavyweight local) |
| R6 | ollama qwen3.6:27b | customer | T0 customer 风险点 (hallucination) |
| R7 | ollama qwen3.5:9b | internal | T0 (light) |
| R8 | ollama qwen3.5:9b | customer | T0 light 客户面向是否危险 |

测度量：
- **rubric_score** (主指标)
- **rounds_to_converge**
- **total_latency_ms**
- **total_tokens** (in/out)
- **total_cost_usd** (claude_cli 是 subscription 但记 theoretical)
- **hallucination_count** (出现 audit_data 没有的具体数字 / 客户细节)

## 9. Hallucination 检测器

特别针对 customer-facing report — local 模型容易编 "WhatsApp 按钮 / Chermside 街道" 等不存在的细节。

检测：
1. 从生成 HTML 提取所有具体数字、地名、产品名
2. 反查是否在 audit_data / reviews / entity.latest 出现
3. 没出现 = hallucination 计 +1
4. 报告中 rubric "数据可信" 自动扣分

实现：`core/reports/hallucination-detector.js`

## 10. 实施路径

### Phase A — 框架代码（~4h）

```
core/reports/
  ├── rubric-internal.js          rubric 数据结构
  ├── rubric-customer.js
  ├── generator.js                 调 LLM 生成 HTML（带 history）
  ├── critic.js                    LLM 评分 + 建议
  ├── hallucination-detector.js    数字/地名反查
  ├── autoresearch-loop.js         主循环
  └── render-baseline.js           参考：当前 build-internal-report.js 输出作为 round-0 baseline
```

### Phase B — CLI 入口（30min）

```
scripts/cli/pl-report-optimize.js
  --entity-key <key>
  --audience internal|customer
  --model claude_cli:sonnet|claude_cli:haiku|ollama:qwen3.6:27b|ollama:qwen3.5:9b
  --rounds <N>
  --budget-usd <X>
  --output data/v2/reports-optimization/<key>/<model>/<audience>/
```

### Phase C — 跑 8-run 矩阵（~2h，多数时间在等 LLM）

跑 FIX MY ROOF × 8 combos，每次保存 round-by-round HTML + critic JSON。

### Phase D — 对比 doc（30min）

`data/qa/report-optimization-eval.md`：
- 每个 run 的 final rubric_score
- rounds_to_converge
- 成本对比
- hallucination count
- 视觉对比（4 个 HTML 截图）
- 结论：哪个模型 + tier 是 cost/quality 最优

### Phase E — 替换 build-internal-report.js（如果验证后值得）

把当前静态模板渲染替换为 autoresearch 生成的最优配置。

## 11. 数据存储

```
data/v2/reports-optimization/
  <entityKey>/
    <model-id>/
      <audience>/
        round-1/
          draft.html
          critic.json
        round-2/...
        final/
          report.html
          eval.json     ← 含全程 metrics + history
```

老报告：`clients/<slug>/v2/internal-audit-report.html` 是当前静态版本，作为 **round-0 baseline** 输入 critic（评分这个版本）。

## 12. 决策记录

| ID | 决策 | 日期 |
|---|---|---|
| **D-RPT-1** | 用 autoresearch 而不是单 prompt 迭代报告生成 | 5/12 |
| **D-RPT-2** | 同一份 audit_data 生成 2 份报告（internal + customer），不复用 prompt | 5/12 |
| **D-RPT-3** | Internal pass = 80/100，Customer pass = 75/100（客户面向更难）| 5/12 |
| **D-RPT-4** | Customer 报告**绝不能出现** $399 价格（暗示价值不报价） | 5/12 |
| **D-RPT-5** | Hallucination 检测器是 customer rubric 硬限——任何编造数字直接 fail | 5/12 |
| **D-RPT-6** | 先验证 claude_cli 跑通 + 出 baseline → 再跑 ollama 对比 | 5/12 |

## 13. 成功 = 什么

跑完 Phase A-D，回答 3 个问题：

1. **Autoresearch 能稳定让分数提升？** Round 1 → final 至少 +15 分（如果不是，rubric 设计有问题）
2. **Claude CLI sonnet 几轮收敛？** 期望 2-3 round 到 85-95
3. **Local LLM (qwen3.6:27b) 能否胜任 internal report？**（如果能，省 token 钱）
   - **不期望 local 能胜任 customer report**（hallucination 风险太高）

如果 local 在 internal 上 ≥ sonnet 90% 分数 + 0 hallucination → 切换 internal 报告生成走本地。
Customer 报告 → 锁定 sonnet 不动。

## 14. 不做的事（明确）

- ❌ 不为单个客户跑 LLM 生成（每次 grade=A 落地都跑会烧钱）—— 只在 audit pipeline 末端跑一次定稿
- ❌ 不让 LLM 改 audit data（只改呈现，data 是上游不可变 source of truth）
- ❌ 不接 OpenAI / Anthropic 第三方 API（保持 claude_cli 订阅路径 + ollama 本地）
- ❌ 不存原始 LLM rationale 到 git（太大）—— 保存最终 HTML + critic JSON
