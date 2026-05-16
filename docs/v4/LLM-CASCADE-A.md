# LLM Cascade A · Cycle-28

> 4-tier cascade · cloud-first (订阅 marginal $0) · local fallback (Qwen 27b/9b)

---

## 设计原则

1. **付费订阅优先** — Codex/Claude 都是 subscription · per-call marginal cost = $0 · 用最稳的
2. **质量 > 速度 > 成本** — 错的报告比慢的报告贵
3. **自动 fallback** — 任何 Tier 失败 (超时 / quota / 输出不达标) · 自动降级下一层
4. **Acceptance criteria 把关** — 输出必须过门槛才算成功
5. **完整 trace** — 每次调用记录走了哪 tier · 失败原因 · 用于优化

---

## 4-Tier Cascade

```
Tier 1 (default · 生产主力):
  Codex CLI (gpt-5 default)
  · cloud · subscription · marginal $0 (实际 cost ~$0.05 if rate-limit billing)
  · 56s · 100% URL fidelity · 28 source tags · 2660 chars
  ↓ if Tier 1 失败 (timeout 90s OR exit code ≠ 0 OR acceptance fail)
  
Tier 2 (fallback):
  Claude CLI (sonnet 3.5)
  · cloud · subscription · marginal $0
  · 47s · 92-100% URL fidelity · 35 source tags · 2459 chars
  ↓ if Tier 2 失败
  
Tier 3 (safety net · 离线兜底):
  Ollama Qwen 3.6 27b (local · 17GB)
  · local · $0 · 不依赖网络
  · 160s · 100% URL fidelity · 30 source tags · 2731 chars
  ↓ if Tier 3 失败 (OOM · ollama daemon down · 慢得不可接受)
  
Tier 4 (emergency · 信息密度低但活):
  Ollama Qwen 3.5 9b (local · 6.6GB)
  · local · $0 · 内存占用低
  · 39s · URL fidelity 待测 · 14 source tags · 1439 chars
```

**DeepSeek R1 14b 不入 cascade** · URL fidelity = 0 (即使关 thinking 也不输出 URL) · 致命缺陷。

---

## Acceptance Criteria (任一 Tier 输出过这关才算成功)

```js
function acceptOutput(text, allowedUrls) {
  const sections = ['业务范围','经营历史','目标客户','服务区域','差异化卖点',
                    '规模估算','数字化成熟度','投资能力评估','Outreach 建议','数据来源'];
  const foundSections = sections.filter(s => text.includes(s)).length;
  
  // URL fidelity
  const urls = [...text.matchAll(/https?:\/\/[^\s)\]"'>]+/g)].map(m => m[0]);
  const realUrls = urls.filter(u => allowedUrls.has(u)).length;
  const fidelity = urls.length ? realUrls / urls.length : 0;

  return foundSections >= 9              // 至少 9/10 段
      && text.length >= 800              // 至少 800 字
      && (urls.length === 0 || fidelity >= 0.8); // 或不输出 URL · 或 80%+ 真实
}
```

不通过 → 自动 fallback 下一 Tier。

---

## Bench 数据 · 6 模型同 prompt 横评 (Cycle-27 测过)

测试 entity: Total Roof & Gutter (Launceston · 无网站 · STARTER · 最难 case)

| Model | 类型 | 速度 | 字数 | 段落 | source-tags | URL fidelity | Cost | 入 cascade |
|---|---|---|---|---|---|---|---|---|
| **Codex gpt-5** | cloud · sub | 56s | 2660 | 10/10 | 28 | ✅ 100% (3 URLs) | $0 marginal | Tier 1 |
| **Claude Sonnet** | cloud · sub | 47s | 2459 | 10/10 | 35 | ✅ 92-100% (5 URLs) | $0 marginal | Tier 2 |
| **Qwen 3.6 27b** | local | 160s | 2731 | 10/10 | 30 | ✅ 100% (10 URLs) | $0 | Tier 3 |
| **Qwen 3.5 9b** | local | 39s | 1439 | 10/10 | 14 | 待测 | $0 | Tier 4 |
| **Gemma 3 27b** | local | 68s | 1102 | 10/10 | 27 | 待测 | $0 | ❌ 不入 (Qwen 27b 更好) |
| **DeepSeek R1 14b** | local | 24s | 970 | 10/10 | 17 | ❌ 0/0 (拒绝输 URL) | $0 | ❌ 拒用 |

Bench 详情: https://customer-summaries.pages.dev/llm-bench/ + https://customer-summaries.pages.dev/llm-bench-v2/

---

## 调用点 (哪些 stage 调 Cascade A)

| Stage | 调用 | 备注 |
|---|---|---|
| S3 customer-summary | ✅ Cascade A | 双语 9 段 |
| S3 services-list 抽取 | ✅ Cascade A | 从 markdown + GBP types |
| S3 about-narrative | ✅ Cascade A | 综合多源 |
| S3 faq 生成 | ✅ Cascade A | niche typical 4-6 问 |
| S3 page-map 决策 | ✅ Cascade A | 新站结构 |
| S3 seo-strategy | ✅ Cascade A | 长尾 target |
| S3 reviews/generated fallback | ✅ Cascade A | AI 补 reviews if real < 3 |
| S3 issue-fix-matrix | ✅ Cascade A | audit issue → page+section 映射 |
| S4 retex build | ✅ Cascade A | Codex retex template |
| S2 Vision (screenshot 评分) | ❌ 独立 vision cascade | gpt-5-vision → claude-vision → qwen-vl |
| S3 photos AI analysis | ❌ 独立 vision cascade | 同上 |
| S3 logo skill | ❌ skill 内部 cascade | existing-logo-brand 决 |

---

## 实现模块

新建 `core/llm/cascade-a.js`:

```js
import { spawn } from 'node:child_process';

const TIERS = [
  { id: 'codex_cli',  cmd: 'codex',  args: ['exec'],         timeout: 90_000 },
  { id: 'claude_cli', cmd: 'claude', args: (p) => ['-p', p], timeout: 90_000 },
  { id: 'ollama_qwen_27b', model: 'qwen3.6:27b',             timeout: 240_000 },
  { id: 'ollama_qwen_9b',  model: 'qwen3.5:9b',              timeout: 90_000 },
];

const SYSTEM_NOTHINK = '直接输出 markdown · 不要 thinking · 不要 reasoning · 不要 <think>.';

function acceptOutput(text, allowedUrls, opts = {}) {
  const minSections = opts.minSections ?? 9;
  const minChars = opts.minChars ?? 800;
  const minUrlFidelity = opts.minUrlFidelity ?? 0.8;
  // ... (上面定义的逻辑)
}

export async function runCascadeA(prompt, { allowedUrls = new Set(), acceptOpts } = {}) {
  const trace = [];
  for (const tier of TIERS) {
    const t0 = Date.now();
    try {
      const result = await callTier(tier, prompt);
      const text = (result.text || '').replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
      const ok = acceptOutput(text, allowedUrls, acceptOpts);
      trace.push({ tier: tier.id, latency_ms: Date.now()-t0, ok, chars: text.length });
      if (ok) {
        return { ok: true, text, provider: tier.id, trace, latency_ms: Date.now()-t0 };
      }
      // 不通过 · fallback 下一 tier
    } catch (err) {
      trace.push({ tier: tier.id, latency_ms: Date.now()-t0, ok: false, error: err.message });
    }
  }
  return { ok: false, trace, error: 'all tiers failed' };
}
```

---

## 监控 + 优化

### 每次调用 trace 写入 ledger:
```json
{
  "scope": "cascade-a",
  "entity_key": "place_xxx",
  "stage": "customer-summary",
  "trace": [
    { "tier": "codex_cli", "ok": false, "latency_ms": 90000, "error": "timeout" },
    { "tier": "claude_cli", "ok": true, "latency_ms": 47000 }
  ],
  "final_provider": "claude_cli",
  "total_latency_ms": 137000
}
```

### Weekly doctor (`pl:cascade-doctor`)
- 统计每周各 tier 命中率
- 发现 Codex 失败率 > 20% → 警报 (订阅可能问题)
- 发现总 fallback 到 Qwen 27b → 警报 (cloud 全挂 · 调查)
- 发现 acceptance 拒绝率 > 30% → 警报 (prompt 可能要调)

### A/B 实验 (Phase 2+ · V4 不做)
- entityKey hash 50/50 路由两个 cascade profile
- 比较 build 后 verification pass rate
- 数据驱动调整 Tier 顺序
