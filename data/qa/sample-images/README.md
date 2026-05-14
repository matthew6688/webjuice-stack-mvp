# V3 Sample Images · 测试 image-extract 入口用

> 把真实业务图片放这里 · `pl:ingest-image` 测试时跑这些 · 不再因没图卡测试。
> Matthew 2026-05-14: "picture input 可以存这个图片 · 以后作为 sample · 测试 run · 不要因为没图片不知道往下推进测试"

---

## 当前 samples (建议命名)

| 文件名 | 内容 | 期望 OCR 输出 |
|---|---|---|
| `roofing-flyer-1.jpg` | 屋顶服务传单 (Matthew 2026-05-14 提供) | • niche: roofer · 40 YEARS EXP<br>• services: Restorations · Repairs · Gutters · Pressure Cleaning<br>• tile/metal · phone 0424 371 622<br>• 关键词: FREE QUOTES |
| `business-card-1.jpg` | (待加) 名片 · 含 logo + 电话 + 地址 + 邮箱 | 商家名 + phone + email + niche 推断 |
| `shopfront-1.jpg` | (待加) 商铺门面 · 含 LOGO + 服务列表 + 招牌 | 商家名 + niche · 不一定有 phone |
| `screenshot-website-1.png` | (待加) 现有网站截图 · 含 hero + nav | 商家名 + niche · 有 URL 推断 |

## 怎么测

```bash
# 选 1 张图 + 提供 hint
npm run pl:ingest-image -- --image-path data/qa/sample-images/roofing-flyer-1.jpg

# Or Discord forum upload (走 image-extract 路径)
```

## 期望行为 (Bug B 修复后)

- ✅ Vision LLM 抽 OCR + 推断
- ✅ niche/city 全有 → 直接 create entity · enqueue master.md
- ⚠️ niche 或 city 缺 → human gate · thread 提示 operator 补字段:
  ```
  ⚠ 图片识别了 · 但还缺 city
  · OCR 提取到: phone=0424 371 622 · niche=roofer
  请补 `city`:
  1️⃣ 在 thread 里回贴: `city=<value>`
  2️⃣ 然后 react ✅ 让任务重试
  ```

## 加图

把图片 drag 到这个目录 · 文件名按上表命名 (or describing-content-N.jpg)。然后跑 `pl:ingest-image` 测试。

---

## 期望 sample 来源

Matthew 业务真实场景:
- AU local business 传单 (报箱发)
- 商家名片 (本地展会收的)
- 现有网站截图 (lead 调研时截的)
- 商铺门面 (亲自路过拍的)
- GBP 截图 (打开 Maps 商家页截图)
