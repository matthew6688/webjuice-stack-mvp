#!/usr/bin/env node

import { getNiche, listNiches } from '../../core/niches/registry.js';

for (const id of listNiches()) {
  const niche = getNiche(id);
  console.log(`${niche.id}\t${niche.label}\t${niche.templateRepo}`);
}
