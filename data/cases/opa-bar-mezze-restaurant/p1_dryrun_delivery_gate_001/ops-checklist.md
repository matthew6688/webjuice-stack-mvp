# Ops Checklist: Opa Bar & Mezze

Status: blocked
Client: opa-bar-mezze-restaurant
Order/run: p1_dryrun_delivery_gate_001
Repo: matthew6688/opa-bar-mezze-restaurant
Preview: https://opa-bar-mezze-restaurant-dev.pages.dev/

| Stage | Status | Evidence | Next action |
|---|---|---|---|
| 创建 dry-run case | pass | data/cases/opa-bar-mezze-restaurant/p1_dryrun_delivery_gate_001/case.json<br>data/cases/opa-bar-mezze-restaurant/p1_dryrun_delivery_gate_001/context-packet.json | 继续验证 evidence 和 website-ready packet。 |
| 验证 evidence | pass | clients/opa-bar-mezze-restaurant/evidence/evidence.json | 继续生成 website-ready packet。 |
| 生成 website-ready packet | pass | clients/opa-bar-mezze-restaurant/intake/website-survey.json<br>data/cases/opa-bar-mezze-restaurant/p1_dryrun_delivery_gate_001/build-packet.md | 创建或继续 Discord website task thread，然后在 dev 上构建。 |
| 检查 Open Design project | pass | clients/opa-bar-mezze-restaurant/concept/open-design/concept-manifest.json<br>clients/opa-bar-mezze-restaurant/concept/open-design/production-handoff.json | 继续确认 production handoff。 |
| 检查 production handoff | pass | clients/opa-bar-mezze-restaurant/concept/open-design/production-handoff.json | 继续 port/build customer repo dev preview。 |
| 构建 customer repo dev preview | blocker | /Users/matthew/Developer/webjuice-generated/opa-bar-mezze-restaurant/dist | 修复该命令失败原因后重新运行 dry-run。 |
| 验证 preview banner 和官方 funnel links | blocker | /Users/matthew/Developer/webjuice-generated/opa-bar-mezze-restaurant/dist | 这个 customer repo 还残留旧版本地 funnel 页面。先同步到最新模板规则，移除本地 /checkout /approve /revise /domain-help 等页面，再重新运行 dry-run。 |
| 验证 delivery QA 报告 | pass | data/cases/opa-bar-mezze-restaurant/p1_dryrun_delivery_gate_001/delivery-qa.json | 继续创建 agent task draft 和客户 review 邮件草稿。 |
| 创建 agent task draft | pass | data/cases/opa-bar-mezze-restaurant/p1_dryrun_delivery_gate_001/agent-task-draft.json | 人工确认后可把 task dispatch 到 Discord website thread。 |
| 生成 customer review email draft | pass | data/cases/opa-bar-mezze-restaurant/p1_dryrun_delivery_gate_001/customer-review-email-draft.json | customer email 只能在 delivery QA 通过后通过 Resend 正式发送。 |

