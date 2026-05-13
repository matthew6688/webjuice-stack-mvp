# V3 · Open Design handoff document · 研究 · 2026-05-13

> Matthew 挑战: "你怎么知道 template 就是正确的解决方案？4 个够吗？让 OD 跨 template 组合好看吗？
> 要不要建素材库 = 我们做 AI 该做的事？文案呢？给 OD 什么 handoff · 它能一步到位生成
> 80-85 分的网站 (真实客户信息 + 设计过得去 + 文案可以 + 单页或多页)？"

我**撤回**昨晚 288-variant vision-autoresearch 那套。先答这道题。

---

## 1. 重新看现状 · "为什么质量不稳定"

我之前研究过 OD 是 **严格** 不是 loose · 真正的不稳定来自**handoff 留太多自由参数**。

读了真东西后 · 现在的 handoff = `core/leads/website-build-handoff.js::renderOpenDesignPrompt()` · 约 28 行 prompt · 实际效果:

| 参数 | 现状 | 后果 |
|---|---|---|
| 商家事实 (名 / 电 / 地 / 服务) | ✅ 注入 verified facts | 稳定 |
| Anti-invent (邮 / 地 / 评 / 牌照) | ✅ "Do not invent..." | 稳定 |
| Anti-slop (gradient / Welcome / 紫渐变) | ✅ 列了 | 部分稳定 (OD 仍会偶尔 slop) |
| 主 CTA + 电话 tel: link | ✅ 强制 | 稳定 |
| 联系表单 (Resend) | ✅ 强制 | 稳定 |
| **视觉方向 / 调色 / 字体** | ❌ "Pick a tasteful direction" — **自由参数** | **不稳定** |
| **Section 数量 / 顺序 / 信息架构** | ⚠️ 列了 5-6 个 key 名 · 无 recipe | **不稳定** |
| **图片 (哪张 · 用在哪)** | ❌ 完全没提 · OD 自己用 placeholder/SVG | **不稳定** |
| **文案语气 / 长度 / 节奏** | ❌ "fill demo copy completely" — 自由 | **不稳定** |
| **Niche-specific 信号 (trust pattern / FAQ angle)** | ⚠️ "Trust signals: 一句" · 不够 | 中等 |

**结论**: 我们没让 OD 不好 · 我们**没告诉它该好成什么样**。

跟 4 roofing template families 的 `open-design-prompt.md` 对比 (那 4 个 OD critic 都打 100 分):

template handoff 多给了 4 件事:
1. `design-language.md` (64 行 · 调色 · 字体 · 节奏 · 风格 anchor)
2. `section-patterns.json` (section recipe · 顺序 · 内容 hint)
3. `template-manifest.json::selectedImages` (manual ChatGPT Image 选好 · 哪张去哪)
4. **针对该 family 的视觉 anchor 一句** ("cinematic roof hero / editorial serif" · 等)

→ template families build 时 (无真客户) · OD 一次过 100 分。
→ 同一 OD · 真客户 build 时 · 没拿到这 4 件 · 自由参数太多 · 不稳定。

---

## 2. 直答 Matthew 的 4 个问题

### Q1 "Template 是正确解决方案吗？"

**不是** "template 替代 OD" · **是** "template = OD 的 design contract"。

不需要把 4 families 当**输出**用 (=静态 HTML 套数据) · 那就成 wordpress 模板了 · 没 AI 价值。

需要把 4 families 当 **handoff 的 design system 部分** · OD 仍是渲染器:
- 商家信息 + audit 痛点 (来自 master.md) = **content layer**
- 1 个 family 的 design-language.md + section-patterns + image manifest = **design layer**
- OD 一次生成 · 锁定的是设计 · 自由的是 content adaptation

这跟"做 AI 该做的事"是反的: AI 该做的是 **content → layout instance** · 不是 **invent design system from scratch**。后者它做不好 (这正是我们见过的不稳定) · 前者它擅长。

### Q2 "4 个够吗？"

够开始 · 不够长期。但这不是 round 1 的问题。

round 1 验证的是 **handoff schema 本身**:
- 4 families × 3 真 roofing 客户 (master.md 已有) = **12 个真客户网站**
- 检查: 同一 family 在 3 客户上 · 设计稳定吗？(应该稳 · 因为 design layer 锁了)
- 检查: 同一客户在 4 families 上 · 文案+架构合理吗？(content adaptation 是 OD 强项)
- 检查: 真客户哪些 family 更搭？(给操作员经验值)

如果 schema 跑得通 · 后期加 family (商业屋顶 / 太阳能屋顶 / 紧急修复...) 是**线性扩**不是重做。
如果 schema 跑不通 · 加 family 也救不了。

→ **不在 family 数量上烧时间** · 在 handoff schema 上烧。

### Q3 "OD 跨 family 组合模块好看吗？要不要建素材库？"

**别让 OD 跨 family 组合**。理由两条:

1. design-language 是个**整体** · "深绿衬里 + 黑橘大标题 + 米橘 CTA" 不会自洽 · OD 没那个判断
2. 真要素材库 · 等于我们替 AI 写 design 词典 · matthew 说对了 · 我们做了 AI 该做的事

正确做法: **per-customer · operator 看 audit + entity tag (商业/住宅/紧急/restoration) 自动建议 1 个 family** · OD 在这 1 个 family 内部做 content adaptation · 不跨。

→ family 选择 = rule (entity 标签 → family) · 不让 OD 选
→ family 内 = OD 全权 · 我们不微管理

### Q4 "文案呢？给什么 handoff 让 OD 一步到位？"

文案是当前最大的自由参数。现在 prompt 只说 "fill demo copy" · OD 写出来的就是它的 base 训练分布 · 千篇一律 "Your trusted partner / Quality you can count on"。

handoff 该给 OD 的 **文案侧 5 个东西**:

1. **业主自己说的话** (来自 GMB description + 真网站 about 抓取 · master.md 第 X 段) · 让 OD 改写不创作
2. **客户评价的具体词** (来自 reviews 8-10 条 · "fixed our leak in 2 hours" 这种短语提取) · trust section 直接用
3. **audit 发现的痛点 → CTA 角度** (e.g. audit 说 "现网站电话不显眼" → CTA 文案 angle = "屋顶问题别等 · 现在打 [电话]")
4. **niche-specific tone profile** (roofing = direct + practical + urgency 适度 · 不是 SaaS 的 polish · 不是 restaurant 的 warmth)
5. **anti-template 黑名单** (现在有 anti-slop · 加 anti-template: "trusted partner" / "your roof deserves better" / "X years of excellence" 等具体短语 ban)

OD 拿到这 5 件 · 文案是**重组真材料** · 不是**生成 generic copy**。

---

## 3. 提议的 handoff schema · `od-handoff-v3.json`

不是新文件类型 · 是把 `website-build-handoff.js` 输出 enrich:

```jsonc
{
  "schemaVersion": 3,
  "clientSlug": "brisbane-roof-restoration-experts",

  // === CONTENT LAYER (来自 master.md · M2 已建) ===
  "content": {
    "business": { /* 现有 */ },
    "verifiedFacts": { /* 现有 · 不动 */ },
    "ownerVoice": {                       // 🆕
      "fromGmbDescription": "...",        // 业主自己写的 1-2 段
      "fromCurrentSite": "...",           // 如有现网 · 抓 about 段
      "rule": "rewrite for clarity · do not invent · cite source line"
    },
    "reviewVoice": [                      // 🆕 8-10 条评价提取
      { "quote": "fixed our leak in 2 hours", "source": "google", "useFor": "trust" },
      { "quote": "showed up on time · explained everything", "source": "google", "useFor": "trust" }
    ],
    "auditPainPoints": [                  // 🆕 audit findings → CTA angle
      { "issue": "电话埋在 footer", "ctaAngle": "make tel: sticky · top hero · big" },
      { "issue": "无 service area · 不知道是否覆盖", "ctaAngle": "hero 副标 list 3 suburbs" }
    ]
  },

  // === DESIGN LAYER (来自 chosen family) ===
  "design": {
    "familyId": "classic-premium-roftix",  // 🆕 rule-picked · 不让 OD 选
    "designLanguagePath": "templates/roofing/families/classic-premium-roftix/design-language.md",
    "sectionPatternsPath": ".../section-patterns.json",
    "selectedImagesPath": ".../template-manifest.json#/selectedImages",
    "anchor": "cinematic roof hero · editorial serif headings · practical service grid",
    "rule": "treat design-language.md as immutable · do not invent new tokens"
  },

  // === COPY GUARDRAILS ===
  "copy": {
    "tone": "direct · practical · local · urgency-where-real",  // 🆕 niche-specific
    "antiTemplatePhrases": [                                   // 🆕 具体短语 ban
      "trusted partner", "your roof deserves better",
      "X years of excellence", "quality you can count on",
      "welcome to", "we are committed"
    ],
    "lengthBudget": { "heroH1": "<=10 words", "heroSubhead": "<=22 words", "serviceCard": "<=35 words" },
    "rule": "every customer-facing string must trace to ownerVoice / reviewVoice / verifiedFacts · or be a structural template line (nav / footer / form label)"
  },

  // === STRUCTURE ===
  "pages": [                              // 现有 · 但加 sectionInstance recipe
    {
      "path": "/",
      "sections": [
        { "key": "hero", "recipe": "section-patterns.json#/hero/premium" },
        { "key": "services", "recipe": ".../services/grid-6" },
        ...
      ]
    }
  ],

  // === BANNER (M3 sales overlay · 唯一新增 component) ===
  "auditBanner": {                        // 🆕
    "enabled": true,
    "placement": "below-hero · dismissable",
    "content": {
      "title": "你现在的网站 vs 这个 demo",
      "bullets": [ /* 3-5 条 audit 发现 + 对照 */ ],
      "cta": "约 15 分钟 · 看完整 audit"
    }
  },

  // === OUTPUT EXPECTATIONS ===
  "outputs": {
    "primary": "index.html (one-page)",
    "secondary": "optional pages/* for simple multi-page",
    "type": "auto",                       // family rule: classic-premium 倾向 multi-page · lead-capture 单页
    "assets": "use selectedImages from template-manifest · do not generate new images this round"
  }
}
```

prompt 渲染从~28 行 → ~60 行 · 但**所有自由参数都收口**。

---

## 4. Round 1 实验 · 12 个真客户 · 不是 288 variant

| 维度 | round 1 取值 |
|---|---|
| Family | 4 (rule-picked per entity · 不全跑) |
| 真客户 | 3 (master.md 已有 · brisbane-roof-restoration / gutter-and-roof-repairs / weatherproof-restorations) |
| 文案策略 | 1 (ownerVoice + reviewVoice + auditPainPoints) |
| Banner | 1 (always on · 用 audit) |
| 图片 | 1 (template selectedImages) |

= **3 × 1 (rule-picked family per customer) = 3 网站**? 不 · 第 1 轮我**故意跑 4 family × 3 客户 = 12 网站** · 看跨 family 哪个真跟 entity tag 对应得上 (验证 rule-picker 假设) · 之后 production 走 rule。

**Cost**: 12 × OD run ($1) + 12 × vision critic ($0.5) = **$18** · 一天跑完。

**判断 ≠ 我审美** · 跑 vision critic (10 条 rubric 仍用 · 但只评 final 输出 · 不在中间 sample 维度) · 加 1 个**新 metric**: copy-anti-template hit count (string match anti-list)。

**验证**:
- 同 family × 3 客户 · 设计稳定吗 (rubric 1-6 score 方差 < 1.5)
- 4 family × 同客户 · content adaptation 合理吗 (商家信息 100% 准确 · 0 hallucination)
- rule-picked family 是不是 vision critic top-1 (rule 验证)

如果都过 · handoff schema 锁。如果某条不过 · 知道在哪改 · 不烧 288。

---

## 5. 跟我昨晚 autoresearch 文档的差异

| 昨晚提的 | 现在改 |
|---|---|
| 288 variant · 5 维 smart sample | 12 真客户 · 1 schema · 跨 family 探 fit 不探 design |
| Vision critic 决定 winner family | rule-picker 决定 family · vision critic 验证 schema |
| Section / tone / image-source 维度 | 全砍 (collapsed 进 family) |
| 7-10 天 + 2 轮 + iterate | 2 天 round 1 · 跑得通直接 production |
| 文案问题没 explicit 解 | ownerVoice + reviewVoice + auditPainPoints + antiTemplate 5 件 |

→ 不是"探所有可能性" · 是"先把已经收敛的东西 lock down · 再看剩下什么真不稳定"。

---

## 6. 信心 · 风险

| 项 | 信心 | 风险 |
|---|---|---|
| 4 families 当 design contract 够稳 | 80% · OD 已对它们打 100 | 真客户 content 注入后会不会破设计 · 没数据 · round 1 才知 |
| ownerVoice/reviewVoice 让文案不 generic | 70% · 直觉对 · 但 OD 接受 quoted material vs 自由生成的反应没测 | round 1 第一指标 |
| rule-picker (entity tag → family) | 60% · 现在没 tag · 需要从 master.md 提 (商住 / 紧急 / 高端 / 商业) · 1 LLM 调用 | M2-D11 加这个 deliverable |
| 单页 vs 多页 family 决定 | 75% · classic-premium 倾向多页 · lead-capture 单页 · 这个我有信心 | — |
| Banner 不破设计 | 65% · 强 banner 跟某些 family 视觉冲突 (editorial-bold 黑底大字 + 米橘 banner 会乱) | round 1 看 · 必要时 per-family banner style |

整体: **75%** schema 跑得通。**90%** 比当前 prompt 稳。

---

## 7. 我要 Matthew 回什么

只要一件:

- **"开 round 1 · 12 真客户 · $18"** → 我 enrich handoff 到 schemaVersion 3 · 跑 12 个 · 出 report
- 或挑哪条不同意 (e.g. "ownerVoice 你以为 OD 会乖乖用 quote · 它不会 · 它会自己重写")
- 或问问题

不再发新方案文档 (这是第二次说) · 真要 code 了。

---

## 8. 我撤的 (诚实记录)

| 我之前主张 | 撤 · 因为 |
|---|---|
| 288 variant smart sample | 在没 lock down handoff schema 前跑维度探索 · 是 overengineering |
| Vision LLM 决定 winning family | family 选择该是 rule (entity tag) · vision 只验设计稳定 |
| autoresearch loop 是 round 1 主菜 | round 1 主菜是 handoff schema · loop 是后期当 schema 不稳时才上 |
| 文案问题 implicit 在 "tone" 维度 | 文案问题该 explicit 解 · 不能藏在 "warm vs urgent" 这种空话里 |

→ matthew 这次推的对。我钉 design + 砍维度。
