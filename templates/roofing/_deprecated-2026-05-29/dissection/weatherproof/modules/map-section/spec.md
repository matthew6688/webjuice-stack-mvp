# Module: map-section

Extracted from: `contact.html` · section #2

Sample H1: —
Sample H2: —

## Parameter slots (to fill out manually before composer can use this)

When parameterizing this module for client X, identify which hardcoded values come from:

- `{{business_name}}` · client·facts
- `{{phone}}` · client·facts
- `{{phone_tel}}` · client·facts
- `{{email}}` · client·facts
- `{{city}}` · client·facts
- `{{state}}` · client·facts
- `{{licensing_authority}}` · client·facts
- `{{suburbs[]}}` · client·facts
- `{{services[]}}` · client·content (with library fallback)
- `{{testimonials[]}}` · client·content (with library fallback)
- `{{photos.<role>}}` · client OR library (library tagged)
- `{{hero_copy.<framework>}}` · library (parameterized)
- `{{faqs[]}}` · library (parameterized to city/state)

## Audit notes

- This module appears in templates/<niche>/modules/<label>/
- When the composer renders this, it must inline the source HTML structure, replace placeholders, then attach provenance tags.