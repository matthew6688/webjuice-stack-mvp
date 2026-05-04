export class TallyApiClient {
  constructor({
    apiKey = process.env.TALLY_API_KEY,
    fetchImpl = globalThis.fetch,
    baseUrl = 'https://api.tally.so',
  } = {}) {
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async createForm(payload) {
    return this.request('/forms', {
      method: 'POST',
      body: payload,
      expectedStatus: 201,
    });
  }

  async createWebhook(payload) {
    return this.request('/webhooks', {
      method: 'POST',
      body: payload,
      expectedStatus: 201,
    });
  }

  async request(path, { method = 'GET', body, expectedStatus = 200 } = {}) {
    this.requireApiKey();
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    const data = text ? parseJson(text) : null;
    if (response.status !== expectedStatus) {
      const message = data?.message || data?.error || text || 'unknown error';
      throw new Error(`Tally API ${method} ${path} failed: HTTP ${response.status} ${message}`);
    }
    return data;
  }

  requireApiKey() {
    if (!this.apiKey) throw new Error('TALLY_API_KEY is required for live Tally API calls');
  }
}

export function buildTallyWebhookPayload({ formId, url, signingSecret = '', externalSubscriber = 'webjuice' }) {
  if (!formId) throw new Error('formId is required');
  if (!url) throw new Error('webhook url is required');
  return {
    formId,
    url,
    eventTypes: ['FORM_RESPONSE'],
    signingSecret: signingSecret || null,
    externalSubscriber,
  };
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}
