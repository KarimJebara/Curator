import fs from 'node:fs';
import { claudeJsonPath } from '../lib/paths.js';
import { estimateTokens, grade } from '../lib/tokens.js';
import { lookupMcpTokens } from '../lib/mcp-known-servers.js';

const safeJson = (p) => {
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
};

// Returns [{ name, scope, command, args, env, source }]
export const collectMcpServers = ({ projectMcpPath } = {}) => {
  const out = [];
  const cj = safeJson(claudeJsonPath());
  if (cj?.mcpServers) {
    for (const [name, cfg] of Object.entries(cj.mcpServers)) {
      out.push({ name, scope: 'global', source: claudeJsonPath(), ...cfg });
    }
  }
  if (cj?.projects) {
    for (const [projectPath, projectCfg] of Object.entries(cj.projects)) {
      if (!projectCfg.mcpServers) continue;
      for (const [name, cfg] of Object.entries(projectCfg.mcpServers)) {
        out.push({
          name,
          scope: `project:${projectPath}`,
          source: claudeJsonPath(),
          ...cfg,
        });
      }
    }
  }
  if (projectMcpPath) {
    const proj = safeJson(projectMcpPath);
    if (proj?.mcpServers) {
      for (const [name, cfg] of Object.entries(proj.mcpServers)) {
        out.push({ name, scope: 'project-local', source: projectMcpPath, ...cfg });
      }
    }
  }
  return out;
};

// Estimate token cost of an MCP server. Two-step:
//   1. Look up the server in a curated table of popular MCPs (tools-list
//      schemas are predictable for known servers — table values are
//      order-of-magnitude estimates, not measured live).
//   2. If unknown, fall back to a config-envelope estimate. This badly
//      under-counts servers with rich tool schemas, but it's better than
//      nothing for ones we haven't catalogued yet.
//
// Each result carries a `source` flag so the UI can show "approx." when
// the number is from the table vs "guess" when it's the envelope estimate.
export const estimateMcpTokens = (server) => {
  const known = lookupMcpTokens(server);
  if (known) return { tokens: known, source: 'known' };
  const envelope = JSON.stringify({
    command: server.command,
    args: server.args,
    env: Object.keys(server.env || {}),
  });
  // Floor at 200 tokens for any connected server (handshake overhead).
  return { tokens: Math.max(200, estimateTokens(envelope) * 4), source: 'envelope' };
};

export const mcpDuplicates = (servers) => {
  // Group by purpose-fingerprint: command + first non-flag arg. URL-based
  // remote servers (no command, no args) have no meaningful fingerprint and
  // are excluded — they can't be duplicates of each other on this signal.
  const groups = new Map();
  for (const s of servers) {
    if (!s.command) continue;
    const cmdArg = (s.args || []).find((a) => !a.startsWith('-'));
    if (!cmdArg) continue;
    const key = `${s.command}::${cmdArg}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  return [...groups.values()].filter((g) => g.length > 1);
};

export const mcpDigest = (servers) => {
  return servers.map((s) => {
    const { tokens, source } = estimateMcpTokens(s);
    return { ...s, tokens, tokensSource: source, grade: grade(tokens) };
  });
};
