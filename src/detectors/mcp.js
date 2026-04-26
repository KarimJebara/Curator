import fs from 'node:fs';
import { claudeJsonPath } from '../lib/paths.js';
import { estimateTokens, grade } from '../lib/tokens.js';

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

// Estimate token cost of an MCP server. Without live tool-listing, we
// approximate from the config envelope. Real cost requires probing the server
// for its tool schemas; that's a Phase 2 enhancement.
export const estimateMcpTokens = (server) => {
  const envelope = JSON.stringify({
    command: server.command,
    args: server.args,
    env: Object.keys(server.env || {}),
  });
  // Conservative floor: 200 tokens for any connected server (handshake overhead).
  return Math.max(200, estimateTokens(envelope) * 4);
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
    const tokens = estimateMcpTokens(s);
    return { ...s, tokens, grade: grade(tokens) };
  });
};
