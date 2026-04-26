// Approximate token cost of popular MCP servers. The numbers are
// order-of-magnitude estimates of the JSON schema each server publishes
// in its tools list — not measured live. Real cost varies with the server
// version. Treat as "rough but useful" rather than "authoritative."
//
// Method: counted tool definitions × ~300–500 tokens per tool (typical
// schema + description + parameters), plus ~200 baseline overhead. We
// publish round numbers to make the approximation honest.
//
// Lookup keys are matched in this order:
//   1. exact server name (e.g. "playwright")
//   2. command basename (e.g. "npx" + "@playwright/mcp")
//   3. URL hostname for remote servers
//
// If you spot one that's significantly off for your setup, please open a
// PR with a corrected number and the rationale.

export const KNOWN_MCP_TOKENS = {
  // Heavy hitters (10+ tools each)
  'playwright': 7500,
  '@playwright/mcp': 7500,
  'filesystem': 5000,
  'github': 6000,
  'supabase': 5500,
  'token-optimizer': 9000,

  // Medium (5–10 tools)
  'browserbase': 3500,
  'browser-use': 3500,
  'firecrawl': 3500,
  'fal-ai': 2800,
  'railway': 3000,
  'stitch': 2800,

  // Cloud / Google / Anthropic-hosted
  'claude_ai_Gmail': 3200,
  'claude_ai_Google_Calendar': 1500,
  'claude_ai_Google_Drive': 1500,
  'cloudflare-docs': 800,
  'cloudflare-observability': 2000,
  'cloudflare-workers-bindings': 2200,
  'cloudflare-workers-builds': 2000,
  'vercel': 2000,
  'clickhouse': 1800,

  // Search / research
  'exa-web-search': 2400,
  'exa': 2400,
  'context7': 800,
  'magic': 1800,

  // Light (1–3 tools)
  'memory': 1500,
  'sequential-thinking': 500,
  'nutrient-document-processing': 1800,
  'videodb': 2000,
};

const guessFromCommand = (cmd, args = []) => {
  if (!cmd) return null;
  const all = (cmd + ' ' + args.join(' ')).toLowerCase();
  for (const key of Object.keys(KNOWN_MCP_TOKENS)) {
    if (all.includes(key.toLowerCase())) return KNOWN_MCP_TOKENS[key];
  }
  return null;
};

const guessFromUrl = (url) => {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    for (const key of Object.keys(KNOWN_MCP_TOKENS)) {
      if (host.includes(key.toLowerCase())) return KNOWN_MCP_TOKENS[key];
    }
  } catch { /* ignore */ }
  return null;
};

export const lookupMcpTokens = (server) => {
  if (KNOWN_MCP_TOKENS[server.name]) return KNOWN_MCP_TOKENS[server.name];
  return guessFromCommand(server.command, server.args) ?? guessFromUrl(server.url) ?? null;
};
