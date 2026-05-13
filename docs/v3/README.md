# V3 · Module-by-Module Design

> **隔离**: 这分支 `v3-modular` · worktree `/Users/matthew/Developer/google-map-website-v3/`
> **原则**: 每模块 95% 信心 → PRD → Matthew sign-off → 实装
> **不影响 main 分支** · 完成后 PR / merge

## 模块图

| 模块 | 范围 | PRD | 状态 |
|---|---|---|---|
| **M1** | 客户发现 + 入库 + 8-key 评分判重 + master.md skeleton | [M1-PRD.md](./M1-PRD.md) | 等 Matthew 审 + 回 5 个 Q |
| **M2** | 完整 audit + grading + master.md design-ready (22 章 / 5 必出) + Discord thread + C cold outreach 队列 | [M2-PRD.md](./M2-PRD.md) | 等 Matthew 审 + 回 5 个 Q |
| **M3** | OD 设计 + 客户 preview 发布 + 销售 banner | TBD (M2 完后写) | — |
| **M4** | Cold outreach 真发 + reply 处理 + 销售跟进 | TBD | — |
| **M5** | 购后生命周期 (Stripe → approval → domain → revision) | TBD | — |
| **M-Infra** | Hermes kanban · skill 体系 · master.md hub · 健康自检 | 跨模块 | 部分已上线 |

## 实装顺序

1. M1 (1.5 工作日)
2. M2 (2.5 工作日)
3. **里程碑 1**: master.md design-ready · pivot M3
4. M3 (TBD · 等 M2 出口契约)
5. ...

## 隔离规则

- 新代码 · 新 docs · 新 scripts → v3-modular branch (当前 worktree)
- ops/hermes 修复 · 立即可用的小 fix → main branch (回到 `/Users/matthew/Developer/google-map-website/`)
- 跨 branch 同步: 实装稳定后 PR `v3-modular` → `main`

## 工作目录切换

```bash
# v3 worktree (隔离的 V3 工作)
cd /Users/matthew/Developer/google-map-website-v3

# main worktree (生产 + 紧急 fix)
cd /Users/matthew/Developer/google-map-website

# 看分支
git -C /Users/matthew/Developer/google-map-website-v3 branch --show-current
# → v3-modular
```
