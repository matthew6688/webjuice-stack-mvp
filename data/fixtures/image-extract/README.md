# Image-extract Test Fixtures · V3 D43

**Owner:** intake / image-extract pipeline · Matthew 提供的 truck/sign 真实样本

固定路径。**不要问 Matthew**——直接用这里的文件跑 image-extract test。
新样本会被追加到这个目录,沿用同样的命名约定。

## 命名约定

`<sign-type>-<niche>-<phone-or-distinguisher>.<ext>`

- `tradie-sign-roofing-0424-371-622.png` — 蓝底广告牌 · 40 YEARS EXP · TILE/METAL ROOFING · RESTORATIONS/REPAIRS/GUTTERS/PRESSURE CLEANING · phone 0424 371 622 · **无 business name**(典型 tradie 难度场景)

## 期望的 image-extract 输出 (ground truth)

| Field | Value (tradie-sign-roofing-0424-371-622.png) |
|---|---|
| `extracted.phone` | `0424 371 622` |
| `extracted.niche` | `roofing` |
| `extracted.services` | `["restorations","repairs","gutters","pressure cleaning"]` |
| `extracted.specialties` | `["tile","metal"]` |
| `extracted.years_exp` | `40` |
| `extracted.offer` | `FREE QUOTES` |
| `extracted.business_name` | `null`(广告牌上没有)|
| `extracted.confidence` | `medium-high`(电话清晰、niche 清晰、无 name)|

## 下游 Places API 多角度搜索期望

`core/leads/image-enrich.js` 应该做 5 个 query:
1. phone-only: `0424 371 622` · AU
2. name-only: skip(no name)
3. name+city: skip
4. name+niche+city: skip
5. phone+niche: `0424 371 622 roofing` · AU

phone-only 一般会命中,score ≥ 80 → 自动 pick。
如果命中失败,流程进入 `human_pick` queue。

## 怎么用

```bash
# 跑 image-extract 单测
npm run qa:test-image-extract -- data/fixtures/image-extract/tradie-sign-roofing-0424-371-622.png

# 或者直接走 SOP-1 image intake stage (Discord 入口)
# 这个 fixture 模拟「用户在 Discord 发 truck/sign 照片」的真实输入
```

## SOP 参考

- `docs/v3/SOP-DISCORD-DISPLAY.md` · image intake 流程
- `~/.hermes/profiles/marketer/skills/b2b-marketing/profitslocal-website-intake/SKILL.md` v4.0
- `core/leads/image-enrich.js` · 5-angle Places search + AI judgment cascade
