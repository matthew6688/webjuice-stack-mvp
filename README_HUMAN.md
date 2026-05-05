# ProfitsLocal 是什么

ProfitsLocal 是一个帮本地餐厅快速拥有高质量网站和手机菜单的自动化系统。

它不是一个普通的网站模板，也不是单纯的 AI 生成页面。它更像一条小型流水线：先收集真实资料，再生成预览网站，再把预览发给潜在客户。客户付款后，系统会自动创建订单、记录修改次数、通知 AI agent 开工、发送邮件、等待客户确认，最后把网站上线到正式域名。

目前我们先只做餐厅。餐厅这个场景已经足够复杂：有 Google Maps 信息、官网、菜单 PDF、菜单图片、电话、地址、预约链接、照片、品牌风格、移动端菜单、付款、修改、上线和域名设置。把餐厅闭环跑顺以后，再扩展到其他行业会更稳。

## 我们卖的是什么

我们卖的是一个给本地餐厅的成品网站服务。

现在的定价是：

- 399 美元，一次性网站，包含 3 次修改。
- 799 美元一年，网站加每月维护。
- 100 美元，每次额外修改。

客户看到的不是后台，也不是代码。他们看到的是一个已经根据他们餐厅资料做好的 preview 网站。如果他们喜欢，可以直接在 preview 网站上购买。

## 为什么这个系统有价值

很多餐厅的线上展示很混乱：

- Google Maps 上有照片和地址，但没有正式网站。
- 有网站，但设计老、手机端难用。
- 菜单在 PDF、图片、社交媒体或第三方平台里，很难看。
- 电话、地址、预约链接不明显。
- 老板没有时间和设计师、开发者反复沟通。

ProfitsLocal 的价值是：我们先帮他们做出来一个能看的版本，而不是先让他们开会、填表、写需求。

客户看到的是具体结果：

- 这是你的餐厅。
- 这是你的菜单。
- 这是你的地址、电话、导航和预约入口。
- 这是一个更正式、更好看的手机友好网站。
- 如果你满意，可以直接购买。

这比传统 agency 的销售方式短很多。

## 整个流程怎么走

### 1. 找餐厅

系统从 Google Places、Google Maps、餐厅官网和公开网页里收集信息。

我们需要尽量拿到：

- 餐厅名字
- 地址
- 电话
- 官网
- 营业信息
- Google Maps 照片
- 菜单链接
- 预约链接
- 品牌 logo
- 餐厅照片和菜品照片

这些资料会被保存成 evidence，也就是证据包。后面的内容生成、菜单生成、页面设计，都应该基于这个证据包，而不是凭空编。

### 2. 处理菜单

餐厅菜单可能在很多地方：

- 网页
- PDF
- 图片
- 扫描件
- Google Maps 照片
- 官网下载文件

系统会尝试用不同工具读取菜单，比如 MarkItDown、OCRmyPDF、PaddleOCR 和 Firecrawl Parse。

菜单信息非常重要。我们宁愿少展示，也不要乱编。菜单页的理念是：信息越核心越好，手机上要快、清楚、容易看。

### 3. 生成网站和菜单

系统会生成两类东西：

第一类是正式网站。

网站应该像一个真正餐厅官网，有品牌感，有照片，有结构，有地址、电话、地图、预约和菜单入口。它要能代表这家餐厅，而不是像一个随便套出来的模板。

第二类是手机菜单。

菜单页不需要很多废话。它的重点是让顾客在手机上快速看到菜品、价格和分类。如果有电话、地址、导航或预约，也要能直接点击。

这两个东西的设计理念不同，不能混在一起。

### 4. 生成 preview

每个餐厅会有一个 preview 网站。

preview 网站是给销售用的。客户可以直接打开，看我们已经为他们做好的版本。

preview 页面底部会有一个固定的销售条，里面有几个按钮：

- 购买网站
- 申请修改
- 批准上线
- 购买额外修改

这个销售条是我们的工具，不是餐厅网站内容的一部分。它不会破坏客户网站本身的设计。

### 5. 生成销售素材

系统会为每个 preview 生成 outreach pack。

里面包括：

- preview 链接
- 桌面截图
- 手机截图
- 从头到尾滚动网站的视频 demo
- 菜单来源证明
- AI audit 结果
- 冷邮件内容

这些素材可以用来给餐厅老板发邮件或私信。核心思路是让对方一眼看到“你们已经帮我做出来了”。

### 6. 客户付款

客户在 preview 网站上点击购买，会进入 Stripe Checkout。

付款成功后，系统会：

- 创建订单
- 记录客户邮箱
- 记录购买套餐
- 创建 3 次修改额度
- 写入收入记录
- 创建一个 case 文件夹
- 在 Discord 里创建对应任务线程
- 给客户发付款确认邮件
- 通知 AI agent 可以开始处理

客户后面提交修改时，必须同时匹配两个信息：

- Stripe order ID
- checkout email

这样可以避免把 A 客户的修改误改到 B 客户的网站上。

### 7. AI agent 开工

每个订单都会有一个长期 case memory。

里面保存：

- 订单信息
- 客户邮箱
- 餐厅名字
- repo
- preview 链接
- 修改记录
- Discord thread ID
- evidence 文件
- content 文件
- design 文件
- agent task
- timeline
- 之前做过什么决定

这样 agent 不需要只靠当前聊天记忆。即使对话变长，或者换一个 agent，也能从 case memory 里找回上下文。

Agent 修改网站时只改 dev branch。不会直接动 live 网站。

### 8. 发送 review 邮件

Agent 修改完 dev preview 后，系统会先做检查：

- 是否读了 case context
- 是否用了真实 evidence
- 是否有 design protocol
- 是否 build 成功
- dev preview 是否部署成功
- 是否有桌面和手机截图

这些条件满足后，系统才会给客户发 review 邮件。

邮件里会有：

- dev preview 链接
- approve 链接
- revise 链接
- order ID
- 当前修改次数
- 域名设置入口

### 9. 客户确认或继续修改

如果客户要改，他们去 revise 页面提交修改意见。

revise 页面会锁定 order ID 和 email。客户不用改，也不能乱改。系统会显示他们已经用了几次修改，还剩几次。

客户也可以上传附件，比如菜单图片、logo、参考图或截图。附件会上传到 Cloudinary，然后进入任务记录和 Discord thread。

如果客户确认没问题，就点 approve。

### 10. 发布 live 网站

客户 approve 后，系统会把 dev branch 的成品发布到 main/live。

发布成功后：

- Cloudflare Pages 部署正式站
- 系统检查 live deploy
- 给客户发 live email
- Discord thread 记录完成状态
- case memory 更新状态

我们已经用 Opa Bar & Mezze 跑通过这个完整流程。

### 11. 设置域名

客户可以选择几种上线方式。

最简单的是用我们提供的免费子域名，比如：

`restaurant-name.profitslocal.com`

这个我们可以自动设置，因为 DNS 在我们这里。

客户也可以用自己的子域名，比如：

`menu.restaurant.com`

这种需要客户在自己的 DNS 里添加一条 CNAME。系统会告诉他们应该填什么。

客户也可以用自己的主域名，比如：

`restaurant.com`

这个最正式，但也最危险，因为可能影响他们原来的网站和邮箱。所以主域名不自动改，必须先做 DNS 和 email audit。

## 系统里有哪些模块

### Evidence 模块

负责收集和保存真实信息。

它回答的是：我们凭什么说这个电话、地址、菜单、照片是真的？

### Menu/OCR 模块

负责读取菜单。菜单可能是网页、PDF、图片或扫描件。

它回答的是：我们能不能从各种乱七八糟的菜单来源里提取出可用内容？

### Design 模块

负责把餐厅信息变成有审美的网站方向。

它回答的是：这个网站看起来是否像一个正式餐厅官网，而不是 AI 随便生成的页面？

### Renderer 模块

负责把 content 和 design 渲染成真实网站。

它回答的是：这些资料最终怎么变成可访问的页面？

### Outreach 模块

负责生成销售素材。

它回答的是：我们怎么把 preview、截图、视频和邮件打包给潜在客户看？

### Sales Funnel 模块

负责付款、订单、修改、批准上线。

它回答的是：客户从购买到上线，中间每一步怎么自动走下去？

### Case Memory 模块

负责保存长期上下文。

它回答的是：agent 怎么知道这个客户是谁、之前改过什么、还剩几次修改？

### Agent Runner 模块

负责让 AI agent 读任务、改 dev、build、截图、通知客户。

它回答的是：付款之后，AI 到底去干什么？

### Discord Workspace 模块

负责内部协作。

每个订单和修改都应该进入同一个 Discord thread，方便我们和 agent 追踪。

### Email 模块

负责给客户发关键节点邮件。

包括付款、修改收到、修改接受、review ready、live published、domain status。

### Domain 模块

负责上线域名。

它区分我们控制的子域名、客户自己的子域名、客户主域名，以及未来的 ProfitsLocal subpage。

### Finance/ROI 模块

负责记录收入和成本。

收入来自 Stripe。成本可以包括 Google Places、Firecrawl、OpenAI、Resend、图片生成、agent runtime 等。

后面可以用这些记录看每个城市、每个餐厅、每个销售批次到底赚不赚钱。

## 现在已经验证过什么

已经验证：

- 5 个 Brisbane 餐厅 preview 可以访问。
- Opa Bar & Mezze 用真实菜单数据重新生成过。
- 菜单 extraction 跑通过真实餐厅菜单。
- 本地 Ollama audit 跑过 5 个 Brisbane 餐厅，结果通过。
- Opa 的 Stripe test checkout 跑通。
- Opa 的 revision request 跑通。
- Opa 的 Cloudinary 附件上传跑通。
- Opa 的 customer review email 跑通。
- Opa 的 approve 到 live publish 跑通。
- Opa 的 live domain 跑通。
- Babylon 和 Chu The Phat 做了额外页面验证和截图验证。
- 5 个 generated restaurant repo 已经同步 Node 24 workflow hardening，dev 和 main deploy 都成功。

## 现在还差什么

现在不是系统没闭环，而是需要把它变得更像稳定产品。

优先级最高的剩余事项：

1. 用专门的 ProfitsLocal Handoff bot 发 Discord task，不要让 website-agent 自己给自己派活。
2. 设置 Resend 和 agent runtime 的单位成本，让 ROI 报告更准确。
3. 再跑 1 到 2 个真实餐厅，确认不是 Opa 单点成功。
4. 等流程稳定后，再做 dashboard。

Dashboard 暂时不是最重要的。现在最重要的是重复跑真实餐厅，看每次是否都能顺利从 preview 走到付款、修改、审核、上线。

## 一句话总结

ProfitsLocal 的核心不是“生成一个网站”。

它真正做的是：把本地餐厅从公开资料、预览网站、销售触达、在线付款、AI 修改、客户确认、正式上线、域名设置和 ROI 记录，连成一条尽量自动化的业务闭环。
