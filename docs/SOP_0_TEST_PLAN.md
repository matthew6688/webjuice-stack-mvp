# SOP-0 Test Plan · 系统化测试矩阵

**版本**: v1 · 2026-05-13
**配套**: [`SOP_0_TASK_SYSTEM.md`](SOP_0_TASK_SYSTEM.md) (架构) · [`SOP_0_OPERATOR_GUIDE.md`](SOP_0_OPERATOR_GUIDE.md) (操作)
**目标**: 证明 SOP-0 v1.3 在 16 个具体场景下行为符合预期 · 失败必须有可执行修复

每个 test case 4 列：**做什么 · 证什么 · 期望什么 · 通过条件**

---

## 0. 测试前置

1. 5 daemon 全 live:  `launchctl list | grep profitslocal` → 5 行非 `-`
2. Ollama up:        `curl http://localhost:11434/api/tags` → 200
3. Tunnel up:        `curl https://tasks.profitslocal.com/api/health` → 200 `{ok:true}`
4. Admin live:       `curl ".../admin/tasks/?token=..."` → 302 + cookie
5. `data/tasks/` 干净: `ls data/tasks/ | grep -v "^_"` → 空
6. Forum thread cleanup: 删测试 thread 用 Handoff bot DELETE

---

## 1. Routing 准确性（intent-router 单元层）

### T1 · 中英混合 single-enrich
- **做**: 调 `routeIntent({ text: "Joe's Plumbing 0412 345 678 melbourne plumber" })`
- **证**: regex 优先识别 phone signal · 不调 ollama 也对
- **期望**: `{ kind: 'single-enrich', args: includes('--phone','--business-name','--city'), provider:'regex' }`
- **通过**: kind 准 + args 至少含 3 个

### T2 · 引号商家名
- **做**: `routeIntent({ text: '"Bluey\'s Cafe" newcastle' })`
- **证**: quoted-name pattern 触发 single-enrich
- **期望**: kind=single-enrich · `--business-name "Bluey's Cafe"` · `--city newcastle`
- **通过**: 同上

### T3 · GBP URL
- **做**: `routeIntent({ text: 'audit https://maps.app.goo.gl/abc' })`
- **证**: URL pattern 触发 single-enrich (或 LLM 选 audit · 两者都可)
- **期望**: kind ∈ {single-enrich, audit} · args 含 url 或 entityKey
- **通过**: 不是 intake / ops 即可

### T4 · 纯文字 batch intake
- **做**: `routeIntent({ text: 'find brisbane roofers' })`
- **证**: 不被 single-enrich 误捕
- **期望**: kind=intake · args 含 `--niche` `--city`
- **通过**: kind 不是 single-enrich

### T5 · 图片 attachment
- **做**: `routeIntent({ text:'', attachments:[{contentType:'image/png',...}] })`
- **证**: hasImage 强制 image-extract (优先级最高)
- **期望**: kind=image-extract · cli=pl:ingest-image
- **通过**: kind=image-extract

**全部 T1-T5 跑法**：
```bash
node scripts/qa/test-intent-router.mjs    # 已存在，包含 T1-T5 子集
```
扩展为 5 case 完整覆盖（10min 工作）。

---

## 2. End-to-end pipeline（每 kind 独立验证）

### T6 · intake 全链
- **做**: 在 `#website-tasks` 开 forum thread "test intake: find sydney cafe shops"
- **证**: listener → ollama → kind=intake → dispatcher → pl:pipeline-batch-start
- **期望**:
  - thread 内有 "Task created" reply
  - tag swap pending → running → done
  - dispatcher 创建 batch metadata 在 `data/v2/pipeline-batches/pipe-cafe-sydney-*.json`
  - 在 `#lead-discovery-runs` 频道开了新 thread
  - 最终 thread 收到 stdout tail "✓ task done"
- **通过**: 4 件事全发生 + task.json `status:'done'` `exit_code:0`

### T7 · single-enrich 全链 + auto-chain audit
- **做**: 在 forum 发 "Joe's Plumbing 0412345678 melbourne plumber"
- **证**: listener → single-enrich → pl:single-enrich → Places resolve → entity → 自动 createTask(audit) → dispatcher 接 audit
- **期望**:
  - task1 (single-enrich) status=done · 包含 entity_key + audit_chained=<task2_id>
  - task2 (audit) 出现 in data/tasks/ within 5s · status=done eventually
  - thread 顺序 reply：Task created (single-enrich) → done → 然后 audit task 在**新** thread（chain task 没用原 thread）
- **通过**: 2 task 都 done + entity 在 store 含 Places 信息

### T8 · image-extract 全链 (Discord 真附件)
- **做**: 用 ProfitsLocal Handoff bot create forum thread with image attachment (multipart upload via API)
- **证**: listener 下载 Discord CDN URL → vision LLM → 提取字段 → pl:ingest-image → entity
- **期望**:
  - thread 立刻收到 "📥 Received..." reply
  - 30-70s 后收到 "🔍 OCR/extract done · X · niche/city"
  - "Task created" reply with full args
  - dispatcher spawn pl:ingest-image (不是 exit=1)
  - task.json 含 `image.prep.ok` step
- **通过**: status=done + entity created · 不是 failed/human
- **失败容忍**: 如果 vision 缺 niche/city → status=human (这也是 OK 的，验证 fallback)

### T9 · audit kind (existing entity)
- **做**: forum 发 "audit place_chijczmikqbxkwsrv0uhynlsn20" (已存在 entity)
- **证**: kind=audit · args=['--entity-key', ...] · 触发 leads:run-pipeline
- **期望**: dispatcher claim → 跑 audit pipeline → 落 detailed-audit fixture → done
- **通过**: status=done + `data/v2/fixtures/detailed-audit/<key>.json` 更新

### T10 · dedup kind (未测覆盖 gap)
- **做**: forum 发 "dedup check"
- **证**: pl:dedup-audit 跑通
- **期望**: dispatcher spawn → 输出 `data/leads/dedup-review-queue.json` (可能为空也算 done)
- **通过**: status=done · CLI exit=0

### T11 · photos kind (未测覆盖 gap)
- **做**: forum 发 "download photos for place_chijczmikqbxkwsrv0uhynlsn20"
- **证**: pl:download-places-photos with entity-key 跑通
- **期望**: dispatcher spawn → photos 落 Cloudinary
- **通过**: status=done OR 合理 fail with 清晰原因（如 quota）

### T12 · ops kind
- **做**: forum 发 "run health check"
- **证**: ops:health-check 跑全 9 项检查
- **期望**: ~12-16s · stdout 包含 "All N checks passed"
- **通过**: status=done · stdout tail 在 thread

---

## 3. 失败 / 异常路径

### T13 · CLI 失败 → failed status
- **做**: 强制创建 task 用不存在的 cli (createTask kind=ops args=['fake-cli'])
- **证**: dispatcher 捕获 exit≠0 · 转 failed · 在 thread 报错
- **期望**: tag swap → failed · thread reply "✗ task failed (exit=N)" + stderr
- **通过**: status=failed · 不是 stuck running

### T14 · 超时 → human
- **做**: 设 `SOP0_TASK_TIMEOUT_MS=2000` · spawn 一个会跑 >2s 的 task (e.g. ops:health-check)
- **证**: dispatcher SIGTERM kill + 转 human
- **期望**: status=human · reason="timeout after 2000ms"
- **通过**: 子进程被杀 · task 不 stuck

### T15 · ollama down → regex fallback
- **做**: 停 ollama 服务 (`launchctl unload`)，发普通 task
- **证**: intent-router 回退到 regex · 不挂
- **期望**: provider='regex' in task.progress · 仍能完成 routing
- **通过**: task created · kind 合理（即使略糙）
- **清理**: 恢复 ollama

### T16 · Reaction ✅ 重跑（未测）
- **做**:
  1. 创建一个会失败的 task 让它进 `human` status
  2. 在该 thread 上加 ✅ reaction (非 bot 用户)
- **证**: handleReaction 触发 · transitionStatus human→pending · dispatcher 重新接管
- **期望**: thread reply "<user> retried task → status: pending" · 重新 spawn
- **通过**: task 再次跑通 + log "reaction add ✅ on thread ..."

### T17 · Reaction 🗑 放弃（未测）
- **做**: 同 T16 但加 🗑
- **证**: transitionStatus human→done · 不再 spawn
- **期望**: thread reply "<user> abandoned" · status=done · error 字段保留
- **通过**: status=done

---

## 4. 并发 + 边界

### T18 · 并发 task spawn
- **做**: 在 5s 内连发 3 个 intake task
- **证**: 3 个 task 都 claim 成功 · 不同时占用同一资源 · 都 done
- **期望**: 3 个 task.json + 3 batch 创建 · 无 stuck
- **通过**: 3/3 done

### T19 · Catch-up backfill
- **做**:
  1. 停 listener (`launchctl bootout`)
  2. 用 Handoff bot create forum thread (listener 不在 听不到)
  3. 启动 listener
- **证**: 启动时扫 active forum threads · 把那条无 task 的补建
- **期望**: log "catch-up: backfilling thread ..." · task created
- **通过**: backfilled=1 · task 正常进 pipeline

### T20 · Retention 归档
- **做**: 手动改一个 done task 的 updated_at 为 365d 前 · 跑 `npm run pl:task-retention`
- **证**: 移到 `data/tasks/_archive/YYYY-MM/`
- **期望**: 文件在 archive · listTasks() 不再返回 · findByThreadId 仍能找到 (scan _archive)
- **通过**: file 移动 + catch-up 不重 route

---

## 5. P5 push trigger

### T21 · 自动触发 enrich task
- **做**: 用 `upsertDiscoveryRun` 写入 thin-contact entity (no phone, no website)
- **证**: `mergeLeadIntoEntity` 检测 newly pending · `maybeSpawnEnrichTask` debounced 创建 enrich task
- **期望**: createTask kind=enrich · cli=pl:run-enrichment-batch · dispatcher 接管
- **通过**: enrich task in data/tasks/ within 1s

---

## 测试执行 plan

| 测试组 | 数量 | 估时 |
|---|---|---|
| §1 Routing 5 case (扩展现有 unit test) | T1-T5 | 30min |
| §2 E2E pipeline 7 case (Discord live) | T6-T12 | 1.5h (每个 ~10min · 等 LLM/CLI) |
| §3 失败/异常 5 case | T13-T17 | 1h |
| §4 并发/边界 3 case | T18-T20 | 45min |
| §5 push trigger 1 case | T21 | 15min |
| **总** | **21 cases** | **~4h** |

---

## 通过 / 失败 后续

- ✅ 21/21 全过 → SOP-0 v1.3 真正打 GA 标
- ❌ 任 1 个失败 → 写 incident report 在 `docs/SOP_0_INCIDENTS/<date>.md` · 修 root cause · 重跑该 test

---

## 测试不覆盖的（明确 out of scope）

- **Cloud failover / Mac off** → 这是 SOP-0 v2 的话题
- **PDF / audio 输入** → backlog
- **Discord rate limit 压测** → 不到那个量级
- **千 task/h 压测** → 同上
- **真实 Places API quota 上限** → 已有 PlacesQuotaGuard 保护
- **多 operator 并发改 reaction** → 单人公司不存在

---

## 自动化分级

- T1-T5: 可放 `scripts/qa/` 自动跑 (无 Discord 依赖)
- T13-T15, T18, T20, T21: 半自动 (创建 fake task + verify file/log)
- T6-T12, T16-T17, T19: **必须 Discord live** (有 forum thread + 真 LLM)，半人工 inspect

CI 跑 T1-T5 + T13-T15 + T20-T21 = 9 个自动 case · ~30s 总时长
