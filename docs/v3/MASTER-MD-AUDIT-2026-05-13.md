# Master MD + audit output 全面审计 · 2026-05-13

> Matthew 要求: 读完 15 份 master.md + 看完所有 output (internal-audit-report.html / screenshots /
> evidence/) · 把所有 bug 汇总。

## 数据范围

- 15 份 `clients/<slug>/v2/master.md` (10 个真客户 audit / 5 个 E2E 制造的 skeleton)
- 10 份 `internal-audit-report.html` (45-52 KB 各 · 排版完整)
- 11 份 screenshots/desktop.png + mobile.png
- 9 份 evidence/issue-*.png (5-7 张/客户 · queensland-roofing 例外: 0 张)

## Bug 清单 · 13 个 · 按严重度排

### 🔴 CRITICAL · 立刻影响销售

#### Bug 1 · 3 必出 section 没渲染到 10 份真 audit master.md

**现象**: 10 份生成于 2026-05-11 的真 audit master.md 都缺 `## 三、现网站快速诊断` / `## 四、业主沟通要点` / `## 五、账户与档案` · 完全没有这 3 个 header。

**根因**: 当时 M2-D6 + `ensureAllRequiredSections` 还没实装 · master.md 是老格式。

**影响**: M3 reference-adapter handoff 依赖这 5 section 当 content layer · 现在 reference adapter 跑这 10 个真客户的 master.md · 会拿到不完整内容。

**修法**: 全量 regenerate · `npm run leads:build-master-md -- --all-with-detailed`。

**verification**: 之后所有 master.md 同时含 5 section。

---

#### Bug 2 · 5 客户 visual_freshness=NULL 即使 audit_score 有值

**清单**:
- brisbane-roofing-solutions-roof-restoration-repairs (audit 69 · vision NULL)
- fix-my-roof-total-roof-restorations (audit 51 · vision NULL)
- gutter-and-roof-repairs (audit 69 · vision NULL)
- hurricane-digital-seo-brisbane (audit 64 · vision NULL)
- weatherproof-restorations (audit 61 · vision NULL)

**现象**: cheap audit 跑了 · 但 ollama vision audit 单独失败 · `visual_*` 字段全 null。

**根因待查**: 可能 ollama 当时挂了 · 也可能 Stage 4 visual audit 没 retry。

**影响**: master.md 里整个 `## 三、视觉审计 · Vision LLM 怎么看` section 不渲染 · 销售看不到新鲜度/信任/转化分数。

**修法 step 1**: 看 audit pipeline 里 vision audit 错误处理是否 silent fail · 加 retry + 日志。
**修法 step 2**: 这 5 客户 re-trigger visual-audit only。

---

#### Bug 3 · pl:single-enrich 解析到错的 place (Bug K)

**现象**: 我跑 `pl:single-enrich --name "Sky High Roofing Brisbane" --phone "0731234567"` · 结果 entity 名字 = "Brisbane" (place_chijm9ktrjpxkwsrqk_e81qjagq · 解析到 Brisbane 城市本身) · 不是商家。

**根因**: single-enrich Places API 调用用 "Brisbane" 当 search query · 不是 "Sky High Roofing Brisbane"。query 构建逻辑漏了 name。

**影响**: 操作员手动用 `pl:single-enrich` 时 · entity 错位 · master.md 全错。

**修法**: 改 `scripts/cli/pl-single-enrich.js` query 构建 · 用 `name + city` 优先。

---

### 🟠 HIGH · 数据准确性

#### Bug 4 · evidence_count 永远 0 即使 evidence dir 有 5-7 张图

**现象**:
| Customer | ev 实际文件数 | master.md frontmatter |
|---|---|---|
| brisbane-roof-restoration-experts | 5 | 0 |
| fix-my-roof | 6 | 0 |
| diamond-roof-tiling-restoration | 7 | 0 |
| roof-space-renovators | 5 | **5** ✓ 唯一正确 |
| roofshield | 6 | 0 |
| ... 9/10 都是 0 |

**根因**: master-md-builder 读 `entity.assets.evidence_count` · 但 audit pipeline 写盘后没 update entity · 只有 roof-space-renovators 因为后续 manual run 触发了 update。

**影响**: master.md 显示 0 evidence · 但实际有 5+ issue 特写图能用进销售报告 · 浪费。

**修法**: master-md-builder 改成动态 count `fs.readdir(clients/<slug>/v2/evidence/)` 而不是读 entity 字段。

---

#### Bug 5 · queensland-roofing-pty-ltd evidence dir 空

**现象**: audit_score=23 (极差) · 跑了 visual+cheap audit · 但 evidence dir 0 张图。

**根因**: `captureIssueEvidence` 在 audit Stage 3 没跑 · 这个 entity 单独漏。

**影响**: audit 报告引用不存在的 issue-*.png · master.md / internal-audit-report.html 都看不到图。

**修法**: 重跑 audit pipeline for this entity · 或单跑 `captureIssueEvidence`。

---

#### Bug 6 · niche 字段空 (`niche: ""`) for places-search 入库

**现象**: `motorone-autobody-cleveland` (来自 `pl:places-search-intake "panel beater Brisbane"`) niche 是空字符串 · 不是 "panel beater" 或 "auto repair"。

**根因**: places-search-intake 入库时没把 niche 从 search query 推断 / 从 GMB categories 提取。

**影响**:
- master.md "行业：" 字段显示 `-`
- M3 reference-adapter `FAMILY_REGISTRY[niche]` 找不到对应 family · 抛错
- 销售看到无 niche 的 entity 难分类

**修法**: places-search-intake 入库时 fallback niche = search query 的关键词 · 或从 `result.types[]` 提取 GMB category。

---

### 🟡 MEDIUM · 数据一致性 / 排版

#### Bug 7 · skeleton master.md duplicate `## 二、` header

**现象**: 5 份新生成 skeleton (brisbane / motorone / obsidian / e2e-image / charlie 没 audit 的) 都有:
```
## 二、销售切入点    ← ensureRequiredOrder 注入
...
## 二、客户访问时看到的页面    ← detail builder 原生
```

**根因**: 我的 `ensureRequiredOrder` 在 速览 后注入 销售切入点 · 没改原本的 `## 二、客户访问页面` (该叫 `## 三、...`)。

**影响**: 显示 2 个 "二、" · 客户/销售看着乱。

**修法**: 改 detail builder · 客户访问页面 改 section 序号 `## 三、` · 或 ensureRequiredOrder 改 detail builder 的 numbering。

---

#### Bug 8 · skeleton master.md 三/四/五 required section 出现在附录后

**现象**: 新 skeleton 排版:
```
## 二、销售切入点 (我注入)
## 二、客户访问页面 (原生 · 重号)
## 业务规模信号
## 附录
## 三、现网站快速诊断 ← 在附录后面
## 四、业主沟通要点
## 五、账户与档案
```

**根因**: `ensureAllRequiredSections` 用 `out + appended` · 不知道 detail builder 已经写了附录 · 直接附加在最后。

**影响**: 阅读流被破坏 · 附录夹在 body 中间。

**修法**: ensureAllRequiredSections 改成在 detail builder 内部的特定 anchor 插入 (e.g. 在 "附录 · 数据出处" 前)。

---

#### Bug 9 · city 大小写不一致

**清单**:
- `brisbane` (motorone · pl:places-search-intake) 
- `gold-coast` (charlie · pl:single-enrich · 带 hyphen)
- `Brisbane` (其余全部 · pl:scrape-docker · pl:pipeline-batch-start)

**根因**: 各入口 normalize city 逻辑不统一。

**修法**: 中央化 city normalize · 推荐 `core/leads/normalize.js#normalizeCity` · 4 入口 + entity 写盘前都调一遍。

---

#### Bug 10 · diamond-roof + roof-space-renovators 销售切入点重复 (sales=2)

**现象**: 这 2 份 master.md 里 `销售切入点` 出现 2 次:
1. 详细 builder 原本写的 `## 七、推荐销售切入点`
2. `ensureRequiredOrder` 又在 速览 后注入 `## 二、销售切入点`

**根因**: 同 Bug 7 · 我的 fix 没考虑 detail builder 已经有该 header。

**修法**: ensureRequiredOrder 先 check 是否已存在再注入。

---

### 🟢 LOW · 内容质量 (不修也能用 · 但能改进)

#### Bug 11 · "未明确决策类型: undefined" 触发依据

**现象**: 4 个 skeleton master.md (无 audit) 触发依据写 "未明确决策类型: undefined"。

**根因**: grade-router 没 audit decision 时仍试着算 grade · fallback 文字不对。

**修法**: 没 audit 时改写 "audit 未跑 · 默认 C 等待"。

---

#### Bug 12 · 附录链接到不存在的 internal-audit-report.html

**现象**: 5 个 skeleton master.md 附录里写 `[internal-audit-report](./internal-audit-report.html)` · 但文件不存在 (audit 没跑)。

**修法**: 检查文件是否存在 · 不存在不写链接。

---

#### Bug 13 · Vision model 字段写死 "ollama-qwen3.6-27b-nothink"

**现象**: 所有 master.md 附录都写 vision model 是这个 · 即使该 master.md 没跑 vision (visual_freshness=null)。

**根因**: 写死的字面量 · 不读 audit run metadata。

**修法**: 读 audit run · 没跑就写 "未运行"。

---

## 修复优先级

| 级别 | Bug | 估时 |
|---|---|---|
| 🔴 Critical | 1 (regenerate) | 5 min · 1 命令 |
| 🔴 Critical | 2 (vision retry) | 1h |
| 🔴 Critical | 3 (single-enrich query) | 30 min |
| 🟠 High | 4 (evidence dynamic count) | 15 min |
| 🟠 High | 5 (queensland evidence rerun) | 10 min |
| 🟠 High | 6 (niche fallback) | 20 min |
| 🟡 Medium | 7+10 (duplicate 二、 / sales 重复) | 20 min |
| 🟡 Medium | 8 (required section position) | 30 min |
| 🟡 Medium | 9 (city normalize) | 30 min |
| 🟢 Low | 11+12+13 | 30 min |

**总: ~4h** · 一次性修完。

## 修复策略

按顺序:
1. 先修 builder 层 bugs (4, 7, 8, 10) · 因为 step 2 regenerate 要用最新 builder
2. 修 entity-side bugs (3, 6, 9, 11)
3. Run 全量 `npm run leads:build-master-md -- --all-with-detailed` · regenerate 15 份
4. Re-trigger visual audit for Bug 2 的 5 客户
5. captureIssueEvidence for queensland-roofing
6. 验证: 跑 `e2e-4-entry` + `e2e-deep-reference-adapter` 全过

## 不修的 (留下个 sprint)

- `assets.cloudinary_folder: null` · 所有 customers · 没用 cloudinary 上传 (M3 work · M4 用)
- `video_url: null` · 所有 customers · Hyperframe 视频生成没跑 (M4)
