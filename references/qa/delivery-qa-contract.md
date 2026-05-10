# Delivery QA Contract

Delivery QA 决定一个 dev preview 是否已经安全到可以发给客户 review。

它和 Ready-to-Build 不是一回事：

```text
Ready-to-Build：我们是否已经有足够准确的输入，可以开始做站？
Delivery QA：这个做完的 dev preview，是否符合交付给客户 review 的标准？
```

## 必须产出的报告

写入：

```text
data/cases/<client>/<order>/delivery-qa.json
```

## 必须覆盖的检查区块

### 1. Business Data

下面这些如果公开展示，错误或未核实都属于硬 blocker：

- business name
- address 或 service area
- phone
- email（如果展示）
- official website URL
- Google Maps URL
- reservation / contact / order URL
- hours（如果展示）
- menu item names / prices（如果展示）
- license / warranty / trust claims（如果展示）

### 2. Niche Completeness

Restaurant：

- reservation/contact CTA
- 有 logo 就尽量用真实 logo
- 有真实菜品/门店照片就优先用真实照片
- menu route 只有在有真实 menu evidence 或客户明确需要时才保留

Roofing：

- service area
- estimate/contact CTA
- service list
- trust proof
- license/warranty 必须有 evidence

### 3. Design

检查：

- 看起来像正式官网，而不是信息拼贴页
- 有品牌资产时要尊重品牌颜色/标识
- 层级、构图、节奏清楚
- mobile 版结构合理
- 不能是 generic AI layout
- preview sales footer/bottom banner 必须和客户正文内容分离
- 如果存在 menu route，视觉和结构上要和正式官网 route 区分开

Open Design 可以作为主要的设计评审系统。Huashu 可以作为审美词汇，但不要重复整套设计体系。

### 4. Copywriting

检查：

- H1 具体，不空泛
- CTA 清楚
- 不造假
- 不使用 generic slogan
- 基本 local SEO 信息存在
- 文案和 niche / customer evidence 对得上

### 5. Technical

检查：

- build 通过
- dev preview URL 可访问
- 电话链接使用 `tel:`
- 邮箱链接存在时使用 `mailto:`
- 地图链接打开 Google Maps
- form 能正确提交或 dispatch
- 没有明显 console error
- 没有 mobile 横向溢出
- 重要链接没有双斜杠

### 6. Customer Communication

检查：

- review email 所需变量存在
- approve URL 存在
- revise URL 存在
- domain setup URL 存在
- order ID 和 customer email 与 case/order 一致
- approve / revise / domain setup 必须指向官方 `https://profitslocal.com/...` 页面，而不是客户 repo 本地 funnel 页面

## 最终判定

只有下面都满足时，才可以写：

```json
{
  "readyForCustomerReview": true
}
```

判定条件：

- business data 没有 blockers；
- niche 必需字段通过；
- technical checks 通过；
- design / copywriting 没有 major fail；
- customer communication 链接完整，而且走官方 funnel。
