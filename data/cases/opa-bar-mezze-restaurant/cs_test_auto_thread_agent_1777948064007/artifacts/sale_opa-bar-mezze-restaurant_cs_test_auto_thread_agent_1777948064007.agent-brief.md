# Agent Brief: sale_opa-bar-mezze-restaurant_cs_test_auto_thread_agent_1777948064007

Client: opa-bar-mezze-restaurant
Repo: matthew6688/opa-bar-mezze-restaurant
Branch: dev
Mode: sale

## Required Read Order

1. data/cases/opa-bar-mezze-restaurant/cs_test_auto_thread_agent_1777948064007/context-packet.json
2. data/cases/opa-bar-mezze-restaurant/cs_test_auto_thread_agent_1777948064007/timeline.jsonl
3. clients/opa-bar-mezze-restaurant/evidence/evidence.json
4. clients/opa-bar-mezze-restaurant/content.restaurant.json
5. clients/opa-bar-mezze-restaurant/design.restaurant.json
6. clients/opa-bar-mezze-restaurant/brand-spec.md

## Customer Request

Auto-thread and auto-agent smoke test after GH_TOKEN push fix. Do not treat as a real customer order.

## Design Protocol

Required skill: huashu-design
- Official website work must look like a real formal website with brand hierarchy, not a data dump.
- Menu work must stay minimal, mobile-first, and content-focused.
- Preserve the existing design language unless the task explicitly asks for redesign.
- Use real restaurant photos and verified brand assets whenever available.

## Constraints

- Read the case context packet before planning edits.
- Website and menu are separate products; classify the request before editing.
- Use evidence/content/design/brand files as source of truth.
- Do not invent or overwrite menu prices, hours, address, phone, reservation links, or photos without evidence.
- Do not overwrite locked decisions from the case file.
- Push only to dev until customer approval.
