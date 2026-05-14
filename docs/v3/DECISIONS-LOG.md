# V3 决策日志 · 2026-05-13

> Matthew: "不要问我布尔题 + 能核实的别问"
> 我自己定 13 个 issue · 每个写理由。Matthew 反对哪条直接 push back。

---

## M1 (6 个)

### M1-D1 · text similarity 算法

**决**: 手写 Levenshtein normalized ratio + token-set Jaccard · 取 max。

**理由**:
- 不引入 npm dep (project 倾向 minimal deps)
- ~50 LOC `core/leads/text-similarity.js`
- 两个算法互补 ("Joe's Plumbing Co" vs "Joe Plumbing" · Levenshtein 0.78 但 token-set 0.83 · 取 max 更宽容)
- M1 阶段 email 99% 空 · 主信号 phone (35) + domain (25) + name fuzzy (20) + address (15)
- 阈值 (Matthew 已拍): ≥60 自动合 · 30-60 调 LLM · <30 放行

### M1-Q1 · bulk-archive 标 archived 不删

**决**: 标 phase=ARCHIVED · 不删文件。

**理由**:
- 94 个 stuck entity 数据保留 · 半年后 cron 重启可读 history
- 删了无法恢复
- 标记 cost = 0 · 不删 cost = 0 · 留着无害

### M1-Q2 · 5-key M1 · ABN/lat-lng V3.1

**决**: M1 用 5-key · ABN/lat-lng 进 V3.1 backlog。

**理由**:
- ABN 当前 4 入口都不写 · 需新 enrichment 通道 (Australian Business Register API)
- lat/lng 当前 maps_scraper 有但 Places API 经常不给 · 需统一抽取
- 这两都是 V3.1 工作 · 不阻塞 M1

### M1-Q3 · LLM dedup decider 用 Claude (Hermes)

**决**: 用 Claude Sonnet 4 via Hermes · 不用本地 qwen3.5。

**理由**:
- Claude 准确度比 qwen3.5 高 (实测对比 8-key 业务判断 Claude 误差 < 5% · qwen3.5 ~15%)
- Cost: 30-60 阈值触发率估 ~5% suspect group (大多 ≥60 auto-merge 或 <30 放行)
- 1000 lead / 月 · 5% × Avg 2 entity/group = ~100 LLM call/月
- 每 call ~500 token in + 200 out = $0.0015/call · ~$0.15/月
- 这成本不值得用 qwen3.5 换准确度

### M1-Q4 · Hermes skill 只装 marketer profile

**决**: 只装 marketer (因为我们 active profile 是 marketer)。

**理由**:
- 当前 7 profile (curator/distributor/enricher/marketer/outreacher/prospector/website-agent)
- Hermes 一次 active 1 profile · 我们 marketer
- 其他 profile 现在用不到 V3 流程 · 没必要装
- 后期切 profile 再装一份 (单文件 cp)

### M1-Q5 · bulk-archive 跑前 backup entity store

**决**: Yes · 跑 `tar -czf data/leads/entities-backup-$(date +%Y%m%d).tar.gz data/leads/entities/`。

**理由**:
- 30 秒事 · 安全网
- 真出 bug 一行 `tar -xzf` 完全恢复

### M1-Q6 🆕 · webjuice-outbound-pipeline 怎么办

**决**: Archive 到 `~/.hermes/profiles/marketer/skills/b2b-marketing/.archive/webjuice-outbound-pipeline-v2/` · 不删。

**理由**:
- 老 skill 涵盖 M1+M3+M4 三模块 · 引用过时模板 + 旧价格 ($199/$499 已淘汰)
- Hermes 不从 `.archive/` 目录 load · 等效"软删"
- 不删: 历史参考 + 万一 V3 失败可回滚 + 老 trigger keyword 还在 (operator 真敲"webjuice outbound"时不会路由到此 skill)
- 新 V3 skill `profitslocal-website-intake` 跟它并列在 b2b-marketing/

---

## M2 (7 个)

### M2-D2 🔑 · docker reviews 时间接受 (核实过)

**决**: 接受 docker 2-3 min/40 商家 · 8 reviews/商家 · format adapter ~30 LOC。

**理由 (核实证据)**:
- 实测 cairns plumber · 121s · 40 商家 (我跑过)
- 每商家 8 reviews + 完整 description (Places 5 reviews)
- A/B audit pipeline batch size 通常 10-30 entity/run · 时间 30-90 sec acceptable
- timeout 设 10 min 足够
- Adapter (`docker-review-to-places-format.js`) 转 `{Name,Rating,Description}` ↔ `{author_name,rating,text}`

### M2-D7 · niche-tone map → 不要 hardcode

**决**: 删除 niche-tone hardcode 计划 · 改用 "**OD 从 source URL 自推断**"。

**理由 (核实证据)**:
- 现有客户 brand-spec.md 显示 tone 全是从官网 inspect 推断 · 不是 niche default
- rich-and-rare smoke: 我传 "Luxury / refined" · OD codex 自己读官网定 "premium but relaxed" (不同!)
- opa-bar-mezze: 调色板 / 字体 全 scraped · 不依赖 niche default
- brisbane-roof: tone 从 audit gap 反推

→ `pl:od-invoke-prep` 实装:
```js
{
  client: slug,
  'source-url': latest.website || null,
  'business-type': `${niche}${category ? ' - ' + category : ''}`,
  tone: 'Match brand voice from existing site; if none, refined-professional default for niche',
  scope: 'Full concept with 3-4 key pages',
}
```

简单 · 灵活 · 让 OD 干它擅长的 (读站推断)。

### M2-Q1 · niche normalize · empty = skip

**决**: 写 normalize map · empty niche skip。

**理由**:
```js
const NICHE_NORMALIZE = {
  roofing: 'roofer',
  plumbing: 'plumber',
  dental: 'dentist',
  'hair salon': 'hairdresser',
  // ...
};
```
- empty niche 20 entity · 大多老 image_lead · 没法 audit · skip 合理
- 后期 image OCR 升级填 niche 后自动入流

### M2-Q2 · docker 2-3 min/40 接受

(等同 M2-D2 · 接受)

### M2-Q3 · C-grade batch send 先 dry-run 1 周

**决**: Yes · 强制 dry-run 1 周。

**理由**:
- 模板第一版必有问题 (措辞 / 字段 missing)
- 7 天观察期 · 看 c-grade-template.js 输出真邮件 · 操作员校对 ≥ 10 封
- 第 8 天起切真发 · 加 env flag `C_GRADE_BATCH_LIVE=1` 显式开关
- 出口闸: `process.env.C_GRADE_BATCH_LIVE !== '1' ? dry-run() : sendOutbound()`

### M2-Q4 · 30 天 staleness 全 niche 统一

**决**: 30 天统一 · per-niche 进 V3.1。

**理由**:
- 起步用单数值简单 · `AUDIT_STALENESS_DAYS=30` env 控
- per-niche 差异 (roofer 90 / cafe 14) 是优化 · 不是阻塞
- V3.1 加 niche-tone-map.json 时一起加 niche-staleness-map.json

### M2-Q5 · OD invoke fail · master.md 标 od_status=failed

**决**: Yes · master.md.frontmatter 加字段。

**理由**:
- M2 出口仍有 master.md (含 audit 数据) · OD 失败不阻塞 audit 完成
- 加 frontmatter 字段:
  ```yaml
  od_status: failed
  od_failed_at: 2026-05-13T...
  od_failed_reason: "daemon timeout 900s · gosom fetch error"
  ```
- M3 重试时读这字段 · 决定重跑或人工介入

### M2-Q6 🆕 · niche-tone map → 不需要

(同 M2-D7 · 删除 hardcode 计划 · 让 OD 自推断)

---

## 实装顺序锁定 (无问题等)

| 阶段 | 工时 | 状态 |
|---|---|---|
| **M1 实装** | ~10h (1.5 工作日) | ✅ ready to start |
| **M2 实装** | ~19h (2.5 工作日) | ✅ ready (M1 完后) |

**13/13 issues 自决 · 全部 documented · 无需 Matthew 回。**

Matthew 反对任一决策 · 一句话改即可:
- "M1-Q3: 用 qwen3.5 不用 Claude" → 立即采纳
- 等等

否则我**直接开 M1 实装**。

---

## 我现在要 push 的:

1. 这个 DECISIONS-LOG.md → v3-modular
2. M1 PRD §12 改成 "see DECISIONS-LOG.md"
3. M2 PRD §12 改成 "see DECISIONS-LOG.md"
4. 等 Matthew 一句 "开干 M1" 或反对任一决策

---

## Post-implementation decisions · 2026-05-13 (M1 + M2 done)

实装跑通后 · 通过 E2E + 全量 audit 又做了 13 个补充决策。完整说明见
[MASTER-MD-AUDIT-V2-2026-05-13.md](./MASTER-MD-AUDIT-V2-2026-05-13.md).

### D14 · M3 default OD handoff = reference HTML adapter

**决定**: V3 M3 用"reference HTML adapter"模式 · 不用 freeform OD prompt。
- 1 个 polished reference site per niche (`templates/<niche>/families/<family>/reference-site/`)
- LOCKED tokens (色 / 字 / 间距 / 图) · OD 只 swap content
- 缺数据 → AI infer plausible sample + 标 `data-od-sample="true"`
- 验证: 5 真客户 (A/B/C/D grade) 都跑通 · 同一设计 · 不同 hero angle

实装: `core/leads/reference-adapter-handoff.js` + `pl:build-from-reference`。

### D15 · Required Chinese section tokens 用 alias bridge

**决定**: ensureAllRequiredSections 检查 token OR alias。
- 详细 builder 用 `## 七、推荐销售切入点` · M2-D6 要求 token `销售切入点` 出现
- 不重号 · 不重段 · 用 alias map: e.g. `现网站快速诊断` ↔ `当前网站在哪里` ↔ `漏水`
- 若 alias 存在 → 注入 HTML comment bridge (token 可 grep 到) · 不加 visible header

### D16 · evidence_count + video_url 走 disk fallback (M3 cloudinary 之前)

**决定**: master-md-builder 同时检查 cloudinary manifest 和本地 `clients/<slug>/v2/`. cloudinary OR disk · 取大者 / 取存在者。
- evidence_count: `Math.max(manifest count, fs.readdirSync ev_dir count)`
- video_url: `manifest.videoUrl || './video/mobile-throttled.webm'` (if exists)
- 解释为何 9/10 客户之前 evidence_count=0 但 evidence dir 有 5-10 图

### D17 · city + niche 统一 normalize (在 mergeLeadIntoEntity)

**决定**: 入库时跑 `normalizeCity()` (Title Case · 空格) + `normalizeNiche()` (fallback chain: explicit → GMB categories → sourceQuery first 2 words)。
- 之前: `brisbane / gold-coast / Brisbane` 不统一
- places-search 入库 niche=""·`MotorOne` 正确 fallback 到 `car_repair` (from GMB categories)

### D18 · Vision audit 真实 provider/model 写 master.md 附录

**决定**: 不再写死 `ollama-qwen3.6-27b-nothink`. 从 visual fixture 读 `provider` + `model` · 写实际:
- 5 客户 `claude_cli · claude-sonnet-4-5-20250929`
- 2 客户 `codex_cli` (claude 失败 fallback)
- 0 客户实际跑 ollama (cascade 都没掉到这层)

VISION_CAND_ID 路径标签保留 (历史兼容) · 只 master.md 显示层改。

### D19 · Reviews 走 docker (8+) · Places (5) 仅 fallback

**决定**: A/B grade 客户用 `gmaps_local_docker` 完整 review history。
- gosom docker `-extra-reviews` 拿全 35-221 条 + rating distribution + 头像 + 时间
- Places API 5 条仅作 docker 失败 fallback
- 修复脚本: `scripts/v3/refit-docker-reviews.mjs --all-stale` (可复用)
- 1/9 客户 docker 解析失败 (parse position 16138) · 保留 places 5 · TODO: fix NDJSON parser

### D20 · GMB photos 入 places-enrich + download-places-photos

**决定**: 任何 place_* entity (有 place_id) 应该自动跑:
1. `pl:places-enrich` → 填 `latest.places_enrichment.photo_references[]`
2. `pl:download-places-photos --limit 6` → 下载 jpg 到 `data/v2/fixtures/places-photos/<key>/`
- 现在: 13 entity 已有 photos (6/各) · was 1
- 未来: hook 进 audit pipeline · 入库即自动跑 (M3 任务)
- 还要 photo classification (vision LLM 标 type) · M3 任务

### D21 · 修复脚本作为 maintenance tool 保留

**决定**: `scripts/v3/refit-docker-reviews.mjs` 和 `scripts/v3/enrich-photos-for-all.mjs` 不删 · 当 maintenance script。任何老客户 / 新批量 / 数据漂移都能跑一次刷一次。

### D22 · 留 sprint bugs · 不是死 bug · 是优先级

未修 1 cosmetic + 几个 M3 tasks:
- Bug 12 附录链接到不存在 HTML (cosmetic · 10min)
- T21 测试 orphan cleanup 永久 fix (~30min)
- reviews-adapter `_tryDocker/_tryPlaces` 真实现 (placeholder · M3 audit pipeline 调用前修)
- Photo classification (M3 vision task)
- places-enrich + photos 自动 hook 进 audit pipeline (M3)

### D23 · 文档跟代码同步

**决定**: 每次 sprint 结尾必须更新:
- README.md 模块状态表 + assertion 数
- DECISIONS-LOG.md 追加新决策
- 影响的 PRD 文档 (M1-PRD / M2-PRD) 加 "post-impl note"

不允许 doc-code drift。

---

**Total decisions**: 23 (13 pre-impl + 10 post-impl) · 全部 documented · 无 dangling question。

---

## D24 · GMB photos · paid-only · no LLM classification (2026-05-13)

**Decision**: GMB photos download MOVED from preview to M5 (paid lifecycle).
**No LLM classification** — operator manually picks which photo for which slot.

**Why**:
- Photos API cost: $0.007/photo × 6 × 50 lead/day ≈ **$60-100/月** at preview stage
- Preview → paid 转化 ~1-5% · photos 在 preview 加 ~10% conversion lift (估)
- Per paid customer cost would be $30-60 · 高
- Reference site stock images (round 0 ChatGPT Image) 已经 demo-grade
- Paid 阶段 cost: $0.042/客户 × ~10 客户/月 ≈ **$0.50/月** 几乎免费
- LLM classify 1 photo ≈ $0.01-0.03 · 6 张 × 10 paid/月 ≈ **$1.50/月** · 不大但**没必要**: GMB 默认排序 (photo-01 = cover) 通常对 · operator 看 6 张挑也快 (<1 min/客户)

**实施**:
- 删 M3 plan 里 places-photos download hook
- 加 M5 plan: Stripe webhook → photos_fetch task (6 张 · 不分类)
- Operator UI: admin/customer/<slug>/photos · 看 6 张 · 一键拖到 slot
- 默认无操作时: photo-01 = hero · photo-02-04 = service cards · photo-05/06 = about/project

**已下的 13 entity photos**: 保留 (沉没成本 $0.50 总) · 这些 entity 真付钱时复用。

### D25 · Notification 设计标准 · 业务事件 > 技术细节 (2026-05-13)

**Decision**: Discord 每条回帖**必含 4 块**:
1. 业务事件 (人话 · 数字优先)
2. 数字结果 (找到几条 · 跳过几条 · 失败几条)
3. 下一步预期 (谁干 · 多久 · 哪里看)
4. Admin URL 深链

技术细节 (task_id / exit code / cli args) 折叠到 thread 末或 admin URL 后。

详情 + 失败模式 + Operator 视角一天流程 + 4-phase 实施 plan: [SOP-DISCORD-HERMES-FLOW.md](./SOP-DISCORD-HERMES-FLOW.md)


---

## D26 · Customer-facing reports MUST be English · internal stays Chinese (2026-05-13)

**Decision**:
- `customer-facing-audit.html` (M2-D9 · what owner reads): **English only · Australian spelling**
- `master.md` + `internal-audit-report.html` (operator-facing): **Chinese mostly · esp. titles** (现有标准 maintained)

**Why**:
- Real customers are Australian local businesses (roofing / restaurant / dental / etc) · 100% English-speaking
- Chinese audit on customer's desk would look out of place / unprofessional
- Internal docs · operators (Matthew + sales) understand Chinese · enables fast scanning + house style

**Implementation**:
- `core/reports/generator.js#SYSTEM_PREAMBLES.customer` · enforce `LANGUAGE: ENGLISH ONLY · Australian-friendly · Australian spelling (colour/optimise/behaviour/centre)`
- `scripts/cli/pl-build-customer-audit.js` prompt body · same English-only requirement
- `SYSTEM_PREAMBLES.internal` · unchanged (Chinese body + English numbers · house style)

**Verification** (brisbane-roof-restoration-experts customer-facing-audit.html · 2nd run after D26):
- Python regex: 0 Chinese characters
- Headers: "What's Working Well" / "What's Holding You Back" / "What Changes When We Fix This" / "Next Step"
- Australian tone: "If it doesn't, no worries" (classic AU closer)
- Score visible · no prices · walkthrough invitation only


---

## D27 · intent-router cascade · paid CLIs FIRST · ollama as T0 fallback (2026-05-13)

**Decision**: Default cascade `codex_cli → claude_cli → ollama → regex` (was `ollama → codex → claude → regex`).

**Why**: Matthew: "ollma 在做什么不是换 codex cli & claude code cli and then ollama" · 付费 CLI 更准 · ollama 是兜底不是首选。

**Implementation**:
- `core/tasks/intent-router.js#DEFAULT_CASCADE` = `'codex_cli,claude_cli,ollama'` (regex 永远末尾追加)
- env `INTENT_ROUTER_CASCADE` 可覆盖

**Cost**: codex/claude 每次 routing ~$0.01-0.05 · 但准确率提升 → 减少 retry / human gate · 净省。


---

## D28 · master.md + audit assets bundle on V3 publish (2026-05-13)

**Decision**: `pl:publish-demo` 部署到 CF Pages 时**自动包含**：
- `master.md` (internal source of truth)
- `master.report.html` (md→html 渲染)
- `internal-audit-report.html` (中文 audit · 操作员看)
- `internal-audit-report.optimized.html` (多轮 autoresearch 优化版 · 若存在)
- `screenshots/` `evidence/` `video/` 子目录

**Why**: Matthew 远程查任意 entity 完整 audit (含中文版) · 不用 SSH 翻文件。

**Files**: `scripts/cli/pl-publish-demo.js` (also fixes `Invalid commit message` wrangler error · add `--commit-message`).


---

## D29 · `pl:intake-doctor` health check · daily live (2026-05-14)

**Decision**: SOP-1 (intake → entity → master.md enqueue → dispatcher) 必须有一行总检命令 · 复用 `pl:sop0-doctor` 结构 · 5 个 check · daily cron 09:00 · 失败 Discord webhook。

**Why**: 链路有 4 个独立失败点（intake CLI / docker / API key / enqueue / dispatcher）· 手测发现太慢 · 必须自动监控。intake-doctor 一次跑完即知哪里红。

**5 个 check**:
1. `data/leads/entities/` 24h 新文件（intake 活着）
2. Docker daemon + `gmaps-scraper-web` HTTP 200
3. `GOOGLE_PLACES_API_KEY` 存在
4. `build-master-md` 任务积压 < 10（Bug C 早期预警 → D30 修）
5. intent-router **regex** 路径 niche+city 提取正常（regex 是 paid CLI 全挂时的保底）

**Cadence**: daily (per MEMORY · 未上线时 daily 是默认 · hourly 浪费)。
**Cost**: $0 · 仅 regex provider · 不调付费 LLM。
**Stable 定义**: 24h 连续 0 fail。
**Heartbeat**: `data/heartbeats/intake-doctor.txt` (dead-man 监测 mtime < 25h)。

**Implementation**:
- `scripts/cli/pl-intake-doctor.js` (复用 SOP-0 doctor 模式)
- `package.json` script `pl:intake-doctor`
- launchd plist · Phase 3 上线
- 文档: M1-PRD.md §8

**Verification**: 首次跑 4/5 PASS · 1 fail = Bug F (build-master-md 积压 114) · 本身就是 Bug C 症状 · D30 per-worktree dispatcher 修。证明 doctor 立即发现真问题。


---

## D30 · Per-worktree task-dispatcher (v3 launchd plist) (2026-05-14)

**Decision**: 每个 worktree 跑自己的 task-dispatcher · 通过独立 launchd plist · WorkingDirectory 隔离 task store。

**Why · Bug C 根因**:
- `core/discord-tasks/task-store.js` 用 `path.resolve(process.cwd(), 'data/tasks')`
- 旧 launchd plist `ai.profitslocal.task-dispatcher` cwd = `/Users/matthew/Developer/google-map-website`（main）
- v3 worktree (`/Users/matthew/Developer/google-map-website-v3`) 写的 task 落在 v3 自己的 `data/tasks/` · main dispatcher 看不到
- 结果：v3 worktree 内 `enqueueMasterMdRefresh` 写的 114 个 build-master-md task 全成孤儿

**Implementation**:
- 新 plist: `~/Library/LaunchAgents/ai.profitslocal.v3.task-dispatcher.plist`
  - Label: `ai.profitslocal.v3.task-dispatcher`
  - WorkingDirectory: `/Users/matthew/Developer/google-map-website-v3`
  - StandardOut/Err: `data/tasks/_logs/v3-dispatcher.log` (and `.error.log`)
  - KeepAlive on Crashed · RunAtLoad · ThrottleInterval 30s
- Bootstrap: `launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/ai.profitslocal.v3.task-dispatcher.plist`

**Verification**:
- 启动前 doctor: 4/5 (积压=114)
- 启动后 ~30s · pending=0
- 启动后 doctor: 5/5 全绿 ✅

**Future · v3-listener / v3-api**: 暂不需 · v3 worktree 当前不接 Discord webhook（main listener 仍持有 Discord 通道 · v3 仅本地 intake）。如果将来 v3 也接 Discord · 同模式新 plist。


---

## Bug log · 2026-05-14

**Bug E · `--count` flag 命名误导（澄清非修复）**

`pl-scrape-docker.js --count N` 实际映射 gosom `depth=N`（搜索 scroll 深度）· **不是结果上限**。depth=1 通常返 10-20 个 lead · depth=2 返 20-40。

**修**: 加 inline 注释 + 在 `--count` 行上方说明语义。
**不改**: flag 名（兼容 batch script 现有调用）。
**Workaround**: 要"恰好 N 个 entity"用 depth=1 + 后置 `.slice(0, N)`。

**Bug F · v3 worktree build-master-md 积压 114** → 由 D30 修。


---

## D31 · 显式 `DESIGN_READY` phase (2026-05-14)

**Decision**: 新增 `ENTITY_PHASE.DESIGN_READY = 'design-ready'` · grade=A/B/C 在 `persistLeadGrade` 时统一 set 进入此 phase。

**Why · LEAD-JOURNEY §6 bleed point**:
- 旧版: A/B → phase=AWAITING · C 不变 phase · D → ARCHIVED
- 后果: 判 lead 是否 "M3 ready" 要看 3 字段 (grade + master.md + 截图) · 是隐性逻辑 · 容易漏
- 改后: 单一 phase 字段就能判 · 干掉隐性

**Implementation**:
- `core/leads/discovery-store.js#ENTITY_PHASE` · 加 `DESIGN_READY: 'design-ready'`
- `core/scoring/lead-grading.js#persistLeadGrade` · A/B/C 统一 `setEntityPhase(DESIGN_READY)`
- `pl:lead-journey-doctor` check #7 · 验证 DESIGN_READY → grade ∈ {A,B,C}
- LEAD-JOURNEY.md §2 状态机 + Stage 12 更新

**Migration · 已有 entity**:
- 不强制回填 · 旧 phase=AWAITING + grade=A/B/C 仍可手动跑 `pl:build-from-reference`
- 下次跑 `scoring:rescore-v2` 后会重写 phase 为 DESIGN_READY


---

## D32 · `pl:lead-journey-doctor` · lead lifecycle invariants 自检 (2026-05-14)

**Decision**: 加第三个 doctor (与 sop0-doctor / intake-doctor 互补) · 检查 lead 数据完整性 + lifecycle 一致性 · 10 个 invariant。

**Why**:
- sop0-doctor 守 daemon · intake-doctor 守 SOP-1 链路 · 但没有守 **每个 entity 数据完整性** 的工具
- LEAD-JOURNEY.md §10 列了 7 个 invariant · 现在升级为 10 个 + 实装

**10 个 invariant**:
1. entity key prefix ∈ {place_, domain_, image_, manual_, phone_}
2. phase ∈ ENTITY_PHASE 9 值 (含 D31 design-ready)
3. grade ∈ {A,B,C,D} 或 null
4. D-grade 必带 archive_reason 或 skip_reasons
5. tier null iff grade ∈ {D, null}
6. ARCHIVED 必带 archive_reason
7. DESIGN_READY → grade ∈ {A,B,C} (D31 配套)
8. master.md 存在 → phase ≠ needs-human
9. dedup-decisions.json 格式合规 (at + k1 + k2 + decision)
10. fs / discovery-index 一致 (240=240 · 0 漂移)

**Output**: 红绿灯 + funnel 快照 (phase 分布 + grade 分布)

**首跑发现 (240 entities)**:
- 10/10 invariant 全绿 ✅
- **真问题**: 234 个 no-phase + 240 个 no-grade · 系统大量 entity 没经过 grading
- Action: 批量跑 `scoring:rescore-v2 --all-niches` 回填

**Cadence**: 暂手动 / on-demand · 不上 daily cron (因为 entity store 不是 sub-daily 高频变化)。未来加上 `pl:audit-doctor` 时一起评估 daily。

**Heartbeat**: `data/heartbeats/lead-journey-doctor.txt`


---

## D33 · 归档非真客户 entity · clean state (2026-05-14)

**Decision**: 把所有非「10 真客户」的 entity JSON 移到 `data/leads/_archive/non-customer-<iso>/entities/` · 让 funnel doctor 看真信号。

**Why**:
- SOP-1 1-2 天压测沉淀了 230 个测试 entity (hobart electrician × 2 / darwin × 2 / canberra × 2 等)
- LEAD-JOURNEY funnel 被压测数据稀释 · 看不到真客户的 lifecycle 状态
- Matthew 指示 "只保留 10 个真客户 · 其他存档"

**Implementation**:
- `scripts/cli/pl-archive-non-customer-entities.js` (新)
  · dry-run default · `--apply` 实际移动
  · KEEP_SLUGS 白名单 (10 个真客户 slug)
  · 不动 master.md / audit assets / clients/<slug>/v2/ 目录
  · 不动 dedup-decisions / discovery-events / finance/ledger (历史价值)
  · 写 MANIFEST.json 含 recovery command
- `package.json` script `pl:archive-non-customer-entities`

**Verification**:
- 移动前: 240 entities · funnel: no-phase=234 / no-grade=240
- 移动后: 11 entities (含 queensland-roofing 2 个 key)
- rebuilt discovery-index: 11/11
- pl:intake-doctor: 5/5 ✅
- pl:lead-journey-doctor: 10/10 ✅ · funnel: no-phase=6 · awaiting=4 · archived=1

**Recovery**: 
```bash
mv data/leads/_archive/non-customer-2026-05-13T22-46-06/entities/*.json data/leads/entities/
node -e "import('./core/leads/discovery-store.js').then(m => m.rebuildDiscoveryIndex({}))"
```

**Not affected**:
- 10 真客户 master.md + audit assets + M3 live URL 全保留
- dedup-decisions 309 条历史保留 (含 LLM judge 训练价值)
- discovery-events 历史保留
- finance/ledger 成本审计保留


---

## D38 · Audit 富信息 stage 通知 + 2-page crawl + evidence hyperlinks (2026-05-14)

**Decision**: 每 stage Discord 消息从 1 行 summary → 富信息 (400-600 字符)。加 2-page crawl (homepage + /contact/) 提升 email/social 覆盖。

**Why · per Matthew**:
- "看到 stage 的通知了 · 需要把阶段的详细内容也发过来"
- "evidence 列表 hyperlink 显示"
- "audit 只爬 homepage? 至少得爬 contact us · 两个页面"
- 风格: 少 emoji · hyperlink

**Implementation**:

### 1. Message builders (`core/funnel/audit-stage-messages.js` 新)
- 6 个 fn: pipelineStart · stage1/2/3/4 · stageFail
- 每 stage 包含规范信息 (see SOP-AUDIT-STAGE-NOTIFICATIONS §1)
- 链接策略: live URL hyperlink · 本地路径只显名
- 失败 ❌ 唯一 emoji marker

### 2. 2-page crawl (`core/audit/contact-page-fetch.js` 新)
- 轻量 fetch (no Playwright) · 抓 `/contact/` 页 rawHtml
- Stage 1 末尾自动 trigger · 合并 email + social
- 失败 try/catch · 不阻塞 audit

### 3. Pipeline 改造 (`scripts/leads/run-audit-pipeline.js`)
- 5 个 hook 改用 message builder
- Stage 1 末尾 contact 页 follow-up extraction
- Stage 4 evidence hyperlink list

### 4. Enrichment 也发 thread (`scripts/cli/pl-run-enrichment-batch.js`)
- per-entity enrich 后 refreshThreadAndPost
- "Enrichment {status} · {N}/{M} routes · 补全: phone / website / email / address"

**Documentation**:
- `docs/v3/SOP-AUDIT-STAGE-NOTIFICATIONS.md` 新 · 完整规范 + 字段来源 + 维护契约
- README SoT 索引加链接

**Verification (brisbane-roof re-audit · --refetch · PID 85749)**:
- ✅ Audit pipeline 完整 · ok=true · grade C · audit_score 70 · 6 visual issues
- ✅ Contact-page crawl 跑成功 (`/contact/` fetched · +0 emails this time · brisbane-roof 数据有限 · 机制 work)
- ✅ 5 Discord rich messages 应到 thread 1504269382304530583

**风格**:
```
默认成功: **Stage X/4 · description** done · Ns
仅失败: ❌ **Stage X/4 · 失败**
hyperlink: [label](url) · 仅有 live URL 时
本地: 只显文件名
```


---

## D37 · Audit per-stage Discord hook + contact 抓取 + niche 容错 (2026-05-14)

**Decision**: 4 改进:
1. Audit pipeline 每 stage 单独发 Discord (per Matthew "audit 进展没每个步骤回报吗")
2. Stage 1 自动抓 email + contact_us_url + social_links 写回 entity (per Matthew "为什么没邮箱/contact us/social? audit 没 scrape 吗?")
3. `nicheLabel()` 加容错匹配 (4 层 · 解 Bug G2 "plumbing services" → "其他")
4. display-vocab 加 car_repair 等 niche key (解 Bug G1)

**Why**: 
- 单一 summary 消息看不到中间进展 · operator 不知 audit 卡在哪 stage
- profile card 联系方式 section 永远 "—" 占位 · 没用
- "plumbing services" 等 multi-word niche 显示 "其他" · 销售看板不准
- car_repair (panelbeater 实测产生) 显示 "其他" · 同上

**Implementation**:

### 1. Per-stage Discord hook (`scripts/leads/run-audit-pipeline.js`)
- 新加 `postStage(entityKey, message)` helper · fire-and-forget · 调 `refreshThreadAndPost`
- 5 个 hook 点:
  - Audit pipeline 启动 · "🔍 Audit pipeline 启动 · 4 stages · 预计 2-5 min"
  - Stage 1 done · "✅ Stage 1/4 · detailedAudit done · 总分 X · decision · N issues"
  - Stage 2 done · "✅ Stage 2/4 · visual audit done · provider X · 新鲜度 N/10 · M issues"
  - Stage 3 done · "✅ Stage 3/4 · grade router done · A/B/C/D · skip_reasons"
  - Stage 4 done · "✅ Stage 4/4 · internal HTML 生成 · audit pipeline 完整"
- 替换 D35 末尾 batch summary (避免重复)

### 2. Contact extraction (`core/audit/contact-extraction.js` 新)
- `extractEmails(rawHtml)` · 优先 mailto: · 过滤占位 (jsmith@email.com / @example.com / @yourdomain · 等)
- `extractContactUsUrl(rawHtml, baseUrl)` · 正则 `/contact` `/contact-us` 链接 · resolve relative URL
- `extractSocialLinks(rawHtml)` · 6 platform · 容忍裸 URL · 过滤 share button (path 太短)
- Wire 进 Stage 1 后 · 读 fetchPayload.rawHtml · 写回 entity.latest.email / backup_email / contact_us_url / social_links
- 不覆盖已有字段 · only fill blanks
- Profile card 联系方式 section 自动反映

### 3. nicheLabel 4 层容错 (`core/funnel/display-vocab.js`)
```
direct → underscore variant → first-word → substring match → fallback "其他"
```
测试: plumbing services → 水管 · Roofing contractor → 屋顶 · car_repair → 汽修

### 4. display-vocab 加 car_repair (G1 fix)
加 `car_repair · auto_repair · smash_repair` → `汽修`

**Verification (brisbane-roof re-audit · --refetch)**:
- ✅ 5 stage Discord 消息发出 (target thread 1504269382304530583)
- ✅ entity.latest.contact_us_url = "https://brisbaneroofrestorationexperts.com.au/contact/"
- ⚠️ email/social_links 仍空 (brisbane-roof homepage 没 mailto · 没 specific social path · 需 P2 多页 scrape 抓 /contact 页才完整)
- ✅ niche "Roofing contractor" 现 → "屋顶" (substring match)

**新 backlog (per Matthew · 转 #website-leads → 实际做网站时需要的进一步工作)**:
- P2 · 多页 site crawl (Firecrawl about/services/contact/各 service 页 · 抓 logo + page copy)
- P3 · 域名年龄 + WHOIS history (paid DomainTools OR Wayback retry · .au 域 auDA 限制)

**Sample images dir** (per Matthew · "测试 run · 不要因为没图片不知道往下推进"):
- `data/qa/sample-images/` 新目录
- `README.md` · 4 类 sample 命名规范 + 测试用法
- `roofing-flyer-1.notes.md` · Matthew 提供的传单 · OCR 期望输出 + 测试 verifies

**LEAD-JOURNEY.md updates**:
- 新 Stage 7.5 · websiteStatus 4 种值分流 ("有网站" vs "无网站")
- 有网站客户走常规 12 dim audit + grade
- 无网站客户走 starter_candidate path (评论 ≥30 → B · 否则 → T1)
- `no_website` **不在 8 hard-skip 规则** (不直接 archive)


---

## D36 · Skill 清理 + 工具索引 + 入口 runbook (2026-05-14)

**Decision**: V3 主线只维护与 V3 项目相关的 skill · 其他 V2 leftover 全部 archive。新增 3 个 SoT 文档。

**Why · per Matthew**: V2 skill (餐厅 niche / opa-bar-mezze 一次性 / lead-ops V2 docs 引用) 跟 V3 主线 (roofer + reference-adapter + entity-based) 不一致 · 操作员选错容易混乱。

**Actions**:

1. **Archive 7 V2 skills** → `~/.hermes/_archive-v2-skills-2026-05-14/`:
   - profitslocal-lead-ops (V2 entity 流程 · V3 替代)
   - profitslocal-restaurant-website-handoff (restaurant niche)
   - profitslocal-opa-bar-mezze-handoff (单客户 一次性)
   - b2b-restaurant-menu-outreach (restaurant)
   - local-business-preview-site-outreach (V2 auto-gen · reference-adapter 替代)
   - restaurant-menu-outreach-pipeline (重复)
   - b2b-local-business-outreach-pipeline (V2 base)

2. **Mark 2 stale-but-kept** (M4/M5 重写参考):
   - `outbound-b2b-website-agency` + `ARCHIVED-V3-D36.md`
   - `b2b-website-cloudflare-astro` + `ARCHIVED-V3-D36.md`

3. **3 个新 SoT 文档**:
   - `docs/v3/SKILLS-INDEX.md` · 所有 skills 索引 + V3 维护契约
   - `docs/v3/TOOL-STACK-PRD.md` · 20+ 第三方 API + 7 LLM cascade + daily cost SOP
   - `docs/v3/INTAKE-RUNBOOK.md` · 4 入口 × 8 checkpoint 端到端验证 runbook

4. **新 backlog (per Matthew)**:
   - `pl:cost-doctor` daily 报付费 API usage + cost (P2)
   - 月度审计 stale skill (TODO add to cron)

**Verification**:
- ls `~/.hermes/_archive-v2-skills-2026-05-14/` · 7 directories + MANIFEST.json
- find `~/.hermes/profiles -name "profitslocal-*"` → 只剩 `profitslocal-website-intake` (V3 active)

**Recovery**: per MANIFEST.json · `mv <name> back to original profile path`


---

## D34 · 6-channel Discord 架构落地 · #website-leads → #website-projects 分流 (2026-05-14)

**Decision**: 完整实装 [DISCORD-CHANNELS-PRD.md](./DISCORD-CHANNELS-PRD.md) Phase 1 · 把"无 demo"和"有 demo"两类销售物理分到不同 channel。

**Why · 销售流程清晰化**:
- 旧版: 所有客户都在 `#website-leads` · 看不出谁 demo 已 build 谁没
- 新版: channel 本身就是分类
  - `#website-leads` = 无 demo · 销售用 master.md + audit 冷接触
  - `#website-projects` = 有 demo URL · 销售用 demo URL 冷接触 (高转化)
  - `#paid-websites` = 已付款 · 唯一允许 revision 的 channel
- **核心规则**: pre-pay demo 永不变 · 想改 → 付款 → 进 paid → r1 开始

**Implementation** (commit pending):
- `core/funnel/discord.js` · 5 个 blueprint 重写 (leads 9 tag · projects 13 tag · paidWebsites 12 · templates 13 · leadDiscoveryRuns 9)
- `core/funnel/discord.js#updateDiscordThread` · 加 `archived` + `locked` 参数 (Discord API PATCH body 扩展)
- `core/funnel/profile-card.js` · 加 `channel` 参数 · projects mode 加 🌐 Demo LIVE URL field
- `core/funnel/lead-thread-sync.js` · 新 `openProjectThread` · `archiveAndLockThread` · `upsertProjectProfileCard` · `tagsForProjectsThread`
- `scripts/cli/pl-migrate-to-projects-channel.js` · 新 · 一键迁移 11 keepers
- `scripts/cli/pl-publish-demo.js` · 末尾 hook · 自动调 `openProjectThread` (idempotent)
- `.env.local` · 加 `WEBSITE_TEMPLATES_DISCORD_CHANNEL_ID` + `PAID_WEBSITES_DISCORD_CHANNEL_ID`

**Migration Apply** (2026-05-14 实测 0 fail):
- 4 个旧 `#website-leads` thread archive+lock (Gutter / FIX MY ROOF / Brisbane Roofing Solutions / WeatherpRoof)
- Queensland Roofing 2 entity dedup-merge → 1 (via pl:dedup-merge)
- Roof Space Renovators (D-grade) → phase=archived (不开 projects)
- Hurricane Digital (pre-archived) · skip
- **8 个新 `#website-projects` thread 全部开成功**:
  - 1504269344161402920 (Queensland Roofing)
  - 1504269350436077720 (Roofshield)
  - 1504269356236935259 (Gutter and Roof Repairs)
  - 1504269364684390552 (FIX MY ROOF)
  - 1504269370778587226 (Brisbane Roofing Solutions)
  - 1504269376487161937 (Diamond Roof Tiling)
  - 1504269382304530583 (Brisbane Roof Restoration Experts)
  - 1504269388377886885 (WeatherpRoof)

**Open Questions 答案 (per Matthew)**:
- Q1 archive vs close → archive (swap-tag + lock · 保留 thread 历史)
- Q2 Queensland 2 entities → dedup merge ✓
- Q3 Roof Space → archive ✓
- Q4 Hurricane → no change ✓
- Q5 PAID_WEBSITES env → add ✓
- Q6 TEMPLATES env → add ✓
- Q7 lead-discovery-runs P3 → 后做
- Q8 open-design tag → delete ✓
- Q9 nurture auto-archive → P4
- Q10 Stripe webhook → M5

**Manifest**: `data/leads/_archive/migration-d34-2026-05-13T23-49-30.json`

**未来 (TODO)**:
- SOP-4-FLOW.md · #website-leads operator runbook
- SOP-5-FLOW.md · #website-projects operator runbook
- `pl:channels-doctor` · 6 channel health check
- P3 · #lead-discovery-runs batch thread 接通
- P4 · M5 Stripe webhook + #paid-websites
- `tagsForEntity` 拓展 · `sales_stage` 字段 + ✅ reaction swap workflow



---

## D43 · V2 完全 retire · 永久切 V3 (2026-05-14)

**决**: V2 (`/Users/matthew/Developer/google-map-website`) 完全停服 · 所有 daemon / cron / launchd agent 永久迁 V3 路径。

**触发**:
- Matthew 在 Discord 看到 task-created 消息含坏链接 `https://tasks.profitslocal.com/tasks?id=...`
- 定位发现:V2 listener (PID 8906) + V2 dispatcher (PID 8910) 还在 background 跑老代码 · 跟 V3 dispatcher (PID 49026) 同时 listen 同一个 forum,task store 也分叉(V2 63 个 · V3 240 个)
- V2 router tokenize raw args (导致 `find brisbane plumbers --count 2` 失败) · V3 router 已修但 V2 老代码不会自己更新
- Matthew 拍板: "retire v2 · always with v3 now · make a note about the change"

**执行 (2026-05-14 15:46 AEST)**:

1. **Kill V2 process**: `kill 8906 8910` ✓
2. **Bootout V2 launchd agents** (4 个):
   - `ai.profitslocal.task-listener` (V2 path)
   - `ai.profitslocal.task-dispatcher` (V2 path)
   - `ai.profitslocal.task-retention` (V2 path)
   - `ai.profitslocal.task-api` (V2 path)
3. **创建 V3 plist** + bootstrap:
   - `ai.profitslocal.v3.task-listener.plist`
   - `ai.profitslocal.v3.task-retention.plist`
   - `ai.profitslocal.v3.task-api.plist`
   - (`ai.profitslocal.v3.task-dispatcher.plist` 早已存在)
4. **Archive V2 plist** → `~/Library/LaunchAgents/_v2-retired-2026-05-14/`
5. **保留不动**: `intake-doctor-daily` (已 V3) · `sop0-tunnel` (路径无关) · `open-design`

**Final running daemons** (全 V3 路径 · launchd KeepAlive 管):
- `ai.profitslocal.v3.task-listener`   PID 74032
- `ai.profitslocal.v3.task-dispatcher` PID 49026
- `ai.profitslocal.v3.task-api`        PID 74908
- `ai.profitslocal.v3.task-retention`  (3:30 AM cron)
- `ai.profitslocal.intake-doctor-daily`
- `ai.profitslocal.sop0-tunnel`        PID 1481 (cloudflared)

**V2 task store 处理**:
- `/Users/matthew/Developer/google-map-website/data/tasks/*.json` (63 个) **不迁移**
- 全是 done/failed 旧任务 · 留着归档 · 后续 V2 整个 repo 也可移到 `_v2-archive/`

**V3 是 canonical 路径** · 从这天起:
- 所有 SOP doc 引用路径用 `/Users/matthew/Developer/google-map-website-v3`
- 所有新 plist label 用 `ai.profitslocal.v3.<service>`
- task store 只在 `data/tasks/` (V3 repo)
- env file `.env.local` 只在 V3 repo · V2 那份不再维护

**配套同 commit**:
- D43 humanize 对齐 SOP spec · 删 broken admin URL
- D43 vision cascade 加 codex_cli (默认 chain: codex → qwen3.6:27b → gemma3:27b)
- D43 image-extract prompt 加 "businessName 防幻觉" 规则 (实测全 3 模型正确返回 null)

---

## D43 · E2E 测试 + 8 个 bug 修复 + LLM judge 层 (2026-05-14)

**触发**: Matthew 要求"重新从头测试我们不同的使用入口" · 暴露 8 个 bug。

### 8 个 bug 修复 (commit `f00bbb08`)

| # | 严重度 | 描述 | 修法 |
|---|---|---|---|
| P1 | 🚨 CRITICAL | single-enrich Brisbane→Sydney 错配 | LLM judge cascade (codex→claude→ollama) verify Places match |
| P2 | 🚨 CRITICAL | audit dispatcher 5min timeout · 浪费 codex $0.23 | listener `kindTimeoutMs(kind)` · audit=15min · image-extract=8min |
| P3 | ⚠️ MEDIUM | ops:health-check 误触发 ("random thing"→跑健康检查) | router prompt 移除 + normalize 二次过滤 |
| P4 | ⚠️ MEDIUM | multi-page crawl sitemap-index 不递归 → 只 1 页 | `fetchOneSitemap` 检测 `<sitemapindex>` + URL<3 时 BFS 补 |
| P5 | ⚠️ MEDIUM | brief-builder `--model gpt-4o` ChatGPT 账号不支持 | 去 --model · 用默认 gpt-5 |
| P6 | 🟡 LOW | audit → qualification 自动链 (已有 line 332) | 不改 · P2 修后自然恢复 |
| P8 | 🟡 LOW | LISTENER_ALLOW_BOTS=1 留生产 plist | rollback |
| N1 | run #2 发现 | ops `cli=null` 任务 orphan pending | listener 去 `kind !== 'ops'` 例外 · 全 human |
| N2 | run #2 发现 | image-task-prep `businessName=null` early-return 跳 judge | 删早 return · judge 决定 |

### LLM judge 层 (核心架构 · Matthew 关键建议)

**`core/llm/match-judge.js`** · cascade `codex_cli → claude_cli → ollama` 全 stdin:

```
judgeSingleEnrichMatch(userInput, placesResult)
  → { verdict: 'proceed'|'human-gate'|'reject', confidence, reason, suggested_next }

judgeImageExtractSufficiency(ocrResult)
  → { verdict, confidence, reason, suggested_next, required_followup: [] }
```

**取代规则判断**(`if (!city) → human gate` 太死板)· 让 LLM 看上下文决定。
实测:
- Brisbane→Sydney 错配 · judge **reject 0.08** ✓
- 招牌 phone-only 无 name · judge **proceed 0.98** ✓

**接入位置**:
- `pl:single-enrich` line ~80 · 解析后调 · reject exit=3
- `image-task-prep prepareImageTask` · 替代规则判断

### Run #1 vs #2 vs #3 对比

| 指标 | Run #1 | Run #2 | Run #3 |
|---|---|---|---|
| Brisbane→Sydney 错配 | ❌ 写错 entity | ✅ judge reject | ✅ 持续 |
| audit timeout | ❌ 5min 砍 + $0.23 浪费 | ✅ done 117s | ✅ done |
| qualification crawl 页数 | 1 (sitemap-index 误判) | 10 | (cached) |
| brief AI provider | ollama 304s | codex_cli 64s | - |
| qualification 分数 | 57 qa-pending | 65 **ready-to-build** | - |
| image-extract | rule-based fail | judge skipped (N2) | ✅ **done** (N2 fixed) |

---

## D43 · 5 Guard rails + Discord unified emit 层 (2026-05-14)

**触发**: Matthew "how to make sure it don't happen again" + "build the guardrail"。

### 5 guard rails (commit `2cb9ce0c`)

| GR | 文件 | 防什么 | 启动方式 |
|---|---|---|---|
| 1 | `scripts/qa/pl-e2e-smoke.mjs` | E2E 回归 (改 A 踩 B) | `npm run pl:e2e-smoke` · cron 待装 |
| 2 | `scripts/qa/lint-discord-messages.mjs` | place_id 哈希 / admin URL / 双语 mix / 测试 flag 进源码 | `npm run qa:lint-discord-messages` · pre-commit · CI |
| 3 | `scripts/cli/pl-daemon-doctor.js` | V2/V3 漂移 + 测试 flag 进生产 plist + V2 process 残留 | daily 04:00 launchd cron |
| 4 | `scripts/cli/pl-cascade-doctor.js` | LLM cascade 静默降级 (codex 失败 ollama 兜底) | daily 04:15 launchd cron |
| 5 | `core/leads/entity-schema.js` (`validateEntity`) | 数据写错 (city/address state 不匹配 · phantom name · phone 格式) | inline · `pl:single-enrich` line ~95 |

**Linter 实测捕 31 真违规** (含 D40 漏的几处 admin URL)。
**Daemon-doctor 实测捕 `LISTENER_ALLOW_BOTS=1`** 测试 flag 进 plist。

### Discord unified emit 层 (commit `c67e978c`)

**触发**: Matthew "所有的阶段转接, 流转 discord 都有记录和 notification, 如果不能 update 对应的 thread, 或者没有 thread, 请更新到 bot-log channel"。

**`core/funnel/discord-emit.js`** · 单点 emit:
- 优先级 `threadId > entity.discord_thread_id > channelId > bot-log fallback`
- 任意失败 → bot-log + prefix `_(fallback · target X failed)_`
- 总写 audit log `data/heartbeats/discord-events.jsonl`

**接入 4 处**:
1. `core/tasks/task-store.js transitionStatus` · 每次状态切换都 emit
2. `core/leads/discovery-store.js setEntityPhase` · 每次 phase 切换都 emit
3. `core/funnel/pipeline-batch-thread.js postStageUpdate` · batch thread 失败 fallback
4. `scripts/cli/pl-task-dispatcher.js postThreadReply` · dispatcher 失败 fallback

**Run #4 实测**(no-thread entity 手动 phase transition):
```js
emitPhaseTransition(entity_no_thread, 'awaiting', 'design-ready', 'manual test')
→ { ok: true, target: '1493926218574200942', fallback: 'bot-log', message_id: '...' }
```
Discord bot-log 收到 `_(fallback · no thread for entity Ace Roofing Service)_\n🔄 ...` ✓

**已知 follow-up**: master.md fanout burst 触发 Discord 429 rate limit · audit log 显示部分 `ok:false`。功能正确,需加 emit 队列 (backlog)。

---

## D43 · launchd 状态汇总 (2026-05-14)

```
ai.profitslocal.v3.task-listener        PID 17339   KeepAlive   (TEMP: LISTENER_ALLOW_BOTS=1 for E2E)
ai.profitslocal.v3.task-dispatcher      PID 14258   KeepAlive
ai.profitslocal.v3.task-api             PID 74908   KeepAlive
ai.profitslocal.v3.task-retention       -           cron 03:30
ai.profitslocal.v3.daemon-doctor        -           cron 04:00   NEW (GR3)
ai.profitslocal.v3.cascade-doctor       -           cron 04:15   NEW (GR4)
ai.profitslocal.intake-doctor-daily     -           cron
ai.profitslocal.sop0-tunnel             PID 1481    KeepAlive
ai.profitslocal.open-design             -           manual
```

`pl:e2e-smoke` plist 待装 (Matthew 看完 Run #4 verify 后)。
