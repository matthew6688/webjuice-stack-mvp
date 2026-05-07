# Agent Brief: revision_opa-bar-mezze-restaurant_cs_test_b1NsMZTui0nhviPT4xGh6r5orYmCzLQjeDQCc5qnKgYe3BDUb0bb7etXY7-1778142082568

Client: opa-bar-mezze-restaurant
Repo: matthew6688/opa-bar-mezze-restaurant
Branch: dev
Mode: revision

## Required Read Order

1. data/cases/opa-bar-mezze-restaurant/cs_test_b1NsMZTui0nhviPT4xGh6r5orYmCzLQjeDQCc5qnKgYe3BDUb0bb7etXY7/context-packet.json
2. data/cases/opa-bar-mezze-restaurant/cs_test_b1NsMZTui0nhviPT4xGh6r5orYmCzLQjeDQCc5qnKgYe3BDUb0bb7etXY7/timeline.jsonl
3. clients/opa-bar-mezze-restaurant/evidence/evidence.json
4. clients/opa-bar-mezze-restaurant/content.restaurant.json
5. clients/opa-bar-mezze-restaurant/design.restaurant.json
6. clients/opa-bar-mezze-restaurant/brand-spec.md

## Customer Request

官方 live smoke：请保持站点内容不变，只验证 revision 能回到同一个 case / website thread，并生成新的 dev 任务。时间：2026-05-07T08:21:01.082Z

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
