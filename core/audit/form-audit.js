/**
 * Form audit — for each <form> on the site:
 *   - field count + types + required-ness
 *   - captcha / anti-spam detection (reCAPTCHA v2/v3, hCaptcha, Turnstile, honeypot)
 *   - submit button presence + label
 *   - validation UX heuristics (HTML5 required, pattern attrs)
 *   - audit-only: we DO NOT submit — we describe what would happen
 *
 * Tier T0 — runs on the Playwright page already opened by siteFetchFull.
 * No extra fetch.
 *
 * Sales angles this surfaces:
 *   - 7+ field forms tank conversion (industry standard 3-4)
 *   - reCAPTCHA v2 ("click I'm not a robot") adds friction; v3 invisible is better
 *   - Honeypot present = good (modern anti-spam without UX cost)
 *   - No captcha = spam risk; no submit button = broken form
 */

const CAPTCHA_PATTERNS = [
  { id: 'recaptcha_v2', name: 'reCAPTCHA v2 (visible "I\'m not a robot")', regex: /(g-recaptcha|recaptcha\/api\.js|recaptcha-checkbox)/i, friction: 'high' },
  { id: 'recaptcha_v3', name: 'reCAPTCHA v3 (invisible)', regex: /grecaptcha\.execute|recaptcha\/api\.js\?render=/i, friction: 'low' },
  { id: 'hcaptcha', name: 'hCaptcha', regex: /(hcaptcha\.com|h-captcha)/i, friction: 'high' },
  { id: 'turnstile', name: 'Cloudflare Turnstile', regex: /(challenges\.cloudflare\.com\/turnstile|cf-turnstile)/i, friction: 'low' },
  { id: 'akismet', name: 'Akismet (WordPress comment spam)', regex: /akismet/i, friction: 'invisible' },
];

export async function auditFormsOnPage({ page } = {}) {
  if (!page) return { ok: false, reason: 'page required', forms: [] };

  const html = await page.content().catch(() => '');
  const captchas = CAPTCHA_PATTERNS.filter((c) => c.regex.test(html));

  const forms = await page.evaluate(() => {
    const result = [];
    const allForms = Array.from(document.querySelectorAll('form'));
    for (const f of allForms) {
      const inputs = Array.from(f.querySelectorAll('input, textarea, select'))
        .filter((el) => {
          const t = (el.type || '').toLowerCase();
          return t !== 'hidden' && t !== 'submit' && t !== 'button';
        });

      const inputDetails = inputs.map((el) => ({
        tag: el.tagName.toLowerCase(),
        type: (el.type || '').toLowerCase(),
        name: el.name || el.id || '(unnamed)',
        required: el.required || el.hasAttribute('required') || /required/i.test(el.getAttribute('aria-required') || ''),
        placeholder: el.placeholder || null,
        pattern: el.pattern || null,
        autocomplete: el.autocomplete || null,
        labelText: (() => {
          if (el.id) {
            const lbl = document.querySelector(`label[for="${el.id}"]`);
            if (lbl) return lbl.textContent?.trim().slice(0, 60);
          }
          return el.closest('label')?.textContent?.trim().slice(0, 60) || null;
        })(),
      }));

      // Honeypot detection — common pattern: hidden field that humans won't fill
      const hiddenFields = Array.from(f.querySelectorAll('input[type="hidden"], input[style*="display:none"], input[style*="display: none"]'));
      const honeypotCandidates = hiddenFields.filter((h) => {
        const n = (h.name || '').toLowerCase();
        const c = (h.className || '').toLowerCase();
        return /honeypot|gotcha|trap|bot|spam_check|(?:^|_)hp(?:_|$)|website_url/.test(n + ' ' + c);
      });

      // Submit button
      const submitBtn = f.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
      const submitLabel = submitBtn ? (submitBtn.textContent?.trim() || submitBtn.value || '(unlabelled)') : null;

      // Action URL
      const action = f.action || null;
      const method = (f.method || 'get').toLowerCase();

      result.push({
        action,
        method,
        field_count: inputs.length,
        inputs: inputDetails,
        required_count: inputDetails.filter((i) => i.required).length,
        has_email_field: inputDetails.some((i) => i.type === 'email' || /email|e-mail|邮箱/i.test(i.name + i.labelText)),
        has_phone_field: inputDetails.some((i) => i.type === 'tel' || /phone|tel|mobile|电话/i.test(i.name + i.labelText)),
        has_message_field: inputDetails.some((i) => i.tag === 'textarea' || /message|comment|enquiry|enquiries|留言/i.test(i.name + i.labelText)),
        has_submit_button: Boolean(submitBtn),
        submit_label: submitLabel,
        honeypot_present: honeypotCandidates.length > 0,
      });
    }
    return result;
  }).catch(() => []);

  // Classify each form
  const classified = forms.map((f) => {
    const looksLikeContact = (f.has_email_field || f.has_phone_field) && f.has_submit_button;
    const looksLikeSearch = f.field_count <= 1 && /search/i.test(f.action || '');
    const looksLikeNewsletter = f.field_count <= 2 && f.has_email_field && !f.has_message_field;
    let role = 'unknown';
    if (looksLikeSearch) role = 'search';
    else if (looksLikeNewsletter) role = 'newsletter';
    else if (looksLikeContact) role = 'contact';
    else if (f.field_count === 0) role = 'empty';

    // Friction assessment
    let frictionLevel = 'unknown';
    if (role === 'contact') {
      if (f.field_count <= 4) frictionLevel = 'low';
      else if (f.field_count <= 6) frictionLevel = 'moderate';
      else frictionLevel = 'high';  // 7+ fields
    }

    return { ...f, role, friction_level: frictionLevel };
  });

  const contactForms = classified.filter((f) => f.role === 'contact');

  return {
    ok: true,
    form_count_total: classified.length,
    contact_form_count: contactForms.length,
    forms: classified,
    captchas_detected: captchas.map((c) => ({ id: c.id, name: c.name, friction: c.friction })),
    has_any_captcha: captchas.length > 0,
    has_any_anti_spam: captchas.length > 0 || classified.some((f) => f.honeypot_present),
    auditor_notes: buildAuditorNotes(classified, captchas),
  };
}

function buildAuditorNotes(forms, captchas) {
  const notes = [];
  const contact = forms.filter((f) => f.role === 'contact');
  if (!contact.length) {
    notes.push({ severity: 'high', text: '未发现联系/报价表单 — 客户只能通过电话或邮件触达，转化路径单一' });
  } else {
    for (const f of contact) {
      if (f.field_count >= 7) notes.push({ severity: 'high', text: `表单字段数 ${f.field_count} — 远超行业标准 3-4 字段，会显著降低转化率` });
      if (!f.has_phone_field && f.role === 'contact') notes.push({ severity: 'medium', text: '联系表单没有电话字段 — 跟进客户时缺关键信息' });
      if (!f.has_message_field && f.field_count > 2) notes.push({ severity: 'low', text: '表单缺少 message/enquiry 文本框 — 客户没法描述具体需求，回复时增加来回沟通' });
    }
  }
  if (!captchas.length && !forms.some((f) => f.honeypot_present)) {
    notes.push({ severity: 'medium', text: '表单未检测到任何 anti-spam 措施（reCAPTCHA / hCaptcha / Turnstile / honeypot 都没有）— 高 spam 风险' });
  }
  for (const cap of captchas) {
    if (cap.friction === 'high') {
      notes.push({ severity: 'low', text: `${cap.name} — 给真人增加额外操作（点击"我不是机器人"），轻微降低转化；redesign 可改用 v3/Turnstile 等 invisible 方案` });
    }
  }
  return notes;
}
