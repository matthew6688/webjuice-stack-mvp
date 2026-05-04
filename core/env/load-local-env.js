import fs from 'fs';
import path from 'path';

export function loadLocalEnv({ files = ['.env.local', '.env'], override = false } = {}) {
  for (const file of files) {
    const envPath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(envPath)) continue;

    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;

      const [, key, rawValue] = match;
      if (!override && process.env[key] !== undefined) continue;
      process.env[key] = unquote(rawValue.trim());
    }
  }
}

function unquote(value) {
  if (value.length < 2) return value;
  const quote = value[0];
  if ((quote !== '"' && quote !== "'") || value[value.length - 1] !== quote) return value;
  const inner = value.slice(1, -1);
  return quote === '"' ? inner.replace(/\\n/g, '\n').replace(/\\"/g, '"') : inner;
}
