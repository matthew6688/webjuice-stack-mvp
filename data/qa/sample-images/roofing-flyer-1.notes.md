# roofing-flyer-1.jpg · 描述

> Matthew 2026-05-14 提供。建议把实际图片 drag 进同目录命名 `roofing-flyer-1.jpg`。

## 视觉内容描述 (AI 看 user 上传图后记录)

蓝底设计 · 屋顶服务传单:

- **左上角 badge**: "40 YEARS EXP"
- **右上角 burst**: "FREE QUOTES"
- **中央 logo**: "ROOFING" + 屋顶轮廓 plus tile/metal
- **logo 下方**: "TILE/METAL" (黑底白字)
- **服务列表** (蓝色 diamond 标点):
  - RESTORATIONS
  - REPAIRS
  - GUTTERS
  - PRESSURE CLEANING
- **底部黑条**: `0424 371 622` (主联系电话)

## 期望 image-extract 输出

```yaml
businessName: ?       # 没明确商家名 · 只有 "Roofing Tile/Metal"
phone: "0424 371 622" # OCR 应识别
niche: roofer         # services 直接说明 (restoration · repairs · gutters)
city: null            # 传单没城市 · 需 human gate 补
years_experience: 40
services: [restorations, repairs, gutters, pressure cleaning]
material: [tile, metal]
ad_keywords: [free_quotes]
```

## 触发什么 path

- vision OCR 抽 phone + niche + services ✓
- city 缺 → **human gate** (Bug B fix · listener 提示 operator)
- operator 在 thread 补 `city=brisbane` → react ✅ → 任务重试

## 测试 verifies

1. vision LLM 能 OCR 蓝底白字 (传单常见对比)
2. niche 推断: 服务列表 ("restorations" "gutters") → "roofer" niche
3. phone 格式: AU mobile `04XX XXX XXX` 识别
4. 缺 city · human gate UX clear (Bug B 修复验证)
