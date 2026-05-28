# OVERNIGHT PLAN · 2026-05-28 → 2026-05-29

> **Goal**: 打通"造完孤立"问题。把所有已建但未接入的 skills/files 全部 wire 到真实流水线。
> 每块完成后必须：(1) 更新代码 (2) 更新相关文档 (3) 更新 CANONICAL.md (4) 更新 HANDOFF-NEXT-SESSION.md
>
> **Codex 共识**: R45 + R46 · Option B+C hybrid · site-ctx.json 是中间契约

---

## 系统目标流水线（完成后）

```
master.md  (SSOT 数据仓库)
  ↓
pl:extract-site-ctx          ← Block A · 新建
  site-ctx.json              (干净的结构化客户数据)
  ↓
pl:llm-single-page-copy      ← Block B · 改造旧 pl-llm-page-copywriter
  读: site-ctx.json + pl-local-trade-page-spec + pl-au-trade-voice + personas
  写: handoff/od-package/content/
      hero-copy.json, services.json, about.md
      reviews.json (新), faq.json, coverage.json (新), process.json (新)
  ↓
pl:compose-editorial         ← Block C · 扩展读取剩余 sections
  读: handoff/od-package/content/* + brand-tokens.css + photos + brief
  写: editorial-output/index.html + ctx-snapshot.json
  ↓
pl:audit-v4 (fast tier)      ← Block D · 验证 3 客户全部仍 GREEN
  ↓
master.md 重新生成            ← Block D · 更新内容就位度 section
```

---

## Block A · `pl:extract-site-ctx` · 新 CLI

**目标**: 把 master.md 里的结构化数据提炼成 `site-ctx.json`，供所有下游工具消费。

**输入**:
- `clients/<slug>/v2/master.md` (YAML frontmatter + body sections)
- `clients/<slug>/v2/core-extract.json` (GBP 原始数据)
- `clients/<slug>/v2/facts.json` (锁定事实)

**输出**: `clients/<slug>/v2/site-ctx.json`

```json
{
  "slug": "vicwest-roofing",
  "generated_at": "...",
  "business": {
    "name": "Vicwest Roofing",
    "phone": "...", "phone_display": "...",
    "city": "Ballarat", "state": "VIC",
    "address": "...", "abn": "...",
    "license_authority": "VBA", "license_number": "CDB-U 65938",
    "rating": 4.1, "review_count": 18,
    "year_founded": null
  },
  "services": ["Roof Replacement", "..."],
  "suburbs": ["Ballarat", "Ballarat Central", "..."],
  "reviews": [{"quote": "...", "author": "...", "location": "..."}],
  "about_signals": ["20+ years experience", "..."],
  "trust_signals": ["Licensed VBA", "18 Google reviews", "..."],
  "brand_personality": "...",
  "_sources": {
    "business": "master.md:yaml",
    "services": "core-extract.json",
    "suburbs": "master.md:seo-section",
    "reviews": "master.md:section-four"
  }
}
```

**实现策略** (Codex R45 B+C hybrid):
- YAML frontmatter → 直接 parse (零 LLM · 零成本)
- 结构化 sections (reviews · suburbs · trust signals) → 正则/markdown parse (零 LLM)
- 不需要 LLM (数据已结构化在 master.md 里)

**代码位置**:
- `scripts/cli/pl-extract-site-ctx.js` (新建)
- `package.json` 加 `"pl:extract-site-ctx": "node --env-file-if-exists=.env.local scripts/cli/pl-extract-site-ctx.js"`

**文档更新**:
- `docs/v3/CANONICAL.md` §0 新增一行: site-ctx.json locked pattern
- `docs/v3/INFRASTRUCTURE-INVENTORY.md` 新增 pl:extract-site-ctx 条目
- `docs/v3/HANDOFF-NEXT-SESSION.md` 更新 sanity check commands

**验收**:
```bash
npm run pl:extract-site-ctx -- --slug vicwest-roofing
cat clients/vicwest-roofing/v2/site-ctx.json | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('business:', d['business']['name'])
print('services:', len(d.get('services',[])))
print('suburbs:', len(d.get('suburbs',[])))
print('reviews:', len(d.get('reviews',[])))
print('trust_signals:', len(d.get('trust_signals',[])))
"
# Expected: name=Vicwest Roofing · services≥4 · suburbs≥8 · reviews≥3
```

---

## Block B · Refactor `pl-llm-page-copywriter.js` → `pl:llm-single-page-copy`

**目标**: 让 LLM copywriter 读 site-ctx.json (不是旧的 site-architecture.json)，用 pl-local-trade-page-spec + pl-au-trade-voice + personas 写出全部内容文件。

**当前状态**: `scripts/cli/pl-llm-page-copywriter.js` 存在但读 site-architecture.json（多页架构产物，已断开）。

**修改**:
- `pl-llm-page-copywriter.js` → 改造为读 site-ctx.json（不删旧功能，加 `--single-page` flag）
- 新增 npm script: `"pl:llm-single-page-copy": "node ... pl-llm-page-copywriter.js --single-page"`

**LLM 读入的 context**:
```
1. site-ctx.json          ← 干净的客户数据
2. pl-local-trade-page-spec.json  ← 11 sections + word budgets
3. pl-au-trade-voice.json ← AU 语气规则 + 禁用词
4. personas/planned-upgrade.js    ← 主要买家类型
5. template profile: editorial-newsletter
```

**LLM 写出的文件** (全部写入 `handoff/od-package/content/`):
| 文件 | 内容 | 当前状态 |
|---|---|---|
| `hero-copy.json` | 3 个标题选项 + subhead + chips | 已存在（pl-enrich-handoff 生成）→ 覆盖/改善 |
| `services.json` | 6 个服务 + 描述 | 已存在 → 覆盖/改善 |
| `about.md` | 3-5 段 about story | 已存在 → 覆盖/改善 |
| `reviews.json` | 3 个真实 Google 评论（从 site-ctx 提取） | 新建 |
| `faq.json` | 6 个 FAQ | 已存在 → 覆盖/改善 |
| `coverage.json` | 10-18 个郊区 | 新建 |
| `process.json` | 4-5 步服务流程 | 新建 |

**重要**: reviews 不是 AI 生成——直接从 site-ctx.json 里的真实 Google 评论提取，LLM 只做格式化。

**代码变更**:
- `scripts/cli/pl-llm-page-copywriter.js` (修改)
- `package.json` 新增 `pl:llm-single-page-copy`

**文档更新**:
- `docs/v3/INFRASTRUCTURE-INVENTORY.md` 更新 pl-llm-page-copywriter 条目
- `docs/v3/SOP-DATA-CHECKPOINT.md` 或新建 `SOP-CONTENT-GENERATION.md` 记录流程

**验收**:
```bash
npm run pl:llm-single-page-copy -- --slug vicwest-roofing
ls clients/vicwest-roofing/v2/handoff/od-package/content/
# Expected: about.md coverage.json faq.json hero-copy.json process.json reviews.json services.json
```

---

## Block C · 扩展 `pl-compose-editorial` 读取全部 sections

**目标**: composer 现在只读 hero/services/about（R44 完成）。扩展为读取 Block B 生成的所有内容文件。

**要接入的文件**:

| 文件 | 模板变量 | 当前状态 |
|---|---|---|
| `reviews.json` | `ctx.reviews.items[{quote,author,location}]` | ❌ 没读 (模板有 section 但用 formula) |
| `coverage.json` | `ctx.coverage.suburbs[]` | ❌ 没读 (模板有但用 formula) |
| `faq.json` | `ctx.faq.items[{q,a}]` | ❌ 没读 (已存在文件但没 wire) |
| `process.json` | `ctx.process.steps[{number,title,body}]` | ❌ 新文件 |

**代码变更**:
- `scripts/cli/pl-compose-editorial.js`
  - 新增 4 个 reader 函数: `readPreparedReviews`, `readPreparedCoverage`, `readPreparedFaq`, `readPreparedProcess`
  - 在 ctx 构建阶段接入 override
  - `ctx-snapshot.json` 扩展 sources 字段

**文档更新**:
- `docs/v3/INFRASTRUCTURE-INVENTORY.md` 更新 composer 读取的文件列表
- composer 注释里更新文件依赖说明

**验收**:
```bash
npm run pl:compose-editorial -- --slug vicwest-roofing
cat clients/vicwest-roofing/v2/editorial-output/ctx-snapshot.json
# Expected: sources.reviews/coverage/faq/process 全部显示 prepared:xxx
```

---

## Block D · 3 客户全量跑 + 验证

**目标**: vicwest-roofing · mark-squire-roof-restorations · a-j-roofing-solutions 全部跑完整流水线。

**命令序列** (每个客户):
```bash
SLUG=vicwest-roofing  # 换成每个客户

npm run pl:extract-site-ctx -- --slug $SLUG
npm run pl:llm-single-page-copy -- --slug $SLUG
npm run pl:compose-editorial -- --slug $SLUG
npm run pl:audit-v4 -- --slug $SLUG \
  --output-dir clients/$SLUG/v2/editorial-output --tier fast
node scripts/leads/build-master-md.js --slug $SLUG   # 重新生成 master.md（含最新内容就位度）
```

**期望结果**:
- vicwest: composite ≥88 (R44 后是 91，新 copy 不应降低)
- mark-squire: composite ≥90 (目前 93)
- a-j: composite ≥80 (目前 83)

**如果分数下降 >3pt**: 检查新 copy 质量，回退到 R44 准备的 hero/services/about（它们已经通过）

---

## Block E · 文档全量更新

**每块完成后立刻做，不要堆到最后**:

1. **`CANONICAL.md`** 新增 site-ctx.json 决策行:
   ```
   | site-ctx.json | master.md → pl:extract-site-ctx → site-ctx.json · 零 LLM 提取 · 下游所有 copy 工具的输入 | CANONICAL.md §0 | Schema change = codex round |
   ```

2. **`docs/v3/INFRASTRUCTURE-INVENTORY.md`** 更新:
   - pl:extract-site-ctx 新条目
   - pl:llm-single-page-copy 条目（替代旧 pl-llm-page-copywriter 描述）
   - composer 读取文件列表更新

3. **`docs/v3/HANDOFF-NEXT-SESSION.md`** 更新:
   - sanity check commands 加 site-ctx.json 验证
   - 3 客户审计分数更新
   - Next priorities 更新

4. **`docs/v3/SOP-CONTENT-GENERATION.md`** (新建):
   - 完整 content generation SOP
   - 每个命令的输入/输出/验收
   - "build and orphan" 防止规则 (Codex R46 Q3 三个问题)

5. **每个客户的 `master.md`** (重新生成):
   - 内容就位度 section 更新显示新文件
   - ctx-snapshot 来源更新

6. **`OVERNIGHT-RESULTS.md`** (本文件同目录):
   - 每块结果 + 分数变化
   - 任何意外问题

---

## 顺序和时间估计

| Block | 估时 | 依赖 |
|---|---|---|
| A · pl:extract-site-ctx | 90 min | 无 |
| B · pl:llm-single-page-copy | 120 min | Block A |
| C · 扩展 composer | 90 min | Block B |
| D · 3 客户全量跑 | 60 min | Block C |
| E · 文档更新 | 贯穿全程 | 每块完成后 |

**总计**: ~6 小时

---

## 失败停止规则

- **Block A 失败**: 如果 master.md parse 有问题，读 YAML frontmatter 的部分先跑（frontmatter 是结构化的），body sections 用基础正则
- **Block B LLM 质量差**: 先用现有 pl-enrich-handoff 生成的 hero-copy.json/services.json（R44 已验证），只跑 reviews/coverage/process 这 3 个新文件
- **Block D 分数下降**: 回退到 R44 baseline (commit 8ccf415b)，只跑 D 和 E

---

## 3 个防止"造完孤立"的铁律（Codex R46 Q3）

每次造新东西前必须回答:
1. **谁调用它？** 写出具体脚本名（不能含糊）
2. **它替代什么？** 如果什么都不替代 = 很可能是孤立工作
3. **输入/输出/验收命令是什么？** 没有 consumer test = 没有完成

---

*写于 2026-05-28 · Matthew 睡前 · Codex R45+R46 共识*
