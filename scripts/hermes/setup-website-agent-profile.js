#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const args = parseArgs(process.argv.slice(2));
const channelId = args.channel || args['channel-id'] || 'WEBSITE_TASKS_CHANNEL_ID';
const profileName = args.profile || 'website-agent';
const hermesRoot = args['hermes-root'] || path.join(process.env.HOME || '', '.hermes');
const profileDir = path.join(hermesRoot, 'profiles', profileName);
const sourceProfile = args['source-profile'] || 'enricher';
const sourceDir = path.join(hermesRoot, 'profiles', sourceProfile);
const cloneAuth = args['clone-auth'] === true || args['clone-auth'] === 'true';

if (!fs.existsSync(sourceDir)) {
  throw new Error(`Source profile does not exist: ${sourceDir}`);
}

fs.mkdirSync(profileDir, { recursive: true });
fs.mkdirSync(path.join(profileDir, 'logs'), { recursive: true });
fs.mkdirSync(path.join(profileDir, 'sessions'), { recursive: true });

if (cloneAuth) copyIfMissing(path.join(sourceDir, 'auth.json'), path.join(profileDir, 'auth.json'));
writeEnvTemplate(path.join(profileDir, '.env'));

fs.writeFileSync(path.join(profileDir, 'SOUL.md'), `${buildSoul()}\n`);
fs.writeFileSync(path.join(profileDir, 'config.yaml'), `${buildConfig(channelId)}\n`);
fs.mkdirSync(path.dirname(launchAgentPath(profileName)), { recursive: true });
fs.writeFileSync(
  launchAgentPath(profileName),
  buildLaunchAgent({ profileName, profileDir }),
);

console.log(`Prepared Hermes profile: ${profileDir}`);
console.log(`LaunchAgent: ${launchAgentPath(profileName)}`);
console.log(`Channel: ${channelId}`);
console.log('Next: set a dedicated DISCORD_BOT_TOKEN in the profile .env, add model auth if needed, then bootstrap the LaunchAgent.');

function copyIfMissing(from, to) {
  if (fs.existsSync(to)) return;
  if (fs.existsSync(from)) fs.copyFileSync(from, to);
}

function writeEnvTemplate(filePath) {
  if (fs.existsSync(filePath)) return;
  fs.writeFileSync(filePath, [
    '# ProfitsLocal Website Agent',
    '# Use a dedicated Discord bot token. Do not reuse a token used by another running Hermes profile.',
    'DISCORD_BOT_TOKEN=',
    'DISCORD_ALLOWED_USERS=',
    `DISCORD_HOME_CHANNEL=${channelId}`,
    '',
    '# Optional provider keys, if this profile does not use cloned auth.',
    'KIMI_API_KEY=',
    'KIMI_BASE_URL=https://api.kimi.com/coding/v1',
    'LLM_MODEL=kimi-for-coding',
    'ANTHROPIC_API_KEY=',
    'ANTHROPIC_BASE_URL=https://api.anthropic.com',
    '',
  ].join('\n'));
  fs.chmodSync(filePath, 0o600);
}

function buildConfig(id) {
  return [
    'model:',
    '  provider: kimi-coding',
    '  default: kimi-for-coding',
    'providers: {}',
    'fallback_providers:',
    '- provider: openai-codex',
    '  model: gpt-5.4',
    '- provider: openai-codex',
    '  model: gpt-5.4-mini',
    'credential_pool_strategies:',
    '  openai-codex: round_robin',
    'toolsets:',
    '- hermes-cli',
    'agent:',
    '  max_turns: 120',
    '  gateway_timeout: 2400',
    '  restart_drain_timeout: 60',
    '  tool_use_enforcement: auto',
    'terminal:',
    '  backend: local',
    '  cwd: /Users/matthew/Developer/google-map-website',
    '  timeout: 180',
    '  persistent_shell: true',
    'browser:',
    '  inactivity_timeout: 120',
    '  command_timeout: 30',
    '  record_sessions: false',
    '  allow_private_urls: false',
    'checkpoints:',
    '  enabled: true',
    '  max_snapshots: 50',
    'file_read_max_chars: 120000',
    'context:',
    '  engine: compressor',
    'memory:',
    '  memory_enabled: true',
    '  user_profile_enabled: false',
    '  memory_char_limit: 4000',
    '  user_char_limit: 1375',
    'discord:',
    '  require_mention: true',
    '  free_response_channels:',
    `  - '${id}'`,
    "  - '1493926255492595732'",
    '  allowed_channels: ""',
    '  no_thread_channels:',
    "  - '1493926255492595732'",
    '  ignored_channels:',
    "  - '1493926218574200942'",
    '  auto_thread: true',
    '  reactions: true',
    '  group_sessions_per_user: false',
    'approvals:',
    '  mode: manual',
    '  timeout: 60',
    'command_allowlist:',
    '- shell command via -c/-lc flag',
    'security:',
    '  redact_secrets: true',
    '  tirith_enabled: true',
    '  tirith_path: tirith',
    '  tirith_timeout: 5',
    '  tirith_fail_open: true',
    'logging:',
    '  level: INFO',
  ].join('\n');
}

function buildSoul() {
  return `# ProfitsLocal Website Agent

You are the ProfitsLocal Website Agent. Your only job is restaurant website and mobile menu delivery for ProfitsLocal customers.

Core mission:
- maintain one durable workstream per paid order or revision thread;
- read case memory before action;
- update client website/menu work on dev first;
- get customer review and approval before live publish;
- keep customer emails and Discord thread updates aligned.

Source of truth:
- case memory: data/cases/<client>/<order>/case.json
- context packet: data/cases/<client>/<order>/context-packet.json
- timeline: data/cases/<client>/<order>/timeline.jsonl
- customer messages: data/cases/<client>/<order>/customer-messages.jsonl
- task: data/agent-tasks/<client>/<task>.json
- evidence/content/design: clients/<client>/

Rules:
- Website and mobile menu are different products. Do not mix their information architecture.
- Website work must look like a real formal restaurant website with brand hierarchy.
- Menu work must stay minimal, mobile-first, and focused on core menu/contact actions.
- Do not invent menu items, prices, address, phone, hours, emails, reservation links, or photos.
- Use verified evidence and brand files before changing customer-facing content.
- Use Huashu Design/open-design protocol for visual website changes.
- Push implementation changes only to dev until explicit approval.
- Publish live only after order ID and checkout email match.
- If evidence conflicts with customer feedback, write the conflict clearly and ask for human decision.

Useful commands:
- npm run case:context -- --case <case.json>
- npm run agent:complete-task -- --task <task.json> --repo-dir <client repo> --execute true --checkout true --push true --check-deploy true --send-email true --send-discord true
- npm run agent:publish-approved -- --task <task.json> --repo-dir <client repo> --execute true --push true --check-deploy true --send-email true --send-discord true
- npm run check:links -- --all clients --internal-links false
- npm run finance:report -- --campaign brisbane-restaurants

Default response language: Chinese for internal team discussion. Use concise operational updates.`;
}

function buildLaunchAgent({ profileName, profileDir }) {
  const python = '/Users/matthew/Developer/Hermes Agent/venv/bin/python';
  const cwd = '/Users/matthew/Developer/Hermes Agent';
  const label = `ai.hermes.gateway-${profileName}`;
  const pathValue = [
    '/Users/matthew/Developer/Hermes Agent/venv/bin',
    '/Users/matthew/Developer/Hermes Agent/node_modules/.bin',
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
    '/Users/matthew/.local/bin',
    '/Users/matthew/.npm-global/bin',
    '/Users/matthew/.bun/bin',
    '/Users/matthew/.cargo/bin',
  ].join(':');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${label}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${python}</string>
        <string>-m</string>
        <string>hermes_cli.main</string>
        <string>--profile</string>
        <string>${profileName}</string>
        <string>gateway</string>
        <string>run</string>
        <string>--replace</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${cwd}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>${pathValue}</string>
        <key>VIRTUAL_ENV</key>
        <string>/Users/matthew/Developer/Hermes Agent/venv</string>
        <key>HERMES_HOME</key>
        <string>${profileDir}</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>
    <key>StandardOutPath</key>
    <string>${profileDir}/logs/gateway.log</string>
    <key>StandardErrorPath</key>
    <string>${profileDir}/logs/gateway.error.log</string>
</dict>
</plist>
`;
}

function launchAgentPath(profile) {
  return path.join(process.env.HOME || '', 'Library', 'LaunchAgents', `ai.hermes.gateway-${profile}.plist`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}
