/**
 * core/contracts/audit-stage-content.js · cycle-27 (Matthew 2026-05-15)
 *
 * v2 typography contract + markdown helpers for per-entity Stage 1-9 messages
 * posted to #website-leads / #website-projects lead threads.
 *
 * Sister to `batch-thread-messages.js` (which handles #lead-discovery-runs
 * batch thread). Same typography rules · different audience.
 *
 * Plan reference: docs/v3/CYCLE-27-RICH-STAGES.md
 *
 * Typography rules (locked · validated visually on BCV thread):
 *   - 正文零 emoji · status only ✓/✗ sparingly
 *   - 没数据 `—` (em-dash) 占位 · 不删行
 *   - `## ` for stage header · `### ` for subsection · `__under__` for sub-block
 *   - `**bold**` 关键数字 · 状态强调
 *   - `*italic*` 「普通话翻译」一行
 *   - `> blockquote` 客户影响 / takeaway
 *   - `` `inline code` `` 值 / ID / 文件名
 *   - `-# subtext` 元数据 / evidence 链接
 *   - `———` major section 分隔 (上下 1 空行)
 *   - bullet list `-` (字段 ≥ 3 项)
 *   - 单条 ≤ 2000 char · 超了拆 2 条
 */

import { STAGE_LABELS } from './discord-messages.js';

export const PLACEHOLDER = '—';
export const MAX_MESSAGE_LENGTH = 2000;

// cycle-27 (Matthew 2026-05-15): re-export contract STAGE_LABELS so v2 builders
// have one place to import. DO NOT redefine literals · lint blocks.
export const STAGE_TITLES = STAGE_LABELS;

/**
 * Format the value for a row · null/undefined/'' → em-dash placeholder.
 * Strings are returned as-is. Numbers/bools converted to string.
 */
export function fmtVal(v) {
  if (v === null || v === undefined || v === '') return PLACEHOLDER;
  if (typeof v === 'boolean') return v ? '是' : '否';
  return String(v);
}

/**
 * Single key/value row: `- key: value`.
 * If value is null/'' · renders em-dash.
 */
export function fmtRow(key, value) {
  return `- ${key}: ${fmtVal(value)}`;
}

/**
 * Multiple rows from an array of [key, value] pairs.
 */
export function fmtRows(pairs) {
  return pairs.map(([k, v]) => fmtRow(k, v)).join('\n');
}

/**
 * Inline code: `` `value` ``. null → em-dash (no backticks).
 */
export function fmtCode(v) {
  if (v === null || v === undefined || v === '') return PLACEHOLDER;
  return '`' + String(v) + '`';
}

/**
 * Stage header: `## Stage N/9 · 标题` with optional suffix `· 30s`.
 */
export function fmtStageHeader(stageNum, suffix = null) {
  const title = STAGE_TITLES[stageNum] || `Stage ${stageNum}`;
  return suffix ? `## ${title} · ${suffix}` : `## ${title}`;
}

/**
 * Sub-section header (within stage): `__title__` with optional inline subtext `   -# explainer`.
 * Underline style is the v2 secondary heading style.
 */
export function fmtSubHeader(title, subtext = null) {
  return subtext ? `__${title}__   -# ${subtext}` : `__${title}__`;
}

/**
 * Italic "普通话翻译" line · single-line plain-language explainer.
 */
export function fmtTranslation(line) {
  return `*${line}*`;
}

/**
 * Multi-line blockquote · used for customer impact / takeaway / quoted source.
 * Each line gets prefixed with `> `.
 */
export function fmtBlockquote(text) {
  if (!text) return `> ${PLACEHOLDER}`;
  const lines = String(text).split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.map((l) => `> ${l}`).join('\n');
}

/**
 * Subtext (small grey · metadata / evidence link / footer note).
 */
export function fmtSubtext(text) {
  return `-# ${text}`;
}

/**
 * Major section separator · `———` with surrounding blank lines.
 * Use BETWEEN top-level sections within a single message.
 */
export const SEPARATOR = '\n\n\n———\n\n\n';

/**
 * Markdown link · [text](url) · null url → em-dash.
 */
export function fmtLink(text, url) {
  if (!url) return PLACEHOLDER;
  return `[${text || url}](${url})`;
}

/**
 * Critical issue card (used in Stage 3 / Stage 4 top-3 痛点).
 * Returns:
 *   **N · title**
 *
 *   *plain-language explainer*
 *
 *   > impact line 1
 *   > impact line 2
 *
 *   -# evidence: [link] or —
 */
export function fmtCriticalIssue(n, { title, plain, impact, evidence = null, evidenceLabel = 'evidence' }) {
  const lines = [];
  lines.push(`**${n} · ${title}**`);
  lines.push('');
  if (plain) {
    lines.push(fmtTranslation(plain));
    lines.push('');
  }
  if (impact) {
    lines.push(fmtBlockquote(impact));
    lines.push('');
  }
  if (evidence) {
    lines.push(fmtSubtext(`${evidenceLabel}: ${fmtLink(null, evidence)}`));
  } else {
    lines.push(fmtSubtext(`${evidenceLabel}: ${PLACEHOLDER}`));
  }
  return lines.join('\n');
}

/**
 * Truncate body to MAX_MESSAGE_LENGTH with ellipsis footer.
 * Caller should split into 2 messages before reaching this fallback.
 */
export function safeTruncate(body, max = MAX_MESSAGE_LENGTH) {
  if (body.length <= max) return body;
  const cutoff = max - 80;
  return body.slice(0, cutoff) + '\n\n…\n\n-# 内容被截断 · 见 master.md 报告链接';
}

/**
 * Joiner that interleaves with SEPARATOR · skipping empty sections.
 */
export function joinSections(sections) {
  return sections.filter((s) => s && String(s).trim().length > 0).join(SEPARATOR);
}
