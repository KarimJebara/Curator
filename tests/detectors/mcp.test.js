import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { collectMcpServers, mcpDuplicates, estimateMcpTokens } from '../../src/detectors/mcp.js';

const tmpProjectMcp = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'curator-test-'));
  const file = path.join(dir, '.mcp.json');
  fs.writeFileSync(file, JSON.stringify({
    mcpServers: {
      'context7': { command: 'npx', args: ['-y', '@upstash/context7-mcp@latest'] },
      'context7-dup': { command: 'npx', args: ['-y', '@upstash/context7-mcp@latest'] },
      'unique-server': { command: 'npx', args: ['-y', 'some-other-server'] },
    },
  }));
  return { dir, file };
};

export const tests = {
  'collectMcpServers reads project mcp config': () => {
    const { file } = tmpProjectMcp();
    const servers = collectMcpServers({ projectMcpPath: file });
    const projectScoped = servers.filter((s) => s.scope === 'project-local');
    assert.equal(projectScoped.length, 3);
  },

  'mcpDuplicates groups by command + first arg': () => {
    const { file } = tmpProjectMcp();
    const servers = collectMcpServers({ projectMcpPath: file })
      .filter((s) => s.scope === 'project-local');
    const dups = mcpDuplicates(servers);
    assert.equal(dups.length, 1);
    assert.equal(dups[0].length, 2);
  },

  'estimateMcpTokens envelope path has a 200-token floor': () => {
    const r = estimateMcpTokens({ command: 'x', args: [] });
    assert.ok(r.tokens >= 200);
    assert.equal(r.source, 'envelope');
  },

  'estimateMcpTokens uses the known-server table when the name matches': () => {
    const r = estimateMcpTokens({ name: 'playwright', command: 'npx', args: ['@playwright/mcp'] });
    assert.equal(r.source, 'known');
    assert.ok(r.tokens > 1000, `expected playwright to be > 1000 tok, got ${r.tokens}`);
  },

  'estimateMcpTokens table lookup also matches by command/args substring': () => {
    const r = estimateMcpTokens({ name: 'whatever', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'] });
    assert.equal(r.source, 'known');
    assert.ok(r.tokens >= 5000, `expected filesystem to be heavy, got ${r.tokens}`);
  },
};
