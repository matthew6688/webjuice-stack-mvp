# Image Generation Automation Notes

Updated: 2026-05-09

## Current Decision

For niche template images, start with manual ChatGPT Image generation from a prompt pack. Do not automate the ChatGPT UI until we know the prompts produce images that meet Matthew's quality bar.

Prompt pack:

```text
templates/roofing/image-prompts/chatgpt-image2-prompt-pack.md
```

## Why Manual First

The current bottleneck is not clicking buttons. The bottleneck is whether the image direction is good enough:

- Does the image look like a real premium local-business website asset?
- Does it match the reference template mood?
- Does it avoid text, fake logos, and fake proof?
- Does it leave usable negative space for website composition?
- Does it fit the target template family?

If the prompts are weak, browser automation will only generate weak images faster.

## Automation Options

### Browser Use

Useful for a later proof-of-concept because it supports persistent browser automation and CLI-style actions such as opening pages, inspecting state, clicking, typing, and taking screenshots. It also supports real browser profile/session patterns.

Risks:

- ChatGPT UI changes often.
- Login/session handling must be reliable.
- Downloads and image extraction need a deterministic convention.
- CAPTCHAs, rate limits, or UI experiments can break the flow.

Best first test:

```text
Open ChatGPT image conversation
Paste one prompt
Wait for image
Download or capture the generated image
Save metadata: prompt, timestamp, source conversation URL, output file path
Run local QA against the saved image
```

### OpenCLI

Useful if we want to turn a website or browser workflow into a more standardized CLI-like tool and produce structured outputs.

Risks:

- The target web app still needs a stable learned workflow.
- We need to confirm image generation/download works reliably before wrapping it.

Best first test:

```text
Create a small OpenCLI browser command for one prompt and one output image.
Require JSON output:
  prompt id
  status
  generated image path
  screenshot path
  error if any
```

### Chrome Extension / Existing Chrome Profile

Most realistic long-term path if the generation happens inside a logged-in ChatGPT account.

Risks:

- Extension permissions and DOM selectors need maintenance.
- The browser must be clearly operator-owned, because it uses the user's session.

Best first test:

```text
Use existing Chrome profile
Open a known ChatGPT conversation
Paste prompt
Wait for image cards
Read image URLs or download buttons
Save image and screenshot
Write a run log
```

## Recommended Sequence

1. Matthew manually tests 5-8 prompts from the prompt pack.
2. Save accepted/rejected images under:

```text
templates/roofing/families/<family>/image-candidates/manual-chatgpt-image/
```

3. Run visual review against the acceptance checklist.
4. If at least 70% are usable, automate one prompt end-to-end with Browser Use or Chrome.
5. If one automated prompt is stable, add a repo script:

```text
npm run template-lab:image-chatgpt-ui -- --prompt-id classic-hero-dusk --family classic-premium-roftix
```

6. Only after this works, batch-generate images.

## Required Run Log

Every automated image generation run must save:

```json
{
  "promptId": "classic-hero-dusk",
  "provider": "chatgpt-image-ui",
  "startedAt": "...",
  "finishedAt": "...",
  "status": "generated",
  "conversationUrl": "...",
  "promptPath": "templates/roofing/image-prompts/chatgpt-image2-prompt-pack.md",
  "outputImages": ["..."],
  "screenshots": ["..."],
  "notes": "..."
}
```

## Quality Gate

Do not attach generated images to Open Design unless:

- the prompt is stored in repo;
- the generated image is stored in repo or a durable asset store;
- a screenshot or provenance record exists;
- the image has no text/logo/watermark/fake proof;
- the image matches the intended template slot.
