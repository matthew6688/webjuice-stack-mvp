# Data Sources & Provenance — THE one maintained reference

> **作用**: 一份文档说清整条数据链——我们用的**每个第三方工具**（多贵/多快、拿到什么数据）、这些数据**怎么用来筛客户**（排除 / 筛入），同名公司怎么**防歧义**，以及最终 **master.md 每个字段从哪个工具来的**（溯源）。
> **状态**: 2026-05-30 · 整合自 `TOOL-STACK-PRD.md`(D36 工具清单)、`LEAD-FILTERING-DESIGN.md`(cycle-23 筛选决定)、`LEAD-JOURNEY.md`、`SOP-PROVENANCE.md`，及实现代码。**取代**散落各处的工具/溯源记录。
> **维护规则**: 任何新增 provider / 改筛选门槛 / 改 master.md 字段来源 → 更新本文档（+ codex round）。
> **目录**: §1 成本分层 · §2 工具×数据×筛选 主表 · §3 筛选漏斗+filter-first 方案 · §4 同名歧义防护 · §5 master.md 溯源表 · §6 待落地

---

## §0 · 核心原则（Matthew 2026-05-30）
1. **筛选 > 打分**：冷线索数据薄，精确分是假精确。先用确定性闸砍掉"一眼不是"，只对幸存者按"价值 × 付费意愿"评估。（cycle-23 已定方向，旧 5 维 predict 分已删。）
2. **便宜的在前，贵的只给活下来的**：每个数据要么排除(kill)、要么筛入/评估价值(rank)。撒大网→廉价闸快过→只对幸存者花贵的。
3. **两条路**：无网站 / 有网站，早期闸共用，价值评估不同。
4. **真实 ≠ 能付钱**：以前用"评论数"一指标兼任两职 → 误杀小客户。彻底拆开（§3）。

---

## §1 · 成本/速度分层（源自 TOOL-STACK-PRD.md D36 + 实测更正）

| Tier | 含义 | 工具（数据相关） |
|---|---|---|
| **T0** | 免费 / 本地 / 一次付清 | **gosom docker maps scraper** · **Playwright**(慢 45-90s) · **Ollama** 本地LLM/vision · **DDG search** · **本地牌照库 SQLite(42万条·瞬时)** · **Wayback API** |
| **T1** | 订阅(已付·按token记) | **Claude CLI** · **Codex CLI** · **ABR ABN**(官方免费webservice·需免费GUID) · **WHOIS/RDAP** · **PageSpeed**(免费25k/天) |
| **T2** | 计量付费(月度quota) | **Google Places API**(~$0.017/req·11k/月/key) · **Tinyfish**(见下更正) · **Firecrawl**($20/mo兜底) · **Cloudinary** |
| **T3** | 高单价(少用) | **Perplexity**(深度autoresearch) · Kimi/Gemini(备用) |

### ⚠️ 两处实测更正（覆盖旧文档）
- **Tinyfish = 免费 · 限流**：`search` 和 `fetch` **都免费**，只受 30 次/分 的本地令牌桶限流（`TINYFISH_RATE_PER_MIN`）。不是"额度用完"。所以它是免费主力，约束是**吞吐**不是**钱**——批量时注意排队。
- **牌照核验 = T0 本地库**：不是各州网查，是一个 **201MB / 422,815 行的本地 SQLite**（`data/licenses/_index.sqlite`），瞬时、免费、无限流。覆盖 **QLD(QBCC) 195,762 · NSW(FairTrading) 178,901 · VIC(VBA) 48,152**（WA/SA/TAS/ACT/NT 暂无）。带 `status`（active 41.7万 / inactive 5,472）、licence_class、牌照号、ABN/ACN、address。模块 `core/enrichment/license-lookup.js`，多级匹配(ABN精确→名字精确→token前缀→FTS模糊)。**目前没接进筛选**（缺口，§6）。

---

## §2 · 主表：工具 × 拿到的数据 × 怎么筛

| 工具 (tier) | 拿到的数据 | 用来**排除**(kill) | 用来**筛入/评价值**(rank) |
|---|---|---|---|
| **docker maps scraper** (T0·免费快·批量) | name·category·phone·website(有/无/第三方)·rating·review_count·address·place_id/cid·图片数 | 名含test/demo→假；电话+网址全空→待enrich/不可达；类目gov/school/竞品→非目标 | **有无网站**(无=高价值)；rating/reviews=**付费力**(不当真伪门槛,§3)；图片数=活跃度 |
| **本地牌照库 SQLite** (T0·免费·瞬时) | license status(active/inactive)·牌照号·发证机构·licence_class·abn/acn·address | **高置信匹配(ABN/名字精确)+inactive→砍**(§4 防误杀) | **license active = "真生意"主信号**(替代评论数)；class对得上行业=强正信号；牌照号→**存给建站做真背书** |
| **ABR ABN** (T1·官方免费) | ABN·实体类型·注册状态·名称匹配·相似分(0-100) | ABN查不到/名称对不上→疑似假→砍(红线:不给假生意建站) | ABN active=真实在营(全国覆盖,补上牌照库的5州空缺) |
| **GBP / Place API** (T2·**付费**$0.017) | business_status·认领与否·hours·全类目·更多照片·editorial summary·price_level·评论文本 | **business_status≠OPERATIONAL→死/停业砍**；类目≥5→太杂 | 认领GBP/price_level/评论文本=付费意愿+真实活跃 |
| **Tinyfish search** (T2·免费限流) | 外部提及·社媒·公司踪迹(经AU过滤) | 全网无踪迹+联系方式空→已消失 | 找补联系方式；佐证在营 |
| **Tinyfish fetch** (T2·免费限流) | 首页markdown·社媒链接·CTA/电话/本地词是否出现 | (有网站)第三方页且不可达→待enrich | **有网站廉价快扫**:缺HTTPS/无手机viewport/无CTA/无首屏电话/内容薄/年份旧→**问题大小=价值** |
| **DDG search** (T0·免费) | 公司提及·搜索结果 | 搜不到+不可达→消失 | 联系方式找补 |
| **Playwright 全爬** (T0·**慢**) | 完整HTML·截图·tech-stack·表单·sitemap·活跃信号 | **sitemap>200页/电商/会员门户/第三方预订→做不了砍** | 深度问题清单(critical/major)=价值；tech复杂度=客单价分层 |
| **PageSpeed** (T1·免费25k/天) | CWV/FCP/LCP/移动分·CRUX真实用户数据 | — | 速度/移动分差=**业主看得见**的硬问题(高价值) |
| **WHOIS/RDAP** (T1) | 域名年限·最近改版信号·DNS | **最近12月刚改版→刚投钱,短期不做,砍** | 老域名+老站=该翻新 |
| **视觉审核** (T0 Ollama/T1 Claude) | 视觉新旧分·设计问题 | — | "看着旧/丑"=业主最有感(高价值) |
| **niche LLM judge** (T1·便宜) | 是否本行业·置信分 | 判非本niche→砍 | — |

---

## §3 · 筛选漏斗(最便宜在前) + filter-first 方案

```
Stage 1 · 真实+可达闸(全T0免费瞬时·对所有线索)
   docker字段 · GBP business_status · 名字正则 · 本地牌照库 · niche判断
Stage 2 · 免费限流(对过了Stage1的)
   tinyfish search+fetch · DDG · ABR ABN
Stage 3 · 付费/慢(只对合格的)
   Place API详情 · Playwright全爬 · PageSpeed · 视觉 · master.md
```

### A · "真实+可达"四闸（取代"评论数当真伪"）
线索要活下来必须过：① 在营(business_status) ② 可达(电话/邮箱,搜不到→砍) ③ **是真生意**(牌照active 或 ABN active,至少一个) ④ 不是假货(名字/踪迹)。
→ **评论数不再当真伪门槛**：3条评论+牌照在营+有电话的小工匠 = 黄金目标。

### B · 牌照淘汰闸（精确·低误杀,见§4）
高置信匹配(ABN/名字精确)+inactive→砍；模糊/查不到(尤其非3州)→不砍。inactive仅占1.3%,所以这道闸**砍得少**——主价值是 active 正信号 + 建站补真牌照号。

### C · "太大/做不了"砍闸（保留,放对位置）
评论数>行业上限(屋顶200)=规模闸(合理)；sitemap>200/类目≥5/电商/会员门户→要爬站才知道→**放Stage3**。

### D · 价值评估（排序,非闸）
- **无网站/第三方页**：价值天然高,按**付费意愿**排序(广告/认领GBP/活跃/price_level)。**不要求评论≥30**。
- **有网站**：价值=**业主看得见问题优先**(手机/联系/HTTPS/看着旧/搜不到) > 技术SEO。已够好(审核≥80)→丢。

### E · 4处标准调整(vs现状)
1. **评论数降级**:从真伪门槛→付费力信号(停止误杀小客户)。
2. **接牌照淘汰闸**:cancelled/expired→砍(已建库未接)。
3. **有网站价值按业主视角加权**。
4. **付费意愿显性化**(广告/认领/活跃)。

---

## §4 · 同名歧义防护（namesake — 别把别家公司补进来）

**问题**(Matthew): 搜索/补全时,名字一样但其实是美国/加拿大那家,或同名不同址 → 绝不能把别家资料补进客户档案。

### 现有防护（有,但不够）
| 防护 | 位置 | 强度 |
|---|---|---|
| 澳洲过滤(AU TLD + 州/城市文本) | `core/enrichment/tinyfish-summary.js` `filterAu()` | 中:能挡明显非AU,但US站提"Brisbane"会漏 |
| 牌照按州匹配 | `license-lookup.js:110/121/131` | 强(已知州时):防跨州同名 |
| ABR 城市→州 偏好 | `abr-abn.js:104` | 中:城市表不全(Toowoomba等没映射) |
| niche LLM判断 | `core/llm/match-judge.js` | 中:判行业相关,不判"是不是同一家" |
| 牌照模糊匹配niche排序 | `license-lookup.js:140` | 弱:多家同名时取第一个 |
| ABR相似分(0-100) | `abr-abn.js` | **未用**:拿到分但没设阈值 |

### ⚠️ 真缺口（namesake 能漏进来的地方）
1. **没有电话/地址交叉验证**(最强的那道防线缺失)——所有匹配只用 名字+州,从不验电话或地址。
2. **ABR相似分没设阈值**——弱匹配(分45-60)只要是唯一结果就采信。
3. **Tinyfish AU过滤太宽**——US站提到澳洲城市就过。
4. **多源不互校**——tinyfish/牌照/ABR 各跑各的,三个结果可能是三家不同公司,没有"最终同一家"闸。

### ✅ 方案（修法明确）
- **加"身份锚点"交叉验证**:任何 enrich 结果(牌照/ABN/外部提及)要被采信,必须与已知锚点(**电话 / 地址 / 州 / postcode**)对得上至少一项;对不上 → 标低置信、不写入 master.md 的"已核实"区。
- **ABR分设阈值**:相似分 <75 → 不自动采信(标 needs_review)。
- **最终"同一家"闸**:多源结果在写入前互校(名字归一化 + 电话/ABN/地址一致),不一致 → 记冲突、走人工。
- 这是 §6 待落地项,且应在"接牌照闸"之前/同时做(否则牌照模糊匹配会放大 namesake 风险)。

---

## §5 · master.md 数据溯源（深度建站阶段:每个字段从哪来）

> 所有工具的数据最终汇到 `master.md`。下表 = 字段/章节 → 来源工具 → 成本 → 真伪。
> 现状: 无中心溯源文档,代码内散落 `[ABR]/[License]/[WHOIS]/[Wayback]/[搜索]/[官网]/[derived]` 标签(`master-md-builder.js`)。本表即中心化。

| master.md 字段/章节 | 来源工具 | Tier | 真伪 |
|---|---|---|---|
| business_name / city / address | Places API 或 docker scraper | T0-T2 | verified |
| niche | GBP类目/搜索词归一 | T0 | inferred(类目兜底) |
| rating / review_count | Places API(官方) 或 docker scraper | T0-T2 | verified |
| website / websiteStatus | Places/scraper | T0-T1 | verified |
| **公司注册(ABR)** abn/实体类型 | `core/enrichment/abr-abn.js` (ABR) | T1 | verified(ABR权威) |
| **行业执照** status/号/机构/class | `core/enrichment/license-lookup.js` (本地SQLite) | T0 | verified(库匹配) |
| **域名历史** 年限/wayback/DNS | WHOIS/RDAP + Wayback API | T0-T1 | verified |
| audit_score / decision / issues(critical/major) | detailedAudit(Playwright+PageSpeed+DOM规则) | T2 | verified |
| fired_triggers | DOM规则引擎 | 内部 | verified |
| visual_age/freshness/trust/conversion | Ollama/Claude vision | T0/T1 | **ai_inferred** |
| review themes / quotable / redesign_hooks | 评论(docker全量/Places≤5)+LLM分析 | T2-T3 | verified(原文)+ai_inferred(主题) |
| PageSpeed mobile/desktop/CRUX | Google PSI(免费) | T1 | verified(真实用户数据) |
| 图片优化 / 第三方脚本 / 表单审计 | Playwright + DOM/网络分析 | T2 | verified |
| sitemap/迁移复杂度 | sitemap.xml解析+启发式 | T1 | verified(sitemap权威)+inferred(分类) |
| 运营活跃度(blog/social/freshness) | Wayback+爬取+正则 | T0-T1 | inferred(启发式) |
| tech栈(cms/analytics/pixels/hosting) | Playwright JS检测+正则库 | T1 | verified(DOM证据)或inferred |
| 信任凭证(trust signals) | ABN/牌照 + 页面正则 | T0-T1 | verified(ABN/牌照)或inferred(页面) |
| AI可发现性(schema/JSON-LD) | 12点清单DOM检查 | T1 | verified(规则命中) |
| 业务规模信号(tier) | 启发式(评论+页数+trackers) | T0-T1 | inferred |
| 商户照片 | Places API(photo_ref→下载) | T1 | verified(GMB上传) |
| logo/品牌色字 | 站点logo提取+品牌分析 | T2 | verified(提取)+inferred(CSS分析) |
| 截图/录屏/证据图 | Playwright截图/录屏 | T2 | verified(真实捕获) |
| 建站准备度(checkpoint) | `pl:data-checkpoint` | 内部 | verified |
| 已建站质量分(audit-v4) | `pl:audit-v4` | T2 | verified(建后审核) |
| 内容就位度(hero/services/about) | compose输入文件扫描 | T2 | verified(文件存在+解析) |

**真伪分层(SOP-PROVENANCE)**: `verified`(官方/DOM证据) > `geo_derived`(地理推导) > `ai_inferred`(LLM判断) > `demo_placeholder`(占位,待客户改)。master.md 已按 `[来源]` 标签标注;建议把"verified vs inferred"做成机器可读字段(§6)。

---

## §6 · 落地方案（codex Round 116 已裁决 · 2026-05-30）

### SSOT — 三个独立写者，职责不重叠（codex 锁定）
- **`exclusion-filter.js`** = 早期"不是真目标"淘汰的**唯一写者**（不另开并行筛选器）。
- **`lead-grading.js`** = 审核后的投资决策（D 级 skip）。
- **`core/enrichment/identity-match.js`（新建）** = enrichment 置信/溯源，**不做任何终局决策**。每个 enrichment adapter 只产出 candidates；identity-match 只把**过了锚点**的 candidate 提升为 canonical（`entity.enrichment.*` / `entity.license`）；低置信的 park 到 candidates/review，**绝不当 verified 渲染**。
  - codex note：`scripts/cli/pl-license-lookup.js` 已有"弱匹配 park 而非 canonical"的更优写回逻辑 → **提升到共享 enrichment 代码**，别留 CLI-only。

### 落地顺序（codex 裁决：身份锚点必须在数据路径上先生效）
1. **身份锚点守卫 `identity-match.js`（先做）**：任何 enrich 结果要成 verified，必须命中**至少一个硬锚点**——phone / ABN / 完整地址 / postcode+state / 精确域名或首页证据。**单独 state 太弱**，只能当辅助（除非配 postcode/suburb）。ABR 相似分 <75 → needs_review。多源冲突（同名但 phone/address/ABN 不一致）→ **记日志 + 阻止 canonical 写入**。
2. **接牌照库**（消费**已锚点核实**的牌照结果）：
   - `abn_exact + inactive + DB 新鲜` → 可 auto-kill。
   - `name_exact + inactive` → **不**自动杀，除非锚点过且候选不歧义。
   - `token_prefix / fts_fuzzy / not_found` → **永不杀**。
   - ABR-active 与 牌照-inactive 冲突 → needs_review（除非 ABN 精确且该 niche 强制持牌）。
   - `active` + class 对得上 → 真目标正信号 + 存真牌照号给建站。
3. **评论数降级**（与 #2 配对）：真伪改用 license-active/ABN-active/近期活跃 + 可达；review_count 只留作付费/规模信号（`>niche_max` 仍是规模闸）。**先在 ~240 实体跑回归 diff**（原 too_few_reviews 砍掉的 / 现在靠 license·ABN·活跃·可达 放进的 / 新引入的误放 / 找回的无网站小客户），**review 过再上线**。
4. 有网站价值按业主视角加权（§3 E-3）。
5. 付费意愿显性化（§3 E-4）。
6. master.md **只把 verified 身份事实当信任背书渲染**；溯源做成机器可读（verified/inferred 字段 + 冲突日志）。

### 牌照库新鲜度（codex 规则 · 杀闸必须带 freshness metadata）
导入器必须写入 import 时间戳。无时间戳 → inactive 只当 advisory。
- **≤30 天**：inactive 可杀（严格匹配下）。
- **31–90 天**：needs_review，不杀。
- **>90 天 / 未知**：仅 advisory。
- 刷新：至少月度，能自动化则周度。

### 覆盖空缺
WA/SA/TAS/ACT/NT 牌照查询结果 = `coverage_unavailable`（**不是 `not_found`**，不扣分），用 ABR 全国兜底。
