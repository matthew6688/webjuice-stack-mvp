# V3 Backlog · 2026-05-14+

> 暂存未做但 spec'd 的工作 · 实做时移到 DECISIONS-LOG.md 或对应 SOP.

---

## ✅ Done (2026-05-14)

- **GR1 pl:e2e-smoke** · code + plist · daily 02:00 cron (commit `65f6cf06`)
- **GR2 qa:lint-discord-messages** · live · 抓 31 真违规 (commit `2cb9ce0c`)
- **GR3 pl:daemon-doctor** · live · daily 04:00 cron · 抓 LISTENER_ALLOW_BOTS=1
- **GR4 pl:cascade-doctor** · live · daily 04:15 cron · `cascade-trace.jsonl` 写起来
- **GR5 entity-schema validate** · live · wired into `pl:single-enrich`
- **GR6 LLM judge 扩范围** · intake + audit · `judgeIntakeResults` + `judgeAuditConclusion` (commit `65f6cf06`)
- **Discord unified emit 层** · `core/funnel/discord-emit.js` · 接入 4 处 (commit `c67e978c`) · 实测 bot-log fallback ✓
- **Emit rate-limit queue** · per-channel serialize · 429 retry · 实测 10 burst ok (commit `65f6cf06`)
- **Narrow test allowlist** · listener accepts 🧪 / [E2E prefix · 不再需要 LISTENER_ALLOW_BOTS=1 永久开
- **Cycle test 1 · D43 · doctor schema fixes** · `pl-lead-journey-doctor.js` 改 `scoring.grade` → `grade.investment_level` · `pl-intake-doctor.js` 加 defensive .env.local loader (see DECISIONS-LOG D43 cycle test 1)

---

## P1 · 杂项 backlog

- **dispatcher stale-running reaper** · 如 dispatcher SIGKILL · 子进程 orphan · task 永远 status=running · 加 1min poll + last-heartbeat-mtime check
- **`pl:single-enrich` auto-chain dedup** · 若 entity 已 phase=archived 或 24h 内 audit · 跳过 auto-chained audit · 现在每次 single-enrich 都强制重跑 audit · 浪费

- 3 doctors cron (cost / audit / publish) → launchd plist · daily ✅ done (commit 5f6ce0b0)
- `pl:check-qualification --all-design-ready` 跑剩余 design-ready entities
- D39 brief-builder 也加 cascade trace (P5 修了但缺 observability) — 半 done · runCascade 已经 trace 了 但只 match-judge 用 · brief-builder 还没接
- `#lead-discovery-runs` P3 集成验证 (batch thread 现在新格式 · 跑完整流程)
- pre-commit hook · 跑 `qa:lint-discord-messages` 阻拦违规提交 — 需要安装 husky

---

## P2 · 不做 / 推后

- 修 `launchctl bootout` 5: I/O error · 重启 mac 可能修 · 不阻塞 (用 unload+load 旧 API 绕)
- ops fanout 量级监控 · 现在 ok · 100/batch 再说
- 老 lead-thread-sync.js 里的 `sendBotLogFallback` 跟新 `core/funnel/discord-emit.js` 重复 · 合并 (低优先 · 都工作)
