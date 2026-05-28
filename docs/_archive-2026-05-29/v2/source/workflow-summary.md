
# ProfitsLocal 端到端工作流示例总结

## 案例：Apex Roofing Brisbane

### 输入
- Google Maps搜索："roofing Brisbane"
- 发现企业排名第9，有网站但评分低

### 输出（8个核心数据产物）

1. **Business Profile** (数据库记录)
   - 基本信息：名称、电话、地址、GBP数据
   - 状态：scraped → audited

2. **Audit Result** (评分+问题诊断)
   - 总分：38/100 (强redesign候选)
   - 3个致命问题：移动端不可用、无HTTPS、无CTA
   - 4个严重问题：加载慢、评论少、设计老旧、联系难
   - 决策：自动进入demo build队列

3. **Visual Audit** (AI视觉判断)
   - 新鲜度：2/10
   - 信任度：4/10
   - 转化准备度：3/10
   - 判断：severely_outdated
   - 证据：table布局、Comic Sans字体、渐变按钮、图片模糊

4. **Sales Angle** (销售切入点)
   - 主角度：mobile_gap
   - 话术："你的网站在手机上完全打不开，正在流失大量客户"
   - 推荐渠道：email优先
   - 紧急度：high

5. **Outreach Content** (3封邮件 + SMS + 电话脚本)
   - Email 1: 问题导向（移动端）
   - Email 2: 机会成本导向（年流失$70K）
   - Email 3: 竞争对手对比（评论差距7倍）
   - SMS: 160字符精简版
   - 跟进序列：Day 3/7/14

6. **Proposal Page** (客户展示页)
   - 3个问题卡片
   - 3个改进亮点（速度、移动端、联系）
   - Before/After对比
   - ROI估算：年增$27K-$45K
   - 7个FAQ
   - 购买CTA：$399

7. **Demo Site** (已上线的新网站)
   - URL: demo.profitslocal.com/apex-roofing-brisbane
   - 5个页面
   - 47秒构建完成
   - Lighthouse性能：96/100
   - 加载时间：1.6s

8. **Internal Sales Report** (销售执行手册)
   - 优先级：HIGH
   - 成交概率：72%
   - 推荐定价：$399（标准价，无折扣）
   - 触达顺序：Email → SMS → Phone → Email followup
   - 备注：Brisbane本地，可上门拜访

---

## 时间线

- 14:30 - 抓取GBP数据
- 15:10 - 完成技术审计 + 截图
- 15:15 - 完成评分与问题分类
- 15:20 - AI视觉分析完成
- 15:25 - 生成销售角度
- 15:30 - 开始构建demo网站
- 15:45 - 生成外联内容
- 15:50 - Demo网站上线
- 16:00 - 生成Proposal Page
- 16:10 - 生成内部销售报告

**总耗时：1小时40分钟（几乎全自动）**

---

## 销售执行流程

### Day 0 (2026-05-10)
- 16:30 发送Email 1（问题导向）

### Day 3 (2026-05-13)
- 如未回复：发送SMS
- 如已回复：发送Proposal Page链接

### Day 7 (2026-05-17)
- 如未回复：电话跟进
- 话术："Hi，我是Matthew，上周发你的demo看了吗？"

### Day 14 (2026-05-24)
- 最后一封Email："如果没兴趣我就把demo下线了"

### 转化触发点
1. 客户回复邮件 → 立即发送Proposal Page
2. 客户点击Demo → 追踪行为，24小时内跟进
3. 客户访问Proposal Page → 追踪停留时间和滚动深度
4. 客户点击购买按钮 → 进入Stripe支付流程

---

## 系统产出清单

每个合格客户自动生成：
✅ 1份结构化审计JSON
✅ 1份AI视觉分析报告
✅ 1份销售角度方案
✅ 3封不同角度的冷邮件
✅ 1条SMS
✅ 1个电话脚本
✅ 1个跟进序列（3封）
✅ 5个常见异议应对
✅ 1个demo网站（5页）
✅ 1个proposal销售页
✅ 1份内部执行报告
✅ 1个Stripe支付链接

**总计：12+个可直接使用的资产**

---

## 关键成功因素

1. **具体问题 > 泛泛而谈**
   - 不说"你的网站需要优化"
   - 说"你的网站在手机上完全打不开，63%客户看不到"

2. **先给价值 > 先要承诺**
   - 不要求"我们开个会聊聊"
   - 直接给demo："我已经做好了，你看看"

3. **视觉冲击 > 文字描述**
   - Before/After slider比长篇大论更有说服力
   - Demo网站比PDF提案转化率高3-5倍

4. **数据支撑 > 主观判断**
   - "加载7.8秒"比"有点慢"更有力
   - "竞争对手评论194条 vs 你28条"比"评论少"更震撼

5. **降低摩擦 > 增加压力**
   - "不喜欢就删掉"比"限时优惠"更自然
   - "$399一次性"比"月费$99"更容易决策

---

## 下一步实施建议

### 立即可做（Week 1）
1. 搭建抓取脚本（Playwright + Google Maps）
2. 集成Lighthouse API
3. 接入Claude API（视觉分析 + 文案生成）
4. 准备1个roofing模板网站

### 第2周
5. 实现评分引擎（按Scoring Spec）
6. 实现outreach文案生成（按Prompt Spec）
7. 搭建demo网站自动部署（Cloudflare Pages）

### 第3周
8. 实现Proposal Page生成
9. 集成Stripe支付
10. 搭建基础CRM dashboard

### 第4周
11. 测试完整流程（抓取→审计→生成→发送）
12. 人工复核10个案例，调优prompt和评分权重
13. 准备正式launch

### 扩展方向
- 多niche模板（plumber, electrician, dentist）
- 自动发送邮件（集成SendGrid/Mailgun）
- 点击追踪与行为分析
- A/B测试不同话术
- 多国家扩展（美国、加拿大、英国）
