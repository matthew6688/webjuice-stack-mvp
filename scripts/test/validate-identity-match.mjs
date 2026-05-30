/**
 * validate-identity-match.mjs · 用真实实体 + 真实牌照库验证 identity-match。
 *
 * 对每个真实实体: 查牌照库 → 把匹配到的牌照行当 candidate 过 identity-match → 统计 verified/discarded/
 * not_found 分布 + 原因码分布, 并按桶抽样打印, 人工眼检 false-verify(认错) / false-discard(误杀)。
 *
 * 用法: node scripts/test/validate-identity-match.mjs [--limit N] [--samples K]
 */
import { loadDiscoveryEntities } from '../../core/leads/discovery-store.js';
import { lookupLicense } from '../../core/enrichment/license-lookup.js';
import { verifyCandidate } from '../../core/enrichment/identity-match.js';

const args = process.argv.slice(2);
const limit = (() => { const i = args.indexOf('--limit'); return i >= 0 ? +args[i + 1] : Infinity; })();
const samplesPerBucket = (() => { const i = args.indexOf('--samples'); return i >= 0 ? +args[i + 1] : 4; })();

const ents = loadDiscoveryEntities().filter((e) => e.latest?.business_name || e.latest?.name).slice(0, limit);
const repoRoot = process.cwd();

const rows = [];
for (const e of ents) {
  const name = e.latest?.business_name || e.latest?.name;
  let lic = null;
  try { lic = await lookupLicense(e, { repoRoot }); } catch { lic = null; }
  if (!lic || lic.status === 'not_found' || !lic.licensee_name) {
    rows.push({ name, verdict: 'no_license_match', reason: 'license_lookup_not_found', license_name: null, tier: null });
    continue;
  }
  const candidate = {
    source: 'license',
    name: lic.licensee_name,
    abn: lic.abn || null,
    address: lic.address || null,
    state: lic.state || null,
  };
  const r = verifyCandidate(e, candidate);
  rows.push({
    name, verdict: r.status, reason: r.reason, license_name: lic.licensee_name,
    tier: lic.lookup_tier, matched: r.matched.join('+') || '-',
    anchors: { phone: !!r.anchors.phone, addr: !!r.anchors.address, abn: !!r.anchors.abn, state: !!r.anchors.state },
  });
}

// ── distribution ──
const byVerdict = {};
const byReason = {};
for (const r of rows) {
  byVerdict[r.verdict] = (byVerdict[r.verdict] || 0) + 1;
  byReason[r.reason] = (byReason[r.reason] || 0) + 1;
}
console.log(`\n=== identity-match validation · ${rows.length} real entities × real licence DB ===\n`);
console.log('VERDICT distribution:');
for (const [k, v] of Object.entries(byVerdict).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);
console.log('\nREASON distribution:');
for (const [k, v] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);

// ── samples per bucket (eyeball false-verify / false-discard) ──
const buckets = ['verified', 'discarded_uncertain', 'not_found', 'no_license_match'];
for (const b of buckets) {
  const sample = rows.filter((r) => r.verdict === b).slice(0, samplesPerBucket);
  if (!sample.length) continue;
  console.log(`\n--- ${b} (showing ${sample.length}) ---`);
  for (const r of sample) {
    console.log(`  "${r.name}"  ↔  licence "${r.license_name || '-'}"  · matched:${r.matched || '-'} · ${r.reason} · tier:${(r.tier || '-').slice(0, 28)}`);
  }
}

// ── the critical signal: licence FOUND (token/name matched in DB) but identity-match DISCARDED ──
const tokenButDiscarded = rows.filter((r) => r.verdict === 'discarded_uncertain' && r.reason === 'anchor_without_name');
console.log(`\n⚠️  licence row matched in DB but identity-match DISCARDED for lack of name corroboration: ${tokenButDiscarded.length}`);
console.log('   (these are likely real matches where the registered name ≠ trading name · the LLM/homepage judge would resolve them)');
for (const r of tokenButDiscarded.slice(0, 6)) console.log(`     "${r.name}" ↔ "${r.license_name}" · matched:${r.matched}`);
