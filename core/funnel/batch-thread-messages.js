/**
 * core/funnel/batch-thread-messages.js · cycle-27 (Matthew 2026-05-15)
 *
 * v2 markdown builders for #lead-discovery-runs batch thread messages.
 *
 * Typography rules (锁定 · 看 docs/v3/CYCLE-27-RICH-STAGES.md):
 *   - 正文零 emoji · 状态仅 ✓/✗ 谨慎用
 *   - 没数据 `—` (em-dash) 占位 · 不删行
 *   - `## ` for section header
 *   - `**bold**` 强调关键数字
 *   - `__underline__` 子区块标题
 *   - `*italic*` 「普通话翻译」一行
 *   - `> blockquote` 客户影响 / 解释
 *   - `` `inline code` `` 值 / ID / 文件名
 *   - `-# subtext` 元数据
 *   - `———` 分隔 (上下 1 空行)
 *   - bullet list `-` (字段 ≥ 3 项)
 *   - 单条 ≤ 2000 char
 */

const PLACEHOLDER = '—';

/**
 * Batch thread starter (replaces 🚀 批次流水线已启动).
 *
 * @param {object} ctx
 * @param {string} ctx.batchId · canonical batch id
 * @param {string|null} ctx.niche
 * @param {string|null} ctx.city
 * @param {number} ctx.count · expected_total
 * @param {string|null} ctx.source · e.g. 'gosom docker' | 'google places api'
 * @param {object} ctx.runFlags · k=v pairs
 * @param {string|null} ctx.startedAt · ISO timestamp
 */
export function batchStartMessage({ batchId, niche, city, count, source = null, runFlags = {}, startedAt = null } = {}) {
  const lines = [];
  lines.push('## 批次启动');
  lines.push('');
  lines.push('');
  lines.push('**基本参数**');
  lines.push(`- 行业: \`${niche || PLACEHOLDER}\``);
  lines.push(`- 城市: \`${city || PLACEHOLDER}\``);
  lines.push(`- 目标: **${count != null ? count : PLACEHOLDER}** 个商家`);
  lines.push(`- 数据源: ${source ? `\`${source}\`` : PLACEHOLDER}`);
  lines.push('');
  lines.push('');
  lines.push('-# batch_id: `' + batchId + '`');
  if (startedAt) lines.push(`-# 启动时间: ${startedAt}`);

  const flagPairs = Object.entries(runFlags || {});
  if (flagPairs.length > 0) {
    lines.push('-# flags: ' + flagPairs.map(([k, v]) => `${k}=${v}`).join(' · '));
  }
  return lines.join('\n');
}

/**
 * Search done (replaces 🔎 搜索).
 *
 * @param {object} ctx
 * @param {string} ctx.query · raw search query
 * @param {number} ctx.count · candidates found
 * @param {boolean} [ctx.withDetails=false] · whether details API will follow
 * @param {boolean} [ctx.failed=false] · search returned 0 / errored
 */
export function batchSearchMessage({ query, count, withDetails = false, failed = false } = {}) {
  const lines = [];
  lines.push('## 搜索');
  lines.push('');
  lines.push('');
  lines.push(`- 查询: \`${query || PLACEHOLDER}\``);
  lines.push(`- 商家数: **${count != null ? count : PLACEHOLDER}**`);
  if (failed || count === 0) {
    lines.push('');
    lines.push('');
    lines.push('> 没找到任何商家 · 批次结束');
  } else if (withDetails) {
    lines.push('');
    lines.push('');
    lines.push('-# 正在拉详细信息 (phone / hours / website)');
  }
  return lines.join('\n');
}

/**
 * Entity intake + LLM judge (replaces 📥 写入实体 + inline ⚠️ LLM 校验).
 *
 * @param {object} ctx
 * @param {number} ctx.count · entities inserted
 * @param {string[]} ctx.entityNames · ALL business names (full list · not just top-3)
 * @param {object|null} ctx.llmJudge · { verdict, reason, suspicious_picks[], confidence, provider }
 */
export function batchEntityWriteMessage({ count, entityNames = [], llmJudge = null, note = null } = {}) {
  const lines = [];
  lines.push('## 写入实体');
  lines.push('');
  lines.push('');
  lines.push(`**${count != null ? count : PLACEHOLDER} 个商家入库**`);
  lines.push('');
  if (entityNames.length > 0) {
    for (const n of entityNames) lines.push(`- ${n || PLACEHOLDER}`);
  } else {
    lines.push(`- ${PLACEHOLDER}`);
  }

  if (llmJudge) {
    lines.push('');
    lines.push('');
    lines.push('———');
    lines.push('');
    lines.push('');
    lines.push('__LLM 校验__   -# 校验入库结果是否真实属于该 niche');
    lines.push('');
    lines.push(`verdict: \`${llmJudge.verdict || PLACEHOLDER}\`` + (llmJudge.confidence != null ? ` · confidence \`${llmJudge.confidence}\`` : ''));
    if (llmJudge.reason) {
      lines.push('');
      const reasonLines = String(llmJudge.reason).split('\n').filter(Boolean);
      for (const r of reasonLines) lines.push(`> ${r}`);
    }
    const suspicious = llmJudge.suspicious_picks || [];
    lines.push('');
    lines.push('可疑名单:');
    if (suspicious.length > 0) {
      for (const s of suspicious) lines.push(`- ${s}`);
    } else {
      lines.push(`- ${PLACEHOLDER}`);
    }
    if (llmJudge.provider) {
      lines.push('');
      lines.push(`-# provider: \`${llmJudge.provider}\``);
    }
  }
  if (note) {
    lines.push('');
    lines.push(`-# ${note}`);
  }
  return lines.join('\n');
}

/**
 * Dedup audit (replaces 🔍 去重审核).
 *
 * @param {object} ctx
 * @param {number} ctx.dupGroups · how many duplicate clusters found
 * @param {number|null} [ctx.suspectCount=null] · entities flagged for review
 */
export function batchDedupMessage({ dupGroups, suspectCount = null } = {}) {
  const lines = [];
  lines.push('## 去重审核');
  lines.push('');
  lines.push('');
  lines.push(`- 重复组数: **${dupGroups != null ? dupGroups : PLACEHOLDER}**`);
  lines.push(`- 嫌疑 entity 数: ${suspectCount != null ? `**${suspectCount}**` : PLACEHOLDER}`);
  lines.push('');
  lines.push('');
  if (dupGroups === 0) {
    lines.push('> 数据库干净 · 无重复');
  } else {
    lines.push(`> 找到 **${dupGroups}** 组重复 · 等 operator 审`);
    lines.push('');
    lines.push('-# 审 dedup-review-queue.json · `/admin/v2-leads/dedup-review`');
  }
  return lines.join('\n');
}

/**
 * Batch finalize (replaces 🏁 批次完成).
 * 不重复 LLM 校验细节 (已经在 写入实体 message 里) · 只总结链路启动状态。
 *
 * @param {object} ctx
 * @param {string|null} ctx.query
 * @param {number} ctx.count · entities upserted
 * @param {number|null} [ctx.expectedTotal=null]
 */
export function batchFinalizeMessage({ query = null, count, expectedTotal = null } = {}) {
  const lines = [];
  lines.push('## 批次完成');
  lines.push('');
  lines.push('');
  if (query) lines.push(`- 查询: \`${query}\``);
  lines.push(`- 入库: **${count != null ? count : PLACEHOLDER}** 个商家`);
  if (expectedTotal != null) {
    lines.push(`- 目标: \`${expectedTotal}\``);
  }
  lines.push('- 链路: audit chain 已自动触发');
  lines.push('');
  lines.push('');
  lines.push('-# 详情见各 lead thread · 最终 KPI dashboard 跑完所有 entity 后贴出');
  return lines.join('\n');
}
