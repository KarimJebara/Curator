import { pairwiseSimilarity } from '../detectors/cluster.js';

// Render a complete audit report. Output is markdown with checkbox-driven
// decision cards — the user hand-edits which boxes to check, then runs
// `curator review --apply` which re-reads the file.
export const renderReport = ({ skills, clusters, topics = [], mcpServers, mcpDups, orphans, drifted, proposals = {} }) => {
  const lines = [];
  const date = new Date().toISOString().slice(0, 10);
  lines.push(`# curator audit — ${date}`);
  lines.push('');
  lines.push(summary({ skills, clusters, topics, mcpServers, mcpDups, orphans, drifted }));
  lines.push('');

  if (clusters.length) {
    lines.push('## Skill clusters');
    lines.push('');
    lines.push('Each cluster is a group of *overlapping* skills (the AI picks ONE at runtime). Review each one and check the actions you want curator to apply.');
    lines.push('');
    for (const c of clusters) {
      lines.push(...clusterCard(c, proposals[c.id]));
      lines.push('');
    }
  }

  if (topics.length) {
    lines.push('## Topics');
    lines.push('');
    lines.push('Each topic is a tag-based grouping for *human browsing* (not the AI pickup loop). A skill can belong to multiple topics. Each topic can become a `/tag-name` browser router that lists all members.');
    lines.push('');
    for (const t of topics) {
      lines.push(...topicCard(t));
      lines.push('');
    }
  }

  if (mcpDups.length) {
    lines.push('## Duplicate MCP servers');
    lines.push('');
    for (const dup of mcpDups) {
      lines.push(`### ${dup[0].command} — ${dup.length} configurations`);
      for (const s of dup) {
        lines.push(`- [ ] Remove \`${s.name}\` (scope: ${s.scope}, ~${s.tokens || '?'} tokens)`);
      }
      lines.push('');
    }
  }

  if (drifted.length) {
    lines.push('## Skills with version-drift suffixes');
    lines.push('');
    lines.push('These names suggest old copies that survived a re-import.');
    lines.push('');
    for (const s of drifted) {
      lines.push(`- [ ] Delete \`${s.name}\` (~${s.tokens} tokens)`);
    }
    lines.push('');
  }

  if (orphans.length) {
    lines.push('## Orphan files');
    lines.push('');
    for (const f of orphans) lines.push(`- [ ] Delete \`${f}\``);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('When done, run `curator review --apply` to apply checked items. A backup is taken before every change.');
  return lines.join('\n');
};

const summary = ({ skills, clusters, topics = [], mcpServers, mcpDups, orphans, drifted }) => {
  const totalSkillTokens = skills.reduce((a, s) => a + s.tokens, 0);
  const totalMcpTokens = mcpServers.reduce((a, s) => a + (s.tokens || 0), 0);
  const inClusters = clusters.reduce((a, c) => a + c.members.length, 0);
  return [
    '## Summary',
    '',
    `- ${skills.length} skills (~${totalSkillTokens} tokens)`,
    `- ${mcpServers.length} MCP servers (~${totalMcpTokens} tokens)`,
    `- ${clusters.length} overlapping clusters covering ${inClusters} skills`,
    `- ${topics.length} topics (tag-based browsing groups)`,
    `- ${mcpDups.length} duplicate MCP groups`,
    `- ${drifted.length} skills with version-drift suffixes`,
    `- ${orphans.length} orphan memory files`,
  ].join('\n');
};

const confidenceBadge = (c) => {
  if (c === 'high') return '🟢 high confidence';
  if (c === 'medium') return '🟡 medium confidence';
  if (c === 'low') return '🔴 low confidence — manual review recommended';
  return '';
};

const clusterCard = (cluster, proposal) => {
  const lines = [];
  const confLine = cluster.confidence ? ` — ${confidenceBadge(cluster.confidence)}` : '';
  lines.push(`### Cluster: \`${cluster.label}\` (${cluster.members.length} skills, ~${cluster.totalTokens} tokens)${confLine}`);
  lines.push('');
  const silText = typeof cluster.silhouette === 'number' ? `, silhouette ${cluster.silhouette.toFixed(2)}` : '';
  lines.push(`Mean similarity within cluster: ${(cluster.meanSimilarity * 100).toFixed(0)}%${silText}`);
  lines.push('');
  lines.push('**Members:**');
  for (const m of cluster.members) {
    const desc = m.description.length > 100 ? m.description.slice(0, 100) + '…' : m.description;
    lines.push(`- \`${m.name}\` (~${m.tokens} tokens, grade ${m.grade}) — ${desc}`);
  }
  lines.push('');

  if (proposal) {
    lines.push('**Proposed actions:**');
    for (const action of proposal.actions) {
      lines.push(formatAction(action));
    }
    if (proposal.router) {
      lines.push(`- [ ] Generate router skill \`${proposal.router.name}\` that dispatches to the specialists above`);
    }
    if (proposal.notes?.length) {
      lines.push('');
      lines.push('**Notes from the verifier:**');
      for (const n of proposal.notes) lines.push(`> ${n}`);
    }
  } else {
    lines.push('**Proposed actions:** _LLM pipeline not run (use `curator scan` without `--no-llm`; needs `claude` CLI logged in or ANTHROPIC_API_KEY)._');
    lines.push('');
    lines.push('Pairwise similarity:');
    lines.push('');
    lines.push(similarityTable(cluster.members));
  }
  return lines;
};

const formatAction = (action) => {
  switch (action.type) {
    case 'specialize':
      return `- [ ] Specialize \`${action.from}\` → \`${action.to}\` (${action.reason})`;
    case 'rewrite': {
      const tail = action.tokensSaved ? `${action.tokensSaved} tokens saved` : (action.reason || 'tighten description');
      return `- [ ] Rewrite \`${action.name}\` description (${tail})`;
    }
    case 'delete':
      return `- [ ] Delete \`${action.name}\` (${action.reason})`;
    case 'keep':
      return `- [x] Keep \`${action.name}\` as-is`;
    default:
      return `- [ ] ${action.type}: ${JSON.stringify(action)}`;
  }
};

const topicCard = (topic) => {
  const lines = [];
  lines.push(`### Topic: \`${topic.tag}\` (${topic.members.length} skills, ~${topic.totalTokens} tokens)`);
  lines.push('');
  lines.push('**Members:**');
  for (const m of topic.members) {
    const desc = (m.description || '').slice(0, 80);
    lines.push(`- \`${m.name}\` — ${desc}${desc.length === 80 ? '…' : ''}`);
  }
  lines.push('');
  lines.push(`**Proposed action:**`);
  lines.push(`- [ ] Generate browser router skill \`${topic.tag}\` (lists all ${topic.members.length} members; users can pick one or be auto-routed)`);
  return lines;
};

const similarityTable = (members) => {
  const matrix = pairwiseSimilarity(members);
  const names = members.map((m) => m.name);
  const lines = ['| | ' + names.map((n) => `\`${n}\``).join(' | ') + ' |'];
  lines.push('|---|' + names.map(() => '---').join('|') + '|');
  for (let i = 0; i < names.length; i++) {
    const row = [`\`${names[i]}\``];
    for (let j = 0; j < names.length; j++) {
      row.push(i === j ? '—' : `${(matrix[i][j] * 100).toFixed(0)}%`);
    }
    lines.push('| ' + row.join(' | ') + ' |');
  }
  return lines.join('\n');
};
