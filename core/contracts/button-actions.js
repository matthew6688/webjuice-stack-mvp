/**
 * core/contracts/button-actions.js · cycle-27 (Matthew 2026-05-16 "do button")
 *
 * Discord component button contract for operator manual override.
 * Replaces emoji-reaction interactions with explicit click buttons.
 *
 * Why buttons over emoji:
 *   - Visible label tells operator what each does
 *   - Works on archived threads (interaction doesn't need write permission)
 *   - Immediate ack ("Processing...") · no silent emoji confusion
 *   - Centralized routing via custom_id (vs scanning every reaction)
 *
 * Discord button limits:
 *   - 5 buttons per action_row · 5 rows per message · max 25 buttons
 *   - custom_id max 100 chars
 *   - Style: 1=PRIMARY(blue) 2=SECONDARY(gray) 3=SUCCESS(green) 4=DANGER(red)
 */

/**
 * All actions operator can take. Each has:
 *   - id: short slug used in custom_id
 *   - label: text shown on button (Chinese, ≤6 char preferred)
 *   - emoji: optional inline emoji prefix
 *   - style: button color (1-4)
 *   - description: what it does (operator-facing)
 *   - applicable: phases where this action makes sense
 */
export const BUTTON_ACTIONS = Object.freeze({
  approve: {
    id: 'approve',
    label: '推进',
    emoji: '🚀',
    style: 1,
    description: '强制推进到下一 stage (build / publish)',
    applicable: ['qa-pending', 'audit-pending', 'audit-ready'],
  },
  archive: {
    id: 'archive',
    label: '归档',
    emoji: '🗄',
    style: 4,
    description: '终止 lead · grade=D · 归档 thread',
    applicable: ['*'],
  },
  reaudit: {
    id: 'reaudit',
    label: '重审',
    emoji: '🔄',
    style: 2,
    description: '强制重跑 detailed audit (覆盖旧 fixture)',
    applicable: ['*'],
  },
  upgrade: {
    id: 'upgrade',
    label: '升级',
    emoji: '⬆️',
    style: 3,
    description: '升 priority (插队 audit queue)',
    applicable: ['audit-pending', 'audit-ready'],
  },
  qa_mark: {
    id: 'qa_mark',
    label: '待复核',
    emoji: '📋',
    style: 2,
    description: '标 qa-pending · 等 operator 补字段',
    applicable: ['audit-ready', 'ready-to-build'],
  },
});

/**
 * Encode {action, entityKey} → Discord custom_id string.
 * Format: `pl:<action>:<entityKey>`
 * Max 100 chars · entityKey for V3 (place_chij... ~30 char) safe.
 */
export function buildCustomId(action, entityKey) {
  if (!action || !entityKey) throw new Error('action + entityKey required');
  const id = `pl:${action}:${entityKey}`;
  if (id.length > 100) throw new Error(`custom_id too long: ${id.length} > 100`);
  return id;
}

/**
 * Decode Discord button custom_id → {action, entityKey} or null if not ours.
 */
export function parseCustomId(customId) {
  if (typeof customId !== 'string') return null;
  const parts = customId.split(':');
  if (parts.length < 3 || parts[0] !== 'pl') return null;
  const action = parts[1];
  if (!BUTTON_ACTIONS[action]) return null;
  return { action, entityKey: parts.slice(2).join(':') };
}

/**
 * Build a single Discord button component object.
 */
export function buildButton(actionKey, entityKey) {
  const def = BUTTON_ACTIONS[actionKey];
  if (!def) throw new Error(`Unknown action: ${actionKey}`);
  return {
    type: 2, // BUTTON
    style: def.style,
    label: def.label,
    emoji: def.emoji ? { name: def.emoji } : undefined,
    custom_id: buildCustomId(def.id, entityKey),
  };
}

/**
 * Build an action_row containing 1-5 buttons. Auto-validates count.
 */
export function buildActionRow(entityKey, actionKeys) {
  if (!Array.isArray(actionKeys) || actionKeys.length === 0) return null;
  if (actionKeys.length > 5) throw new Error(`max 5 buttons per row · got ${actionKeys.length}`);
  return {
    type: 1, // ACTION_ROW
    components: actionKeys.map((k) => buildButton(k, entityKey)),
  };
}
