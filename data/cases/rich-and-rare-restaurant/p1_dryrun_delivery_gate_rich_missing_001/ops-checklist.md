# Ops Checklist: Rich & Rare Restaurant

Status: blocked
Client: rich-and-rare-restaurant
Order/run: p1_dryrun_delivery_gate_rich_missing_001
Repo: matthew6688/rich-and-rare-restaurant
Preview: https://rich-and-rare-restaurant-dev.pages.dev/

| Stage | Status | Evidence | Next action |
|---|---|---|---|
| 创建 dry-run case | pass | data/cases/rich-and-rare-restaurant/p1_dryrun_delivery_gate_rich_missing_001/case.json<br>data/cases/rich-and-rare-restaurant/p1_dryrun_delivery_gate_rich_missing_001/context-packet.json | 继续验证 evidence 和 website-ready packet。 |
| 验证 evidence | blocker | - | 先运行资料收集，生成 evidence/evidence.json。 |
| 生成 website-ready packet | blocker | - | 修复 evidence/content/design 缺口后重新运行 dry-run。 |
| 检查 Open Design project | pass | clients/rich-and-rare-restaurant/concept/open-design/concept-manifest.json<br>clients/rich-and-rare-restaurant/concept/open-design/production-handoff.json | 继续确认 production handoff。 |
| 检查 production handoff | pass | clients/rich-and-rare-restaurant/concept/open-design/production-handoff.json | 继续 port/build customer repo dev preview。 |
| 构建 customer repo dev preview | pass | /Users/matthew/Developer/webjuice-generated/rich-and-rare-restaurant/dist | 继续验证 customer repo preview banner。 |
| 验证 preview banner 和官方 funnel links | pass | /Users/matthew/Developer/webjuice-generated/rich-and-rare-restaurant/dist | 继续创建 agent task draft。 |
| 验证 delivery QA 报告 | blocker | data/cases/rich-and-rare-restaurant/p1_dryrun_delivery_gate_rich_missing_001/delivery-qa.json | 先运行 npm run qa:write-delivery-qa -- --client rich-and-rare-restaurant --order p1_dryrun_delivery_gate_rich_missing_001 --preview-url https://rich-and-rare-restaurant-dev.pages.dev/ --email matthew6688@gmail.com --repo matthew6688/rich-and-rare-restaurant，人工确认后重新运行 dry-run。 |
| 创建 agent task draft | pass | data/cases/rich-and-rare-restaurant/p1_dryrun_delivery_gate_rich_missing_001/agent-task-draft.json | 人工确认后可把 task dispatch 到 Discord website thread。 |
| 生成 customer review email draft | pass | data/cases/rich-and-rare-restaurant/p1_dryrun_delivery_gate_rich_missing_001/customer-review-email-draft.json | customer email 只能在 delivery QA 通过后通过 Resend 正式发送。 |

