# Dokobot Redesign Workflow

Updated: 2026-05-06

## Purpose

Dokobot gives the local agent a real Chrome browser reader. Use it when a normal scraper is weak: JavaScript-rendered sites, Google search result pages, logged-in pages, infinite scroll, social profiles, or pages where browser-rendered text matters.

For ProfitsLocal, Dokobot is a collection and audit tool. It is not the source of truth by itself and it is not the visual QA tool. The output should feed the website redesign preservation packet.

## Installed State

Verified locally:

- CLI: `dokobot --version` -> `2.10.10`
- Local bridge: `dokobot doko list` returns local Chrome devices
- Codex skills installed:
  - Dokobot Core Skill
  - Doko Search
  - Doko Research
- Hermes Agent skills installed:
  - Dokobot Core Skill
  - Doko Search
  - Doko Research

Hermes/Codex may need a restart before newly installed skills appear in their skill lists.

## Core Commands

List devices:

```bash
dokobot doko list
```

Read a page through local Chrome:

```bash
dokobot read --local --device <device-id> --screens 3 --timeout 60 https://example.com
```

Read Google search results through local Chrome:

```bash
dokobot read --local --device <device-id> --screens 2 --timeout 60 'https://www.google.com/search?q=Business+Name+restaurant'
```

Project smoke helper:

```bash
npm run dokobot:smoke -- --url https://dokobot.ai/skill
```

Save extracted text:

```bash
npm run dokobot:smoke -- --url https://www.richandrare.com.au --output data/dokobot/rich-and-rare-home.md
```

## When To Use

Use Dokobot for:

- existing website redesign intake;
- sitemap and page text extraction from JS-heavy sites;
- Google search / business panel capture;
- contact discovery from search results;
- social/profile pages that need a logged-in browser;
- before/after critique inputs for outreach;
- local browser content checks when Firecrawl/Playwright extraction is sparse.

Prefer existing deterministic tools for:

- direct API data such as Google Places;
- static HTML extraction when Firecrawl or MarkItDown works;
- PDF/OCR workflows;
- screenshots and visual layout QA, where Playwright remains more reliable.

## Redesign Preservation Flow

```text
Dokobot search/read
-> existing sitemap candidates
-> official pages and important links
-> core business facts
-> logo/favicon/brand asset candidates
-> SEO metadata and visible headings
-> current CTA/footer/header facts
-> website-redesign-preservation packet
-> local LLM audit
-> build only if ready
```

## Rich & Rare Smoke Evidence

Google result page extraction successfully returned:

- official site: `https://www.richandrare.com.au`
- address: `97 Boundary St, West End QLD 4101`
- phone: `(07) 3638 8888`
- rating/reviews
- menu links
- contact link
- reservation provider: SevenRooms
- Google business description
- social profile candidates

This proves Dokobot is useful for the exact redesign-preservation intake case: it captures the business panel and organic sitelinks that normal website-only crawling may miss.

## Operating Rules

- Keep `--local` as default for local work: free, fast, and no page content leaves the machine.
- If multiple devices exist, pass `--device`; otherwise reads fail with a selection prompt.
- Use `--screens` and `--session-id` for long/infinite pages.
- Close long sessions when done if the command returns a session ID.
- Do not use Dokobot alone to decide critical facts. Cross-check important facts against official site, Google Places, and existing artifacts.
- If extraction misses core facts, stop the redesign and ask for human/source help.

## Known Limitations

- Search results depend on browser locale, login state, and Google UI.
- CAPTCHA or sparse extraction can happen after rapid searches.
- CLI `dokobot search` does not expose local-mode flags; for local free search, read the search engine URL directly.
- Browser text extraction is not a replacement for screenshot QA.
