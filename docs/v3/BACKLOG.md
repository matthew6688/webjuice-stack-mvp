# V3 Backlog · 2026-05-14+

> 暂存未做但 spec'd 的工作 · 实做时移到 DECISIONS-LOG.md 或对应 SOP.

---

## ✅ Done (2026-05-14)

- **GR1 pl:e2e-smoke** · code shipped (`scripts/qa/pl-e2e-smoke.mjs`) · plist 待装
- **GR2 qa:lint-discord-messages** · live · 抓 31 真违规 (commit `2cb9ce0c`)
- **GR3 pl:daemon-doctor** · live · daily 04:00 cron · 抓 LISTENER_ALLOW_BOTS=1
- **GR4 pl:cascade-doctor** · live · daily 04:15 cron · `cascade-trace.jsonl` 写起来
- **GR5 entity-schema validate** · live · wired into `pl:single-enrich`
- **Discord unified emit 层** · `core/funnel/discord-emit.js` · 接入 4 处 (commit `c67e978c`) · 实测 bot-log fallback ✓

---

## P0 · 剩下的 guard rails

### GR1 plist 装 cron
`scripts/qa/pl-e2e-smoke.mjs` code 已就绪 · 装 launchd plist 每天 02:00 跑 (避开 dispatcher 高峰):
```
ai.profitslocal.v3.e2e-smoke.plist
```
建议先手跑几天 verify baseline 稳了再装 cron。

### GR6 · LLM judge 扩范围 (~30min)
当前只有 single-enrich + image-extract 走 judge。扩到:
- **intake** (find ...) · LLM 看 returned candidates 是不是真 niche 商家还是 generic 噪声
- **audit** 完成时 · LLM 判 "audit 结论合理吗" · 防 score 异常
- **deliverable**: 扩 `core/llm/match-judge.js` 加 `judgeIntakeResults` + `judgeAuditConclusion`

### Emit rate-limit 队列 (~30min · 新发现 2026-05-14 Run #4)
Run #4 实测 · master.md fanout burst 让 emit 同时 hit bot-log 触发 Discord 429。
audit log 显示部分 `ok:false`。
- **修法**: emit 加 token-bucket queue · 同时只 emit ≤ 4 条/秒
- **deliverable**: `core/funnel/discord-emit.js` 加内部 queue

---

## P1 · 杂项 backlog

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
