# Open Design · 现状 + Hermes 替代性评估

调研日期: 2026-05-13
仓库: `/Users/matthew/Developer/google-map-website`
关键外部依赖: `/Users/matthew/Developer/open-design/` (独立 OSS 项目)

---

## 一、代码地图

### 关键发现 (颠覆性)
**"Open Design" 不是 profitslocal 内建的网站生成器,它是一个独立的 Apache-2.0 开源产品 (nexu-io/open-design),坐落在 `/Users/matthew/Developer/open-design/`。** profitslocal 仅作为客户端调用它的 daemon (HTTP 127.0.0.1:7466)。

证据:
- `/Users/matthew/Developer/open-design/README.md` L42-46: "Open Design (OD) is the open-source alternative" to Anthropic Claude Design, "BYOK at every layer", 站在 huashu-design / guizang-ppt / open-codesign / multica 四个开源仓肩膀上。
- `core/open-design/workspace.js:3` 写死了 `DEFAULT_OPEN_DESIGN_DATA_DIR = '/Users/matthew/Developer/open-design/.od'`。
- `scripts/open-design/run-concept.js:8` `DEFAULT_OPEN_DESIGN_ROOT = '/Users/matthew/Developer/open-design'`,启动 daemon 用的是 `node24` 的二进制。
- OD 真正的执行引擎是用户本机已安装的 16 种 coding-agent CLI 之一 (codex/claude/hermes/gemini/opencode/qwen…),`run-concept.js:45` 默认 `agentId = 'codex'`。

### profitslocal 这一侧的 Open Design 代码 (≈ 4.5K lines)
| 路径 | LOC | 一句话 |
|------|-----|--------|
| `core/open-design/workspace.js` | 55 | 解析 .od/projects/<id>/concept-manifest.json,绑定本地 OD 项目 |
| `core/leads/template-match.js` | 248 | 把 lead → roofing/restaurant 模板家族打分匹配 |
| `core/leads/copy-brief.js` | 248 | 把 verified facts → hero/CTA/services copy plan |
| `core/leads/open-design-handoff.js` | 86 | 拼一份发给 OD daemon 的 prompt + guardrails |
| `scripts/leads/build-template-mockup-handoff.js` | 111 | research → ready → match → brief → handoff 串起来 |
| `scripts/open-design/run-concept.js` | **1431** | 启动 daemon、SSE 解析、超时/兜底、artifact 落盘 |
| `scripts/open-design/continue-concept.js` | 511 | 在已有项目上追加 prompt 改稿 |
| `scripts/open-design/run-template-handoff.js` | 312 | 把上面的 handoff JSON 喂给 run-concept |
| `scripts/open-design/audit-generated-concept.js` | 224 | 跑 ui/copy/mobile/seo/fact-safety 五项 audit |
| `scripts/open-design/validate-concept.js` | 216 | concept-manifest.json schema 检查 |
| `scripts/open-design/build-production-handoff.js` | 305 | concept → production-handoff.json (准备上 Cloudflare) |
| `scripts/open-design/port-production-handoff.js` | 304 | 写到客户 git 仓 |
| `scripts/open-design/sync-from-app.js` | 125 | 把 OD app 内手动改的稿同步回 clients/<slug>/ |
| `core/deploy/client-repo-bootstrap.js` | 170 | gh repo create + cf pages project + secrets |
| `core/deploy/github-actions.js` | 48 | 查 deploy run 状态 |

### 其他相关
- `niches/restaurant/{adapter,schema}.js` (317 LOC) — Restaurant evidence → 结构化 content 的适配器,**这才是 niche IP**。
- `niches/roofing/` — 空。Roofing 的 niche 智能完全活在 `templates/roofing/` 的 JSON 里。
- `core/design/restaurant-brief.js` (230 LOC) — Restaurant 视觉/语言 brief 构造器。
- `core/redesign/preservation.js` (472 LOC) — 老站事实保留检查。
- `core/leads/asset-manifest.js` — 客户资产清单 (screenshot/video/doc)。

---

## 二、单客户产物 (brisbane-roof-restoration-experts)

```
clients/brisbane-roof-restoration-experts/
└── v2/                                 # 这是 V2 audit 产物,不是网站构建产物
    ├── master.md                  329L  # 由 scripts/leads/build-master-md.js 自动生成
    ├── master.report.html         419L  # huashu-md-html (~/.claude/skills/.agents/skills/huashu-md-html/scripts/md_to_html.py) 转的
    ├── internal-audit-report.html 629L  # core/reports/internal-audit-html.js 生成
    ├── evidence/
    │   ├── issue-form-visual-clutter.png
    │   ├── issue-hero-text-contrast.png
    │   ├── issue-homepage-title-clear.png
    │   └── issue-logo-design.png
    ├── screenshots/{desktop,mobile}.png
    └── video/mobile-throttled.webm
```

**这个客户没有任何 concept/open-design 目录,也没有 lead/open-design-handoff.json,意味着——它根本没有进入 Open Design 网站生成流程。** v2/ 里全是 audit 产物 (现状评分、问题截图、报告 HTML、移动视频),用于销售/外联,不是要交付的网站。

对比有 OD 输出的样本 (`clients/od-handoff-roofer-smoke/concept/open-design/`),实际网站产物是:
```
concept-manifest.json        # 项目元数据
concept-quality-audit.json   # 5 项 audit 结果
concept-quality-audit.md     # 人类可读 audit
index.html                   # 实际网站 (单 HTML 文件)
outreach.html                # 外联落地页变体
open-design-run-state.json   # daemon run 元数据
open-design-run-summary.md
prompt.txt                   # 喂给 codex/claude 的最终 prompt
run-events.sse               # SSE 全量回放
assets/                      # OD 拉的图片/字体
```

**真实交付物 = 一个 daemon-spawned coding-agent 生成的单文件 HTML + outreach 变体。** 完全没有 multi-page、router、CMS、组件库。

---

## 三、设计系统

### profitslocal 这边
- **没有 React 组件库,没有设计 token,没有 block library。**
- `src/styles/` 只有 `global.css` 和 `admin-design-system.css` — 这是 profitslocal 自己 admin/landing 用的,不是给客户网站的。
- `src/layouts/` 只有 `Layout.astro` + `AdminLayout.astro` — Astro 项目骨架,跟客户网站无关。

### 模板系统 (这是真 IP)
`templates/roofing/families/` — **4 个 family**:
1. `classic-premium-roftix` — 高端住宅屋顶,深色英雄/绿 CTA
2. `editorial-bold-commercial` — 工业商业大胆杂志风
3. `lead-capture-restoration` — 一页式低信息修复留资
4. `productized-modern-roofing` — 产品化材料/检查/系统包

每个 family 含:
```
DESIGN.md                # 设计语言文档
brand-kit.json           # 色板/字体/logo 规则
design-language.md
design-signals.json (115 LOC for roftix)
section-patterns.json (40 LOC) # block 序列约束
template-manifest.json   # fit/factsPolicy/qa/factualLock
qa-rubric.json
copy-audit.json
image-keywords.json     # (在 shared/)
image-candidates/        # 真实候选图
references/              # 参考站点截图,按时间戳分目录
screenshots/{desktop-index,desktop-outreach,mobile-index}.png
open-design/             # OD 真生成过的样例 (≈350 LOC index.html)
open-design-prompt.md    # 喂给 OD 的 prompt 模板
```

`templates/roofing/shared/`:
- `image-keywords.json` / `service-taxonomy.json` / `trust-signals.json`

**restaurant niche** 完全不在 templates/ 里,而是在 `niches/restaurant/{adapter,schema}.js` —— 走的是不同范式 (evidence → structured content adapter)。**两个 niche 走两条路,系统不统一。**

总结:
- "设计系统" = 4 个 roofing 家族的 JSON 配置 + 参考图 + 一份 prompt 模板。
- "组件" = 实际不存在;每次 codex/claude 都从零写 HTML。
- 实际 HTML 由 LLM 一次性吐出,profitslocal 不维护 partial/include/snippet。

---

## 四、LLM-replaceable vs IP

| 组件 | 分类 | 理由 |
|------|------|------|
| `templates/roofing/families/*/template-manifest.json` (4 个) + `design-signals.json` + section-patterns.json | 🟢 **LOCAL IP** | 这是 niche-specific 的策展知识:什么样的 lead 配什么家族、必须保留哪些事实、哪些 section 不能少。Hermes 替代不掉,因为它是经验沉淀,不是再生成。 |
| `core/leads/template-match.js` (打分逻辑) | 🟢 **LOCAL IP** | 80+ 行手写规则: notFor 惩罚、低信息线索拒绝、redesign/teaser/premium build-mode 加权。是结晶过的销售直觉。 |
| `core/leads/copy-brief.js` (verified facts → hero/CTA plan) | 🟢 **LOCAL IP** | factLock + 不可发明字段 + 不可暴露的 provenance 标签。这是合规/质量保证,跟 LLM 谁来跑无关。 |
| `niches/restaurant/{adapter,schema}.js` | 🟢 **LOCAL IP** | Evidence pack → 结构化菜单/CTA/营业时间。规则化解析,不需要 LLM。 |
| `core/leads/asset-manifest.js` + Cloudinary 上传 | 🟢 **LOCAL IP** (基础设施) | 客户资产的唯一索引,串联 audit/proposal/网站。 |
| `core/audit/*` (12 个维度,包含 pagespeed/ai-geo/form/sitemap/tech-stack) | 🟢 **LOCAL IP** | V2 audit 12 维度,自家定义的评分体系。 |
| 实际 HTML 生成 (codex/claude 跑 open-design daemon 喷出的 index.html) | 🔴 **COMMODITY** | OD daemon 调你本机的 CLI。Hermes/Claude/GPT 任何一个能写 HTML 的模型都可跑。`assertOpenDesignReady` 也只是检查 OD 仓在不在。 |
| Hero/section copywriting (LLM 实际写词的那一步) | 🟡 **COULD MIGRATE** | 现在由 codex 在 OD 里完成。完全可以让 Hermes (T1 订阅) 或 Claude API (T3) 直接出。 |
| `scripts/open-design/run-concept.js` 的 SSE 解析/超时/兜底 (1431 LOC!) | 🟡 **可大幅简化** | 这 1431 行 90% 在跟 OD daemon 的 SSE 流死磕 (artifact-quiet-ms、hard-timeout、question-form rounds、app-visible vs isolated mode)。如果直接调 Hermes API,这层全废。 |
| `core/deploy/client-repo-bootstrap.js` + CF Pages + GH Actions | 🟡 **可简化** | gh repo create + wrangler pages project create + secrets。Hermes 不替代这个,但 Cloudflare Worker 直接托管单文件 HTML 比 gh+actions+pages 简单 10 倍。 |
| `core/redesign/preservation.js` (472L 老站事实保留检查) | 🟢 **LOCAL IP** | 防止 LLM 把客户真实电话改掉。 |
| `scripts/open-design/audit-generated-concept.js` (5 项 audit) | 🟢 **LOCAL IP** | UI/copy/mobile/SEO/fact-safety 五维 audit 是质量门。 |
| `huashu-md-html` (master.md → HTML) | 🟡 已是外部 skill | 在 `~/.claude/skills/.agents/skills/huashu-md-html/`,Markdown→theme'd HTML 转换器,你不维护。 |
| Hyperframes 视频导出 | 🟡 已是外部 skill | 也是外部技能,不在仓里。 |

---

## 五、Open Design 的 "硬" 问题

**先说结论:profitslocal 的护城河 ≠ Open Design 这个 OSS 项目本身。** OD 那一坨 (.od/、daemon、16-agent 检测、72 design systems、31 skills) 是公开 Apache-2.0 任何人能克隆的。

真正"硬"的部分:

1. **Lead → 模板匹配** (`template-match.js`)
   证据: 247 行规则,scoring 用了 `commercial|metal|bold` / `restoration|repair|gutter` / `redesign|existing site` / `teaser|one_page` 6 组正则 + `notFor` 惩罚 + `qaScore` 加权。这是手工调出来的经验。

2. **Fact-lock & verified-vs-inferred 分离** (`copy-brief.js` + `open-design-handoff.js:25-30`)
   证据: prompt 里强制 "Do not print labels like placeholder, inferred, generated, audit, or Open Design on the frontend" + `mustKeepExact` + `mustNotInvent` 黑白名单。LLM 没这层就会随便编电话。

3. **Niche 模板策展** (`templates/roofing/families/*` 那 4 套)
   证据: 每个家族都有真实参考站截图 + image-candidates + 已跑过的 OD 生成样例 + qa-rubric。重新做一个 family 不便宜。

4. **V2 12-dim audit 评分体系** (`core/audit/*`)
   证据: pagespeed/ai-geo/form/sitemap/tech-stack/activity/domain-history/image-optimization/trust-signals 等都是自家定义的探针。

5. **客户资产管线** (`core/leads/asset-manifest.js` + Cloudinary)
   证据: 单一 manifest.json 串联 audit screenshot/video/proposal HTML,所有外联/销售都引用这里。

**不硬的部分:**
- HTML 实际渲染。`run-concept.js:1431` 那一大坨 SSE/timeout/fallback 逻辑全是为了喂 OD 这个外部 daemon —— 如果直接调 LLM API,90% 删掉。
- "16-agent 检测",对 profitslocal 没意义,我们只跑 codex 或 claude。
- "72 design systems" 在 OD 上游仓里,我们没用上。

---

## 六、Cloudflare 交付现状

**Pipeline 跑通了吗:** 是,但只跑了 3 个客户域名。

证据 (`data/domain/*.pages-status.json`):
- `opa-controlled.profitslocal.com` ✓ active (Google CA)
- `profitslocal.com` ✓
- `rich-and-rare.profitslocal.com` ✓ active (2026-05-06)

**真客户数** (paid via Stripe, `data/finance/ledger.jsonl`):
```
4 笔 paymentStatus=paid 记录:
- opa-bar-mezze-restaurant            $399 (2026-05-05)
- profitslocal-e2e-1778026269809      $399 (2026-05-06)  ← e2e 测试
- forum-remote-smoke-1778164589       $$$  ← smoke 测试
- fresh-paid-prod-smoke               $$$  ← smoke 测试
```
**真正非 smoke 的付费客户 = 2 个 (opa-bar-mezze + rich-and-rare),且都还在体系内子域 `*.profitslocal.com`,没有自有顶级域。**

`clients/` 有 13 个 v2/ 目录,但**绝大多数没有 concept/open-design/ 输出** —— v2/ 只是 audit 产物用来卖,不是已交付的网站。

Deploy 链路 (`core/deploy/client-repo-bootstrap.js:20-40`):
```
gh repo create → gh variable set PAGES_PROJECT_NAME →
gh secret set CLOUDFLARE_API_TOKEN/ACCOUNT_ID →
wrangler pages project create <name>-dev/live →
git push main + dev → GitHub Actions deploy →
add custom domain (cf-pages)
```
依赖: `GH_PAT`, `CF_API_TOKEN`, `CF_ACCOUNT_ID`。

**结论: 交付链路代码完整,真正跑过的客户只有 2 个,产品仍在原型/早期阶段。**

---

## 七、给 V3 的判断

### Open Design 是不是真护城河?
**不是。** OD 仓本身 (Apache-2.0 OSS) 在 `~/Developer/open-design/`,任何人 git clone 即可。**护城河是 profitslocal 这一侧的 4 个东西**: lead→模板匹配 / fact-lock copy plan / niche 模板策展 (4 个 roofing family JSON) / V2 12-dim audit。

### Hermes 能替代多少?
**~55-65%**。具体:
- HTML 渲染那一步 (`run-concept.js` 1431 LOC + OD daemon + codex CLI spawn): **100% 可替代**,Hermes 直接 chat API 输出 HTML 就行。
- Copy plan 实际写词: **100% 可替代** (现在也是 LLM 写的,只是经过 codex)。
- 模板匹配/fact-lock/audit/asset 管线: **0% 替代**,这些是规则代码不是 LLM。
- 模板策展 (4 个 family 的 JSON+参考图): **0% 替代**,这是人工沉淀。

### 必须我们造的 3 件
1. **Niche 模板策展 + fact-lock copy brief** —— `template-match.js` + `copy-brief.js` + `templates/<niche>/families/*`。这是手工调出来的销售直觉,LLM 替代不了。
2. **V2 12-dim audit + 资产管线** —— `core/audit/*` + `core/leads/asset-manifest.js` + Cloudinary。是销售/外联的弹药库。
3. **Cloudflare Pages 部署 + 域名绑定** —— `core/deploy/client-repo-bootstrap.js`。真客户上线只能我们做。但可以大幅简化 (见下)。

### V3 该简化 / 砍 / 交给 Hermes 的 3 件
1. **砍掉 1431 行的 `run-concept.js` + OD daemon 依赖** —— 替成 100 行的 "Hermes/Claude API + 一份 system prompt + 落盘 index.html"。理由: 4500 行 OD 胶水代码服务于一个 OSS daemon,我们其实只需要 LLM 吐 HTML。Roofing 已有的 4 个家族 prompt 直接喂 Hermes。
2. **砍 GitHub Actions + 双 Pages 项目 (dev+live) 的 bootstrap** —— Cloudflare Worker 单文件托管或直接 `wrangler pages deploy ./` 一行命令。`buildClientRepoBootstrapPlan` 里 11 个 step 缩成 2 个。理由: 现在每个客户要建 1 个 gh repo + 2 个 cf pages 项目 + 4 个 secret/var,2 个真客户的成本根本不需要这么重的脚手架。
3. **统一两个 niche 范式** —— roofing 走 `templates/families/*` (JSON 策展),restaurant 走 `niches/restaurant/adapter.js` (代码适配),系统分裂。V3 选一条路 (推荐 JSON 策展 + 共享 schema),让加新 niche = 加目录,不再写 JS。

---

最后: 真正"护城河"层 (template-match.js + copy-brief.js + templates/roofing/families/* + core/audit/*) 加起来 **不超过 2000 LOC**。其他 ~4500 LOC 都是 OD daemon 胶水,Hermes 来了大部分可以删。
