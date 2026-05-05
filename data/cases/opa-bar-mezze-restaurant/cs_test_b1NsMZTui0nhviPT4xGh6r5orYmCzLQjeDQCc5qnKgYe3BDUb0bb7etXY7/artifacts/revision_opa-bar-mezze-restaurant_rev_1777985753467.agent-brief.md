# Agent Brief: revision_opa-bar-mezze-restaurant_rev_1777985753467

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

Live revision smoke: keep the restaurant website unchanged, but confirm the revision pipeline can receive Cloudinary attachments and create a dev task. No visual change required unless the agent adds a tiny internal smoke note in allowed case/task records only.

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
