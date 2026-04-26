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

  'estimateMcpTokens has a 200-token floor': () => {
    const tokens = estimateMcpTokens({ command: 'x', args: [] });
    assert.ok(tokens >= 200);
  },
};
