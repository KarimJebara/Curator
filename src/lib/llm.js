// Two backends: the Anthropic SDK (when ANTHROPIC_API_KEY is set, faster +
// has prompt caching) and the `claude -p` CLI (uses the user's Claude
// subscription via OAuth, no API key required). The CLI backend is the
// default — most users have a Max/Pro subscription, far fewer have API keys.

import { spawn } from 'node:child_process';

const MODEL_NAMES = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-7',
};

let sdkClient = null;
const sdk = async () => {
  if (sdkClient) return sdkClient;
  const mod = await import('@anthropic-ai/sdk');
  const Anthropic = mod.default || mod.Anthropic;
  sdkClient = new Anthropic();
  return sdkClient;
};

export const hasApiKey = () => Boolean(process.env.ANTHROPIC_API_KEY);
export const backend = () => (hasApiKey() ? 'sdk' : 'cli');

const completeViaSdk = async ({ which, system, user, cacheable, maxTokens }) => {
  const client = await sdk();
  const content = [];
  if (cacheable) content.push({ type: 'text', text: cacheable, cache_control: { type: 'ephemeral' } });
  content.push({ type: 'text', text: user });
  const res = await client.messages.create({
    model: MODEL_NAMES[which],
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content }],
  });
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { text, usage: res.usage, backend: 'sdk' };
};

// Run `claude -p`. The prompt goes on stdin to avoid shell-escaping issues
// with embedded quotes or newlines. We disable slash commands and session
// persistence so this looks like a clean, stateless API call.
const completeViaCli = ({ which, system, user }) =>
  new Promise((resolve, reject) => {
    const args = [
      '-p',
      '--model', which,
      '--output-format', 'text',
      '--disable-slash-commands',
      '--no-session-persistence',
    ];
    if (system) args.push('--system-prompt', system);
    const child = spawn('claude', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', (err) => {
      if (err.code === 'ENOENT') {
        reject(new Error("`claude` CLI not found. Install Claude Code or set ANTHROPIC_API_KEY to use the SDK backend."));
      } else {
        reject(err);
      }
    });
    child.on('close', (code) => {
      if (code !== 0) {
        const detail = stderr.trim() || stdout.trim() || `exit ${code}`;
        if (/login/i.test(detail)) {
          reject(new Error("`claude` CLI is not logged in. Run `claude` once to authenticate, or set ANTHROPIC_API_KEY."));
        } else {
          reject(new Error(`claude -p failed: ${detail}`));
        }
        return;
      }
      resolve({ text: stdout.trim(), usage: null, backend: 'cli' });
    });
    child.stdin.write(user);
    child.stdin.end();
  });

export const complete = async ({ which = 'haiku', system, user, cacheable, maxTokens = 2048 }) => {
  if (hasApiKey()) {
    return completeViaSdk({ which, system, user, cacheable, maxTokens });
  }
  return completeViaCli({ which, system, user });
};

export const tryParseJson = (text) => {
  const stripped = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const m = stripped.match(/[\[{][\s\S]*[\]}]/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch { return null; }
  }
};
