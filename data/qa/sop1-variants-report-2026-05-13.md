# SOP-1 入口变体 + Discord 真触发 完整覆盖测试报告

生成: 2026-05-13 · 跑了 5 个 CLI 变体 + 4 个 Discord 真触发 = 9 个 case

---

## Part A · CLI 直触发 5 变体

| Case | 调用 | 结果 | 备注 |
|---|---|---|---|
| **places-multi** | `pl:places-search-intake --query "cafe brisbane" --query "cafe gold coast" --limit 2` | ✅ **CLI 跑通** · 4 entity 真落盘 · 但 task 标 `human` | dispatcher 120s 超时不够多 query · CLI 自己 OK |
| **single-phone** | `pl:single-enrich --phone 0731717777 --no-chain` | ❌ **0 results from Places textSearch** | pre-existing bug: textSearch 不索引电话号 · 应用 `findPlaceFromText` |
| **single-url** | `pl:single-enrich --gbp-url https://maps.google.com/?cid=...` | ❌ **query is required** | pre-existing bug: --gbp-url 接收但根本没解析 · 直接走 textSearch 空 query |
| **single-chained** | `pl:single-enrich --business-name "Bond Plumbing" --city gold-coast --niche plumber` (默认 chain) | ✅ **DONE** · chained audit task 也 DONE 用时 6 min | 链式 audit 完整跑通 (leads:run-pipeline 366s) |
| **image-card** | `pl:ingest-image --image <png> --business-name 'Dicki's New Farm' --phone 0731717777 --niche restaurant --city brisbane` | ✅ **DONE** · `image_dicki-s-new-farm_0731717777.json` 落盘 | G-6.1 OCR auto 未做 · 但手填字段路径 OK |

### CLI 变体 · 真实 entity 写盘统计

- **places-multi**: 4 个 `place_chij*` (cafe brisbane + cafe gold coast 各 2)
- **single-chained**: 1 个 (Bond Plumbing) + audit 完成
- **image-card**: 1 个 `image_dicki-s-new-farm_0731717777`

总计: **6 个 entity** 从变体测试写入 store

---

## Part B · Discord 真触发 4 case (listener routing 路径)

测试方法: 临时 `LISTENER_ALLOW_BOTS=1` 跑 listener · bot 发 4 条 forum thread · 验证 listener 真处理 + routing

| Query 文本 | Router 判 kind | 落到 CLI | 跑通? |
|---|---|---|---|
| `find sydney plumbers` | intake ✅ | pl:pipeline-batch-start | ❌ **未提取 niche/city flag** |
| `search "roofer hobart" "roofer launceston"` | places-intake ✅ | pl:places-search-intake | ✅ running → done |
| `"Bond Plumbing" (07)55735253 gold coast` | single-enrich ✅ | pl:single-enrich | ✅ DONE |
| `audit https://maps.app.goo.gl/4q9SShXJEKEMaqGZA` | audit ✅ | pl:run-pipeline | ❌ **2 bug** |

### Listener routing bug 详情

**Bug L-1 · intake 不抽 flag**
- 触发: 自然语言 `find sydney plumbers`
- 现象: dispatcher 跑 `pl:pipeline-batch-start find sydney plumbers` (raw text 作 args)
- 错误: `--niche required`
- 原因: `intent-router.js` `extractArgsFromText(text, 'intake')` 没有把"X in Y"或"X Y plumbers"解析成 `--niche plumber --city sydney`
- 修复方向: regex 抽取 niche 词 (plumber/roofer/cafe/etc) + city 词 + 传 flag

**Bug L-2 · audit 路由用错 npm script 名**
- 触发: `audit <URL>`
- 现象: dispatcher 跑 `pl:run-pipeline` → npm error "missing script"
- 真实名: `leads:run-pipeline` (一年前改名后路由表没同步)
- 文件: `core/tasks/intent-router.js:189` 已经写对了 `leads:run-pipeline`，所以 LLM router 输出错了。需查 LLM prompt 或 LLM fallback

**Bug L-3 · audit 把 URL 当 entity_key**
- 同上 case
- args: `--entity-key https://maps.app.goo.gl/4q9SShXJEKEMaqGZA`
- 应当: 先 resolve URL → entity_key (chain via single-enrich first) · 再传给 audit
- 这条比 L-2 影响小 (因为 L-2 先失败)

---

## Part C · 4 个原入口实际"安全到达 SOP-2"清单

| 入口 | CLI 直触发 | Discord 真触发 | 整体可用度 |
|---|---|---|---|
| **batch-maps** | ✅ chained 链路通 (cairns + gold-coast 测过) | ❌ L-1 阻塞 (操作员必须 manual 传 niche/city) | 🟡 50% · 需修 L-1 |
| **places-api** | ✅ 多 query 也通 (4 entity 落盘) | ✅ Discord 真触发也通 | 🟢 100% |
| **single-enrich** | ✅ name+city+niche · ✅ 链式 audit · ❌ 纯电话 · ❌ 纯 URL | ✅ "name + phone + city" Discord 触发通 | 🟡 75% · phone/URL 变体待修 |
| **image** | ✅ 手填字段路径通 | ⏭ 未在本轮测 (需 Discord 真上传 + vision OCR) | 🟢 80% · 自动 OCR (G-6.1) 仍 TODO |

---

## Part D · 下一步该修什么 (按业务阻塞优先)

| # | 修什么 | 阻塞 | 工程量 |
|---|---|---|---|
| 🔴 1 | **L-1 listener routing 不抽 niche/city** · 让"find sydney plumbers"真触发 batch-maps | 主流量入口废 | 1h (regex 加 extractArgsFromText) |
| 🟡 2 | **L-2 LLM router 错 CLI 名** · audit 路由到 pl:run-pipeline 应是 leads:run-pipeline | audit 入口 100% 废 | 30 min (查 LLM prompt) |
| 🟡 3 | **places-multi dispatcher 超时短** · 多 query 跑超 120s 标 human | UX bug · 实际数据没丢但状态显示错 | 30 min (per-CLI timeout override) |
| 🟢 4 | **single-phone Google API 用错** · textSearch → findPlaceFromText with phonenumber | 操作员场景 · 当前必须给 name | 1h |
| 🟢 5 | **single-url 不解析 GBP URL** · 接收 --gbp-url 但没抽 place_id | 操作员场景 · 当前必须给 name | 1h (URL parser) |
| ⚪ 6 | **L-3 audit 把 URL 当 entity_key** · 先 resolve · 然后 chain audit | 同 L-2 修后才用得到 | 1h |
| ⚪ 7 | **image G-6.1 auto OCR** | 当前必须手填字段 | 4h |

---

## Part E · Discord 见证 thread

| Thread | 用途 | URL |
|---|---|---|
| `🧪 SOP-1 live demo` | 3 案例首跑 (places/single/batch) | https://discord.com/channels/1493925728570310756/1503871766991208488 |
| `🧪 SOP-1 变体覆盖` | 5 变体 (含失败) | https://discord.com/channels/1493925728570310756/1503874300690825359 |
| `🧪 listener test · find sydney plumbers` | Discord 真触发 #1 | https://discord.com/channels/1493925728570310756/1503876917483274310 |
| `🧪 listener test · multi-query places` | Discord 真触发 #2 | https://discord.com/channels/1493925728570310756/1503876932067131594 |
| `🧪 listener test · single name+phone` | Discord 真触发 #3 (✅ 跑通) | https://discord.com/channels/1493925728570310756/1503876947099254824 |
| `🧪 listener test · single GBP URL` | Discord 真触发 #4 (audit 失败) | https://discord.com/channels/1493925728570310756/1503876961435390022 |
