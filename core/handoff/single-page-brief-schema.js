/**
 * Single-page brief schema · JSON Schema draft 2020-12 + cross-field validator
 *
 * Owns INPUT data shape ONLY (Codex Round 9 D4 orthogonal split).
 *
 *   brief-schema  =  what data MUST be present + valid shape
 *   page-spec     =  what rendered HTML MUST contain (skills/pl-local-trade-page-spec)
 *
 * Phone appears in both layers but at different abstraction:
 *   - brief-schema: phone object { display, tel_link } MUST be valid AU format
 *   - page-spec: phone digit string MUST appear ≥6 times in rendered HTML
 * They never overlap.
 *
 * Per Codex Round 16 Q-Y-2 (a): JSON Schema for structure · JS post-checks for
 * cross-field constraints. No AJV/custom-keyword dependency.
 *
 * Per Codex Round 16 Q-Y-5: includes canonical_url · service_area_primary_suburb ·
 * entity_review_count · emergency_phone conditional · URL vs path distinction ·
 * secondary_segments ≠ primary_segment · state ↔ address.state hard-equal.
 *
 * Scope guard (Codex R16 #7): input shape + deterministic cross-field ONLY.
 * No audit/content-quality logic. No rendered-output checks.
 *
 * Spec: docs/v3/SOP-SINGLE-PAGE-LOCAL-TRADE-STANDARD.md §6
 */

// ─── JSON Schema (draft 2020-12 · structure validation) ───────────────────────
export const BRIEF_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://profitslocal.dev/schemas/single-page-brief-v2.json',
  title: 'ProfitsLocal Single-Page Brief v2',
  type: 'object',
  additionalProperties: true,
  required: [
    'business_name',
    'phone',
    'address',
    'state',
    'abn',
    'license',
    'niche',
    'primary_segment',
    'urgency_mix',
    'pricing_disclosure_mode',
    'suburbs_covered',
    'services',
    'brand_tokens_path',
  ],
  properties: {
    // ─── Hard-required (T1 zero-tolerance) ─────────────────────────────────
    business_name: { type: 'string', minLength: 2, maxLength: 80 },
    phone: {
      type: 'object',
      required: ['display', 'tel_link'],
      additionalProperties: false,
      properties: {
        display: { type: 'string', pattern: '^(0?\\d[\\s\\-]?\\d{2,3}[\\s\\-]?\\d{3}[\\s\\-]?\\d{3}|1[38]00[\\s\\-]?\\d{3}[\\s\\-]?\\d{3})$' },
        tel_link: { type: 'string', pattern: '^\\+61\\d{9}$' },
      },
    },
    address: {
      type: 'object',
      required: ['street', 'suburb', 'state', 'postcode'],
      additionalProperties: false,
      properties: {
        street: { type: 'string', minLength: 3 },
        suburb: { type: 'string', minLength: 2 },
        state: { type: 'string', enum: ['VIC', 'QLD', 'NSW', 'WA', 'SA', 'TAS', 'ACT', 'NT'] },
        postcode: { type: 'string', pattern: '^\\d{4}$' },
      },
    },
    state: { type: 'string', enum: ['VIC', 'QLD', 'NSW', 'WA', 'SA', 'TAS', 'ACT', 'NT'] },
    abn: { type: 'string', pattern: '^\\d{2}\\s?\\d{3}\\s?\\d{3}\\s?\\d{3}$' },
    license: {
      type: 'object',
      required: ['authority', 'number', 'status'],
      additionalProperties: false,
      properties: {
        authority: { type: 'string', enum: ['VBA', 'QBCC', 'NSW-FT', 'BC-WA', 'CBS-SA', 'CBOS-TAS', 'AC-ACT', 'NT-WS'] },
        number: { type: 'string', minLength: 4, maxLength: 20 },
        status: { type: 'string', enum: ['active', 'grey-zone', 'omit'] },
      },
    },
    niche: { type: 'string', enum: ['roofing'] }, // Phase A: roofing only · Phase B adds plumbing/electrical/etc.
    primary_segment: {
      type: 'string',
      enum: ['urgent-repair', 'planned-upgrade', 'commercial-maintenance', 'guided-first-time-buyer', 'mixed-not-allowed'],
    },
    urgency_mix: { type: 'string', enum: ['emergency-heavy', 'mixed', 'scheduled-heavy'] },
    pricing_disclosure_mode: { type: 'string', enum: ['hidden', 'indicative_range', 'per_quote_only'] },
    suburbs_covered: {
      type: 'array',
      minItems: 8,
      items: { type: 'string', minLength: 2 },
    },
    services: {
      type: 'array',
      minItems: 3,
      items: {
        type: 'object',
        required: ['name', 'short'],
        properties: {
          name: { type: 'string', minLength: 3 },
          short: { type: 'string', maxLength: 200 },
          photo_url: { type: 'string', format: 'uri', nullable: true },
        },
      },
    },
    brand_tokens_path: { type: 'string', minLength: 5 }, // path or URL to brand-tokens.css

    // ─── Required + present_or_absent ───────────────────────────────────────
    secondary_segments: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'string',
        enum: ['urgent-repair', 'planned-upgrade', 'commercial-maintenance', 'guided-first-time-buyer'],
      },
    },
    emergency_response_sla_hours: { type: ['number', 'null'], minimum: 0, maximum: 48 },
    emergency_phone: {
      oneOf: [
        { type: 'null' },
        {
          type: 'object',
          required: ['display', 'tel_link'],
          properties: {
            display: { type: 'string' },
            tel_link: { type: 'string', pattern: '^\\+61\\d{9}$' },
          },
        },
      ],
    },
    owner_full_name: { type: ['string', 'null'], minLength: 2 },
    owner_photo_url: { type: ['string', 'null'], format: 'uri' },
    year_founded: { type: ['integer', 'null'], minimum: 1800, maximum: 2026 },
    service_radius_km: { type: ['number', 'null'], minimum: 1, maximum: 500 },
    insurance_amount_aud: { type: ['integer', 'null'], minimum: 100000 },
    entity_review_count: { type: ['integer', 'null'], minimum: 0 }, // For review fallback <5 trigger
    reviews_count_recent: { type: ['integer', 'null'], minimum: 0 }, // reviews in last 90 days

    // ─── Optional (when present, validated; when absent, no error) ─────────
    canonical_url: { type: 'string', format: 'uri' }, // deploy base URL
    service_area_primary_suburb: { type: 'string' }, // anchor suburb for service-area section
    reviews: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'text'],
        properties: {
          name: { type: 'string' },
          suburb: { type: 'string' },
          service: { type: 'string' },
          date: { type: 'string' }, // YYYY-MM or ISO date
          text: { type: 'string' },
          _provenance: { type: 'string', enum: ['REAL', 'AI_PLACEHOLDER'] },
        },
      },
    },
    before_after_pairs: {
      type: 'array',
      items: {
        type: 'object',
        required: ['before', 'after'],
        properties: {
          before: { type: 'string' }, // URL or path
          after: { type: 'string' },
          suburb: { type: 'string' },
          service: { type: 'string' },
          date: { type: 'string' },
          _provenance: { type: 'string', enum: ['REAL', 'STOCK_PLACEHOLDER'] },
        },
      },
    },
    modifier_pre_sale_window_days: { type: ['integer', 'null'], minimum: 1, maximum: 365 },
  },
};

// ─── State ↔ Authority mapping (cross-field) ──────────────────────────────────
const STATE_AUTHORITY = {
  VIC: 'VBA',
  QLD: 'QBCC',
  NSW: 'NSW-FT',
  WA: 'BC-WA',
  SA: 'CBS-SA',
  TAS: 'CBOS-TAS',
  ACT: 'AC-ACT',
  NT: 'NT-WS',
};

// ─── Minimal JSON Schema validator (no AJV dep) ───────────────────────────────
// Implements: required · type · enum · pattern · minLength · maxLength ·
// minimum · maximum · minItems · maxItems · oneOf · properties · items ·
// additionalProperties (true | false) · nullable
function validateSchemaStep(value, schema, pathArr = []) {
  const errors = [];
  const here = pathArr.join('.') || '(root)';

  // Handle oneOf
  if (schema.oneOf) {
    const matches = schema.oneOf.filter((s) => validateSchemaStep(value, s, pathArr).length === 0);
    if (matches.length === 0) {
      errors.push({ path: here, code: 'oneOf', message: 'value matches none of oneOf schemas' });
    }
    return errors;
  }

  // Type check
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actualType = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    if (!types.includes(actualType) && !(types.includes('integer') && actualType === 'number' && Number.isInteger(value))) {
      errors.push({ path: here, code: 'type', message: `expected ${types.join(' | ')} got ${actualType}` });
      return errors; // bail · further checks meaningless
    }
  }
  if (value === null) return errors;

  // Enum
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push({ path: here, code: 'enum', message: `must be one of [${schema.enum.join(', ')}] · got "${value}"` });
  }
  // String constraints
  if (typeof value === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) {
      errors.push({ path: here, code: 'minLength', message: `length ${value.length} < min ${schema.minLength}` });
    }
    if (schema.maxLength != null && value.length > schema.maxLength) {
      errors.push({ path: here, code: 'maxLength', message: `length ${value.length} > max ${schema.maxLength}` });
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push({ path: here, code: 'pattern', message: `does not match /${schema.pattern}/` });
    }
  }
  // Number constraints
  if (typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum) {
      errors.push({ path: here, code: 'minimum', message: `${value} < min ${schema.minimum}` });
    }
    if (schema.maximum != null && value > schema.maximum) {
      errors.push({ path: here, code: 'maximum', message: `${value} > max ${schema.maximum}` });
    }
  }
  // Object
  if (schema.type === 'object' && typeof value === 'object' && !Array.isArray(value)) {
    if (schema.required) {
      for (const k of schema.required) {
        if (!(k in value) || value[k] === undefined) {
          errors.push({ path: `${here}.${k}`, code: 'required', message: `missing required field` });
        }
      }
    }
    if (schema.properties) {
      for (const [k, propSchema] of Object.entries(schema.properties)) {
        if (k in value) {
          errors.push(...validateSchemaStep(value[k], propSchema, [...pathArr, k]));
        }
      }
    }
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties || {}));
      for (const k of Object.keys(value)) {
        if (!allowed.has(k)) {
          errors.push({ path: `${here}.${k}`, code: 'additionalProperties', message: `unknown property` });
        }
      }
    }
  }
  // Array
  if (schema.type === 'array' && Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) {
      errors.push({ path: here, code: 'minItems', message: `length ${value.length} < min ${schema.minItems}` });
    }
    if (schema.maxItems != null && value.length > schema.maxItems) {
      errors.push({ path: here, code: 'maxItems', message: `length ${value.length} > max ${schema.maxItems}` });
    }
    if (schema.items) {
      for (let i = 0; i < value.length; i++) {
        errors.push(...validateSchemaStep(value[i], schema.items, [...pathArr, String(i)]));
      }
    }
  }

  return errors;
}

// ─── Cross-field validator (Codex R16 Q-Y-5) ──────────────────────────────────
export function validateCrossFields(brief) {
  const errors = [];
  const seg = brief.primary_segment;
  const um = brief.urgency_mix;
  const pdm = brief.pricing_disclosure_mode;

  // 1. State ↔ address.state must match (Codex Q-Y-5)
  if (brief.state && brief.address?.state && brief.state !== brief.address.state) {
    errors.push({
      code: 'state_address_mismatch',
      message: `top-level state "${brief.state}" must equal address.state "${brief.address.state}"`,
    });
  }

  // 2. License authority must match state (T1.5 zero-tolerance from SOP)
  if (brief.state && brief.license?.authority) {
    const expected = STATE_AUTHORITY[brief.state];
    if (expected && brief.license.authority !== expected) {
      errors.push({
        code: 'state_authority_mismatch',
        message: `state ${brief.state} requires license.authority "${expected}" · got "${brief.license.authority}"`,
      });
    }
  }

  // 3. mixed-not-allowed is sentinel only · cannot be brief target
  if (seg === 'mixed-not-allowed') {
    errors.push({
      code: 'primary_segment_invalid',
      message: 'mixed-not-allowed is a rejection sentinel · brief must commit to one of 4 buying-intent segments',
    });
  }

  // 4. secondary_segments cannot include primary_segment (Codex Q-Y-5)
  if (Array.isArray(brief.secondary_segments) && brief.secondary_segments.includes(seg)) {
    errors.push({
      code: 'secondary_includes_primary',
      message: `secondary_segments cannot contain primary_segment "${seg}"`,
    });
  }

  // 5. urgency_mix ↔ emergency_response_sla_hours conditional
  if (um === 'emergency-heavy' || um === 'mixed') {
    if (brief.emergency_response_sla_hours == null) {
      errors.push({
        code: 'emergency_sla_required',
        message: `urgency_mix "${um}" requires emergency_response_sla_hours (number) · got null`,
      });
    }
  } else if (um === 'scheduled-heavy' && brief.emergency_response_sla_hours != null) {
    errors.push({
      code: 'emergency_sla_unexpected',
      message: 'urgency_mix "scheduled-heavy" must have emergency_response_sla_hours=null',
      severity: 'warn',
    });
  }

  // 6. primary_segment = guided-first-time-buyer REQUIRES pricing_disclosure_mode = indicative_range
  if (seg === 'guided-first-time-buyer' && pdm !== 'indicative_range') {
    errors.push({
      code: 'first_buyer_requires_indicative_range',
      message: 'primary_segment=guided-first-time-buyer requires pricing_disclosure_mode=indicative_range (SOP §4.4)',
    });
  }

  // 7. primary_segment = commercial-maintenance REQUIRES insurance_amount_aud
  if (seg === 'commercial-maintenance' && brief.insurance_amount_aud == null) {
    errors.push({
      code: 'commercial_requires_insurance_amount',
      message: 'primary_segment=commercial-maintenance requires insurance_amount_aud (number)',
    });
  }

  // 8. license.status = "omit" forbids customer-facing license display · brief must mark
  if (brief.license?.status === 'omit') {
    // No error · informational marker for renderer (suppresses license in trust-bar)
  }

  // 9. emergency_phone (when present) cannot equal main phone (Codex Q-Y-5)
  if (brief.emergency_phone && brief.phone) {
    if (brief.emergency_phone.tel_link === brief.phone.tel_link) {
      errors.push({
        code: 'emergency_phone_duplicate',
        message: 'emergency_phone identical to main phone · should be null or different number',
        severity: 'warn',
      });
    }
  }

  // 10. brand_tokens_path · URL or repo-relative (Codex Q-Y-5)
  if (brief.brand_tokens_path) {
    const p = brief.brand_tokens_path;
    const isUrl = /^https?:\/\//.test(p);
    const isRepoRel = !p.startsWith('/') && (p.startsWith('clients/') || p.startsWith('public/') || p.includes('brand-tokens.css'));
    if (!isUrl && !isRepoRel) {
      errors.push({
        code: 'brand_tokens_path_format',
        message: `brand_tokens_path must be https URL OR repo-relative path · got "${p}"`,
      });
    }
  }

  // 11. service_area_primary_suburb (when present) must be in suburbs_covered
  if (brief.service_area_primary_suburb && Array.isArray(brief.suburbs_covered)) {
    if (!brief.suburbs_covered.includes(brief.service_area_primary_suburb)) {
      errors.push({
        code: 'primary_suburb_not_in_covered',
        message: `service_area_primary_suburb "${brief.service_area_primary_suburb}" not in suburbs_covered[]`,
      });
    }
  }

  // 12. canonical_url (when present) must be https
  if (brief.canonical_url && !/^https:\/\//.test(brief.canonical_url)) {
    errors.push({
      code: 'canonical_url_must_be_https',
      message: `canonical_url must use https:// · got "${brief.canonical_url}"`,
    });
  }

  return errors;
}

// ─── Public validator entry ───────────────────────────────────────────────────
export function validateBrief(brief) {
  const schemaErrors = validateSchemaStep(brief, BRIEF_SCHEMA);
  const crossErrors = validateCrossFields(brief);
  const hardErrors = [...schemaErrors, ...crossErrors.filter((e) => e.severity !== 'warn')];
  const warnings = crossErrors.filter((e) => e.severity === 'warn');
  return {
    valid: hardErrors.length === 0,
    errors: hardErrors,
    warnings,
    summary: {
      schema_errors: schemaErrors.length,
      cross_field_errors: hardErrors.length - schemaErrors.length,
      warnings: warnings.length,
    },
  };
}
