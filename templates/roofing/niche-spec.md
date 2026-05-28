# Niche Spec · Roofing Contractor (Australia)

> **Owner**: SOP-3 · cross-family · cross-customer reusable
> **Used by**: copy generation prompts · content validator · audit-fix verifier
> **Source**: profitslocal-roofer-prd.md §5.1 + §11

---

## 1. 行业背景

- **目标客户**: 屋主 (homeowner) · 物业经理 · 建筑商 (builder · for new builds)
- **核心决策因素**: 信任（执照 / 年限 / 保障）> 价格 > 速度
- **客单价**: $5,000–$30,000+
- **决策周期**: 3–14 天
- **比价**: 通常 2–3 家
- **核心痛点**:
  - 担心工人无执照
  - 担心拖延
  - 担心收款后消失
  - 担心结果不达标 / 漏水返工

---

## 2. State → Licensing Authority Map (LOCKED · 必须验证)

⚠️ **Fact-check rule**: 任何提到 license / regulator / authority 的文案必须使用客户**真实所在州**的机构。LLM 不得跨州混用（最常见错误：VIC 客户用了 QBCC · QBCC 是 QLD only）。

| State | Code | 屋顶执照监管机构 | 强制注册必要性 |
|---|---|---|---|
| Queensland | QLD | **QBCC** (Queensland Building and Construction Commission) · roof cladding subclass | 必须 · $3300+ 工程 |
| Victoria | VIC | **VBA** (Victorian Building Authority) · DB-L Roofing | 必须 · $10K+ 工程 |
| New South Wales | NSW | **NSW Fair Trading** · home building license | 必须 · $5K+ 工程 |
| Western Australia | WA | **DMIRS** (Department of Mines, Industry Regulation and Safety) | 必须 · 注册 builder/contractor |
| South Australia | SA | **CBS** (Consumer and Business Services) · building work contractor | 必须 |
| Tasmania | TAS | **CBOS** (Consumer Building and Occupational Services) | 必须 · $20K+ |
| ACT | ACT | **Access Canberra** · building services | 必须 |
| Northern Territory | NT | **NT Building Practitioners Board** | 必须 |

**Prompt 注入规则**：每次生成 license/trust copy 时，先从 `core-facts.state` 读州码 · 再从此表查机构 · 注入 prompt context "License authority for {state} = {authority}".

---

## 3. 必须包含的信任信号 (Trust Signals)

按 priority 排序 · 至少 top 4 出现在首页 hero / trust strip：

1. **州政府执照** (per §2 map · LOCKED) — **首屏必须出现**
2. **保险信息** (Public Liability Insurance · 推荐 $20M)
3. **品牌认证** (Colorbond® · BlueScope · Boral · Monier · Stratco)
4. **工程保障年限** (workmanship warranty · 5y / 10y / 20y)
5. **Google 评分 + 真实评论数** (≥ 3 条评论 surface)
6. **服务年限** ("X years serving [City]" · 优先 ≥ 5y)
7. **Before/After 工程图片** (gallery section)
8. **ABN** (Australian Business Number · footer)
9. **HIA / Master Builders 会员**（如有）

---

## 4. SEO 关键词策略

### 主关键词（必须 H1/H2 出现 ≥ 1 次）
- `[city] roofing contractor`
- `roof repair [city]`
- `roof replacement [city]`

### 次关键词（H2/body 出现 ≥ 2 次）
- `metal roofing`
- `colorbond roof / colorbond roofing`
- `gutter replacement`
- `tile roof restoration` (如适用)

### 长尾词（service-area pages · 每页 1 个）
- `emergency roof repair [city]`
- `cost of roof replacement [city]`
- `roof replacement [suburb-name]` × N suburbs

### 禁用词（zero tolerance · 出现即 FAIL）
- "best roofing" (无本地化)
- "quality service" (空洞)
- "Welcome to" (套话)
- "Your trusted [partner / roofing experts]"
- "X years of excellence"
- "second to none"
- "we pride ourselves"
- "committed to excellence"
- "high quality service"
- "best in class"
- "industry-leading"
- "innovative solutions"
- "tailored to your needs"

---

## 5. 文案规则 (所有 block 通用)

### 主语视角
- ✅ 用 **"your roof"** / "your home" / "your property"
- ❌ 不用 "our service" / "our team" / "we are"

### 禁用空洞自吹词
- ❌ quality · professional · experienced · committed · excellence · passionate · dedicated
- ✅ 用具体数字 / 执照号 / 真实评论 / 品牌名 替代

### 句子结构
- 段落 ≤ 3 句（移动端优先）
- 每个 H2 必须包含**地名**或**核心服务关键词**之一
- CTA ≤ 5 词

### CTA 风格（第一人称 vs 第三人称）
- ✅ **"Get My Free Quote"** (第一人称 · 用户视角)
- ❌ **"Get a Quote"** (中性 · 弱)
- ✅ **"Book My Roof Inspection"**
- ✅ **"Call [phone]"** (直接 tel:)

### 信任表达
- 不说 "trusted"，说具体证据
  - ❌ "trusted local roofer"
  - ✅ "VBA Licensed · 18 reviews · 4.1★ · 20+ years in Ballarat"

---

## 6. Block 必须项（每页最少）

### 所有页（home + service + service-area + about + contact）
- 一个 `<h1>` 唯一 · 含地名或服务词
- 一个**首屏 CTA**（phone tel: link 或 quote 按钮）· 必须在前 1500 chars
- LocalBusiness JSON-LD schema · 含 phone + address + rating
- footer 含 phone tel link + address + ABN

### Home 页特定
- Hero · h1 + sub + 2 CTA + hero image
- Trust strip · 5 items (per §3 trust signals)
- Services grid · 3-5 cards
- Why us · 4 differentiators (≥ 1 含具体数字)
- Testimonials · ≥ 3 real (or "[from Google reviews]" labeled)
- Service areas · suburb list + SEO paragraph
- Final CTA · phone + quote form

### Service 页特定
- Service hero · 含服务名 + 城市
- Service detail · 流程 / 材料 / 工期 / 保障
- Process · 4 steps (PRD §5.3 lock: Free Inspection → Written Quote → Installation → Final Inspection)
- FAQ · 6 mandatory topics（见 §7）
- Cross-sell · 链接到其他 service pages

### Service-area 页特定
- Local hero · "Roofing in [suburb]" · 含距离 / 服务半径
- Local content · suburb-specific paragraph (80-120 words · 主城市 + suburb 2+ 次)
- Nearby areas · 链接到附近 suburbs
- Service highlight · 本 suburb 常见服务

### About 页特定
- Owner story / 公司历史
- Trust stats · 服务区 / 评分 / 年限
- Certifications · 执照 / 保险 / 品牌认证

### Contact 页特定
- Quote form (必含 name · phone · suburb · service · message)
- Map embed (Google Maps cid 或 address)
- Phone tel link 大字
- Business hours
- Address

---

## 7. Mandatory FAQ Topics (PRD §5.3 B-FAQ · 6 questions)

每个 roofer 网站必须包含这 6 个 FAQ topic（措辞可调整 · 但话题不可缺）:

1. **价格 / 报价范围**
   - Question: "How much does roof replacement cost in [city]?"
   - Answer: 必须给具体**价格范围**（如 $8,000–$25,000）· 不得只说"联系我们获取报价"
   - 价格区间因 area 调整（如 Brisbane $10k-$30k · 偏远地区 $8k-$20k）

2. **执照**
   - Question: "Are you licensed to do roofing in [state]?"
   - Answer: 必须提及具体州监管机构 (per §2 map) · 不得编造执照号

3. **免费报价**
   - Question: "Do you offer free quotes?"
   - Answer: Yes + 时间承诺（"24/48 hours"）

4. **工期**
   - Question: "How long does a roof replacement take?"
   - Answer: 具体天数范围（"3-7 days for standard residential"）

5. **保障**
   - Question: "What warranty do you offer?"
   - Answer: 具体年限（"10-year workmanship + 25-year material from BlueScope Colorbond"）

6. **材料**
   - Question: "What roofing materials do you use?"
   - Answer: 具体品牌（Colorbond / BlueScope / Boral / Monier）· 不得只说"premium materials"

---

## 8. 图片使用规范

### 优先级
1. 客户自己的项目照片（Phase B5 verified scrape）
2. Google Business Profile 照片
3. AI 生成或 stock（最后选择 · 必须标注）

### 禁用
- ❌ Generic "happy crew handshake" stock
- ❌ Purple gradient backgrounds
- ❌ Generic "construction worker thumbs up"
- ❌ AI-generated photo-realistic faces

### Hero 图建议
- ✅ Drone shot of completed roof
- ✅ Worker on roof (mid-action · 不是 pose)
- ✅ Before-after split image
- ✅ Material close-up (Colorbond profile · gutter detail)

---

## 9. Verification Checklist (Validator 用)

每页生成后跑过：

- [ ] LOCKED facts verbatim: business_name · phone · phone_tel_link · address · city · rating
- [ ] State authority 正确 (VIC=VBA · QLD=QBCC · etc. per §2 map)
- [ ] License 号未编造（除非 master_record.license_number 已 verified）
- [ ] H1 唯一 · 含城市或服务词
- [ ] Trust strip 含 ≥ 4 signals (per §3)
- [ ] CTA ≤ 5 词
- [ ] 段落 ≤ 3 句
- [ ] 禁用词 0 出现 (per §4)
- [ ] 第一人称 CTA / 用户视角主语
- [ ] FAQ 含 6 mandatory topics (per §7)
- [ ] LocalBusiness JSON-LD valid
- [ ] tel: link 存在
- [ ] 图片符合 §8 优先级

---

## 10. Cross-niche extensibility

此 niche-spec 模式可复用至其他 niche（plumber / electrician / painter）:

| 替换项 | 复用率 |
|---|---|
| §2 State authority map | **100% 复用**（建筑业共享）|
| §3 Trust signals | 70% 复用（license + insurance + warranty 通用） |
| §4 SEO keywords | 30% 复用（替换主关键词） |
| §5 文案规则 | 90% 复用（通用 trade tone） |
| §6 Block 必须项 | 80% 复用（结构通用） |
| §7 Mandatory FAQ | 40% 复用（价格 / 工期 / 保障通用 · 具体内容换） |
| §8 图片规范 | 80% 复用 |
| §9 Validator | 100% 复用 |

每个新 niche 只需重写 §1-§4 即可。
