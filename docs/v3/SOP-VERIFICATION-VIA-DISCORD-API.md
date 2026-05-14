# SOP · 测试验证必须从 Discord API 取数据

> V3 D43 · Matthew 2026-05-14 cycle-7
> Lesson learned: 我多次报 "100% PASS" 之后 Matthew 在 Discord 立刻发现重大 bug。
> 根因：用**结构性指标**冒充**功能性指标**。
> 这个 SOP 强制：凡是涉及 Discord 可视化的验证，必须 fetch Discord API 取真数据。

---

## 0 · 适用范围

任何修改影响以下任一可视化的代码，**验证步骤必须包含 Discord API fetch**：

- `#website-tasks` · `#lead-discovery-runs` · `#website-leads` · `#website-projects` · `#paid-websites` · `bot-log` 任一 channel 的内容
- 任何 thread 的标题（title）
- 任何 thread 的消息内容（embed / content）
- 任何 thread 的 archived / locked / tag 状态
- profile card 渲染
- 5 stage audit messages 路由
- 任何「告诉客户/运营人员看什么」的输出

不在此列的纯内部数据（entity JSON 字段计算 / 后端流转）可以走 JSON 验证。

---

## 1 · 禁止当作 PASS 凭据的「假指标」

写测试 / 报 PASS 时，**以下任何一个单独都不算 PASS**：

| ❌ 假指标 | 为什么不算 | 真正应该 check |
|----------|-----------|---------------|
| `task.status === 'done'` | exit 0 只代表脚本跑完，不代表产生了对的工件 | fetch Discord API 看消息是否真的发出 |
| `doctor exit 0` | doctor 检查 daemon 健康，不检查 UI/消息 | 同上 |
| Entity JSON 字段存在 | JSON 写"已发送"不代表真发了 | fetch Discord 看消息真在那 |
| `refreshThreadAndPost ok:true` | **外层 ok 包了内层 fail · silent swallow** | 检查嵌套 `.msg.ok === true` |
| `openLeadThread.then(...)` 返回的 promise | fire-and-forget 错误被 catch 吃掉 | 用 await 拿结果 + 验证 |
| Agent 报告说 "PASS" | agent 没人监督会用假指标骗你 | 自己 fetch 一遍 |
| 我自己 render 的 profile card mock | mock 渲染对 ≠ Discord 显示对 | fetch 真 message embed |
| 文件存在 | 文件是旧的 / 内容是旧的 / 不会过期 | check mtime · check 内容 |
| `console.log` 看到打印 | log 看到 ≠ Discord 收到 | API fetch 验证 |

---

## 2 · 强制 Hard Evidence (Discord API)

凡是 Discord 可视化变化，PASS 报告必须包含**以下任一组**的实际 API 输出：

### Group A · 标题正确（rename / 新开 thread）
```bash
node --env-file=.env.local -e "
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const TID = '<thread_id>';
const r = await fetch('https://discord.com/api/v10/channels/' + TID, {
  headers: { Authorization: 'Bot ' + TOKEN }
});
const d = await r.json();
console.log('title:', d.name);
console.log('archived:', d.thread_metadata?.archived);
console.log('locked:', d.thread_metadata?.locked);
"
```
**PASS 条件**:
- title 完全等于期望（含 `[屋顶] [待发] [C] X` 这种）
- title 不含 `[?]`（cycle-5c 规定）
- archived / locked 状态符合期望

### Group B · 消息真发到了 thread（stage messages / summary）
```bash
node --env-file=.env.local -e "
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const TID = '<thread_id>';
const r = await fetch('https://discord.com/api/v10/channels/' + TID + '/messages?limit=50', {
  headers: { Authorization: 'Bot ' + TOKEN }
});
const ms = await r.json();
console.log('count:', ms.length);
for (const m of ms.reverse()) {
  const head = m.embeds?.[0]?.title || m.embeds?.[0]?.description?.slice(0,80) || m.content?.slice(0,80) || '(empty)';
  console.log('  ' + m.timestamp.slice(11,19) + ' | ' + head.replace(/\\n/g, ' '));
}
"
```
**PASS 条件**:
- 消息数量 ≥ 期望（profile card + N 个 stage + summary）
- 关键消息内容包含期望关键词
- 时间戳在本次 cycle 时间窗内

### Group C · channel 全局扫描（无 [?] · 无 stale / 无重复）
```bash
node --env-file=.env.local -e "
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CH = process.env.WEBSITE_LEADS_DISCORD_CHANNEL_ID;
// First get guild_id from channel
const ch = await fetch('https://discord.com/api/v10/channels/' + CH, {
  headers: { Authorization: 'Bot ' + TOKEN }
});
const cd = await ch.json();
// Then list active threads
const ar = await fetch('https://discord.com/api/v10/guilds/' + cd.guild_id + '/threads/active', {
  headers: { Authorization: 'Bot ' + TOKEN }
});
const ad = await ar.json();
const ours = (ad.threads || []).filter(t => t.parent_id === CH);
let anyQ = false;
for (const t of ours) {
  if (t.name.includes('[?]')) anyQ = true;
  console.log(t.id, t.name);
}
console.log('count:', ours.length, '· any [?]?', anyQ ? 'YES ❌' : 'NO ✓');
"
```
**PASS 条件**:
- 0 个 thread 标题含 `[?]`
- thread 数量符合期望（不漏不重）

### Group D · profile card embed 内容正确（phone clickable · 时间戳动态等）
```bash
node --env-file=.env.local -e "
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const TID = '<thread_id>';
const r = await fetch('https://discord.com/api/v10/channels/' + TID + '/messages?limit=30', {
  headers: { Authorization: 'Bot ' + TOKEN }
});
const ms = await r.json();
for (const m of ms) {
  if (m.embeds?.[0]?.fields) {
    for (const f of m.embeds[0].fields) {
      console.log('---' + f.name + '---');
      console.log(f.value);
    }
    break;
  }
}
"
```
**PASS 条件**:
- 电话/邮箱 含 `[...](tel:...)` / `[...](mailto:...)` markdown
- 时间字段含 `<t:UNIX:D>` / `<t:UNIX:R>` Discord 原生动态格式
- 「客户本地时间」之类不可动态字段**已删除**
- 其他字段渲染符合 SOP-DISCORD-DISPLAY 标准

---

## 3 · 强制每个 cycle 必跑的 4 步检查

每个修改触及 Discord 可视化的 cycle 收尾必须跑：

```bash
# 1. doctors green (basic health)
for d in pl-daemon pl-lead-journey pl-intake pl-audit pl-cascade pl-publish; do
  node scripts/cli/${d}-doctor.js >/dev/null 2>&1 && echo "$d ✓" || echo "$d ✗"
done

# 2. ALL #website-leads threads · 0 个 [?] · count 正确
# (Group C 那条命令)

# 3. 至少 1 个 thread 完整 5-stage / summary 都在
# (Group B 那条命令对一个具体 entity)

# 4. dispatcher log 最近 1h 没 silent fail
tail -200 data/tasks/_logs/v3-dispatcher.error.log | grep -E "fell back|discord_404|silent|skipped" || echo "no silent fails"
```

任一红 → **不算 cycle 完成 · 不能报 PASS · 必须修**。

---

## 4 · 报 PASS 模板（强制格式）

收尾给 Matthew 报告时**必须**贴 Group A + B + C 三组的真实 API 输出（不是描述、不是截图描述、不是 mock 渲染）：

```
PASS 验收 · cycle-X

[Group A · 标题 · 真实 API fetch]
title: [屋顶] [待发] [C] Queensland Roofing Pty Ltd
archived: false

[Group B · 消息 · 真实 API fetch · count + 时间戳]
count: 7
  11:38:07 | [屋顶] [待发] [C] Queensland Roofing Pty Ltd
  11:47:12 | **Audit pipeline 启动** · 4 stages · 预计 2-5 min
  11:47:13 | **Stage 3/4 · 分级 router** done  Grade: C ...
  ...

[Group C · channel 扫描 · 真实 API fetch]
count: 8 · any [?]? NO ✓

[Group D · 一个 entity 的 embed fields · 真实 API fetch]
---联系方式---
电话: [0489 263 653](tel:0489263653)
邮箱: [sales@...](mailto:sales@...)
```

**禁止**在 PASS 报告里出现：
- 自己 render 的 mock 输出（必须 fetch Discord 来）
- 任何 "应该" / "预计" / "估计" 描述
- 任何引用 entity JSON 当 PASS 证据的句子
- 任何 "agent 报告说" 当 PASS 证据的句子

---

## 5 · Snapshot 工具（可选 · 复用脚本）

`scripts/cli/pl-discord-snapshot.js`（建议建 · 现在没建）—— 一次性 fetch + 输出标准 PASS 报告：

```
npm run pl:discord-snapshot -- --entity <key>
npm run pl:discord-snapshot -- --channel leads
npm run pl:discord-snapshot -- --thread <id>
```

输出 Group A/B/C/D 全部 · stdout 直接当 PASS 证据贴。**待 Matthew 批准实施。**

---

## 6 · 已经验证过的反例（用来教训自己）

不要再犯：

| 日期 | 我说的 | 真相 |
|------|--------|------|
| cycle-1 | "0 P1 bugs · ready for Matthew test" | 用了 task.status=done · 没 fetch Discord · 你打开发现 stage 消息全在 bot-log |
| cycle-4 | "thread 不会有 [?] 了" | 没 fetch channel · 4 个 thread 标题还是 `[?]` |
| cycle-5 | "fixed P1-P5 · all green" | 1 个 thread 有 stage · 其他 7 个空壳 |
| cycle-5c | "all 8 threads · 0 [?]" | 这次对了（用了 Group C 命令）· 但报告里没贴消息内容 → 你打开发现 7 个空 |

每次都是因为**漏掉 Group B**（消息真在 thread 里）和**漏掉对每个 thread 的扫描**（只 sample 1 个就 generalize）。

---

## 7 · 强制 rule (从今天起)

1. **不 fetch Discord API · 不算 PASS · 不报 PASS**
2. **只 sample 1 个 thread 不算覆盖 · 必须扫全 channel**
3. **Group B 漏掉等于报告作废**
4. **PASS 报告必须贴 raw API 输出 · 不是描述**
5. **Cycle 之间不重启 dispatcher 就改完代码报 PASS = 假 PASS**（旧 dispatcher 跑的是旧代码）

违反任一条 = 不算完成 · Matthew 可以直接要求 redo。

---

## 8 · 后续待建（开发任务）

- `scripts/cli/pl-discord-snapshot.js` · 通用 PASS evidence collector
- `scripts/cli/pl-discord-doctor.js` · 加进 6 doctor 行列 · 每 hour 跑一次扫 channel：
  - 任何 thread 标题含 `[?]` → 红
  - 任何 thread 0 message（profile card 也没） → 红
  - 任何 thread 7+ 天没新消息但 phase 不是 archived → 黄
- 加 invariant 到 `pl-lead-journey-doctor.js`：所有 active `#website-leads` thread 都有至少 1 个 stage 或 summary 消息 (不只 profile card)

---

## 9 · 一句话

**Discord 上看不到 = 没做。**
不管 entity JSON 多漂亮、不管 task.status 多 done、不管 doctor 多绿。
