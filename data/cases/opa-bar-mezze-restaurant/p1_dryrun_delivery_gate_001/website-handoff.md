# Website Handoff: Opa Bar & Mezze

状态：blocked
项目：opa-bar-mezze-restaurant
Repo：matthew6688/opa-bar-mezze-restaurant
本地目录：/Users/matthew/Developer/webjuice-generated/opa-bar-mezze-restaurant
Preview：https://opa-bar-mezze-restaurant-dev.pages.dev/
Dry-run：p1_dryrun_delivery_gate_001

## 当前结论

这个项目还没有达到客户 review 标准，请先处理 blockers。

## 核心入口

- Website survey：clients/opa-bar-mezze-restaurant/intake/website-survey.json
- Build packet：data/cases/opa-bar-mezze-restaurant/p1_dryrun_delivery_gate_001/build-packet.md
- Ops checklist：data/cases/opa-bar-mezze-restaurant/p1_dryrun_delivery_gate_001/ops-checklist.md
- Agent task draft：data/cases/opa-bar-mezze-restaurant/p1_dryrun_delivery_gate_001/agent-task-draft.json
- Customer review email draft：data/cases/opa-bar-mezze-restaurant/p1_dryrun_delivery_gate_001/customer-review-email-draft.json

## Open Design

- 状态：bound
- Project ID：opa-bar-mezze-restaurant-open-design-1778137259385
- Manifest：clients/opa-bar-mezze-restaurant/concept/open-design/concept-manifest.json
- Production handoff：clients/opa-bar-mezze-restaurant/concept/open-design/production-handoff.json
- Continue command：npm run open-design:continue-concept -- --client opa-bar-mezze-restaurant --prompt "<change request>"
- Sync command：npm run open-design:sync-from-app -- --client opa-bar-mezze-restaurant

## 下一步

1. 修复该命令失败原因后重新运行 dry-run。
2. 这个 customer repo 还残留旧版本地 funnel 页面。先同步到最新模板规则，移除本地 /checkout /approve /revise /domain-help 等页面，再重新运行 dry-run。

