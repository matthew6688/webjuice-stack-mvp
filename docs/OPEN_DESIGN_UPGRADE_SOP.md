# Open Design Fork 与升级 SOP

更新时间：2026-05-08

## 目的

我们的目标不是改造 Open Design 成另一套产品，而是：

1. 把 Open Design 当作上游设计引擎；
2. 用我们自己的 fork 承载业务关键 patch；
3. 在不打断 ProfitsLocal 网站生产链的前提下，持续吸收官方更新。

这份文档解决 4 个问题：

- 本地 `open-design` 仓库的 remote 应该怎么配；
- 我们自己的修复应该先落在哪里；
- 官方更新来了以后怎么安全同步；
- 同步后如何证明没有把 Open Design / Discord / repo 流程搞坏。

## 当前标准结构

Open Design 本地仓库：

```text
/Users/matthew/Developer/open-design
```

标准 remote 结构：

```text
origin   = https://github.com/matthew6688/open-design.git
upstream = https://github.com/nexu-io/open-design.git
```

当前已确认状态：

- 本地工作分支：`main`
- fork：`matthew6688/open-design`
- 官方上游：`nexu-io/open-design`
- 2026-05-08 最新上游 `upstream/main`：`2bb029c` `release: Open Design 0.5.0 (#820)`
- 2026-05-08 当前 fork `origin/main`：`d0431a1`

这意味着：

- 你的业务修复先进入 `origin/main`；
- 官方更新从 `upstream/main` 获取；
- 本地活跃安装始终来自这个 checkout；
- ProfitsLocal 的 headless / app-visible / sync 流程都以这个 checkout 为准。

## 为什么必须用 fork

原因很直接：

1. 我们已经有业务关键 patch，不能只存在本地工作区；
2. 直接把改动压在官方 remote 上不可控，也不适合我们的节奏；
3. 后续要升级官方版本时，fork 是最稳的缓冲层；
4. 出问题时，fork 也能作为已验证版本的回滚锚点。

## 当前已知关键 patch

截至 2026-05-08，我们自己的 Open Design 侧 patch 至少包括：

1. `Auto-refresh projects on home view`
   - 修复外部 daemon/API 新建项目后，桌面 app Recent 不自动刷新的问题。

2. `Handle legacy produced files safely`
   - 兼容历史 `producedFiles` 为字符串数组的旧数据；
   - 避免 `succeeded` 项目点开时因为 `split('/')` 崩溃。

这些 patch 现在已经：

- 存在于本地 `open-design` checkout；
- 推到了 `origin/main`；
- 没有直接推到 `upstream/main`。

## Golden Rule

**不要直接在活跃的 Open Design checkout 上对官方分支执行无验证更新。**

尤其不要直接：

```bash
cd /Users/matthew/Developer/open-design
git pull
```

正确流程是：

1. 先看 `upstream/main` 有什么变化；
2. 先跑升级 smoke；
3. 确认通过后，再合并到我们的 fork；
4. 最后才让本地活跃安装切到新的已验证版本。

## 日常开发规则

### 1. 自己的修复怎么提

所有与 ProfitsLocal 闭环强相关的 Open Design 修复：

- 先在本地 `open-design` 改；
- 本地验证；
- 提交到 fork 的 `origin/main`；
- 同步更新 ProfitsLocal 中文 SOP；
- 如果适合上游，再单独考虑 PR 到 `upstream`。

### 2. 什么适合长期保留在 fork

适合保留在 fork 的，一般是：

- 与 ProfitsLocal 集成强绑定的 patch；
- 我们必须立刻依赖、但官方还没合并的修复；
- 本地 app / daemon / pipeline 状态一致性修复；
- 为避免生产中断而做的兼容层。

### 3. 什么应该争取回推官方

更通用的修复，比如：

- UI 崩溃兼容；
- 项目列表自动刷新；
- 数据结构向后兼容；

这些都值得后续整理成 PR 给官方。

## 安全同步官方更新

### 步骤 1：确认本地状态

```bash
cd /Users/matthew/Developer/open-design
git status --short
git remote -v
git branch --show-current
```

要求：

- 工作区干净；
- 当前分支清晰；
- `origin` 和 `upstream` 没配反。

### 步骤 2：拉取官方最新

```bash
cd /Users/matthew/Developer/open-design
git fetch upstream
git log --oneline --decorate upstream/main -n 10
```

先看差异，不要急着 merge。

### 步骤 3：先跑 ProfitsLocal 升级 smoke

在 `google-map-website` 仓库执行：

```bash
cd /Users/matthew/Developer/google-map-website
npm run open-design:upgrade-smoke
```

默认是 dry-run。它现在默认比较的是 `upstream/main`，不是我们的 fork。它会告诉你：

- 当前 Open Design HEAD；
- `origin/main` 和 `upstream/main` 分别是谁；
- 目标上游 HEAD；
- 本地是否 dirty；
- 使用的 Node；
- 计划创建的临时 worktree；
- 将执行的 smoke 步骤。

真正执行：

```bash
npm run open-design:upgrade-smoke -- --execute true
```

它会：

1. 拒绝在 dirty checkout 上运行；
2. 在目标版本创建临时 worktree；
3. 安装依赖；
4. build Open Design daemon；
5. 跑 ProfitsLocal 的 `run-concept` smoke；
6. 保持当前活跃 checkout 不被污染。

如果 smoke 通过，并且你确认要把这次上游更新真正吃进 fork：

```bash
npm run open-design:upgrade-smoke -- --execute true --apply true
```

`--apply true` 会额外执行：

1. 确认活跃 checkout 在 `main`；
2. 先把本地 `main` 快进到 `origin/main`；
3. 再把已验证的 `upstream/main` merge 进本地 `main`；
4. 最后 push 回 `origin/main`。

## 合并上游到 fork

只有 smoke 通过后，才进入这一步。

推荐流程：

```bash
cd /Users/matthew/Developer/open-design
git fetch origin
git fetch upstream
git checkout main
git merge --ff-only origin/main
git merge upstream/main
```

如果没有冲突：

```bash
git push origin main
```

如果有冲突：

1. 先保留我们的业务关键 patch；
2. 手动解决冲突；
3. 重跑 smoke；
4. 再 push 到 fork。

## 回滚策略

如果升级 smoke 没通过：

- 不切换活跃 Open Design checkout；
- 删除临时 worktree；
- 保持当前已验证版本继续工作。

如果 fork `main` 合并后发现问题，现在有一条单独命令：

```bash
cd /Users/matthew/Developer/google-map-website
npm run open-design:rollback -- --commit <已验证 commit> --execute true
```

它会：

1. 拒绝 dirty 的 Open Design checkout；
2. 把活跃 checkout 切到目标 commit 的 detached HEAD；
3. 重新安装依赖；
4. `rebuild better-sqlite3`；
5. 重建 `@open-design/daemon`。

如果你要手工回滚，也可以用旧方式：

```bash
cd /Users/matthew/Developer/open-design
git log --oneline --decorate -n 20
git checkout <上一个已验证 commit>
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @open-design/daemon build
```

回滚时必须同时记录：

- 回滚到哪个 commit；
- 为什么回滚；
- 哪个 smoke 没过。

## 升级后必须证明什么

升级不能只看 “能 build”。

至少要证明下面这些还通：

### A. headless 设计生成

```bash
cd /Users/matthew/Developer/google-map-website
npm run open-design:run-concept -- --client <smoke> --open-design-root /Users/matthew/Developer/open-design --mode isolated --prompt "..."
```

### B. app-visible 项目可见

- 新 project 能出现在 Open Design app；
- 如果首页没自动刷新，说明升级引入了回归。

### C. pipeline 状态正确

- 不能出现设计成功但 app 仍显示 `Not started`；
- `messages.run_id / run_status` 要能正确反映。

### D. 继续修改链路不丢

至少再验证一次：

1. Open Design app 改动；
2. `sync-from-app`；
3. 生成 `production-handoff`；
4. `port-production-handoff`；
5. repo build 成功。

### E. 历史项目不会因为 produced files 崩溃

至少点开一个 `succeeded` 历史项目，确认：

- `Files from this turn` 能正常显示；
- 点击不会触发前端 crash。

## 升级后推荐 smoke 清单

在 `google-map-website` 仓库执行：

```bash
npm run open-design:test-upgrade-workflow
npm run open-design:test-artifact-fallback
npm run build
```

如果做真实 redesign 升级验证，再跑：

```bash
npm run open-design:run-concept -- \
  --client rich-and-rare-upgrade-smoke \
  --open-design-root /Users/matthew/Developer/open-design \
  --mode isolated \
  --source-url https://www.richandrare.com.au/ \
  --business-type "restaurant - steak and seafood restaurant" \
  --tone "Luxury / refined, match existing brand" \
  --scope "Full concept with 3-4 key pages" \
  --timeout-ms 900000
```

验证：

```bash
npm run open-design:validate-concept -- \
  --client rich-and-rare-upgrade-smoke \
  --require-source-pages \
  --must-contain "West Village"
```

## 当前 timeout 规则

对于 `codex + web-prototype`：

- 默认 timeout 不应低于 `600000ms`
- 除非在故障调查里明确加入 `--allow-short-timeout`

原因：

- 之前的 `120000ms / 180000ms` 会把仍在正常推进的 native run 误判成失败；
- 这已经被验证是一个真实根因。

## 什么时候接受 fallback

`artifact_quiet_fallback` 只有在下面条件成立时才算成功：

1. 已经存在**真实生成的** HTML 页面；
2. 不是 `source-*.html` 这种源站抓取文件；
3. 目录静默一段时间；
4. 导出内容足够进入 handoff / port / build。

如果连第一个生成 HTML 都没有，就不是 fallback success，而是 run failure / timeout。

## 和 ProfitsLocal 主仓库的关系

Open Design fork 只负责：

- 设计引擎本身；
- app / daemon / pipeline / skill 执行层；

ProfitsLocal 主仓库负责：

- headless orchestration；
- Discord / Open Design / repo 三方同步；
- production handoff；
- customer repo port；
- QA / review / publish / domain。

所以：

- Open Design 的修复要进入 fork；
- ProfitsLocal 的集成策略要进入 `google-map-website` 文档和脚本。

## 推荐操作节奏

最稳的维护节奏是：

1. 平时在 fork 上累积必要 patch；
2. 每次官方发出有价值更新，再 fetch `upstream`；
3. 先跑升级 smoke；
4. smoke 通过后再 merge 到 fork；
5. 最后再让日常使用的本地 Open Design checkout 升到这个已验证版本。

这样既能保持与官方同步，也不会因为一次上游更新把整个网站设计流水线打断。
