# V3 Backlog · 2026-05-14+

> 暂存未做但 spec'd 的工作 · 实做时移到 DECISIONS-LOG.md 或对应 SOP.

---

## P0 · Prevent-regression guard rails (Matthew 2026-05-14)

E2E run #2 暴露 5 个 bug pattern · 单靠"修 bug"不够 · 要建系统性 guard rail。

### 1. `pl:e2e-smoke` daily cron (~30min)
- 当前 `/tmp/e2e-driver.sh` 是一次性手写脚本 · production 化:
  - 6 入口 + qualification · 每天 03:00 自动跑
  - baseline (run #2 结果) checked into `data/qa/e2e-baseline.json`
  - 新跑 diff baseline · 回归 → Discord bot-log + Hermes alert
- **deliverable**: `scripts/qa/pl-e2e-smoke.js` + `~/Library/LaunchAgents/ai.profitslocal.v3.e2e-smoke.plist`

### 2. Discord message linter (~20min)
- Pre-commit + CI 扫码库 · 检测违规模式:
  - 用户面消息 hardcode `place_chij[a-z0-9_-]+` (entity_key 哈希)
  - `/admin/...` URL (D40 弃用)
  - "Stage N · English / 中文" 双语 mix label
  - "已转人工" 等 partial pattern (容易 grep miss)
- **deliverable**: `scripts/qa/lint-discord-messages.mjs` · husky pre-commit hook · GitHub Actions step

### 3. `pl:daemon-doctor` (~20min)
- launchd 状态巡检 · 防 V2/V3 漂移:
  - 所有 active label 是 `ai.profitslocal.v3.*` (无 V2 残留)
  - 生产 plist 不含 `LISTENER_ALLOW_BOTS=1` / `*_TEST=1` / `DRY_RUN=1` 测试 flag
  - WorkingDirectory 都是 V3 路径
  - 期望 daemon 都 alive (listener / dispatcher / task-api / 3 doctor cron)
  - 没期望外的 daemon (V2 plist 自动 reload?)
- **deliverable**: `scripts/cli/pl-daemon-doctor.js` · daily cron

### 4. Cascade observability (~40min)
- `runAiCascade` 改 black box → trace:
  - task 写入 `provider_chain: [{ provider: 'codex_cli', error: '...' }, { provider: 'ollama', success: true }]`
  - daily aggregate · "本周 codex 失败率 50%" → alert
  - ollama 兜底率 > 30% 主动告警
- **deliverable**: 改 `core/llm/*-cascade.js` 返回 trace · `pl:cascade-doctor` 聚合

### 5. Entity schema validation (~45min)
- 写 entity 前 Zod schema 验证 · 阻止 P1 类 bug:
  - `city` 字段必须跟 `address.locality` fuzzy ≥ 0.6
  - `name` 不能是 service-description ("Roofing Tile/Metal") · 跟 services[] 重合 80%+ 报警
  - `phone` AU format
- **deliverable**: `core/leads/entity-schema.js` · single source of truth · `upsertDiscoveryRun` 必走

### 6. LLM judge 兜底范围扩大 (~30min)
- 现在 single-enrich + image-extract · 扩到:
  - intake (find ...) · LLM 看 candidates 是不是真 niche 商家还是 generic
  - audit 完 · LLM 判结论合理吗 (防 score 异常)
- **deliverable**: 扩 `core/llm/match-judge.js` 加 `judgeIntakeResults` + `judgeAuditConclusion`

---

## P1 · 杂项 backlog

- doctor 加 cron (cost / audit / publish · 3 个) → launchd plist · daily
- `pl:check-qualification --all-design-ready` 跑剩余 design-ready entities
- D39 brief-builder 也加 cascade trace (P5 修了但缺 observability)
- `#lead-discovery-runs` P3 集成验证 (batch thread 现在新格式 · 跑一遍看完整流程)
- pre-commit hook · 阻 `LISTENER_ALLOW_BOTS` / `place_chij*` 提交

---

## 不做

- 修 `launchctl bootout` 5: I/O error · 重启 mac 可能修 · 不阻塞 (用 unload+load 旧 API 绕)
- ops fanout 量级监控 · 现在 ok · 100/batch 再说
