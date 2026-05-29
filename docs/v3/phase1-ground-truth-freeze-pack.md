# Phase 1 · Ground-Truth Freeze Pack

**Date**: 2026-05-29
**Purpose**: 冻结阶段 1 audit 闭环验证的输入（codex R53 立刻执行指令）。所有 recall/precision/issue 解决率/A-B 都以这份冻结快照为不可变基准。
**Decision authority**: codex 代表 Matthew 终裁（R53）。

---

## 0 · 重要基线说明（读 codex 必看）

**audit-v4 (新 5-P0 工具) 当前给的 composite ≠ CANONICAL 记的 91/89/93。**
- CANONICAL §4 的 91/89/93 来自**旧 SOP-V2 full audit**。
- audit-v4（5-P0 新工具）当前 **T4/T5 仍是 stub**，grade=EXPERIMENTAL，给出更低的实验分。
- **阶段 1 的 A/B 基线 = audit-v4 这条分（下表），不是 91/89/93。** 这正是阶段 1 要先验证 audit-v4 是否够格的原因。

| Client | audit-v4 composite (frozen baseline) | grade | checkpoint |
|---|---|---|---|
| vicwest-roofing | **63** | EXPERIMENTAL (T4/T5 stubbed) | GREEN |
| a-j-roofing-solutions | **59** | EXPERIMENTAL (T4/T5 stubbed) | YELLOW + PREVIEW banner |
| mark-squire-roof-restorations | **63** | EXPERIMENTAL (T4/T5 stubbed) | YELLOW + banner |

---

## 1 · Frozen artifacts (rendered output · codex 独立审这个)

repo root: `/Users/matthew/Developer/google-map-website-v3`

| Client | artifact | path (rel) | SHA-256 |
|---|---|---|---|
| vicwest | rendered | `clients/vicwest-roofing/v2/editorial-output/index.html` | `3efa6d980d249c07aceab9b6ecb8165bc4c3f8ac819996fa4f39fa2eeeff730e` |
| a-j | rendered | `clients/a-j-roofing-solutions/v2/editorial-output/index.html` | `c45f9dc4d1069db32b64732f64b923f12a14afbf744e8e093c6b70b7d77237de` |
| mark-squire | rendered | `clients/mark-squire-roof-restorations/v2/editorial-output/index.html` | `3bf79758a07ed7a6ea643ccf8d68129fde4a2f770306e6e00db8c9d6eecb328b` |

template (shared): `templates/roofing/editorial-newsletter/template.html` · SHA-256 `1942fa645167cf15b89ba1bf9000afc423728a47cceed4e042a0f8778f234a54`

---

## 2 · Upstream compose inputs (feedback 的可改目标 · R50 upstream-targeted)

| Client | site-ctx.json | core-extract.json | master.md | checkpoint.json |
|---|---|---|---|---|
| vicwest | `f69e2f69…e3c6f` | `4d17ecf7…1535` | `ea80f4e5…c1a6` | `26c1fd61…6437` |
| a-j | `2622d939…b9e7` | `b513d5c0…ad5c` | `0048636a…423e` | `1ab94f34…32c9` |
| mark-squire | `bf428161…88b8` | `527b00f8…e7e7` | `39f74573…b65e` | `655cf7c9…9dce2` |

(完整 64-hex hash 见 §1 同批 shasum 输出；路径模式 `clients/<slug>/v2/<file>`)
注：a-j 无 `single-page-brief.yaml`（YELLOW 客户，符合 GATE 设计）。

---

## 3 · Reproducible generation commands

```bash
cd /Users/matthew/Developer/google-map-website-v3

# RENDER (V1 canonical · deterministic · 同输入同输出)
npm run pl:compose-editorial -- --slug <slug>
#   default template = editorial-newsletter

# AUDIT (5-P0 · 当前 T4/T5 stub)
npm run pl:audit-v4 -- --slug <slug> --tier full
#   产物: editorial-output/audit-v4-{full,issues,summary}.json + _vision-audit-v4.json
```

slug ∈ {vicwest-roofing, a-j-roofing-solutions, mark-squire-roof-restorations}

---

## 4 · 当前 audit 输出（仅作后续对照 · NOT codex 第一轮输入）

每客户已有：`audit-v4-full.json` / `audit-v4-issues.json` (schema/1) / `audit-v4-summary.json` / `_vision-audit-v4.json`。
**codex 独立审 §1 的 index.html 时不要先看这些**，避免污染独立性；列完缺陷后再对照。

---

## 5 · Ground-truth schema 草案（空 · 待 codex 填）

```jsonc
// docs/v3/phase1-ground-truth.json  (待生成)
{
  "schema_version": "phase1-ground-truth/1",
  "frozen_pack_ref": "phase1-ground-truth-freeze-pack.md",
  "artifact_hashes": { "vicwest-roofing": "3efa6d98…", "a-j-roofing-solutions": "c45f9dc4…", "mark-squire-roof-restorations": "3bf79758…" },
  "defects": [
    {
      "id": "GT-<slug>-001",
      "slug": "vicwest-roofing",
      "severity": "P0|P1|P2",          // codex 终裁
      "dim_hint": "P0_content_accuracy|copy_quality|brand_fidelity|content_richness|design_consistency|mobile",
      "where": "section/block 或选择器位置",
      "what": "缺陷描述（客观可判定）",
      "source": "codex|matthew",        // 双盲来源
      "in_ground_truth": true,          // codex 终裁是否纳入
      "rationale": "为何算缺陷 / 为何此严重度"
    }
  ],
  "severity_arbiter": "codex (representing Matthew · R53)",
  "notes": "并集为候选 · codex 终裁 severity 与是否纳入"
}
```

---

## 6 · 给 codex 的独立审指令

请 codex（代表 Matthew）：
1. 直接读 §1 三个 `index.html`（绝对路径 = repo root + rel path），**不看 §4 现有 audit**。
2. 各列 P0/P1/P2 缺陷清单（覆盖 Matthew 5-P0 关切：核心信息准确 / branding 统一 / 设计 / 文案真实-客户匹配 / 转化）。
3. 按 §5 schema 终裁 severity + 是否纳入 ground truth。
4. 产出即 ground-truth 的 codex 侧权威输入；Matthew 后续可 override。

**范围红线**：本步只冻结 + 建 ground truth，**不写功能代码、不改 audit/composer**（R52-Q4 / R53-D1）。
