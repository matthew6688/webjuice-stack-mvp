# Lead Screening · Data Sources × Cost × Filter Map

> **作用**: 一张表说清——我们筛客户用到的**每个第三方工具**、它**多贵/多快**、能**拿到什么数据**、每个数据**怎么用来筛**（① 排除非目标 / ② 筛入并评估价值）。
> **状态**: 2026-05-30 · 按"筛选优先（filter-first）"新思路重新整理。整合自 `TOOL-STACK-PRD.md`(D36 工具清单)、`LEAD-FILTERING-DESIGN.md`(cycle-23 筛选决定)、`LEAD-JOURNEY.md`、实现代码 (`core/leads/*`, `core/scoring/*`, `core/enrichment/*`)。
> **owner**: 任何新增 provider / 改筛选门槛 → 更新本文档 + codex round。

---

## 0 · 核心原则（Matthew 2026-05-30）

1. **筛选 > 打分**。冷线索数据薄，给个 0-100 的精确分是"假精确"，是在给噪音打分。用**确定性闸门**先把"一眼不是"的砍掉；只对**活下来的**再按"价值 × 付费意愿"评估。
   （这其实是 cycle-23 已定方向：`LEAD-FILTERING-DESIGN.md` 原话"先排除明显不是我们客户的 · 剩下的都进 audit · 不再分级"。旧的 5 维 predict 分已删。本文档是在这基础上**重排工具+数据+门槛**。）
2. **便宜的在前，贵的只给活下来的**。每个数据要么**排除**(kill)、要么**筛入/评估价值**(rank)。撒大网 → 廉价闸快速过滤 → 只对幸存者花贵的（Place API 付费、Playwright 慢、深度审核）。
3. **两条路**：无网站 / 有网站，早期闸共用，价值评估不同（见 §4）。

---

## 1 · 成本/速度分层（源自 TOOL-STACK-PRD.md D36）

| Tier | 含义 | 工具（筛选相关） |
|---|---|---|
| **T0** | 免费 / 本地 / 一次付清 | gosom **docker maps scraper**、**Playwright**(慢)、**Ollama** 本地LLM/vision、**DDG search**、**ABR ABN 核验**(官方免费 webservice)、各州**牌照注册局**网查(免费但分散) |
| **T1** | 订阅（已付，按 token 记） | **Claude CLI**、**Codex CLI**（LLM 判断：niche 相关性、文案、视觉兜底） |
| **T2** | 计量付费（月度 quota） | **Google Places API**(~$0.017/req · 11k/月/key)、**PageSpeed**(免费 25k/天)、**Tinyfish**(免费额度·近用完)、**Firecrawl**($20/mo 兜底)、**WHOIS/domain-history** |
| **T3** | 高单价（少用） | **Perplexity**(深度 autoresearch)、Kimi/Gemini(备用) |

> ⚠️ 注意两个"看着免费其实有坑"的：**Tinyfish** 免费额度近用完（PRD D36 注），**Place API** 是真付费（$0.017/req）。所以"快速免费"主力其实是 **docker scraper + DDG search + ABR**；Tinyfish 当**单页抓取**用要省着。

---

## 2 · 筛选漏斗（最便宜的在最前）+ 每阶段用哪些工具

```
Stage 0 · 发现(批量·免费)        docker maps scraper → 基础 GBP 数据(名/类目/电话/网址/星级/评论数/地址/图片数)
   │  ↓ 廉价确定性闸(T0·$0)
Stage 1 · 真实性/可达性闸          GBP business_status · 联系方式 · 名字假货正则 · ABR ABN 核验 · 牌照状态 · niche 正则
   │  ↓ 分流: 无网站 / 有网站 / 第三方页
Stage 2 · 廉价网页信号(T0/免费额度)  无网站→直接 starter；有网站→Tinyfish 单页快扫(HTTPS?手机?联系方式?CTA?旧不旧?)
   │  ↓ 只对幸存者
Stage 3 · 贵/慢(按需付费)          Place API 详情(付费) · Playwright 全爬(慢) · PageSpeed · 视觉审核 · master.md
```

**省钱铁律**：牌照/ABN 核验便宜可早做；**Place API 详情、Playwright 全爬、深度审核**必须晚做（只给活下来的）。

---

## 3 · 主表：工具 × 拿到的数据 × 怎么筛

| 工具 (tier) | 拿到的数据 | 用来**排除**(kill) | 用来**筛入/评估价值**(rank) |
|---|---|---|---|
| **docker maps scraper** (T0·免费快·批量) | name · category · phone · website(有/无/第三方) · rating · review_count · address · place_id/cid · 图片数 | business 名含 test/demo → 假货；电话+网址全空 → 待 enrich/不可达；类目 gov/school/竞品 → 非目标 | **有无网站**(无=高价值)；rating/review_count 当**规模/付费**信号（**不当真实性硬门槛**，见 §5-#1）；图片数=活跃度 |
| **GBP / Place API** (T2·**付费** $0.017) | business_status(营业/停业) · 认领与否 · hours · 类目(全) · 更多照片 · editorial summary · price_level · 评论文本 | **business_status≠OPERATIONAL → 死/停业，砍**；类目数≥5 → 太杂 | 认领 GBP=在乎线上存在(付费意愿)；hours/照片/评论文本=真实活跃；price_level=客单价/付费力 |
| **ABR ABN 核验** (T0·官方免费) `core/enrichment/abr-abn.js` | ABN · 实体类型 · 注册状态 · 名称匹配 | **ABN 查不到 / 名称对不上 → 疑似假/没法 verify，砍**（Matthew 红线：不给假生意建站） | ABN active + 实体类型=真实在营生意（**"是不是目标"的真信号**，替代评论数当门槛） |
| **牌照注册局**(各州·免费) VBA(Vic)/QBCC(Qld)/NSW Fair Trading… | license 状态(active/cancelled/expired) · 牌照号 · 发证机构 | **牌照已注销/过期 → 砍**（Matthew 明确要的闸 · 见 §5-#2，目前疑似没接成淘汰闸） | 牌照 active = 合法在营 + 可在文案上做信任背书 |
| **DDG / web search** (T0·免费) | 公司提及 · 社媒 · 残留信息 | 搜不到任何踪迹 + 联系方式空 → 已消失 | 找补联系方式；佐证"还在营业" |
| **Tinyfish 单页抓取** (T2·免费额度近用完) | 首页 markdown · 社媒链接 · CTA/电话/本地词是否出现 | (有网站)第三方页且不可达 → 待 enrich | **有网站廉价快扫**：缺 HTTPS / 无手机 viewport / 无 CTA / 无首屏电话 / 内容太薄 / 年份过旧 → **问题大小=价值** |
| **Playwright 全爬** (T0·**慢** 45-90s) `core/audit/site-fetch-full.js` | 完整 HTML · 截图 · tech-stack · 表单检测 · sitemap · 活跃信号 | **sitemap>200 页 → 太大砍**；检测到电商/会员门户/第三方预订 → 做不了砍 | 深度问题清单(critical/major)=价值；tech 复杂度=客单价分层 |
| **PageSpeed** (T2·免费 25k/天) | CWV / FCP / LCP / 移动分 | — | 速度差/移动分低 = 业主看得见的硬问题(高价值，见 §5-#3) |
| **WHOIS / domain-history** (T2) | 域名注册年限 · 最近改版信号 | **最近 12 个月刚改版 → 刚投过钱，短期不会再做，砍** | 老域名+老站 = 该翻新 |
| **视觉审核** (T0 Ollama / T1 Claude) | 视觉新旧分 · 设计问题 | — | "看着旧/丑" = 业主最有感的问题(高价值) |
| **LLM niche judge** (T1·便宜) | 是否本行业 | 判定非本 niche → 砍 | — |

---

## 4 · 数据字段 → 筛选决策（排除 vs 筛入 的完整映射）

### ❌ 用来"排除"的信号（kill · 越早越便宜越好）
| 信号 | 来源(成本) | 判定 |
|---|---|---|
| business_status 停业/永久关闭 | docker/GBP (免费/付费) | 死 → 砍 |
| 联系方式全空（enrich 后仍无） | docker + DDG + Tinyfish (免费) | 不可达 → 砍 |
| 名字含 test/demo/sample | docker (免费) | 假货 → 砍 |
| **ABN 查不到 / 名称对不上** | ABR (官方免费) | 没法 verify → 砍 |
| **牌照已注销/过期** | 州注册局 (免费) | 不合法/不在营 → 砍 ⟵ **缺口，待接** |
| review_count > niche 上限(屋顶200) | docker (免费) | 太大/连锁 → 砍 |
| 类目 gov/school/charity/竞品(SEO/marketing) | docker (免费) | 非目标 → 砍 |
| sitemap > 200 页 / 类目≥5 | Playwright (慢·只对幸存者) | 太复杂做不了 → 砍 |
| 检测到电商/会员门户/第三方预订 | Playwright (慢) | 做不了 → 砍 |
| audit_score ≥ 80（网站已经够好） | 深度审核 | 加不了价值 → 砍 |
| 最近 12 月刚改版 / 已全外包运营 | WHOIS + tech 信号 | 不会买 → 砍 |

### ✅ 用来"筛入 + 评估价值"的信号（rank 幸存者）
| 信号 | 含义 |
|---|---|
| **无网站 / 只有第三方页 + 可达** | 最高价值（给他第一个真站）· 直接 starter |
| **audit 问题大小**（分越低 + critical/major 越多） | = 我们能加的价值（核心） |
| **业主看得见的问题**（手机坏/无联系/看着旧/搜不到） | 价值权重最高（见 §5-#3） |
| 牌照 active + 最近有评论/活动 | **"是不是真目标"的真信号**（替代评论数门槛） |
| 投 Google 广告 / 认领 GBP / 近期活跃 | **付费意愿**信号 |
| review_count / rating / price_level | 规模 + 付费力（用于**分层定价**，不当真实性硬门槛） |

---

## 5 · 与现有标准的 4 处调整（本次新思路 vs 现状）

> 现状门槛见 `core/leads/exclusion-filter.js` / `core/scoring/cheap-audit-v2.js` / `core/scoring/lead-grading.js`。

1. **评论数别一刀切**（最重要）。现状：<5 砍、A 级要 100、B 级要 30。但**无网站的小工匠评论本就少**（正因为小才没网站），用评论数当门槛=误杀黄金目标。
   → 改：**"是不是真目标"用「牌照 active + 最近活动 + 可达 + ABN 真」判定**；评论数/rating 只用于**付费力分层**，不当真实性硬闸。
2. **补上牌照淘汰闸**。Matthew 明确要"牌照注销→砍"，牌照查询又便宜。现状采集了 license.status 但**疑似没接成早期淘汰闸**。→ 在 Stage 1 加一道免费牌照状态闸（cancelled/expired → kill）。
3. **有网站的"价值"按业主视角加权**。39 条审核规则里一堆技术 SEO（JSON-LD/sitemap/LLMS.txt）业主看不见也不心疼。→ 价值排序**优先**：手机能不能看、客户能不能联系、看着旧不旧、Google 上找不找得到；技术 SEO 往后放。
4. **付费意愿显性化**。投广告/认领 GBP/近期活跃 = 舍得为营销花钱。现状只在定价层用了一点。→ 当成正经筛选维度。

---

## 6 · 待确认 / 给 codex 的问题
- **牌照状态的确切来源与覆盖**：各州注册局(VBA/QBCC/NSW…)哪些有可程序化的免费查？覆盖率多少？能否做成 Stage-1 早期闸（要快、要免费、要够准）。
- **Tinyfish 额度**：PRD 记"近用完"。若是，有网站的廉价单页快扫主力换成什么（Firecrawl 付费？DDG+轻抓？）。
- **评论数门槛改动的回归影响**：放宽后无网站小客户会多放进多少？需在现有 240 实体上跑一遍看漏斗变化。
- 本文档是否进 CANONICAL §0 作为"筛选数据源 SSOT"。
