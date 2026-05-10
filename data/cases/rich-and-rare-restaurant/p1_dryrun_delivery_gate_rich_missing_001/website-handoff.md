# Website Handoff: Rich & Rare Restaurant

状态：blocked
项目：rich-and-rare-restaurant
Repo：matthew6688/rich-and-rare-restaurant
本地目录：/Users/matthew/Developer/webjuice-generated/rich-and-rare-restaurant
Preview：https://rich-and-rare-restaurant-dev.pages.dev/
Dry-run：p1_dryrun_delivery_gate_rich_missing_001

## 当前结论

这个项目还没有达到客户 review 标准，请先处理 blockers。

## 核心入口

- Website survey：clients/rich-and-rare-restaurant/intake/website-survey.json
- Build packet：data/cases/rich-and-rare-restaurant/p1_dryrun_delivery_gate_rich_missing_001/build-packet.md
- Ops checklist：data/cases/rich-and-rare-restaurant/p1_dryrun_delivery_gate_rich_missing_001/ops-checklist.md
- Agent task draft：data/cases/rich-and-rare-restaurant/p1_dryrun_delivery_gate_rich_missing_001/agent-task-draft.json
- Customer review email draft：data/cases/rich-and-rare-restaurant/p1_dryrun_delivery_gate_rich_missing_001/customer-review-email-draft.json

## Open Design

- 状态：bound
- Project ID：rich-and-rare-restaurant-open-design-1778065212163
- Manifest：clients/rich-and-rare-restaurant/concept/open-design/concept-manifest.json
- Production handoff：clients/rich-and-rare-restaurant/concept/open-design/production-handoff.json
- Continue command：npm run open-design:continue-concept -- --client rich-and-rare-restaurant --prompt "<change request>"
- Sync command：npm run open-design:sync-from-app -- --client rich-and-rare-restaurant

## 下一步

1. 先运行资料收集，生成 evidence/evidence.json。
2. 修复 evidence/content/design 缺口后重新运行 dry-run。
3. 先运行 npm run qa:write-delivery-qa -- --client rich-and-rare-restaurant --order p1_dryrun_delivery_gate_rich_missing_001 --preview-url https://rich-and-rare-restaurant-dev.pages.dev/ --email matthew6688@gmail.com --repo matthew6688/rich-and-rare-restaurant，人工确认后重新运行 dry-run。

