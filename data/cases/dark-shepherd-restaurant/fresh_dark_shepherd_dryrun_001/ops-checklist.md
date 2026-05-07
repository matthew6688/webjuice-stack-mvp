# Ops Checklist: Dark Shepherd

Status: ready_for_customer_review
Client: dark-shepherd-restaurant
Order/run: fresh_dark_shepherd_dryrun_001
Repo: matthew6688/dark-shepherd-restaurant
Preview: https://dark-shepherd-restaurant-dev.pages.dev/

| Stage | Status | Evidence | Next action |
|---|---|---|---|
| 创建 dry-run case | pass | data/cases/dark-shepherd-restaurant/fresh_dark_shepherd_dryrun_001/case.json<br>data/cases/dark-shepherd-restaurant/fresh_dark_shepherd_dryrun_001/context-packet.json | 继续验证 evidence 和 website-ready packet。 |
| 验证 evidence | pass | clients/dark-shepherd-restaurant/evidence/evidence.json | 继续生成 website-ready packet。 |
| 生成 website-ready packet | pass | clients/dark-shepherd-restaurant/intake/website-survey.json<br>data/cases/dark-shepherd-restaurant/fresh_dark_shepherd_dryrun_001/build-packet.md | 创建或继续 Discord website task thread，然后在 dev 上构建。 |
| 检查 Open Design project | pass | clients/dark-shepherd-restaurant/concept/open-design/concept-manifest.json<br>clients/dark-shepherd-restaurant/concept/open-design/production-handoff.json | 继续确认 production handoff。 |
| 检查 production handoff | pass | clients/dark-shepherd-restaurant/concept/open-design/production-handoff.json | 继续 port/build customer repo dev preview。 |
| 构建 customer repo dev preview | pass | /Users/matthew/Developer/dark-shepherd-restaurant/dist | 继续验证 customer repo preview banner。 |
| 验证 preview banner 和官方 funnel links | pass | /Users/matthew/Developer/dark-shepherd-restaurant/dist | 继续创建 agent task draft。 |
| 验证 delivery QA 报告 | pass | data/cases/dark-shepherd-restaurant/fresh_dark_shepherd_dryrun_001/delivery-qa.json | 继续创建 agent task draft 和客户 review 邮件草稿。 |
| 创建 agent task draft | pass | data/cases/dark-shepherd-restaurant/fresh_dark_shepherd_dryrun_001/agent-task-draft.json | 人工确认后可把 task dispatch 到 Discord website thread。 |
| 生成 customer review email draft | pass | data/cases/dark-shepherd-restaurant/fresh_dark_shepherd_dryrun_001/customer-review-email-draft.json | customer email 只能在 delivery QA 通过后通过 Resend 正式发送。 |

