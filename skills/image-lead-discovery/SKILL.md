---
name: image-lead-discovery
description: Use when a lead starts from a Discord image/photo, sign, flyer, screenshot, or OCR text. Converts the image into evidence, searches/verifies contact facts, writes a discovery log, then runs lead-ops.
---

# Image Lead Discovery

Use this skill when an operator drops a business photo into Discord, especially signs, vans, menus, flyers, screenshots, or handwritten notes.

The habit matters: every search and conclusion must be written into repo evidence and `discovery-log.jsonl`. Do not keep search work only in chat.

## Workflow

1. Record the Discord source.
   - workspace/channel/thread/message if known
   - attachment name or screenshot source
   - OCR text or operator transcription
2. Extract minimum facts.
   - business name or visible brand text
   - phone
   - email if present
   - services
   - location/address if present
   - trust claims such as years experience/free quote, marked as claims
3. Search the strongest unique identifiers.
   - phone exact match first
   - phone without spaces
   - business text + phone
   - business text + service/location if phone search fails
4. Record every useful search action.
   - query
   - result URL
   - matched fact
   - confidence
   - conflicts
5. Write evidence and log.
   - `clients/<slug>/evidence/evidence.json`
   - `clients/<slug>/lead/discovery-log.jsonl`
   - `clients/<slug>/lead/discord-image-source.md`
6. Run lead-ops.
   - `lead-intake`
   - `lead-research`
   - `redesign-check`
   - `build-ready`
   - `outreach-brief`
7. Inspect admin/pipeline result.

## Command

Create an input JSON, then run:

```bash
npm run leads:image-discovery -- --input data/qa/discord-image-lead/<slug>/input.json
```

## Input Shape

```json
{
  "clientSlug": "mb-roofing-photo-lead",
  "discord": {
    "workspace": "website-leads",
    "channelId": "1501187038706401290",
    "messageId": "optional"
  },
  "image": {
    "name": "roofing-sign.jpg"
  },
  "ocrText": "visible or operator-supplied text",
  "businessName": "visible name if any",
  "businessNameNote": "mark if generic or uncertain",
  "industry": "roofing and restoration",
  "phone": "0424 371 622",
  "services": ["roof restorations", "roof repairs"],
  "search": {
    "queries": [
      "\"0424 371 622\" roofing",
      "\"0424371622\" roofing"
    ],
    "results": [
      {
        "title": "M&B Roofing",
        "url": "https://betterpages.com.au/item/mb-roofing/",
        "summary": "Phone matched listing; adds email, Facebook, and Jamison Town NSW.",
        "businessName": "M&B Roofing",
        "city": "Jamison Town / Greater Western Sydney",
        "address": "Jamison Town, NSW 2750",
        "email": "ghilton@live.com.au",
        "facebookUrl": "https://www.facebook.com/M-B-Roofing-1746109772175941"
      }
    ]
  },
  "conflicts": [
    "Photo says 40 years experience; directory says 50 years. Verify before customer-facing copy."
  ]
}
```

## Output Checks

The run is not complete unless:

- `evidence.json` includes the OCR facts and search-match facts.
- `discovery-log.jsonl` includes Discord image, OCR, search query, search match, conflict, evidence write, and lead-ops run.
- `/admin/leads/` can show the lead in the correct pipeline stage.
- Work trace shows the search result URL and the evidence source.
- Any conflicting claim is visible before it can reach outreach copy.

## Decision Rules

- Phone-only or OCR-only: reachable, but `需人工`; continue searching phone/name/service before building.
- Phone + verified directory/listing match + services + location + no dedicated website found: can become `可做 Mockup`.
- If search finds an official website: do not build immediately; run `site-audit` first.
- No reachable contact path: skip or research contact path first.
- If the only value proposition is weak or generic, do not build just to build.

## Scenario Matrix

| Scenario | Required output |
|---|---|
| Image has services and phone, but no search match | `需人工`; log the search queries and say what is still missing |
| Image phone matches directory/social, no website found | `可做 Mockup`; log why no dedicated website is a positive opportunity |
| Image phone/name finds official website | `需人工`; run `site-audit` before redesign/mockup |
| Image has no real contact path | `已跳过` or research contact path first |
