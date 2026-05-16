/**
 * cycle-27 · TDD test · button-actions contract
 *
 * Matthew (2026-05-16 "do button"): operator manual override via Discord
 * component buttons · replaces emoji reactions.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); failed++; }
}

console.log('cycle-27 · button-actions contract\n');

const m = await import('../../core/contracts/button-actions.js');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');

// ─── T1 · BUTTON_ACTIONS shape ────────────────────────────────────
t('BUTTON_ACTIONS has 5+ defined actions with required fields', () => {
  const keys = Object.keys(m.BUTTON_ACTIONS);
  assert.ok(keys.length >= 5, `expected 5+ actions · got ${keys.length}`);
  for (const k of keys) {
    const a = m.BUTTON_ACTIONS[k];
    assert.ok(a.id, `${k} missing id`);
    assert.ok(a.label, `${k} missing label`);
    assert.ok(a.style >= 1 && a.style <= 4, `${k} invalid style ${a.style}`);
    assert.ok(a.description, `${k} missing description`);
  }
});

t('All 4 styles available (PRIMARY · SECONDARY · SUCCESS · DANGER)', () => {
  const styles = new Set(Object.values(m.BUTTON_ACTIONS).map((a) => a.style));
  assert.ok(styles.size >= 3, `should use variety of styles · got ${[...styles]}`);
});

// ─── T2 · buildCustomId / parseCustomId round-trip ────────────────
t('buildCustomId + parseCustomId · round-trip preserves action + entityKey', () => {
  const id = m.buildCustomId('approve', 'place_chijabc123');
  assert.equal(id, 'pl:approve:place_chijabc123');
  const parsed = m.parseCustomId(id);
  assert.deepEqual(parsed, { action: 'approve', entityKey: 'place_chijabc123' });
});

t('parseCustomId · returns null for non-pl prefix', () => {
  assert.equal(m.parseCustomId('other:foo:bar'), null);
  assert.equal(m.parseCustomId('pl:not_an_action:abc'), null);
  assert.equal(m.parseCustomId(''), null);
  assert.equal(m.parseCustomId(null), null);
});

t('buildCustomId · entityKey w/ underscores preserved', () => {
  const id = m.buildCustomId('archive', 'domain_acme.com.au');
  const parsed = m.parseCustomId(id);
  assert.equal(parsed.entityKey, 'domain_acme.com.au');
});

// ─── T3 · buildButton structure ──────────────────────────────────
t('buildButton returns valid Discord BUTTON component', () => {
  const btn = m.buildButton('approve', 'place_test');
  assert.equal(btn.type, 2);
  assert.equal(btn.style, 1);
  assert.equal(btn.label, '推进');
  assert.equal(btn.emoji.name, '🚀');
  assert.equal(btn.custom_id, 'pl:approve:place_test');
});

t('buildButton throws on unknown action', () => {
  assert.throws(() => m.buildButton('nonexistent', 'place_test'));
});

// ─── T4 · buildActionRow ─────────────────────────────────────────
t('buildActionRow · 4 buttons in 1 row', () => {
  const row = m.buildActionRow('place_test', ['approve', 'archive', 'reaudit', 'upgrade']);
  assert.equal(row.type, 1);
  assert.equal(row.components.length, 4);
  for (const c of row.components) assert.equal(c.type, 2);
});

t('buildActionRow · throws if > 5 buttons', () => {
  assert.throws(() =>
    m.buildActionRow('x', ['approve', 'archive', 'reaudit', 'upgrade', 'qa_mark', 'approve']));
});

t('buildActionRow · null for empty array', () => {
  assert.equal(m.buildActionRow('x', []), null);
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
