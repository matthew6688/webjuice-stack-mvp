# SOP Maintenance Rules · 维护协议

**版本**: v1.0
**最近更新**: 2026-05-12
**约束力**: 🔴 强制 · AI 工程师 / 工程师 / 操作员都必须遵守
**配套**: [`SOP_OWNERSHIP_REGISTRY.md`](SOP_OWNERSHIP_REGISTRY.md)

---

## 0. Why this exists

Matthew 反馈："SOP-1 和 SOP-2 内容互相交叉，同一信息出现在两处，未来漂移就尴尬。"

历史教训（2026-05-12 audit 发现）：
- Entity schema 在 SOP-1 §5 + SOP_HANDOFF_CONTRACT.md + 隐式在 SOP-2 = **3 处**
- gosom Docker 链路在 SOP-1 §3 (完整) + SOP-2 Stage 0 (简述) = **2 处**
- 5 处概念跨 SOP 重复 → 100% 漂移风险

**这份规则的目的**：把这种重复从源头杜绝。

---

## 1. 单源原则 (Single Source of Truth)

每个业务概念有且只有**一个** owner SOP。其他 SOP 引用时**禁止重述**，**必须链接到 owner**。

Owner 归属见 [`SOP_OWNERSHIP_REGISTRY.md`](SOP_OWNERSHIP_REGISTRY.md)。

---

## 2. 五问写作前检查 (Pre-Write Checklist)

每次准备写或改 SOP 文档 / admin 页面前，必须依次自答：

### Q1 · 这个概念的 owner 是谁？
打开 `SOP_OWNERSHIP_REGISTRY.md` 查表。如果 registry 里没有 → 在 registry 加一行后再继续。

### Q2 · 我正在修改的是不是 owner 文档/页面？
- ✅ 是 → 正常改，完整描述
- ❌ 否 → **禁止重述概念内容**。只能写 "见 [owner SOP §X]" + 链接

### Q3 · 改动影响的页面 / 文档 / 代码三者，我是不是全部更新？
- code 改了 → owner doc 改了 → admin 页面改了 → screenshot 验证过
- 任一未更新 → 在 admin 页面顶部加 stale banner

### Q4 · 跨 SOP 引用是不是双向？
- 如果 SOP-1 引用 SOP-2 概念 → SOP-2 是否在合适位置（如 "上游来源"段）反向链接 SOP-1？
- 不一定每处都双向，但导航链条不能断

### Q5 · 改完跑 `npm run ops:sop-audit` 了吗？
- 自动 grep 检测跨 SOP 重复
- failure → 修了再 commit

**任何一问答 "否" → 不能 commit。**

---

## 3. 提交协议

每次 commit message 涉及 SOP 改动时，必须按以下结构：

```
<scope> · <动作> · <概念名>

Owner: <SOP-X-Y>  (引自 SOP_OWNERSHIP_REGISTRY)
Files changed:
  - code: ...
  - doc:  ...
  - page: ...
Sync checks:
  [x] Q1 owner identified
  [x] Q2 no重述
  [x] Q3 code/doc/page 三者一致
  [x] Q4 跨 SOP 引用双向
  [x] Q5 sop-audit passed

Co-Authored-By: ...
```

跳过任一 [x] → review 时打回。

---

## 4. 跨 SOP 引用的标准格式

### 4.1 在 doc / page 里引用其他 SOP

```markdown
**niche_match SKIP 行为** 详见 [SOP-2 §3.3](SOP_2_LEAD_DISCOVERY_PIPELINE.md#33-hard-triggers)（cheap-audit-v2 5 hard triggers 之一）。
```

注意：
- ✅ 一句话简述（让读者知道概念大概是什么）
- ✅ 锚链接到 owner SOP 的具体章节
- ❌ 不要列出规则细节
- ❌ 不要复制 owner SOP 的表格

### 4.2 在代码注释里引用

```js
// 当 category 不含 niche 关键词时 SKIP。
// 详见 SOP-2 §3.3 hard triggers (cheap-audit-v2).
```

### 4.3 在 admin 页面里引用

UI button: "查看 SOP-2 §3.3 (Hard triggers)" → `/admin/scoring/sop-2#hard-triggers`

---

## 5. 例外情况

### 5.1 跨 SOP 共享的"接口"概念

例如 `entity.latest.batch_id` 字段：
- **字段定义**（类型、必填、值域、schemaVersion）→ SOP-X-Handoff 拥有
- **写入逻辑**（pl:scrape-docker --batch-id 怎么传）→ SOP-1 拥有
- **读取消费**（哪个 audit 步骤用这个字段）→ SOP-2 拥有

每个 SOP 描述自己的视角，**互不重述**。

### 5.2 总览 / 索引性内容

例如 SOP overview 里列出每个 SOP 的 1-2 行简介 — 这是**导航必要**，不算"重复内容"。但**简介一句话即可**，不展开。

---

## 6. Audit 工具

### 6.1 自动 audit
```
npm run ops:sop-audit
```
- grep 跨 SOP 出现的关键短语
- 报告重复 → exit 1

### 6.2 手动 review
每周 1 次：
- 跑 audit + 看报告
- check ownership registry 是否需要更新
- 看是否有新概念没归属

### 6.3 Audit 的 known good case
- "gosom Docker scraper" 出现在 SOP-1 (owner) + SOP-2 §Stage 0 (one-line link) = OK
- "gosom Docker scraper" 出现在 SOP-1 (owner) + SOP-2 详细描述 = ❌ FAIL

---

## 7. Onboarding 新 SOP 的流程

1. 在 `SOP_OWNERSHIP_REGISTRY.md` 加一行: SOP-N 拥有概念 [...]
2. 检查现有 SOP 是否已经描述这些概念 → 如有，先迁移
3. 写 `docs/SOP_N_<name>.md`
4. 建 admin 页面 `/admin/scoring/sop-n` + viewer `/admin/scoring/sop-n-doc`
5. 在 `SOP_OVERVIEW.md` matrix 加一行
6. 跑 `ops:sop-audit` 确认无重复
7. 截图 + 推 Discord 通告

---

## 8. AI 工程师特别约束

> 当 AI 工程师 (Claude / Hermes / Codex) 改 SOP 时：
> 1. **必须先打开 `SOP_OWNERSHIP_REGISTRY.md` 读一遍**（哪怕已经记得）
> 2. **必须在 commit message 里写出 Owner**
> 3. **必须跑 `npm run ops:sop-audit`** 之后才能 push
> 4. 如果 audit 失败 → 不能 force push / 不能 skip → 必须修

这是硬约束，不是建议。
