# LLM 路由决策（P2.1 + P2.3 评测结果）

测试日期：2026-05-11
测试 entity：FIX MY ROOF Total Roof Restorations (`place_chijn587yc79k2sr7vyvy-egoam`)
原始数据：
- [Heartbeat eval](./p2.1-heartbeat-eval-fix-my-roof.md)
- [Email body eval](./p2.3-emailbody-eval-fix-my-roof.md)

---

## P2.1 Heartbeat eval — 找最便宜+正确的本地模型

任务：读 entity context → 决定 next_action（idle/draft_email/send_followup/advance/archive/flag_needs_human）

| Model | Tier | 延迟 | 决策 | 成本/次 | 推荐 |
|---|---|---|---|---|---|
| **qwen3.5:9b** | T0 | 12s | ✓ flag_needs_human | $0 | ⭐ **生产 heartbeat 默认** |
| qwen3.6:27b | T0 | **211s** | ✓ flag_needs_human | $0 | ❌ 太慢，cron 不可用 |
| gemma3:27b | T0 | 54s | ✗ draft_email | $0 | ❌ 决策错（识别不出 needs-human 应停）|
| deepseek-r1:14b | T0 | 18s | ✗ send_followup | $0 | ❌ 决策错 |
| haiku | T1 | 6s | ✓ flag_needs_human | $0.012 订阅 | 备用（紧急时升级）|
| sonnet | T1 | 6s | ✓ flag_needs_human | $0.057 订阅 | 不必要（haiku 已够）|

**Heartbeat 路由策略**：

```js
T0 (default) = qwen3.5:9b
T1 (fallback) = claude_cli haiku   (when ollama returns invalid JSON twice)
```

**每月成本估算**（每 4h heartbeat × 50 active A leads = 300 calls/day = 9000/月）：
- 9000 × $0 (qwen3.5:9b) = **$0/月**
- 假设 5% fallback = 450 calls × $0.012 = **$5.4/月 订阅扣**（接近 0）

## P2.3 Email body eval — 找客户面向的可用质量

任务：读 entity + audit + variant → 生成个性化 cold email subject + body

| Model | Tier | 延迟 | 质量评估 | 成本/次 | 推荐 |
|---|---|---|---|---|---|
| qwen3.5:9b | T0 | 17s | ⚠ 编造细节（WhatsApp 按钮 / Chermside 等假数据）| $0 | 不能客户面向用 |
| deepseek-r1:14b | T0 | 10s | ⚠ 通用模板（"Hi [Name]" 都没填）| $0 | 不能客户面向用 |
| **haiku** | T1 | 21s | ✓ 引用真实 127 reviews + 真实服务类型 + 具体改动 + 明确 ROI 数字 | $0.048 订阅 | ⭐ **B/C grade 默认** |
| **sonnet** | T1 | 24s | ✓✓ 引用真实电话/URL/HTTP-only/review 主题；最具体最准确 | $0.256 订阅 | ⭐ **A grade 默认** |

**关键发现**：本地模型在客户面向的 cold outreach 上**编造数据**风险高，会写出客户网站上根本没有的东西，损害可信度。

**Email body 路由策略**：

```js
A grade lead     → sonnet  ($0.26 × 50/月 = $13 订阅扣)
B/C grade lead   → haiku   ($0.05 × 100/月 = $5 订阅扣)
本地兜底         → qwen3.5:9b（仅当 CLI 不可用时使用，含警告："body 可能不准确，审稿后再发"）
```

**每月成本估算**（50 A + 100 B/C × 1 first-send/月）：
- A: 50 × $0.26 = $13 订阅
- B/C: 100 × $0.05 = $5 订阅
- 合计：**$18/月 订阅扣**（实际 $0 — 在订阅额度内）

---

## 路由总规则（更新 D15）

| 任务类别 | Tier 默认 | 模型 | 理由 |
|---|---|---|---|
| Cron jobs（heartbeat, daily-tick, reply-poll）| T0 | qwen3.5:9b | 高频，决策准确，零成本 |
| Reply classifier (unclear fallback) | T0 | qwen3.5:9b | 已实施 |
| Variant hypothesis 生成 | T0 | qwen3.5:9b | 内部用 |
| Cold email body (A grade) | T3 | sonnet (via claude_cli) | 客户面向，质量第一 |
| Cold email body (B/C grade) | T1 | haiku | 客户面向，性价比 |
| Audit narration / master.md | T0 | qwen3.5:9b | 内部用 |
| Proposal page 文案 | T3 | sonnet | 客户面向 + 合同前关键 |

**总成本预估**（50 lead/月 + 100 send + 30 reply + 9000 heartbeat）：
- T0 操作：**$0 实际**
- T1 操作：$18 订阅扣（额度内）
- T3 操作：$13 订阅扣（额度内）
- **实际花费：$0/月**

---

## 实施清单

- [x] qwen3.5:9b 已是 text-adapter T0 默认（[text-adapter.js:OLLAMA_TEXT_MODEL](../../core/llm/text-adapter.js)）
- [ ] **改 pl:email-draft / pl:email-send 默认走 T1 haiku for body generation**（grade=A 自动升 sonnet）
- [ ] 写 `core/outreach/email-body-generator.js` — 替代当前静态模板替换
- [ ] 改 P2.1 heartbeat skill prompt 用 T0
- [ ] Hermes skill 清理（见 [p2.2-hermes-skill-audit.md](./p2.2-hermes-skill-audit.md)）

每月成本 monitoring：[pl:kpi](../../scripts/cli/pl-kpi.js) 加 LLM cost summary 字段（finance_today 已部分覆盖）。
