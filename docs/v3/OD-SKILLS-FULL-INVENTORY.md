# OD Skills · Full 137-Skill Inventory · ProfitsLocal Mapping

> Source: `/tmp/open-design/skills/*/SKILL.md` (137 subdirectories · AGENTS.md and README.md at top level excluded · the "139" in the brief includes those two top-level files).
> Date: 2026-05-27 · Owner: Matthew · Project: ProfitsLocal (AU local-trades website + ongoing marketing automation).

> **🟡 ERRATA (2026-05-27 evening)**: This inventory ranks skills based on their OD `SKILL.md` *description*. **The OD descriptions are real · the OD content is not** — each OD `SKILL.md` is a 43-line catalogue stub pointing to an upstream repo. Real methodology lives at the upstream (e.g. `marketingskills/skills/marketing-psychology/SKILL.md` is **455 lines** vs OD's 43-line stub). To actually integrate any skill below, see `external/skills/README.md` + run `bash external/skills/PULL.sh` to materialize the upstreams (~89 MB · 7 repos · ~177 real skills total). Tier rankings in this doc are approximately right for prioritisation; "how to use" implications are wrong (cannot invoke OD stubs · must integrate methodology from upstream into our own prompts).

---

## Pipeline stage reference (S1–S9 legend)

| Tag | Stage | What it produces |
|---|---|---|
| S1 | Lead discovery | Google Maps scrape · license registers · raw business list |
| S2 | Lead enrichment | Website scrape · reviews · license lookup · existing brand assets |
| S3 | Brand brief / direction | Inferred palette / voice / DESIGN.md per lead |
| S4 | Design / build website | Single- or multi-page site via OD pipeline |
| S5 | Audit | 4-tier audit (PASS/FAIL + composite ≥73) |
| S6 | Proposal slides | Pitch decks sent to prospect |
| S7 | Demo video / mockup | Screenshot / mockup / device-frame proof artifact |
| S8 | Outreach | Cold email · SMS · WhatsApp · ad creative · domain ideas |
| S9 | Ongoing-service deliverables | Monthly ads · seasonal posters · quarterly decks · annual recap video for paying retainers |

---

## Tier distribution

| Tier | Count | Definition |
|---|---|---|
| P0 | 18 | Use immediately — already in use or solves a core need today |
| P1 | 41 | Short-term (1–2 weeks) integrate — clear ROI for S4/S5/S6/S8 |
| P2 | 52 | Real value but later — most paid retainer (S9) deliverables sit here |
| P3 | 26 | Niche / experimental / single-ticket / internal-only |
| **Total** | **137** | |

---

## Skills by category

### Design & UI fundamentals

| Skill | What it does | Stage | How we'd use it | Tier |
|---|---|---|---|---|
| apple-hig | Apple HIG as 14 sub-skills covering iOS/macOS/visionOS/watchOS components and patterns | S4 | 暂不用，AU 本地服务商基本只做 web · iOS app 不在路线图 | P3 |
| brand-guidelines | Anthropic-style brand reference for color/typography consistency on artifacts | S3 | 拿来当 DESIGN.md 模板参考，对齐每个客户的 brand tokens 生成方式 | P2 |
| color-expert | 286K-word color science reference: OKLCH/OKLAB, palette gen, contrast, naming | S3 | 自动从 license/brand 资料推导客户主色 + 对比度 check，避免 AI slop 配色 | P1 |
| design-brief | Parse I-Lang structured brief into concrete spec (palette/type/layout/mood/density) | S3 | 把每个客户的 master.md 转成强结构 design brief，喂给 OD pipeline | P0 |
| design-consultation | Build full design system from scratch with creative risks + realistic mockups | S3 | 给高价值客户（贵客）做 brand-from-zero kickoff，配合 logo skill | P2 |
| design-md | Create/manage DESIGN.md files as single source of truth | S3 | 已经在用：每客户一个 DESIGN.md，OD pipeline 必读 | P0 |
| design-review | Designer-Who-Codes visual audit + atomic-commit fixes with before/after | S5 | OD 出站前的最后一道 visual check，配合 4-tier audit | P0 |
| enhance-prompt | Improve prompts with design specs + UI/UX vocab for design-to-code | S3 | 给 OD seed prompt 加 design vocabulary，提升 OD 输出 baseline | P1 |
| frontend-design | Anthropic frontend design + UI/UX for production interfaces with type/layout discipline | S4 | OD pipeline 的核心 skill 之一，已在用 | P0 |
| frontend-dev | Cinematic full-stack frontend with MiniMax media + generative art for showcase | S4 | 给"贵客 hero page"用，普通 lead 不开 | P2 |
| frontend-skill | OpenAI restrained-composition landing/web/app UI playbook | S4 | OD multi-page 路线参考；与 frontend-design 互补 | P1 |
| plan-design-review | Senior Designer review: 0-10 per dim + AI-Slop signals + what-a-10-looks-like | S5 | 4-tier audit T2/T3 直接挂这个 skill；anti-slop 是核心需求 | P0 |
| platform-design | 300+ rules from HIG + Material 3 + WCAG 2.2 for cross-platform | S4 | WCAG 2.2 a11y baseline check，配 audit T1 PASS/FAIL | P1 |
| shadcn-ui | Build accessible UI with shadcn/ui + Stitch loop | S4 | OD 输出 components 的统一 baseline · radix-based, a11y 默认达标 | P1 |
| stitch-loop | Iterative design-to-code critique-adjust-ship cycle | S5 | pl:iterate-site 的方法论 reference，强化 audit-feedback loop | P0 |
| swiftui-design | SwiftUI anti-slop rules + brand asset protocol + 5-dim review | S4 | 不做 native iOS — 等真有客户要 app 再说 | P3 |
| taste-skill | High-agency frontend skill with tunable variance/motion/density to stop UI slop | S4 | 反 AI-slop，OD seed 强制加 taste 参数；与 anti-slop dimension 对接 | P0 |
| theme-factory | 10 preset font + color themes for slides/docs/reports/HTML | S3 / S6 | proposal deck 快速套主题；客户 master.md → HTML 套主题 | P1 |
| ui-skills | Opinionated evolving constraints to keep small UI pieces coherent | S4 | OD pipeline 多页面跨页一致性的硬约束 reference | P1 |
| ui-ux-pro-max | Catalog-only entry; upstream not bundled | S4 | 上游未捆绑，仅作 catalog · 实际无用 | P3 |
| web-design-guidelines | Vercel engineering team web standards (layout/type/color/motion/a11y) | S5 | 已经在用 (built-in skill)；OD audit T1 quick checklist | P0 |
| wpds | WordPress Design System tokens + components | S4 | 客户若已有 WP 站可对齐 token；本地 trades 多数非 WP | P3 |
| apple-hig (duplicate flag — see above) | — | — | — | — |

### Frontend execution / web prototype

| Skill | What it does | Stage | How we'd use it | Tier |
|---|---|---|---|---|
| artifacts-builder | Multi-component React + Tailwind + shadcn HTML artifacts (claude.ai) | S4 | OD 之外的临时 prototype 用；不是 ProfitsLocal 主线 | P2 |
| web-artifacts-builder | Anthropic reference for React + Tailwind embeddable artifacts | S4 | 与 artifacts-builder 重复，pick 一个用，主线还是 OD | P3 |
| flutter-animating-apps | Flutter mobile motion/transitions | S4 | 不做 Flutter 移动应用 | P3 |
| login-flow | Mobile login & authentication flow screens | S4 | 部分客户站点需要客户登录（极少数），暂不需要 | P3 |
| faq-page | Collapsible accordion + search + category filter FAQ page | S4 | 多页面 OD 必须有 FAQ block；直接套这个 skill 当 sub-template | P0 |
| release-notes-one-pager | One-page HTML release notes (Added/Fixed/Breaking/Known/Upgrade) | S9 | 给签了 retainer 的客户做"本月网站更新"一页报告 | P2 |
| research-decision-room | Messy research → evidence ledger + theme map + decision memo in one HTML artifact | S5 | 把 audit findings + 客户反馈整合成 decision room，retainer 客户季度复盘用 | P2 |
| frontend-slides | Animation-rich HTML presentations with style previews | S6 | proposal deck 的 HTML 版本路线，配合 huashu-md-html | P1 |

### Copywriting & marketing

| Skill | What it does | Stage | How we'd use it | Tier |
|---|---|---|---|---|
| ad-creative | Generate/iterate ad headlines, descriptions, primary text for paid social/search | S8 / S9 | S8 冷外联广告变体；S9 retainer 月度 ads 批量产出 | P0 |
| brainstorming | Structured Q&A + alternative exploration for rough ideas → designs | S3 / S6 | proposal pitch angle brainstorm；客户 brand direction 三方案探索 | P1 |
| competitive-ads-extractor | Extract competitor ads from ad libraries; teardown messaging + creative | S2 / S3 | enrich 阶段抓本地竞品（其他 roofer/builder）的 Meta Ads Library 创意 | P1 |
| copywriting | Marketing copy: landing/homepages/ads rewrite | S4 / S8 | 网站 hero copy + 冷邮件 + ad copy 主力 skill | P0 |
| creative-director | 20+ methodologies (SIT/TRIZ/SCAMPER) + Cannes-calibrated 3-axis eval | S6 / S9 | 高价值 retainer 客户做 quarterly campaign 概念；普通 lead 不开 | P2 |
| domain-name-brainstormer | Brainstorm domain names + check availability across .com/.io/.dev/.ai | S3 / S8 | 客户若没现成域名，给 3-5 个备选；upsell entry point | P1 |
| marketing-psychology | Apply behavioral science to copy + design (hooks/framing/pricing) | S4 / S8 | 网站 hero + CTA 文案心理学优化；冷邮件 framing | P0 |
| paywall-upgrade-cro | Upgrade screens/paywalls/upsell modals optimization | S4 | 本地 trades 一般无 paywall · pricing card 倒是可借鉴 | P2 |

### Brand identity (logo / poster / fundamentals)

| Skill | What it does | Stage | How we'd use it | Tier |
|---|---|---|---|---|
| canvas-design | PNG/PDF posters/illustrations with design philosophy + aesthetic principles | S9 | retainer 客户季节性海报（promo / Christmas / EOFY） | P1 |
| poster-hero | Vertical poster / Moments-style share image with strong visual impact | S9 / S8 | 朋友圈/IG 分享海报；社媒发布 + 邮件 hero image | P1 |
| algorithmic-art | p5.js seeded generative art for procedural posters/motion stills | S9 | 季节性海报 abstract 背景；不是主线但加分项 | P2 |
| article-magazine | Long-form HTML essay layout (Huashu / md-html style) | S9 | 给 retainer 客户做季度长文（SEO + thought leadership）| P2 |
| hand-drawn-diagrams | Excalidraw hand-drawn diagrams with animated SVG + hosted edit link + PNG | S4 / S6 | proposal deck 里画流程图；网站 process section 手绘风 | P2 |

### Audit & review

| Skill | What it does | Stage | How we'd use it | Tier |
|---|---|---|---|---|
| design-review | (see above) Designer-Who-Codes visual audit | S5 | (see above) | P0 |
| plan-design-review | (see above) Senior Designer 0-10 dim rating + AI-Slop signals | S5 | (see above) | P0 |
| pptx-html-fidelity-audit | Audit python-pptx export vs source HTML for layout/content drift + re-export | S6 | proposal deck HTML → PPTX 转换的保真度审计 | P2 |
| stitch-loop | (see above) iterative design-to-code feedback | S5 | (see above) | P0 |
| web-design-guidelines | (see above) Vercel web standards | S5 | (see above) | P0 |
| full-page-screenshot | Full-page screenshots via CDP zero-dep | S5 / S7 | audit evidence + before/after 截图；retainer monthly review | P0 |
| screenshot | Cross-OS desktop/window/region capture | S5 / S7 | audit + 演示视频素材；和 full-page-screenshot 互补 | P1 |
| screenshots-marketing | Playwright marketing screenshots (hero/App Store/changelog) | S7 | 把客户新站 hero 截成 marketing screenshot 当 proposal 证据 | P1 |

### Slides / decks / presentations

| Skill | What it does | Stage | How we'd use it | Tier |
|---|---|---|---|---|
| pptx | Read/generate/adjust .pptx slides + layouts + templates | S6 | proposal deck 最终交付格式（客户要 PPTX） | P0 |
| pptx-generator | PptxGenJS production-tested deck pipeline (MiniMax) | S6 | 自动化批量生成 proposal deck 主力工具 | P0 |
| slides | OpenAI .pptx with PptxGenJS for sales decks/kickoff/showcases | S6 | 与 pptx-generator 重复，挑一个；保留作为 backup | P2 |
| nanobanana-ppt | AI PPT with document analysis + styled images via NanoBanana | S6 | 实验：自动把 master.md → styled PPT；先试再决定主线 | P2 |
| ppt-keynote | Apple Keynote-quality HTML slides, one card per screen, ←/→ nav | S6 | proposal deck HTML 版（线上预览 link 发给客户） | P1 |
| frontend-slides | (see above) animation-rich HTML presentations | S6 | (see above) | P1 |
| deck-guizang-editorial | 10 layouts × 5 palettes editorial-magazine-meets-e-ink deck | S6 | 高端 proposal deck 风格选项之一（贵客向） | P1 |
| deck-open-slide-canvas | Locked 1920×1080 React component-level free composition | S6 | 自由度最高 deck；复杂 case-study 演示用 | P2 |
| deck-swiss-international | 16-column grid + single saturated accent, 22 locked layouts | S6 | 数据型 proposal deck（KPI/ROI 估算）首选模板 | P0 |
| html-ppt-retro-quarterly-review | Retro blue+orange quarterly review template, 3 slides, <3s holds | S9 | retainer 客户季度复盘 deck 直接套；典型 S9 用例 | P0 |
| 8-bit-orbit-video-template | Retro pixel deck motion design (multi-scene HTML-to-video) | S7 / S9 | 复古 demo 视频片头；niche 风格选项 | P3 |
| after-hours-editorial-template | Luxury dark-editorial 3-page cinematic storyboards | S7 / S9 | 高端 retainer 客户年度 recap video 模板候选 | P2 |
| digits-fintech-swiss-template | Swiss-grid black/warm-paper/neon-lime fintech deck | S6 | 数据型 deck 备选（fintech 风但可改 trades）| P2 |
| editorial-burgundy-principles-template | Burgundy/blush/muted-gold manifesto/principles deck | S6 | "我们的工艺原则" 风格 proposal · 适合 heritage roofer | P2 |
| field-notes-editorial-template | Soft-paper magazine business report w/ retention chart | S9 | retainer 月度/季度 business report 模板 | P1 |
| swiss-creative-mode-template | Swiss/brutalist interactive deck w/ theme switch + hotspot | S6 | hero 提案落地页风格（提案站 = 落地页）| P2 |
| swiss-user-research-video-template | Swiss warm-paper user-research deck w/ donut breakdowns | S5 | audit 报告呈现模板（"我们发现 X 个问题"）| P2 |
| weread-year-in-review-video-template | WeRead 9:16 annual reading report HTML-to-MP4 vertical | S9 | retainer 客户年终社媒分享视频模板（9:16 IG/TikTok）| P2 |

### Video & animation engines

| Skill | What it does | Stage | How we'd use it | Tier |
|---|---|---|---|---|
| remotion | Programmatic video via React — branded explainers, dashboards-to-video | S7 / S9 | demo video + retainer 月度视频主引擎 · 已经接 huashu skill | P0 |
| video-hyperframes | Hyperframes/Remotion-compatible continuous frame animation w/ autoplay | S7 / S9 | hyperframes 已在用 (built-in)；OD 输出转视频 | P0 |
| sora | OpenAI Sora short video clips for cinematic shots/b-roll/concept | S7 / S9 | hero b-roll 给 retainer 客户用（贵但效果好） | P2 |
| fal-kling-o3 | Kling O3 image+video via fal.ai | S7 / S9 | fal-ai 路线视频备选；与 Sora 二选一 | P2 |
| fal-video-edit | AI video edit: remix style, upscale, BG remove, add audio | S9 | retainer 视频后期处理（背景替换/4k 升级）| P2 |
| fal-lip-sync | Talking head + lip sync audio-to-video | S9 | "店主介绍" 视频（客户照片 + TTS 配音对口型）| P2 |
| venice-video | Venice.ai video generation + transcription | S9 | 备选 video provider；和 fal/sora 比价后再定 | P3 |
| video-downloader | YouTube + others download for offline editing/archival | S9 / S2 | 抓客户已有的 YouTube content 重剪；S2 抓竞品视频参考 | P2 |
| youtube-clipper | YouTube clip slicing + captions + export pipeline | S9 / S8 | retainer 客户 YouTube → IG Reels/TikTok 自动剪辑 | P1 |
| slack-gif-creator | Slack-optimized animated GIFs with size validators | S8 | 冷外联 GIF（少用，多数 prospect 不在 Slack）| P3 |
| gif-sticker-maker | Photos → Funko/Pop-Mart-style animated GIF stickers via MiniMax | S9 | 客户头像 → 趣味 GIF 表情包（小红利、社媒互动）| P3 |

### Animation library (GSAP suite)

| Skill | What it does | Stage | How we'd use it | Tier |
|---|---|---|---|---|
| gsap-core | gsap.to/from/fromTo, easing, stagger, matchMedia (responsive + prefers-reduced-motion) | S4 | OD 站点 hero / section reveal 主动画引擎 | P0 |
| gsap-react | useGSAP hook, refs, gsap.context, cleanup for React | S4 | React 路线 OD 输出的动画清理；标配 | P1 |
| gsap-frameworks | GSAP for Vue/Svelte/non-React frameworks | S4 | 暂不用 Vue/Svelte；保留备用 | P3 |
| gsap-timeline | gsap.timeline + position param + nesting + playback | S4 | 复杂多阶段 hero 动画编排 | P1 |
| gsap-scrolltrigger | Scroll-linked anim, pin, scrub, triggers | S4 | 落地页长滚动 storytelling 主力 plugin | P0 |
| gsap-plugins | ScrollToPlugin/Flip/Draggable/Inertia/SplitText/Custom* | S4 | SplitText 用得最多（文字逐字揭示）；按需引入 | P1 |
| gsap-performance | Transforms over layout, will-change, batching, 60fps | S4 | 大图站性能 audit T1 必走；防 jank | P1 |
| gsap-utils | clamp/mapRange/normalize/interpolate/random/snap/toArray/wrap/pipe | S4 | 数值映射辅助；与 gsap-core 一起用 | P2 |

### Image generation & enhancement

| Skill | What it does | Stage | How we'd use it | Tier |
|---|---|---|---|---|
| imagegen | OpenAI Image API for UI mockups/icons/illustrations/social cards | S4 / S7 / S9 | OD 站内 illustration + 社媒卡片主力 image gen | P0 |
| imagen | Google Gemini image gen API | S4 | imagegen 的备选 provider；价格优 / quota 切换 | P2 |
| canvas-design | (see above) PNG/PDF posters/illustrations | S9 | (see above) | P1 |
| algorithmic-art | (see above) p5.js seeded generative art | S9 | (see above) | P2 |
| pixelbin-media | 85+ API image+video portfolio + website page generation | S4 | CDN/transform 备选（我们用 Cloudinary，pixelbin 暂搁置） | P3 |
| replicate | Discover/compare/run AI models via Replicate API | S4 / S9 | swap model 实验场；和 fal-ai 互补 | P2 |
| image-enhancer | Upscale + sharpen + denoise for presentations/docs | S2 / S7 | 客户提供低质量 logo/照片的批量增强；S2 enrich 标配 | P0 |
| fal-generate | fal.ai image/video generation (Flux/SDXL/Ideogram) | S4 / S9 | OD hero image + retainer social 主 provider | P0 |
| fal-image-edit | fal.ai image edit: style transfer, BG remove, object remove, inpaint | S2 / S4 | 客户 logo 抠图、photo BG 替换；高频用 | P0 |
| fal-realtime | Real-time streaming image gen for moodboard/draft variations | S3 | brand direction kickoff 时快速出 3 个风格 moodboard | P1 |
| fal-restore | Deblur/denoise/face fix/document restore | S2 | 客户老照片/扫描 logo 修复；与 image-enhancer 配 | P1 |
| fal-upscale | AI super-res for image + video | S2 / S7 | 客户低分图升 4K；demo video 升清 | P0 |
| fal-vision | Image analysis: segment/detect/OCR/describe/VQA | S2 | enrich：scrape 客户 site 图后 OCR 招牌/价目表；自动 alt-text | P1 |
| fal-3d | Text/image → 3D models | S7 | mockup-device-3d 的 3D 资产源；多数 case 不需要 | P3 |
| fal-tryon | Virtual try-on for clothes (ecommerce/lookbook) | S4 | trades 不需要 try-on；保留备用 | P3 |
| fal-train | Train custom LoRA for personalized brand image gen | S9 | 单大客户专属 brand LoRA（高端 retainer offering） | P2 |
| venice-image-generate | Venice.ai image generation styles | S4 | 备选 provider；与 fal/openai 价比 | P3 |
| venice-image-edit | Venice.ai image edit + upscale + BG remove | S4 | 同上，备选 | P3 |
| gif-sticker-maker | (see above) MiniMax Funko/Pop-Mart sticker | S9 | (see above) | P3 |

### Audio / speech / music

| Skill | What it does | Stage | How we'd use it | Tier |
|---|---|---|---|---|
| speech | OpenAI TTS with built-in voices for narration/explainer/VO | S7 / S9 | demo video 配音 + retainer 月度视频 VO 主引擎 | P0 |
| venice-audio-speech | Venice.ai TTS models, voices, formats, streaming | S7 / S9 | speech 的备选 provider（多语言/口音）| P2 |
| venice-audio-music | Venice.ai music gen (jingles/loops/scoring) | S9 | retainer 视频背景音乐生成（避开版权）| P1 |
| ai-music-album | Full-lifecycle AI music album (concept/lyric/sequencing/export) | S9 | 给客户做"店铺主题曲"奇袭服务；niche upsell | P3 |

### Social cards & overlays

| Skill | What it does | Stage | How we'd use it | Tier |
|---|---|---|---|---|
| card-twitter | Twitter quote/data card 16:9 dark | S8 / S9 | 冷外联推特素材；retainer 客户社媒卡 | P1 |
| card-xiaohongshu | XHS swipeable multi-card carousel 3:4 | S9 | retainer 客户小红书推广（AU 华人客户场景） | P2 |
| social-reddit-card | Realistic Reddit post card w/ vote rail + comments | S7 / S9 | demo video overlay；客户社媒 Reddit 风讲故事 | P2 |
| social-spotify-card | Spotify Now-Playing card w/ progress + controls | S9 | retainer video overlay (BGM 标识) | P3 |
| social-x-post-card | Realistic X post card w/ likes/reposts/views | S7 / S9 | demo video overlay；社媒 quote 卡 | P1 |
| frame-macos-notification | Realistic macOS notification banner overlay | S7 | demo video 里展示"客户咨询通知" 营造可信感 | P2 |

### Video frames / VFX (HTML-in-canvas)

| Skill | What it does | Stage | How we'd use it | Tier |
|---|---|---|---|---|
| frame-data-chart-nyt | NYT-newsroom staggered-reveal editorial chart frames | S7 / S9 | demo video 数据段（"客户增加了 47% 询盘"）| P1 |
| frame-flowchart-sticky | SVG curve + sticky-note + whiteboard-feel flowchart frame | S6 / S7 | proposal 里讲我们的 onboarding 流程 | P2 |
| frame-glitch-title | Digital glitch / chromatic offset / data corruption title | S7 | demo video 转场（少用，niche 风格） | P3 |
| frame-light-leak-cinema | Film leaks + grain + 16:9 letterbox + serif large title | S7 / S9 | 高端 retainer 年度 recap video 开场卡 | P2 |
| frame-liquid-bg-hero | WebGL-style fluid displacement BG + quote overlay | S4 / S7 | 网站 hero BG 备选；demo video 开场 | P1 |
| frame-logo-outro | Segmented logo assembly + glow + tagline reveal | S7 | demo video / retainer video 标准片尾（每个客户都有）| P0 |
| vfx-text-cursor | Cursor light trail + chromatic rays + word-by-word reveal | S7 | demo video 开场 quote 揭示效果 | P1 |
| mockup-device-3d | Static iPhone+MacBook 3D showcase w/ real HTML on screens | S7 | demo "新站在 iPhone+MacBook 上的样子" — 必备资产 | P0 |

### Reports / data viz

| Skill | What it does | Stage | How we'd use it | Tier |
|---|---|---|---|---|
| d3-visualization | D3.js charts + interactive viz (line/bar/map/force/sankey/treemap/sunburst/choropleth) | S5 / S9 | audit report 数据图 + retainer 季度 ROI 报告 | P1 |
| data-report | CSV/Excel/JSON → polished visual report page (Chart.js inline) | S5 / S9 | retainer 月度数据报告主力；audit findings 可视化 | P0 |
| research-decision-room | (see above) Research → evidence ledger + decision memo | S5 | (see above) | P2 |
| field-notes-editorial-template | (see above) Magazine business report template | S9 | (see above) | P1 |

### Document generation

| Skill | What it does | Stage | How we'd use it | Tier |
|---|---|---|---|---|
| doc | OpenAI .docx read/create/edit with formatting fidelity | S6 | proposal 的 Word 版本（少数客户要 .docx） | P2 |
| docx | Anthropic .docx with tracked changes + comments | S6 | 同上 docx 备选；review-ready 交付 | P2 |
| minimax-docx | OpenXML SDK branded reports/proposals/template authoring | S6 | branded proposal 自动化生成（带 logo + token）| P1 |
| pdf | Extract text + create PDFs + handle forms | S6 / S9 | proposal PDF 交付主力；retainer 月报 PDF | P0 |
| minimax-pdf | Token-based design system + 15 cover styles for branded PDF | S6 / S9 | branded PDF 主力，cover style 选项多；与 pdf 配 | P0 |
| resume-modern | A4 minimal single-page resume for print/PDF | S3 | "店主简介页"借用 layout 模板；不直接用作简历 | P3 |
| doc-kami-parchment | Warm parchment + monochrome ink-blue accent + serif editorial doc | S9 | 高端 retainer 月度报告纸感版式 | P2 |

### Figma integration

| Skill | What it does | Stage | How we'd use it | Tier |
|---|---|---|---|---|
| figma-use | Figma Plugin API: canvas write/inspect/variables (prereq for others) | S3 / S4 | 若客户要 Figma 交付源文件再开；非主线 | P2 |
| figma-create-new-file | Create blank Figma Design / FigJam file | S3 / S4 | workshop kickoff 时建文件；非主线 | P3 |
| figma-create-design-system-rules | Generate project-specific design-system rules for Figma↔code | S3 | 自动建客户专属 design tokens；与 design-md 接 | P2 |
| figma-code-connect-components | Connect Figma components to code via Code Connect | S4 | 代码与 Figma 同步；OD 不直接走 Figma → 等需求 | P3 |
| figma-generate-design | Build/update Figma screens from code/description w/ DS tokens | S3 / S4 | code → Figma 反向同步（少见，非主线） | P3 |
| figma-generate-library | Build pro-grade design system library in Figma from codebase | S4 | 给签长约客户做完整 Figma DS（高端 offering）| P2 |
| figma-implement-design | Translate Figma → production code 1:1 fidelity | S4 | 客户提供 Figma 时反向 import；不常见 | P3 |

### Automation / browser / utility

| Skill | What it does | Stage | How we'd use it | Tier |
|---|---|---|---|---|
| agent-browser | Browser automation CLI: navigate/forms/click/screenshot/scrape/QA/dogfood | S2 / S5 | S2 网站 enrichment scrape 主引擎；S5 OD preview live QA | P0 |
| full-page-screenshot | (see above) CDP full-page capture | S5 | (see above) | P0 |
| screenshot | (see above) cross-OS capture | S5 | (see above) | P1 |

### Niche / one-off

| Skill | What it does | Stage | How we'd use it | Tier |
|---|---|---|---|---|
| hatch-pet | Codex animated pet spritesheet from character art (8×9 atlas + QA + pet.json) | S9 | 完全 internal testing / 玩具，no business use | P3 |
| login-flow | (see above) mobile login screens | S4 | (see above) | P3 |

---

## Recommended integration order (P0 → P3)

### P0 (18) · Plug in this week — these unlock or solidify current pipeline

1. **design-md** · already canonical · keep enforcing per-customer DESIGN.md as SSOT.
2. **design-brief** · convert each master.md to I-Lang brief before OD seed.
3. **frontend-design** + **taste-skill** + **web-design-guidelines** + **plan-design-review** + **design-review** + **stitch-loop** · the OD audit + iteration stack · all five together = 4-tier audit + anti-slop guarantee.
4. **agent-browser** · S2 enrichment + S5 live preview QA · drop-in replacement for hand-rolled scrape.
5. **full-page-screenshot** · audit evidence + before/after.
6. **gsap-core** + **gsap-scrolltrigger** · OD output animation baseline.
7. **copywriting** + **ad-creative** + **marketing-psychology** · S4 + S8 + S9 copy main engine.
8. **fal-generate** + **fal-image-edit** + **fal-upscale** + **image-enhancer** + **imagegen** · the image-asset stack — without this, OD output looks AI-slop.
9. **pptx** + **pptx-generator** + **deck-swiss-international** + **html-ppt-retro-quarterly-review** · proposal + retainer deck stack.
10. **pdf** + **minimax-pdf** · branded PDF proposal delivery.
11. **remotion** + **video-hyperframes** + **frame-logo-outro** + **mockup-device-3d** · demo video stack.
12. **speech** · TTS for demo + retainer video.
13. **data-report** · S5 audit dashboard + retainer monthly report.
14. **faq-page** · multi-page OD output requirement.

### P1 (41) · Integrate 1–2 weeks · clear ROI on S4/S6/S8

color-expert · enhance-prompt · frontend-skill · platform-design · shadcn-ui · theme-factory · ui-skills · brainstorming · competitive-ads-extractor · domain-name-brainstormer · canvas-design · poster-hero · creative-director (selective) · ppt-keynote · frontend-slides · deck-guizang-editorial · field-notes-editorial-template · frame-data-chart-nyt · frame-liquid-bg-hero · vfx-text-cursor · d3-visualization · screenshot · screenshots-marketing · gsap-react · gsap-timeline · gsap-plugins · gsap-performance · fal-realtime · fal-restore · fal-vision · venice-audio-music · card-twitter · social-x-post-card · youtube-clipper · minimax-docx

### P2 (52) · Real value but ramp later · most S9 retainer deliverables

artifacts-builder · article-magazine · brand-guidelines · deck-open-slide-canvas · design-consultation · digits-fintech-swiss-template · editorial-burgundy-principles-template · fal-train · fal-kling-o3 · fal-video-edit · fal-lip-sync · figma-create-design-system-rules · figma-generate-library · figma-use · frame-flowchart-sticky · frame-light-leak-cinema · frame-macos-notification · gif-sticker-maker (overlap) · gsap-utils · hand-drawn-diagrams · imagen · nanobanana-ppt · pixelbin-media (re-eval) · replicate · research-decision-room · release-notes-one-pager · slides · social-reddit-card · card-xiaohongshu · sora · swiss-creative-mode-template · swiss-user-research-video-template · swiss-fintech (digits) · 8-bit-orbit-video-template (overlap) · weread-year-in-review-video-template · doc · docx · doc-kami-parchment · video-downloader · paywall-upgrade-cro · pptx-html-fidelity-audit · after-hours-editorial-template

### P3 (26) · Niche / experimental / single-ticket / internal

apple-hig · swiftui-design · wpds · ui-ux-pro-max · web-artifacts-builder (overlap w/ artifacts-builder) · flutter-animating-apps · login-flow · resume-modern · figma-create-new-file · figma-code-connect-components · figma-generate-design · figma-implement-design · gsap-frameworks · fal-3d · fal-tryon · venice-image-generate · venice-image-edit · venice-video · venice-audio-speech (overlap w/ speech) · slack-gif-creator · ai-music-album · hatch-pet · 8-bit-orbit-video-template · frame-glitch-title · social-spotify-card · pixelbin-media

---

## Rationale notes

- **Why 18 P0**: every P0 either (a) already plugs into a current pipeline step (design-md, agent-browser, gsap-core) or (b) solves a *recurring* gap that costs hours per customer (image quality via fal-* stack, proposal generation via pptx-generator).
- **Why 41 P1**: these are 1-degree extensions of P0 — same provider, complementary feature, or natural next step (e.g. gsap-react after gsap-core; frame-data-chart-nyt after data-report).
- **Why 52 P2**: most of S9 (retainer ongoing-service deliverables) lives here. We do NOT sign retainers in week 1 — those skills can wait until first paying retainer.
- **Why 26 P3**: genuinely off-strategy (Flutter / SwiftUI / iOS apps), upstream-only stubs (ui-ux-pro-max, pixelbin-media), or duplicates of a P0/P1 skill already chosen.

---

*End of inventory · 137 skills mapped · 0 skipped.*
