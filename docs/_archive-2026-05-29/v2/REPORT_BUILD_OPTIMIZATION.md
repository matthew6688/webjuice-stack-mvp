# Internal Report Build — Optimization Roadmap

创建日期：2026-05-12
关联：
- [internal-report-scaling-summary.md](../../data/qa/internal-report-scaling-summary.md) — 当前实测数据
- [SCALING_AND_PRICING.md](SCALING_AND_PRICING.md) — Pages slot 维度的独立瓶颈
- [BACKLOG.md](BACKLOG.md) — 落地任务追踪

> 这份文档锁定 `build-internal-report.js` 的 5 级性能优化路线。**不重新论证**，要改先在这里改。

---

## Baseline（2026-05-12 实测）

- 10 leads, fresh evidence (Playwright) = **297.8 s / 4:58 min**
- 平均 **29.8 s/lead**, p50 27.5 s, p95 51.1 s
- `evidence_capture` 占 **99.96%** 总时间
- 其他 6 步加起来 < 0.1 s/lead

## 触发条件

| 状态 | 投资行动 |
|---|---|
| < 50 active leads | 不做任何优化，sequential 跑就够 |
| 50-80 leads | 启动 **P0** 并行化（和 H.9.b 触发点对齐）|
| 80+ leads | P0 必须 ship，**P1 缓存** 同时启动 |
| 300+ leads | P2-P4 全部考虑 |

---

## P0 — Worker pool 并行化 evidence_capture

**问题**：当前 for-loop 一个一个跑 Playwright；evidence 是 99.96% 时间但 100% sequential。

**改**：
- 单 Chromium browser 实例
- N 个并行 contexts（N=4 on 16GB Mac, N=8 on 32GB Mac, N=4 on cloud runner）
- worker pool 模式：`p-limit` 或 native `Promise.allSettled` + 信号量
- 每个 lead 独立 context（避免 cookie / storage 串扰）

**影响**：
- 4-way: 8.3 hr → 2.1 hr (1000 leads)
- 8-way: 8.3 hr → 1.0 hr (1000 leads)

**工程量**：~3-5 h
**改动文件**：
- `scripts/leads/build-internal-report.js` — 主循环改并行
- `core/audit/issue-evidence.js` — 接受 shared browser，不再自己 launch
- `package.json` — 加 `p-limit` 依赖（已有则不动）

**风险**：
- Playwright 内存：每 context ~200-400 MB；8-way ~3 GB
- 目标站点对并发 friendly 度（同站点 N 个 lead 通常没事，跨站点更安全）
- 浏览器死锁 / hang context（需要 per-context timeout 守护）

**验证**：跑 10 leads × 4-way，应在 ~75 s 完成（avg 29.8s × 10 ÷ 4）

---

## P1 — Evidence by audit_version 缓存

**问题**：rubric / 报告模板调整重跑时，每次都重截图，浪费 5+ min。

**改**：
- evidence PNG 上传 R2 / Cloudinary（uploadCloudinary 已支持，只缺缓存逻辑）
- key by `entityKey + audit_version_hash + issue_id`
- 跑前查 manifest，命中跳过 Playwright，直接复用 CDN URL
- audit_version 改变 → 缓存自动失效

**影响**：
- 重复跑（同 lead 同 audit）：5 min → 5 s
- 增量跑（新 lead 加入旧集合）：只新 leads 走 Playwright

**工程量**：~4 h
**改动文件**：
- `core/audit/issue-evidence.js` — 加 cache check
- `core/assets/upload-audit-assets.js` — 加 manifest write/read
- `scripts/leads/build-internal-report.js` — 集成

**前置依赖**：Cloudinary 凭据已就位（MEMORY.md `reference_storage_cloudinary.md`）

**验证**：连跑两次 --all，第二次 < 30 s 完成（只 render，evidence 全命中）

---

## P2 — C/D grade 跳过 mobile video

**问题**：mobile-throttled 视频录制最低 ~10 s。C/D leads 不做个性化 outreach，视频没价值。

**改**：
- `captureForLead` 加 `recordVideo` 参数
- C/D grade 时设为 false
- A/B grade 保持当前行为

**影响**：
- C/D 占 ~40% leads
- 每 C/D lead 省 ~10 s
- 总时间省 ~13%（10 leads 省 ~40 s）

**工程量**：~30 min
**改动文件**：
- `scripts/leads/build-internal-report.js` — 传 `recordVideo: leadGrade in [A,B]`
- `core/audit/issue-evidence.js` — 接受参数

**风险**：低；C/D 报告其他内容完整，只缺视频

---

## P3 — Pre-warm browser pool（跨 lead 复用）

**问题**：每 lead 一次 chromium.launch；冷启动 1-2 s/lead 浪费。

**改**：
- 顶层一次 launch
- 所有 lead 共享 browser，各自 newContext
- 跑完 close

**影响**：
- 每 lead 省 1-2 s（cold start + 退出）
- 10 leads 省 10-20 s（占总时间 ~5%）

**工程量**：~2 h
**改动文件**：
- 同 P0；如果 P0 已做，P3 几乎免费（架构一致）

**注意**：P3 应该和 P0 一起做（架构同源）

---

## P4 — B-D grade evidence 降级

**问题**：现在每个 issue 都单独截图。B-D leads 不一定需要这么多颗粒度。

**改**：
- A grade：保持现状（每 issue 截图 + 视频 + 全套）
- B grade：仅顶部 3 critical issues 截图 + 视频
- C grade：仅 desktop + mobile 总览 + 1 截图，无视频
- D grade：仅 desktop 总览 1 张，无视频

**影响**：
- B-D 占 ~70% leads
- 假设 B-D 平均省 60% evidence 时间（~18 s/lead）
- 总时间省 ~42%（10 leads 省 ~125 s）

**工程量**：~3 h
**改动文件**：
- `core/audit/issue-evidence.js` — 加 grade-aware 模式
- `scripts/leads/build-internal-report.js` — 传 grade 参数

**风险**：B-D 报告 evidence 信息密度降低；销售用法上可接受（A 才是主战场）

---

## 不做的事（明确）

- ❌ **不**全部异步、不阻塞主进程（这是 batch 工具，不是 web 服务，wall time 才是 KPI）
- ❌ **不**用 Selenium / Puppeteer 替换 Playwright（投资已落，性能差不大）
- ❌ **不**自建 evidence cluster / 分布式（80 客户内单机足够）
- ❌ **不**降低 evidence 质量（视频码率 / 截图分辨率）—— 这是销售素材，质量优先

---

## 决策记录

| ID | 决策 | 日期 |
|---|---|---|
| **D-OPT-1** | Worker pool 并行化是 P0，触发条件 50-80 leads | 5/12 |
| **D-OPT-2** | Evidence cache by audit_version 是 P1，重跑场景关键 | 5/12 |
| **D-OPT-3** | C/D 跳视频 P2，最小工程量但 ROI 明确 | 5/12 |
| **D-OPT-4** | Pre-warm browser pool 与 P0 合并，不单独立项 | 5/12 |
| **D-OPT-5** | B-D evidence 降级 P4，等 P0+P1 都落地再评估必要性 | 5/12 |

---

## 落地顺序（按 Lead 规模触发）

```
50 leads ──────────► P0 (parallel) + P3 (browser pool) — 1 周一起做
80 leads ──────────► P1 (cache) — H.9.b 同期触发
80+ + rubric 迭代中 ► P2 (video skip C/D) — 半天搞定
300+ leads ────────► P4 (evidence 降级) — 再评估

并行触发：H.9.b R2+Workers routing 项目（独立瓶颈，见 SCALING_AND_PRICING.md）
```
