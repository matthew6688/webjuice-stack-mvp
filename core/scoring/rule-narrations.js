/**
 * Rule narrations — for every detailed-audit rule, three-layer prose:
 *
 *   plain      → 普通话翻译，让非技术老板看得懂
 *   impact     → 客户业务影响，能挂上钱 / 客户流失百分比
 *
 * Templates use `{var}` placeholders. Available context:
 *   {rating}, {review_count}, {business_name}, {niche}, {city},
 *   {lcp}, {lcp_seconds_rounded}, {final_url}, {monthly_clicks_est},
 *   {monthly_inquiries_est}
 *
 * Not every rule needs both layers — minor / housekeeping rules can omit
 * `impact`. The renderer only displays layers that have content.
 *
 * If a rule isn't in this map, master-md falls back to the rationale
 * (existing behavior). We add the most sales-relevant ~20 rules first
 * and grow the map over time.
 */

export const RULE_NARRATIONS = {
  // ── Technical ───────────────────────────────────────────────────────────
  https_enabled: {
    plain: '你的网站没有 HTTPS — 浏览器会在地址栏显示「不安全」标记，部分浏览器（Chrome / Firefox）甚至会弹出全屏警告挡住页面。',
    impact: 'Google 早在 2018 年起把 HTTPS 列为搜索排名因素，没有 HTTPS 直接拉低自然搜索可见度；且超过 80% 的访客看到「不安全」标识会立刻关掉。对你这种 {review_count} 条 Google 评价积累起来的口碑来说，访客在网址栏就被劝退，等于浪费了所有 GBP 流量。',
  },
  first_paint_under_3s: {
    plain: '你的网站在手机上要超过 3 秒才能让客户看到主要内容（实测 LCP {lcp_seconds_rounded} 秒），相当于他们要等比一首流行歌副歌还长的时间，页面才肯露脸。',
    impact: 'Google 数据：移动加载从 1 秒涨到 3 秒，跳出率提高 32%；涨到 5 秒提高 90%。简单说，你的 GBP 流量进来一半在加载阶段就走了。按行业标准 3-5% 的转化率折算，每多 1 秒延迟约等于每月少 5-10 个咨询。',
  },
  mobile_responsive: {
    plain: '你的网站在手机上看会有明显的排版问题（按钮太小、图片溢出、要左右滑动才能看完）。',
    impact: 'Brisbane 屋顶服务行业 70% 以上的访客来自手机。手机上不好用 = 你正在主动赶走 70% 的潜在客户。Google Lighthouse 的 mobile 分数也是搜索排名信号之一，连带影响自然流量。',
  },
  no_console_errors: {
    plain: '你的网站在浏览器控制台里有报错。访客看不到这些错误，但报错的脚本通常就是导致按钮点不动 / 表单提交不了 / 图片加载失败的原因。',
    impact: '一个失败的 click-to-call 按钮等于这次访问完全白来。每月成百上千次访问，哪怕只有 1% 受影响也是几十次失之交臂的咨询。',
  },
  favicon_and_meta: {
    plain: '你的网站缺少 favicon（浏览器标签页上的小图标）或基本的 meta 标签。',
    impact: '客户在多 tab 浏览时找不到你的网站；Facebook / WhatsApp 分享时缩略图会拉错图甚至没有图，链接显得不专业。',
  },

  // ── UX / Conversion ─────────────────────────────────────────────────────
  above_fold_cta_within_5s: {
    plain: '客户打开你的网站后，前 5 秒内（一屏之内）看不到任何明显的「联系我们 / 报价 / 立即拨打」按钮。',
    impact: '行业研究：移动用户做决策的前 8 秒决定 70% 的留存。看不到 CTA = 等于没办法转化。你的 {review_count} 条好评在堆积信任，但客户找不到下一步该点哪。',
  },
  phone_visible_above_fold: {
    plain: '电话号码在第一屏看不到 — 客户必须滚动才能找到怎么联系你。',
    impact: '本地服务客户 60-70% 倾向打电话沟通（不是填表单）。电话号没在第一屏 = 这部分客户里很多人会直接关掉去搜下一家。这是最便宜的转化优化之一。',
  },
  click_to_call_link: {
    plain: '电话号码不是 click-to-call 链接（手机上点击不会自动拨号）。',
    impact: '移动客户必须复制号码再切到拨号界面再粘贴 — 每多一步操作就流失一批客户。修复成本只是把 `<a href="tel:0712345678">` 写对，但能立刻拉高电话转化率。',
  },
  quote_or_booking_form: {
    plain: '你的网站没有 quote / booking 表单 — 客户只能打电话或发邮件。',
    impact: '工作时间外（晚上 / 周末）的访客没办法联系你，只能等。家庭装修客户经常在晚上做决策；你正在错过非营业时间的转化窗口。',
  },
  has_gallery: {
    plain: '没有项目作品集 / before-after 图库。',
    impact: '屋顶 / renovation 行业，「眼见为实」是关键决策因素之一。没有作品集 = 客户没法判断你的工艺水准 = 比起有图库的同行落后一截。',
  },
  has_testimonials: {
    plain: '网站上没有客户评价 / 推荐 — 即使你 Google 上有 {review_count} 条 {rating}★ 评价。',
    impact: '客户进了你的网站不会回过头去看 Google Maps；网站上没有评价就等于你的口碑资产没被网站这块阵地利用。把 5-8 条 {rating}★ 真实 quote 直接放上去，转化率提升 30-50% 是行业基准。',
  },

  // ── Content ─────────────────────────────────────────────────────────────
  homepage_title_clear: {
    plain: '你网站的浏览器标签 title 没把业务名字 + 服务关键词写清楚（比如该写「{business_name} - {niche} {city}」，但目前是泛泛一句）。',
    impact: 'Google 搜索结果里展示的就是这个 title。写不清楚 = 排名靠后 + 即使排上来客户也不知道是不是匹配的服务。SEO 最便宜的修复，但很多本地企业完全没做。',
  },
  service_copy_specific: {
    plain: '网站文案里没有具体说清楚你做哪些服务（比如 metal roofing / tile restoration / gutter / skylight 等专项），只是泛泛说「我们做屋顶」。',
    impact: '客户搜的是具体问题（「漏水维修」「屋顶翻新报价」），网站没有匹配的具体服务文字，搜索引擎匹配不上你 + 客户进来也判断不了你做不做他要的活儿。',
  },
  trust_signals_present: {
    plain: '网站上没有显眼地写出执照号 / ABN / 保险信息 / 从业年限 / 行业证书。',
    impact: '澳洲 QLD 的屋顶服务必须有 QBCC 执照才能合法开工；客户在花几千几万块前一定会查这些。你网站上没标 = 客户要么打电话来问要么直接选下一家更透明的。',
  },
  localized_content: {
    plain: '网站文案没明确提到服务的城市 / 区域（比如 Brisbane / Sunshine Coast / Lawnton 等具体地名）。',
    impact: '本地搜索 SEO 的核心信号之一就是地理关键词。「{city} roofing」这类搜索流量直接跟你网站里的本地化文案挂钩；不写具体地区 = 把流量让给写得清楚的同行。',
  },

  // ── SEO ─────────────────────────────────────────────────────────────────
  title_meta_present: {
    plain: '页面缺少 SEO 用的 title 标签或 meta description。',
    impact: 'Google 搜索结果里显示的就是这两块。没写 = Google 自己截一段（往往不重点），客户看到不是吸引人的描述就不会点进来。',
  },
  h1_unique: {
    plain: '页面要么没有 H1 标题（搜索引擎无法理解页面主旨），要么有多个 H1（搜索引擎不知道哪个是主题）。',
    impact: 'H1 是搜索引擎判断页面主题最权威的信号。写错或缺失 = 关键词排名拉低；同一页面同样的内容，H1 写对的可以排到前 3 页，写不对的可能挂在第 7 页。',
  },
  local_schema_markup: {
    plain: '网站没有 LocalBusiness JSON-LD 结构化数据（让 Google / AI 知道你是本地企业、地址、电话、营业时间的标准格式）。',
    impact: 'Google「附近的服务」「Knowledge Panel」「AI Overview」都依赖这类结构化数据。没有 = 即使排名上去也不会出现在右侧 Knowledge Panel 或地图卡片里 — 错失高转化的展示位。AI agent / ChatGPT 引用本地商家时也是基于这些数据。',
  },
  image_alt_present: {
    plain: '图片没有 alt 文字描述。',
    impact: '影响两件事：① 视障用户的可访问性（在澳洲是法律风险）；② Google 图片搜索流量（屋顶项目图片是极强的 SEO 资产，但没 alt 等于没标）。',
  },
  sitemap_robots: {
    plain: '缺少 sitemap.xml 或 robots.txt（告诉 Google 你有哪些页面、哪些可以爬）。',
    impact: '搜索引擎可能漏掉你的服务页面 = 这些页面排名永远进不来。本地服务页面（metal roofing brisbane / tile roof repair）是最容易抢排名的内容，少一个 sitemap 就少一批流量。',
  },

  // ── GBP（这些客户自己改 Google 后台，不在 redesign 范围内，所以语调更"建议"）─
  has_website_link: {
    plain: '你的 Google Business Profile 上没填官网链接。',
    impact: 'Google 上看到你信息的客户，如果想了解更多服务 / 看作品集，没法直接跳到你的网站。手填 GBP 后台 30 秒就能解决，但很多本地企业从没做过。',
  },
  review_volume_vs_peers: {
    plain: '你的 Google 评价数量低于同行平均水平。',
    impact: '本地搜索排名信号之一就是评价数量；不光是分数，连"有多少条"都算。短期可以做的：每个完工的客户群发一条「点评一下吧」的 SMS。',
  },
  average_rating: {
    plain: '你的 Google 平均星级低于行业警戒线。',
    impact: '低于 4.0 的本地企业在 Google Maps 推荐里基本不会被推（用户筛选默认勾"4.0+"）。修复路径是回复差评 + 邀请满意客户主动评价。',
  },
  has_hours: {
    plain: 'GBP 上没有完整的营业时间。',
    impact: '客户搜「现在还在营业的 roofer」时你不会被显示。',
  },
  image_count: {
    plain: 'GBP 上图片数量低于行业建议（一般 ≥ 10 张完工图 + 团队照 + 设备照）。',
    impact: '图片数量直接影响 GBP 在地图卡片里的展示效果。',
  },
};

/**
 * Plug context vars into a template string using `{var}` syntax. Missing
 * vars stay as-is so we don't paper over data gaps with empty strings.
 */
export function interpolate(template, ctx = {}) {
  if (!template) return '';
  return String(template).replace(/\{(\w+)\}/g, (m, key) => {
    const v = ctx[key];
    return (v === undefined || v === null) ? m : String(v);
  });
}

/**
 * Pull narration prose for a rule id, interpolated with context.
 * Returns `{ plain, impact }` — either may be empty if no template exists.
 */
export function narrate(ruleId, ctx = {}) {
  const tmpl = RULE_NARRATIONS[ruleId];
  if (!tmpl) return { plain: '', impact: '' };
  return {
    plain: interpolate(tmpl.plain, ctx),
    impact: interpolate(tmpl.impact, ctx),
  };
}
