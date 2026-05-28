# V2 定价 + Scaling 决策

更新日期：2026-05-11
状态：**已拍板**（5/11 Matthew 决定）
关联：[BACKLOG.md](BACKLOG.md) · [DISCORD_OUTREACH_PRD.md](DISCORD_OUTREACH_PRD.md) §H.9

> 这份文档锁定定价 + 基础设施 scaling 路径。**不要重新论证**，要改先在这里改。

---

## 1. 锁定的定价 (不动)

```
Tier 1 — $399 一次性
   ├ 1-page 本地企业网站
   ├ 3 次包含的 revision
   ├ Hosting 永久包含 (in profitslocal CF account)
   ├ 客户自己的域名（CNAME 到 profitslocal CF）
   └ 公平使用上限: 500K 月 PV（远超本地 SMB 正常量）

Tier 2 — $799/年
   ├ 1-page + 12 次/年 revision
   ├ Monthly maintenance（menu / 营业时间 / 活动 / 新照片）
   ├ Local SEO cleanup
   ├ Domain setup 协助
   └ Hosting 包含（recurring 已覆盖）

Add-on — $100 / extra revision
```

**关键定位**：
- **Tier 2 卖 maintenance，不是卖 hosting**
- 客户从来不接触 CF / DNS / SSL — 我们打包搞定
- 客户 hosting 在**我们的 CF 账号**永久持有（不让客户碰）

## 2. 永久 hosting 经济性 (为什么这样可行)

### 单客户终生 marginal cost

```
CF Pages bandwidth        : $0 (CF 不收 egress，永久免费)
CF Workers requests       : ~$0.05/年 (100K req/月典型 local SMB)
R2 storage (5MB site)     : $0.012/年
DNS / SSL                  : $0 (CF 自带)
────────────────────────────────────────
合计                       : ~$0.06/年/客户

vs 收入 $399 / 5 年 = $79.8/年/客户
利润率                     : 99.92%
```

### 1000 客户规模成本

| 资源 | 月成本 | 年成本 |
|---|---|---|
| Workers Paid base | $5 | $60 |
| 1000 × marginal | $5 | $60 |
| **总 infra cost** | **~$10** | **~$120/年** |

**1000 客户 × $399 一次性 = $399K，每年付 $120 维持。**

这不是"无限承担费用"。是几乎零成本。

## 3. ToS Fair-Use 条款 (放 footer + pricing page)

**英文**：
> "Hosting is included on a fair-use basis. If your site consistently exceeds 500,000 monthly pageviews (very unusual for a local business), we'll reach out about upgrading to a maintenance tier with bandwidth coverage."

**中文**：
> "托管费用按合理使用范围包含。若您的网站月访问量持续超过 50 万次（本地企业极罕见），我们会主动联系您升级到含带宽承诺的维护套餐。"

**触发**：500K monthly pageviews（本地 SMB 几乎不可能达到，~6 万倍正常量）。出现 = 业务大成 = 自然升 Tier 2 谈话。

## 4. 真正的瓶颈：Pages slot 100/账号

钱不是问题，**slot 是 hard cap**。

| 客户规模 | 架构 | 成本 |
|---|---|---|
| 0-80 客户 | 当前：1 客户 = 1 Pages project | $5/月 |
| 80-100 客户 | **触发架构迁移项目**（提前 20 客户准备） | $5/月 |
| 100+ 客户 | 1 个 Worker + 1 个 R2 bucket = 无限客户 | $5-15/月 |

### 架构迁移目标（H.9.b — Pages → R2+Workers）

```
现状:
  johnsroofing.com.au → CNAME → profitslocal-live.pages.dev
                                  └─ 100 客户 = 100 projects

未来:
  johnsroofing.com.au → CNAME → profitslocal-router.workers.dev
                                  └─ 1 个 worker 解析 hostname
                                  └─ R2 bucket: customers/<slug>/*
                                  └─ 无限客户
```

**预算**：~25h 一次性工程
**月成本**：仍 $5-15（Workers req + R2 storage 都极便宜）
**Trigger**：第 80 个 active 客户启动改造

## 5. 现在的执行清单 (P0)

按顺序：

- [ ] **U.1** 升级 Cloudflare Workers Paid ($5/月)
  - dashboard 操作（需要 2FA / 信用卡）
  - 解锁 5000 builds/月 + 10M Workers req + Durable Objects 稳定 + KV
  - 覆盖整个 matthew6688 账号下所有 Pages + Workers projects

- [ ] **U.2** ToS fair-use 条款上线
  - 加到 profitslocal.com pricing section 底部 micro 文字
  - 加到 checkout 页面
  - 1 行代码改

- [ ] **U.3** 30-day TTL preview cleanup cron
  - 新建 `scripts/cli/pl-pages-ttl-tick.js`
  - 删除条件：CF Pages project age > 30d 且无关联 paid_intake
  - 注册成 Hermes weekly cron（paused，第一次手动验证）
  - 释放 slot 给新客户 demo

- [ ] **U.4** 客户数量监控
  - admin overview KPI 加 "active Pages projects / 100" 计数
  - 达 80 → 触发 BACKLOG.H.9.b 告警

## 6. 中期触发器 (H.9.b - R2+Workers routing)

**触发条件**：active customer 网站 ≥ 80（Pages slot 0.8 占用率）

**项目计划** (~25h)：
1. 设计 worker routing 逻辑（hostname → R2 key prefix）
2. R2 bucket 结构: `customers/<slug>/{index.html, assets/...}`
3. wrangler 部署管线（替换 Pages CLI）
4. 现有 100 客户分批迁移（一次性脚本）
5. DNS 客户域名 CNAME 重定向（从 pages.dev → workers.dev）
6. 切流量后老 Pages projects 删除（释放 slot 池给 demo）

**Risk 缓解**：
- 蓝绿部署：老 Pages 保留 30 天 fallback
- 灰度迁移：先 10 客户验证 → 全量
- 客户感知 0（DNS CNAME 切换不需要客户操作）

## 7. 不做的事 (明确)

- ❌ **不**让客户拥有 CF 账号（违背"hands-off 服务"卖点 + 失去 leverage）
- ❌ **不**多账号轮换规避 slot 限制（CF ToS 灰色 + 操作噩梦）
- ❌ **不**改成 recurring monthly hosting fee（破坏 Tier 1 $399 一次性的价格点）
- ❌ **不**注册免费邮箱开多账号（同上 ToS 风险）
- ❌ **不**给客户 GitHub repo access（代码 + audit + 设计 IP 不外流）
- ❌ **不**改定价（市场调研已证明 $399/$799 位置正确）

## 8. 决策记录

| ID | 决策 | 日期 |
|---|---|---|
| **D-PRICE-1** | $399 一次性永久 hosting，$799/年卖 maintenance（不是 hosting） | 5/11 |
| **D-PRICE-2** | 客户 hosting 永久在我们 CF 账号，客户从不接触 infra | 5/11 |
| **D-PRICE-3** | ToS fair-use cap = 500K monthly PV，超过触发升级谈话 | 5/11 |
| **D-INFRA-1** | 升 $5/月 Workers Paid 立即做 | 5/11 |
| **D-INFRA-2** | 80 客户 active 时触发 R2+Workers routing 改造 | 5/11 |
| **D-INFRA-3** | 30-day TTL 自动删除未成交 preview | 5/11 |

## 9. 数学场景验证

### Year 1（假设 100 个 leads 成交，60% Tier 1 / 40% Tier 2）

```
60 × $399 = $23,940 一次性
40 × $799 = $31,960 recurring (year 1)
───────────────────────────────────
Year 1 收入: $55,900

Infra cost: $5/月 × 12 + 100 × $0.06/年 = $66
Year 1 净利: ~$55,834
```

### Year 2（90% Tier 2 续费 + 60 新成交）

```
36 × $799 (续费) + 60 × $399 (新一次性) + 60 × $799 (新 yearly 估 40%) = $76,824
合计: 假设新增 40%/60% 混合 = 类似规模

Infra cost: ~$200/年（含 R2 + Workers if 已迁移）
Year 2 净利: ~$76K
```

### 客户达 80 时（trigger H.9.b）

- 老 80 Pages projects 平稳运行
- 启动 R2+Workers 项目（25h，~1 周）
- 不影响新销售（continue with Pages until migration done）
- 迁移期间客户 0 感知

## 10. 改变这份文档前

如果未来想改变本文档的任一决策（D-PRICE-* / D-INFRA-*），请：
1. 在该决策行下方添加 "REVISED: <日期> <reason>"
2. 不要直接覆盖旧值（保留决策历史）
3. 在 [BACKLOG.md](BACKLOG.md) 加追溯条目说明变更原因

---

## 一句话总结

**$399 永久 hosting 经济上完全成立（marginal cost $0.06/年/客户）。瓶颈是 Pages slot 100 而非钱。短期 $5/月 + 30-day TTL，中期客户达 80 时迁 R2+Workers。**
