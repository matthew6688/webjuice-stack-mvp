# SOP-X-Dedup · 跨源去重业务逻辑

**版本**: v1.0
**最近更新**: 2026-05-12
**配套页面**: [`/admin/v2-leads/dedup-review`](/admin/v2-leads/dedup-review) · [`/admin/v2-leads/dedup-overview`](/admin/v2-leads/dedup-overview)
**Owner**: 本文档 — entity 去重所有业务规则在这里，**SOP-1 / SOP-2 引用时只能链接，不能重述**

---

## 0. 一句话

> 用 3 把唯一性钥匙（`place_id` / 电话 / 网站域名）找重复 lead。**place_id 一致 → 自动合并**；其他钥匙命中 → 进队列等操作员一秒判断。

---

## 1. 3-key dedup 策略

**就 3 把钥匙，不复杂**：

| 钥匙 | 字段 | 强度 | 处理 |
|---|---|---|---|
| **1. place_id** | `entity.identifiers.place_id` | 🔵 100% 同一商户 | **自动合并**（无需操作员） |
| **2. phoneDigits** | `entity.identifiers.phoneDigits`（电话去空格/+/-，取后 10 位） | 🟢 99% 同一商户 | 进 review 队列 |
| **3. websiteDomain** | `entity.identifiers.websiteDomain`（取 root domain，去 www.）| 🟢 99% 同一商户 | 进 review 队列 |

### 1.1 不在 v1 范围（边缘 case，1% 不到）

- 名字模糊匹配（"ACME Roofing Pty Ltd" vs "ACME Roofing"）→ v2 再加
- 同公司多店共用一个电话 → 进 review 队列让操作员看
- email 字段 → 我们大多数 lead 没采集到，先不做

---

## 2. 合并协议

### 2.1 Auto-merge (place_id 命中)

写入新 entity 时若 `place_id` 在 store 已存在 → 已有的 `mergeLeadIntoEntity` 路径处理 (`runs[]` 累积，`latest` 字段合并)。**已经在跑，无需改**。

### 2.2 Operator-confirmed merge

操作员在 `/admin/v2-leads/dedup-review` 看到一对疑似 → 点 **"合并"** → 后端跑 `pl:dedup-merge K1 K2`：

```
winner    = 优先 K1 (有 place_id 的赢；若都有或都没，选 firstSeenAt 早的)
loser     = K2

操作:
  1. winner.runs[]    += loser.runs[]      (合并历史 runs，最多保留 20)
  2. winner.batches[] += loser.batches[]   (合并 batch tags，最多 20，dedup)
  3. winner.history[] += loser.history[]   (合并事件流，最多 100)
  4. winner.lastSeenAt = max(both)
  5. winner.merged_from = [...prev, loser.entityKey]   (追溯字段)
  6. loser.merged_into  = winner.entityKey             (标记，不删)
  7. loser.status       = 'merged'                     (新 status 值)
  8. loser.archivedAt   = now                          (软删)
  9. dedup-events.jsonl append: { at, action: 'merged', winner, loser, operator }
```

**关键决策**：**loser 不物理删**，标 `merged_into` 归档。理由：保留历史 + 可撤销 (`pl:dedup-undo`)。

### 2.3 Operator-confirmed not-duplicate

操作员点 **"不同"** → 在 `data/leads/dedup-decisions.json` 记录 `{K1, K2, decision: 'different', at, operator}`。下次 audit 不再 flag 这对。

---

## 3. 嫌疑队列

`data/leads/dedup-review-queue.json`：

```json
{
  "generatedAt": "2026-05-12T...",
  "totalSuspects": 5,
  "suspects": [
    {
      "id": "phone:0410607076",
      "matchKey": "phoneDigits",
      "matchValue": "0410607076",
      "entityKeys": ["place_chij...", "image_acme-roofing_0410607076"],
      "namesPreview": ["ACME Roofing Pty Ltd", "ACME Roofing"],
      "firstSeen": "2026-05-09T..."
    },
    ...
  ]
}
```

每对嫌疑唯一 id = `<matchKey>:<matchValue>`，重新 audit 时同 id 不重复入队（已被操作员裁决过的 + dedup-decisions.json 记录的 跳过）。

---

## 4. CLI

### 4.1 `pl:dedup-audit [--niche X]`

只读，跑 detector 输出嫌疑队列：
- 构建 3 个 hash 表 (place_id, phoneDigits, websiteDomain) → entityKeys[]
- 任一 key 的 entityKeys.length > 1 → 进 queue（除非已有 'different' 裁决）
- 写 `data/leads/dedup-review-queue.json`
- 报告：`{ scanned, place_id_dups, phone_dups, domain_dups, total_suspects, ms }`

### 4.2 `pl:dedup-merge --winner K1 --loser K2 [--operator NAME]`

按 §2.2 协议执行。要求：
- `--confirm` flag 防误操作（不带就 dry-run）
- 跑前 backup loser entity 到 `data/leads/dedup-backups/<loser-key>-<ts>.json`
- 写 `dedup-events.jsonl`

### 4.3 `pl:dedup-undo --loser K2`

读 backup，恢复 loser entity 到 store + 移除 winner 的 `merged_from` 末位 + jsonl append undo event。

---

## 5. Operator 决策 UI

`/admin/v2-leads/dedup-review`：
- 读 `dedup-review-queue.json`
- 渲染每对嫌疑两栏 side-by-side（name / phone / website / address / city / niche / firstSeenAt）
- 3 个按钮：**合并** / **不同** / **跳过**（稍后再决定）

`/admin/v2-leads/dedup-overview`：
- 嫌疑队列长度
- 5-层策略说明（其实是 3 层 + auto-merge layer + manual layer）
- 历史合并事件列表（从 `dedup-events.jsonl` 读最近 20 条）

---

## 6. 健康监控

`ops:health-check` 新增项：
- "Dedup review queue 长度 > 20" → 推 Discord (warn)
- "queue 长度 > 100" → error，怕操作员 fatigue

---

## 7. Scale 注意

- 当前 ~82 entities，直接 O(N²) 比较也才 6,724 次，无所谓
- > 1000 entities → hash 表已经 O(N)，没问题
- > 10,000 entities → 单文件 entity 读盘是瓶颈（不是 dedup 逻辑），那时考虑 SQLite

---

## 8. 跨 SOP 引用

- Entity schema 字段定义 → 见 [SOP-X-Handoff](SOP_HANDOFF_CONTRACT.md)
- `place_id` 来源 (gosom) → 见 [SOP-1 §3](SOP_1_INTAKE_DISCOVERY.md#3-主入口操作链路--gosom-docker-scraper)
- `image_<slug>_<phone>` entityKey 生成规则 → 见 [SOP-1 §2.1](SOP_1_INTAKE_DISCOVERY.md#21-image-lead-v2-vs-v1重要)
